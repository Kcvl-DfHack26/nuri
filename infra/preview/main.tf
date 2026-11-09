terraform {
  required_version = "~> 1.13.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.10"
    }
  }
  backend "gcs" {
    bucket = "kcvlb4-tofu-state"
    prefix = "nuri/preview"
  }
}

variable "project_id" {
  description = "ID of the GCP project hosting nuri preview resources."
  type        = string
  nullable    = false
  validation {
    condition     = var.project_id == "kcvlb4"
    error_message = "nuri PR previews use the existing kcvlb4 project."
  }
}

locals {
  project    = var.project_id
  region     = "asia-northeast1"
  name       = "nuri-preview"
  repository = "Kcvl-DfHack26/nuri"
  repo_id    = "1447386190"
  identities = {
    "preview"        = { suffix = "publisher", purpose = "publisher" }
    "preview-create" = { suffix = "creator", purpose = "service creator" }
  }
}

provider "google" {
  project = local.project
  region  = local.region
}

resource "google_project_service" "preview" {
  for_each = toset([
    "artifactregistry.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "run.googleapis.com",
    "storage.googleapis.com",
    "sts.googleapis.com",
  ])
  service            = each.key
  disable_on_destroy = false
}

resource "google_service_account" "runtime" {
  account_id   = "${local.name}-runtime"
  display_name = "nuri disposable PR preview runtime"
  depends_on   = [google_project_service.preview]
}

resource "google_service_account" "automation" {
  for_each     = local.identities
  account_id   = "${local.name}-${each.value.suffix}"
  display_name = "GitHub Actions PR preview ${each.value.purpose}"
  depends_on   = [google_project_service.preview]
}

resource "google_iam_workload_identity_pool" "preview" {
  workload_identity_pool_id = "${local.name}-github"
  depends_on                = [google_project_service.preview]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.preview.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  attribute_mapping = {
    "google.subject"               = "assertion.sub"
    "attribute.github_environment" = "assertion.environment"
  }
  attribute_condition = "assertion.repository_id == '${local.repo_id}' && assertion.repository == '${local.repository}' && assertion.ref == 'refs/heads/main' && assertion.environment in ['preview', 'preview-create'] && assertion.workflow_ref == '${local.repository}/.github/workflows/preview.yml@refs/heads/main'"
  oidc { issuer_uri = "https://token.actions.githubusercontent.com" }
}

resource "google_service_account_iam_member" "federation" {
  for_each           = google_service_account.automation
  service_account_id = each.value.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.preview.name}/attribute.github_environment/${each.key}"
}

resource "google_service_account_iam_member" "act_as_runtime" {
  for_each           = google_service_account.automation
  service_account_id = google_service_account.runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${each.value.email}"
}

resource "google_artifact_registry_repository" "preview" {
  repository_id          = local.name
  location               = local.region
  format                 = "DOCKER"
  cleanup_policy_dry_run = false
  depends_on             = [google_project_service.preview]
  cleanup_policies {
    id     = "expire-preview-images"
    action = "DELETE"
    condition {
      tag_state  = "ANY"
      older_than = "1209600s"
    }
  }
}

resource "google_artifact_registry_repository_iam_member" "publisher" {
  location   = local.region
  repository = google_artifact_registry_repository.preview.name
  role       = "roles/artifactregistry.repoAdmin"
  member     = "serviceAccount:${google_service_account.automation["preview"].email}"
}

resource "google_storage_bucket" "state" {
  name                        = "${local.project}-nuri-preview-state"
  location                    = local.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
  depends_on                  = [google_project_service.preview]

  versioning { enabled = true }
  soft_delete_policy { retention_duration_seconds = 0 }
  lifecycle_rule {
    condition {
      days_since_noncurrent_time = 7
      with_state                 = "ARCHIVED"
    }
    action { type = "Delete" }
  }
  lifecycle { prevent_destroy = true }
}

resource "google_storage_bucket_iam_member" "automation" {
  for_each = google_service_account.automation
  bucket   = google_storage_bucket.state.name
  role     = "roles/storage.objectAdmin"
  member   = "serviceAccount:${each.value.email}"
}

# Bucket creation is checked against the project, where there is no bucket name yet.
resource "google_project_iam_custom_role" "image_bucket_creator" {
  project     = local.project
  role_id     = "nuriPreviewImageBucketCreator"
  title       = "nuri PR preview image bucket creator"
  permissions = ["storage.buckets.create"]
  depends_on  = [google_project_service.preview]
}

resource "google_project_iam_member" "image_bucket_creator" {
  for_each = google_service_account.automation
  project  = local.project
  role     = google_project_iam_custom_role.image_bucket_creator.name
  member   = "serviceAccount:${each.value.email}"
}

resource "google_project_iam_custom_role" "image_bucket_manager" {
  project = local.project
  role_id = "nuriPreviewImageBucketManager"
  title   = "nuri PR preview image bucket manager"
  permissions = [
    "storage.buckets.delete",
    "storage.buckets.get",
    "storage.buckets.getIamPolicy",
    "storage.buckets.setIamPolicy",
    "storage.buckets.update",
    "storage.objects.delete",
    "storage.objects.list",
  ]
  depends_on = [google_project_service.preview]
}

