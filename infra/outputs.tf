output "workload_identity_provider" {
  description = "GitHub environment variable GCP_WORKLOAD_IDENTITY_PROVIDER."
  value       = google_iam_workload_identity_pool_provider.github.name
}
output "deploy_service_account" {
  description = "GitHub environment variable GCP_SERVICE_ACCOUNT."
  value       = google_service_account.deployer.email
}
output "cloud_run_service" {
  description = "GitHub environment variable CLOUD_RUN_SERVICE."
  value       = var.name
}
output "artifact_repository" {
  description = "GitHub environment variable ARTIFACT_REPOSITORY."
  value       = google_artifact_registry_repository.api.repository_id
}
output "migration_job" {
  description = "GitHub environment variable CLOUD_RUN_MIGRATION_JOB."
  value       = "${var.name}-migrate"
}
output "registry" {
  description = "Docker repository base URI."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.api.repository_id}"
}
output "sql_connection_name" {
  description = "Cloud SQL connection name for the DATABASE_URL socket."
  value       = google_sql_database_instance.postgres.connection_name
}
output "api_origin" {
  description = "Expected API origin; verify against the service URI after deployment."
  value       = local.api_origin
}
output "service_uri" {
  description = "Cloud Run service URI when enabled."
  value       = try(google_cloud_run_v2_service.api[0].uri, null)
}
output "expo_web_url" {
  description = "Public entry point of the Expo Web app on the Cloud Run service."
  value       = var.deploy_application ? "${google_cloud_run_v2_service.api[0].uri}/" : null
}

output "image_bucket" {
  description = "Private Cloud Storage bucket for API images."
  value       = google_storage_bucket.images.name
}
