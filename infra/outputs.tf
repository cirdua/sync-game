# =============================================================================
# Outputs — everything the app + deploy scripts need.
# Sensitive values (connection strings, tokens) are marked sensitive; read them
# with:  terraform output -raw <name>
# =============================================================================

output "resource_group_name" {
  description = "Resource group holding all Guild Live resources. `terraform destroy` removes everything here."
  value       = azurerm_resource_group.rg.name
}

output "location" {
  value = azurerm_resource_group.rg.location
}

# ---- Function App -----------------------------------------------------------
output "function_app_name" {
  description = "Name of the Function App (used by `func azure functionapp publish` in Milestone 4)."
  value       = azurerm_linux_function_app.func.name
}

output "function_app_hostname" {
  description = "Base hostname of the deployed Functions API."
  value       = azurerm_linux_function_app.func.default_hostname
}

output "function_app_base_url" {
  description = "Full https base URL of the Functions API. Frontend uses <this>/api/* ."
  value       = "https://${azurerm_linux_function_app.func.default_hostname}"
}

# ---- Static Web Apps --------------------------------------------------------
output "static_web_app_name" {
  value = azurerm_static_web_app.swa.name
}

output "static_web_app_default_hostname" {
  description = "Public URL where the frontend will be served."
  value       = "https://${azurerm_static_web_app.swa.default_host_name}"
}

output "static_web_app_api_key" {
  description = "SWA deployment token. Use with `swa deploy --deployment-token <this>` (Milestone 4)."
  value       = azurerm_static_web_app.swa.api_key
  sensitive   = true
}

# ---- Web PubSub -------------------------------------------------------------
output "webpubsub_hostname" {
  value       = azurerm_web_pubsub.wps.hostname
  description = "Web PubSub service hostname."
}

output "webpubsub_hub_name" {
  value = azurerm_web_pubsub_hub.hub.name
}

output "webpubsub_connection_string" {
  description = "Web PubSub primary connection string (used by Functions bindings + negotiate)."
  value       = azurerm_web_pubsub.wps.primary_connection_string
  sensitive   = true
}

# ---- Cosmos DB --------------------------------------------------------------
output "cosmos_account_name" {
  value = azurerm_cosmosdb_account.cosmos.name
}

output "cosmos_database_name" {
  value = azurerm_cosmosdb_sql_database.db.name
}

output "cosmos_connection_string" {
  description = "Cosmos primary SQL connection string (used by the Functions data layer)."
  value       = azurerm_cosmosdb_account.cosmos.primary_sql_connection_string
  sensitive   = true
}

output "cosmos_endpoint" {
  value = azurerm_cosmosdb_account.cosmos.endpoint
}

# ---- Convenience: local.settings.json blob for the Functions app ------------
# Pipe to a file in Milestone 2 to run the backend locally against real Azure:
#   terraform output -raw functions_local_settings > ../api/local.settings.json
output "functions_local_settings" {
  description = "Ready-to-use local.settings.json content for the Functions app."
  sensitive   = true
  value = jsonencode({
    IsEncrypted = false
    Values = {
      FUNCTIONS_WORKER_RUNTIME    = "node"
      AzureWebJobsStorage         = "UseDevelopmentStorage=true"
      COSMOS_CONNECTION_STRING    = azurerm_cosmosdb_account.cosmos.primary_sql_connection_string
      COSMOS_DATABASE_NAME        = azurerm_cosmosdb_sql_database.db.name
      WEBPUBSUB_CONNECTION_STRING = azurerm_web_pubsub.wps.primary_connection_string
      WEBPUBSUB_HUB_NAME          = azurerm_web_pubsub_hub.hub.name
    }
    Host = {
      CORS = "*"
    }
  })
}