resource "google_project_iam_member" "image_bucket_manager" {
  for_each = google_service_account.automation
  project  = local.project
  role     = google_project_iam_custom_role.image_bucket_manager.name
  member   = "serviceAccount:${each.value.email}"
  condition {
    title      = "nuri-preview-image-buckets"
    expression = <<-CEL
      resource.name.startsWith('projects/_/buckets/${local.project}-nuri-preview-pr-') &&
      ((resource.type == 'storage.googleapis.com/Bucket' && resource.name.endsWith('-media')) ||
       (resource.type == 'storage.googleapis.com/Object' &&
        resource.name.extract('projects/_/buckets/{bucket}/objects/').endsWith('-media')))
    CEL
  }
}

data "google_project" "preview" {
  project_id = local.project
}

resource "google_tags_tag_key" "preview" {
  parent      = "projects/${data.google_project.preview.number}"
  short_name  = local.name
  description = "Identifies the disposable nuri PR preview Cloud Run services."
  depends_on  = [google_project_service.preview]
}

resource "google_tags_tag_value" "preview" {
  parent     = google_tags_tag_key.preview.id
  short_name = "service"
}

# 作成ジョブは新規サービスにタグを付ける。既存サービスの更新・削除権限は持たない。
resource "google_tags_tag_value_iam_member" "creator" {
  tag_value = google_tags_tag_value.preview.id
  role      = "roles/resourcemanager.tagUser"
  member    = "serviceAccount:${google_service_account.automation["preview-create"].email}"
}

resource "google_project_iam_custom_role" "creator" {
  project = local.project
  role_id = "nuriPreviewCloudRunCreator"
  title   = "nuri PR preview Cloud Run creator"
  permissions = [
    "run.operations.get",
    "run.services.create",
    "run.services.createTagBinding",
    "run.services.get",
  ]
  depends_on = [google_project_service.preview]
}

resource "google_project_iam_member" "creator" {
  project = local.project
  role    = google_project_iam_custom_role.creator.name
  member  = "serviceAccount:${google_service_account.automation["preview-create"].email}"
}

# 非同期操作と配信リビジョンの参照には、サービスのタグを評価できない。
resource "google_project_iam_custom_role" "observe" {
  project = local.project
  role_id = "nuriPreviewCloudRunObserver"
  title   = "nuri PR preview Cloud Run observer"
  permissions = [
    "run.operations.get",
    "run.revisions.get",
  ]
  depends_on = [google_project_service.preview]
}

resource "google_project_iam_member" "observe" {
  project = local.project
  role    = google_project_iam_custom_role.observe.name
  member  = "serviceAccount:${google_service_account.automation["preview"].email}"
}

resource "google_project_iam_custom_role" "read_service" {
  project     = local.project
  role_id     = "nuriPreviewCloudRunReader"
  title       = "nuri PR preview Cloud Run reader"
  permissions = ["run.services.get", "run.services.listTagBindings"]
  depends_on  = [google_project_service.preview]
}

resource "google_project_iam_member" "read_service" {
  for_each = google_service_account.automation
  project  = local.project
  role     = google_project_iam_custom_role.read_service.name
  member   = "serviceAccount:${each.value.email}"
  condition {
    title      = "nuri-preview-services"
    expression = "resource.matchTagId('${google_tags_tag_key.preview.id}', '${google_tags_tag_value.preview.id}')"
  }
}

# 配信・回収ジョブの更新はタグ付きサービスに限る。配信アカウントにはタグの付与権限を与えない。
resource "google_project_iam_custom_role" "publisher" {
  project = local.project
  role_id = "nuriPreviewCloudRunManager"
  title   = "nuri PR preview Cloud Run manager"
  permissions = [
    "run.services.delete",
    "run.services.getIamPolicy",
    "run.services.setIamPolicy",
    "run.services.update",
  ]
  depends_on = [google_project_service.preview]
}

resource "google_project_iam_member" "publisher" {
  project = local.project
  role    = google_project_iam_custom_role.publisher.name
  member  = "serviceAccount:${google_service_account.automation["preview"].email}"
  condition {
    title      = "nuri-preview-services"
    expression = "resource.matchTagId('${google_tags_tag_key.preview.id}', '${google_tags_tag_value.preview.id}')"
  }
}

output "preview_wif_provider" {
  description = "GitHub preview Environment variable PREVIEW_WIF_PROVIDER."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "preview_service_account" {
  description = "GitHub preview Environment variable PREVIEW_SERVICE_ACCOUNT."
  value       = google_service_account.automation["preview"].email
}

output "preview_state_bucket" {
  description = "GCS bucket with per-PR OpenTofu state."
  value       = google_storage_bucket.state.name
}

output "preview_creator_service_account" {
  description = "GitHub preview-create Environment variable PREVIEW_SERVICE_ACCOUNT."
  value       = google_service_account.automation["preview-create"].email
}

output "preview_run_tag_key" {
  description = "GitHub repository variable PREVIEW_RUN_TAG_KEY."
  value       = google_tags_tag_key.preview.id
}

output "preview_run_tag_value" {
  description = "GitHub repository variable PREVIEW_RUN_TAG_VALUE."
  value       = google_tags_tag_value.preview.id
}
