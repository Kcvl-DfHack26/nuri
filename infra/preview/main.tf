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

locals {
  project    = "kcvlb4"
  region     = "asia-northeast1"
  name       = "nuri-preview"
  repository = "Kcvl-DfHack26/nuri"
  repo_id    = "1447386190"
}

provider "google" {
  project = local.project
  region  = local.region
}

resource "google_service_account" "runtime" {
  account_id   = "${local.name}-runtime"
  display_name = "nuri disposable PR preview runtime"
}

resource "google_service_account" "publisher" {
  account_id   = "${local.name}-publisher"
  display_name = "GitHub Actions PR preview publisher"
}

resource "google_iam_workload_identity_pool" "preview" {
  workload_identity_pool_id = "${local.name}-github"
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

resource "google_cloud_run_v2_service" "preview" {
  name                 = local.name
  location             = local.region
  ingress              = "INGRESS_TRAFFIC_ALL"
  deletion_protection  = true
  default_uri_disabled = false
  scaling {
    min_instance_count = 0
    max_instance_count = 3
  }
  template {
    service_account = google_service_account.runtime.email
    timeout         = "180s"
    scaling {
      min_instance_count = 0
      max_instance_count = 1
    }
    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello"
      ports { container_port = 8080 }
      resources {
        limits   = { cpu = "1", memory = "2Gi" }
        cpu_idle = true
      }
    }
  }
  # GitHub Actions creates tagged revisions without sending traffic to them from the service root.
  lifecycle {
    ignore_changes = [template[0].revision, template[0].containers[0].image, template[0].containers[0].env, traffic, client, client_version]
  }
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  location = local.region
  name     = google_cloud_run_v2_service.preview.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "publisher" {
  location = local.region
  name     = google_cloud_run_v2_service.preview.name
  role     = "roles/run.developer"
  member   = "serviceAccount:${google_service_account.publisher.email}"
}

output "preview_wif_provider" {
  description = "GitHub preview Environment variable PREVIEW_WIF_PROVIDER."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "preview_service_account" {
  description = "GitHub preview Environment variable PREVIEW_SERVICE_ACCOUNT."
  value       = google_service_account.publisher.email
}
