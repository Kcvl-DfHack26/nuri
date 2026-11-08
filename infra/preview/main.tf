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
  description = "ID of the dedicated preview GCP project."
  type        = string
  nullable    = false
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id)) && var.project_id != "kcvlb4"
    error_message = "Set a valid preview project ID distinct from the kcvlb4 staging project."
  }
}

locals {
  project    = var.project_id
  region     = "asia-northeast1"
  name       = "nuri-preview"
  repository = "Kcvl-DfHack26/nuri"
  repo_id    = "1447386190"
}

provider "google" {
  project = local.project
  region  = local.region
}

resource "google_project_service" "preview" {
  for_each = toset([
    "artifactregistry.googleapis.com",
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

resource "google_service_account" "publisher" {
  account_id   = "${local.name}-publisher"
  display_name = "GitHub Actions PR preview publisher"
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
    "google.subject"          = "assertion.sub"
    "attribute.repository_id" = "assertion.repository_id"
  }
  attribute_condition = "assertion.repository_id == '${local.repo_id}' && assertion.repository == '${local.repository}' && assertion.ref == 'refs/heads/main' && assertion.environment == 'preview' && assertion.workflow_ref == '${local.repository}/.github/workflows/preview.yml@refs/heads/main'"
  oidc { issuer_uri = "https://token.actions.githubusercontent.com" }
}

resource "google_service_account_iam_member" "federation" {
  service_account_id = google_service_account.publisher.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.preview.name}/attribute.repository_id/${local.repo_id}"
}

resource "google_service_account_iam_member" "act_as_runtime" {
  service_account_id = google_service_account.runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.publisher.email}"
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
  member     = "serviceAccount:${google_service_account.publisher.email}"
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

resource "google_storage_bucket_iam_member" "publisher" {
  bucket = google_storage_bucket.state.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.publisher.email}"
}

# Cloud Run の管理権限は、ステージングを含まないプレビュー専用プロジェクトに付与する。
resource "google_project_iam_custom_role" "publisher" {
  project = local.project
  role_id = "nuriPreviewCloudRunManager"
  title   = "nuri PR preview Cloud Run manager"
  permissions = [
    "run.operations.get",
    "run.revisions.delete",
    "run.revisions.get",
    "run.revisions.list",
    "run.services.create",
    "run.services.delete",
    "run.services.get",
    "run.services.getIamPolicy",
    "run.services.setIamPolicy",
    "run.services.update",
  ]
  depends_on = [google_project_service.preview]
}

resource "google_project_iam_member" "publisher" {
  project = local.project
  role    = google_project_iam_custom_role.publisher.name
  member  = "serviceAccount:${google_service_account.publisher.email}"
}

output "preview_wif_provider" {
  description = "GitHub preview Environment variable PREVIEW_WIF_PROVIDER."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "preview_service_account" {
  description = "GitHub preview Environment variable PREVIEW_SERVICE_ACCOUNT."
  value       = google_service_account.publisher.email
}

output "preview_state_bucket" {
  description = "GCS bucket with per-PR OpenTofu state."
  value       = google_storage_bucket.state.name
}
