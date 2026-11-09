data "google_project" "current" {}

locals {
  identity_prefix = length(var.name) <= 22 ? var.name : "${substr(var.name, 0, 13)}-${substr(sha256(var.name), 0, 8)}"
  api_origin      = var.api_origin != "" ? var.api_origin : "https://${var.name}-${data.google_project.current.number}.${var.region}.run.app"
  apis = toset([
    "artifactregistry.googleapis.com", "run.googleapis.com", "sqladmin.googleapis.com",
    "secretmanager.googleapis.com", "iam.googleapis.com", "iamcredentials.googleapis.com", "sts.googleapis.com",
    "storage.googleapis.com",
    # Gemini on Vertex AI reads the ⑫-3 video (#142, #155).
    "aiplatform.googleapis.com"
  ])
}

resource "google_project_service" "enabled" {
  for_each           = local.apis
  service            = each.key
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "api" {
  repository_id = var.name
  location      = var.region
  format        = "DOCKER"
  depends_on    = [google_project_service.enabled]
}

resource "google_service_account" "runtime" {
  account_id   = "${local.identity_prefix}-runtime"
  display_name = "nuri Cloud Run runtime"
  depends_on   = [google_project_service.enabled]
}
resource "google_storage_bucket" "images" {
  name                        = "${var.project_id}-${local.identity_prefix}-images"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
  depends_on                  = [google_project_service.enabled]

  lifecycle { prevent_destroy = true }
}

resource "google_storage_bucket_iam_member" "runtime_images" {
  bucket = google_storage_bucket.images.name
  role   = "roles/storage.objectUser"
  member = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_service_account" "migration" {
  account_id   = "${local.identity_prefix}-migrate"
  display_name = "nuri database migration"
  depends_on   = [google_project_service.enabled]
}
resource "google_service_account" "deployer" {
  account_id   = "${local.identity_prefix}-deploy"
  display_name = "GitHub deployment (no infrastructure administration)"
  depends_on   = [google_project_service.enabled]
}
resource "google_project_iam_member" "sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}
# The API calls Gemini on Vertex AI with the runtime's own identity; no key file (#155).
resource "google_project_iam_member" "vertex_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}
resource "google_project_iam_member" "migration_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.migration.email}"
}
resource "google_project_iam_member" "run_developer" {
  project = var.project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.deployer.email}"
}
resource "google_service_account_iam_member" "act_as_runtime" {
  service_account_id = google_service_account.runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deployer.email}"
}
resource "google_service_account_iam_member" "act_as_migration" {
  service_account_id = google_service_account.migration.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deployer.email}"
}
resource "google_artifact_registry_repository_iam_member" "push" {
  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.api.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "${local.identity_prefix}-github"
  depends_on                = [google_project_service.enabled]
}
resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  attribute_mapping = {
    "google.subject"          = "assertion.sub"
    "attribute.repository"    = "assertion.repository"
    "attribute.repository_id" = "assertion.repository_id"
  }
  attribute_condition = "assertion.repository_id == '${var.github_repository_id}' && assertion.repository == '${var.github_repository}' && assertion.ref == 'refs/heads/main' && assertion.workflow_ref == '${var.github_repository}/.github/workflows/deploy.yml@refs/heads/main'"
  oidc { issuer_uri = "https://token.actions.githubusercontent.com" }
}
resource "google_service_account_iam_member" "federation" {
  service_account_id = google_service_account.deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository_id/${var.github_repository_id}"
}

resource "google_sql_database_instance" "postgres" {
  name                = var.name
  region              = var.region
  database_version    = "POSTGRES_17"
  deletion_protection = var.deletion_protection
  settings {
    tier                        = var.database_tier
    edition                     = "ENTERPRISE"
    disk_size                   = 10
    disk_autoresize             = true
    availability_type           = "ZONAL"
    deletion_protection_enabled = var.deletion_protection
    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
    }
    ip_configuration {
      ipv4_enabled = true
      # No authorized networks. Only the authenticated Cloud SQL connector/socket is used.
      ssl_mode = "ENCRYPTED_ONLY"
    }
  }
  depends_on = [google_project_service.enabled]
}
# Deleting the instance removes the database and user with it. ABANDON keeps
# destroy from failing on open connections or on objects the user owns.
resource "google_sql_database" "app" {
  name            = "expo-hono-opentofu-starter"
  instance        = google_sql_database_instance.postgres.name
  deletion_policy = "ABANDON"
}
resource "google_sql_user" "app" {
  name                = "expo-hono-opentofu-starter"
  instance            = google_sql_database_instance.postgres.name
  password_wo         = var.database_password
  password_wo_version = var.database_password_version
  deletion_policy     = "ABANDON"
}
resource "google_secret_manager_secret" "app" {
  for_each  = toset(["database-url", "auth-secret", "google-client-id", "google-client-secret", "resend-api-key", "expo-push-access-token"])
  secret_id = "${var.name}-${each.key}"
  replication {
    auto {}
  }
  depends_on = [google_project_service.enabled]
}
resource "google_secret_manager_secret_iam_member" "runtime" {
  for_each = toset(concat(
    ["database-url", "auth-secret"],
    var.google_oauth_enabled ? ["google-client-id", "google-client-secret"] : [],
    var.email_login_enabled ? ["resend-api-key"] : [],
    var.push_notifications_enabled ? ["expo-push-access-token"] : []
  ))
  secret_id = google_secret_manager_secret.app[each.key].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}
