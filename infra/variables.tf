variable "project_id" {
  description = "Existing, billing-enabled Google Cloud project ID."
  type        = string
}
variable "region" {
  description = "Region shared by Cloud Run, SQL and Artifact Registry."
  type        = string
  default     = "asia-northeast1"
}
variable "name" {
  description = "Resource prefix, one state per environment."
  type        = string
  default     = "nuri-staging"
}
variable "github_repository" {
  description = "Repository allowed to deploy from main."
  type        = string
  default     = "Kcvl-DfHack26/nuri"
}
variable "github_repository_id" {
  description = "Immutable GitHub repository ID, from gh api repos/OWNER/REPO --jq .id."
  type        = string
}
variable "database_password" {
  description = "Application DB password. Write-only; also set the matching DATABASE_URL secret manually."
  type        = string
  sensitive   = true
  ephemeral   = true
  validation {
    condition     = length(var.database_password) >= 24
    error_message = "Use a random password of at least 24 characters."
  }
}
variable "database_password_version" {
  description = "Increment to rotate the write-only password."
  type        = number
  default     = 1
}
variable "database_tier" {
  description = "Cloud SQL instance size; shared-core keeps a demo affordable."
  type        = string
  default     = "db-f1-micro"
}
variable "deploy_application" {
  description = "Enable only after pushing a real image and adding secret versions."
  type        = bool
  default     = false
}
variable "deletion_protection" {
  description = "Guards Cloud SQL in OpenTofu and Google Cloud, plus the Cloud Run service and migration job in OpenTofu. Set false only to destroy them."
  type        = bool
  default     = true
}
variable "image" {
  description = "Initial immutable Artifact Registry image URI. Later revisions are owned by CI."
  type        = string
  default     = ""
  validation {
    condition     = !var.deploy_application || can(regex("@sha256:[a-f0-9]{64}$", var.image))
    error_message = "Application deployment requires an image pinned by sha256 digest."
  }
}
variable "api_origin" {
  description = "HTTPS origin for Better Auth. After first deployment, set this to service_uri (or a mapped custom domain); the empty fallback is provisional."
  type        = string
  default     = ""
}
variable "trusted_origins" {
  description = "Explicit browser/app origins accepted by Better Auth. No exp:// wildcards in production."
  type        = list(string)
  default     = ["com.kcvl.nuri://"]
}

variable "google_oauth_enabled" {
  description = "Reference Google OAuth client ID and secret versions in Cloud Run only after adding both Secret Manager versions."
  type        = bool
  default     = false
}

variable "email_login_enabled" {
  description = "Reference the Resend API key in Cloud Run only after adding its Secret Manager version and setting email_from."
  type        = bool
  default     = false
}

variable "email_from" {
  description = "Resend sender used for login links when email_login_enabled is true. Verify its domain before sending to users."
  type        = string
  default     = ""
}

variable "push_notifications_enabled" {
  description = "Reference the Expo Push Service access token in Cloud Run after adding its Secret Manager version."
  type        = bool
  default     = false
}
