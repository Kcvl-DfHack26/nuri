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

variable "tag_key" {
  description = "Permanent ID of the Resource Manager key marking preview services."
  type        = string
  nullable    = false
  validation {
    condition     = can(regex("^tagKeys/[0-9]+$", var.tag_key))
    error_message = "Use the permanent preview tag key ID."
  }
}

variable "tag_value" {
  description = "Permanent ID of the Resource Manager value marking preview services."
  type        = string
  nullable    = false
  validation {
    condition     = can(regex("^tagValues/[0-9]+$", var.tag_value))
    error_message = "Use the permanent preview tag value ID."
  }
}

locals {
  project = var.project_id
  region  = "asia-northeast1"
  name    = "nuri-preview-pr-${var.pr_number}"
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
  tags                 = { (var.tag_key) = var.tag_value }
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
    ]
  }
}
