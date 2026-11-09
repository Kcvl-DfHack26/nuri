terraform {
  required_version = "~> 1.13.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.10"
    }
  }
  backend "gcs" {}
}

variable "pr_number" {
  description = "The GitHub pull request that owns this preview."
  type        = string
  nullable    = false
  validation {
    condition     = can(regex("^[1-9][0-9]{0,8}$", var.pr_number))
    error_message = "The pull request number must contain 1 to 9 digits without a leading zero."
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
  project = var.project_id
  region  = "asia-northeast1"
  name    = "nuri-preview-pr-${var.pr_number}"
  bucket  = "${local.project}-${local.name}-media"
}

provider "google" {
  project = local.project
  region  = local.region
}

resource "google_cloud_run_v2_service" "preview" {
  project              = local.project
  name                 = local.name
  location             = local.region
  ingress              = "INGRESS_TRAFFIC_ALL"
  deletion_protection  = false
  default_uri_disabled = false
  scaling {
    min_instance_count = 0
    max_instance_count = 1
  }
  template {
    service_account = "nuri-preview-runtime@${local.project}.iam.gserviceaccount.com"
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

  depends_on = [google_storage_bucket_iam_member.runtime_images]

  # CI が検証済みのイメージ、リビジョンとトラフィックを管理する。
  lifecycle {
    ignore_changes = [
      template[0].revision,
      template[0].containers[0].image,
      template[0].containers[0].env,
      traffic,
      client,
      client_version,
      invoker_iam_disabled,
      tags,
    ]
  }
}

resource "google_storage_bucket" "images" {
  project                     = local.project
  name                        = local.bucket
  location                    = local.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = true

  soft_delete_policy { retention_duration_seconds = 0 }
}

resource "google_storage_bucket_iam_member" "runtime_images" {
  bucket = google_storage_bucket.images.name
  role   = "roles/storage.objectUser"
  member = "serviceAccount:nuri-preview-runtime@${local.project}.iam.gserviceaccount.com"
}

output "image_bucket" {
  description = "Private image bucket passed to the preview revision."
  value       = google_storage_bucket.images.name
}