resource "google_secret_manager_secret_iam_member" "migration" {
  secret_id = google_secret_manager_secret.app["database-url"].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.migration.email}"
}

resource "google_cloud_run_v2_service" "api" {
  count                = var.deploy_application ? 1 : 0
  name                 = var.name
  location             = var.region
  deletion_protection  = var.deletion_protection
  ingress              = "INGRESS_TRAFFIC_ALL"
  default_uri_disabled = false
  template {
    service_account = google_service_account.runtime.email
    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }
    volumes {
      name = "cloudsql"
      cloud_sql_instance { instances = [google_sql_database_instance.postgres.connection_name] }
    }
    containers {
      image = var.image
      ports { container_port = 8080 }
      resources { limits = { cpu = "1", memory = "512Mi" } }
      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }
      env {
        name  = "BETTER_AUTH_URL"
        value = local.api_origin
      }
      env {
        name  = "TRUSTED_ORIGINS"
        value = join(",", var.trusted_origins)
      }
      env {
        name  = "GCS_BUCKET"
        value = google_storage_bucket.images.name
      }
      # Without it the analysis answers 503; VERTEX_LOCATION keeps its default, global (#155).
      env {
        name  = "VERTEX_PROJECT"
        value = var.project_id
      }
      dynamic "env" {
        for_each = var.email_login_enabled ? { EMAIL_FROM = var.email_from } : {}
        content {
          name  = env.key
          value = env.value
        }
      }
      dynamic "env" {
        for_each = merge(
          { DATABASE_URL = "database-url", BETTER_AUTH_SECRET = "auth-secret" },
          var.google_oauth_enabled ? { GOOGLE_CLIENT_ID = "google-client-id", GOOGLE_CLIENT_SECRET = "google-client-secret" } : {},
          var.email_login_enabled ? { RESEND_API_KEY = "resend-api-key" } : {},
          var.push_notifications_enabled ? { EXPO_PUSH_ACCESS_TOKEN = "expo-push-access-token" } : {}
        )
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.app[env.value].secret_id
              version = "latest"
            }
          }
        }
      }
      # A revision takes traffic only after it can reach the database.
      # Liveness stays on /health so a short database outage does not restart instances.
      # The timeout matches the pool's 5 s connect timeout (apps/api/src/db/client.ts),
      # and 12 tries give a cold db-f1-micro up to 120 s, under Cloud Run's 240 s cap.
      startup_probe {
        http_get { path = "/ready" }
        timeout_seconds   = 5
        period_seconds    = 10
        failure_threshold = 12
      }
      liveness_probe {
        http_get { path = "/health" }
      }
    }
  }
  lifecycle {
    ignore_changes = [template[0].containers[0].image, traffic, client, client_version]
    precondition {
      condition     = !var.email_login_enabled || can(regex("@", var.email_from))
      error_message = "email_from must be a configured Resend sender when email_login_enabled is true."
    }
  }
  depends_on = [google_project_iam_member.sql_client, google_secret_manager_secret_iam_member.runtime, google_storage_bucket_iam_member.runtime_images]
}
resource "google_cloud_run_v2_service_iam_member" "public" {
  count    = var.deploy_application ? 1 : 0
  name     = google_cloud_run_v2_service.api[0].name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}
resource "google_cloud_run_v2_job" "migrate" {
  count               = var.deploy_application ? 1 : 0
  name                = "${var.name}-migrate"
  location            = var.region
  deletion_protection = var.deletion_protection
  template {
    template {
      service_account = google_service_account.migration.email
      max_retries     = 0
      timeout         = "300s"
      volumes {
        name = "cloudsql"
        cloud_sql_instance { instances = [google_sql_database_instance.postgres.connection_name] }
      }
      containers {
        image   = var.image
        command = ["node", "dist/db/migrate.js"]
        volume_mounts {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }
        env {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.app["database-url"].secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }
  lifecycle { ignore_changes = [template[0].template[0].containers[0].image, client, client_version] }
  depends_on = [google_project_iam_member.migration_sql_client, google_secret_manager_secret_iam_member.migration, google_service_account_iam_member.act_as_migration]
}
