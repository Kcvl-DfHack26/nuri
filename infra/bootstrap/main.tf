terraform {
  required_version = "~> 1.13.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.10"
    }
  }
}
variable "project_id" {
  description = "Existing billing-enabled project; bucket is PROJECT-tofu-state."
  type        = string
}
variable "region" {
  description = "State bucket region."
  type        = string
  default     = "asia-northeast1"
}
provider "google" { project = var.project_id }

resource "google_storage_bucket" "state" {
  name                        = "${var.project_id}-tofu-state"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
  versioning { enabled = true }
  lifecycle { prevent_destroy = true }
}
output "state_bucket" {
  description = "Use in infra/backend.hcl. Preserve the initial bootstrap state."
  value       = google_storage_bucket.state.name
}
