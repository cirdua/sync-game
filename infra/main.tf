# =============================================================================
# Guild Live — Infrastructure (Milestone 1)
# Single resource group, one environment, local tfstate.
#
# Cost posture (see README): everything is free-tier EXCEPT Web PubSub.
#   - Cosmos DB: SERVERLESS  (never provisioned throughput -> avoids ~$24/mo floor)
#   - Static Web Apps: FREE   (Standard adds ~$9/mo flat)
#   - Functions: CONSUMPTION  (pay-per-exec, ~free at this scale)
#   - Web PubSub: STANDARD 1 unit (~$1.61/day — the ONLY metered cost)
# Run `terraform destroy` immediately after the event.
# =============================================================================

# Random suffix keeps globally-unique names (storage, web pubsub, cosmos, swa)
# collision-free without manual coordination.
resource "random_string" "suffix" {
  length  = 6
  lower   = true
  upper   = false
  numeric = true
  special = false
}

locals {
  suffix = random_string.suffix.result
  # Storage account names: 3-24 chars, lowercase alphanumeric only.
  storage_name = substr("${var.project_name}st${local.suffix}", 0, 24)
}

# -----------------------------------------------------------------------------
# Resource group — everything lives here so teardown is one command.
# -----------------------------------------------------------------------------
resource "azurerm_resource_group" "rg" {
  name     = "rg-${var.project_name}"
  location = var.location
  tags     = var.tags
}

# -----------------------------------------------------------------------------
# Cosmos DB — SERVERLESS NoSQL (Core/SQL) API.
# Partition key is /sessionCode everywhere (see architecture.md §3).
# -----------------------------------------------------------------------------
resource "azurerm_cosmosdb_account" "cosmos" {
  name                = "${var.project_name}-cosmos-${local.suffix}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  offer_type          = "Standard"
  kind                = "GlobalDocumentDB" # NoSQL / Core (SQL) API

  # THIS is what makes it serverless. Removing this capability would switch the
  # account back to provisioned throughput and incur the monthly floor.
  capabilities {
    name = "EnableServerless"
  }

  consistency_policy {
    consistency_level = "Session"
  }

  geo_location {
    location          = azurerm_resource_group.rg.location
    failover_priority = 0
  }

  tags = var.tags
}

resource "azurerm_cosmosdb_sql_database" "db" {
  name                = "guildlive"
  resource_group_name = azurerm_resource_group.rg.name
  account_name        = azurerm_cosmosdb_account.cosmos.name
  # No throughput set => inherits serverless billing from the account.
}

# Containers — all partitioned by /sessionCode so a live game hits one partition.
resource "azurerm_cosmosdb_sql_container" "sessions" {
  name                  = "sessions"
  resource_group_name   = azurerm_resource_group.rg.name
  account_name          = azurerm_cosmosdb_account.cosmos.name
  database_name         = azurerm_cosmosdb_sql_database.db.name
  partition_key_paths   = ["/sessionCode"]
  partition_key_version = 2
}

resource "azurerm_cosmosdb_sql_container" "questions" {
  name                  = "questions"
  resource_group_name   = azurerm_resource_group.rg.name
  account_name          = azurerm_cosmosdb_account.cosmos.name
  database_name         = azurerm_cosmosdb_sql_database.db.name
  partition_key_paths   = ["/sessionCode"]
  partition_key_version = 2
}

resource "azurerm_cosmosdb_sql_container" "players" {
  name                  = "players"
  resource_group_name   = azurerm_resource_group.rg.name
  account_name          = azurerm_cosmosdb_account.cosmos.name
  database_name         = azurerm_cosmosdb_sql_database.db.name
  partition_key_paths   = ["/sessionCode"]
  partition_key_version = 2
}

resource "azurerm_cosmosdb_sql_container" "answers" {
  name                  = "answers"
  resource_group_name   = azurerm_resource_group.rg.name
  account_name          = azurerm_cosmosdb_account.cosmos.name
  database_name         = azurerm_cosmosdb_sql_database.db.name
  partition_key_paths   = ["/sessionCode"]
  partition_key_version = 2
}

# -----------------------------------------------------------------------------
# Web PubSub — STANDARD, 1 unit. Group-per-session fan-out (see architecture.md).
# This is the only metered/always-on cost (~$1.61/day, billed per unit per day).
# -----------------------------------------------------------------------------
resource "azurerm_web_pubsub" "wps" {
  name                = "${var.project_name}-wps-${local.suffix}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location

  sku      = "Standard_S1"
  capacity = 1

  tags = var.tags
}

# Hub used by the app. event_handler wiring to Functions is added in Milestone 4
# (needs the deployed Function URL); for negotiate-only flows the hub alone is enough.
resource "azurerm_web_pubsub_hub" "hub" {
  name          = "guildlive"
  web_pubsub_id = azurerm_web_pubsub.wps.id

  # Allow anonymous connect for clients that present a valid access token
  # (tokens are minted server-side by the negotiate Function, scoped to a group).
  anonymous_connections_enabled = true
}

# -----------------------------------------------------------------------------
# Storage account — required backing store for the Function App (Consumption).
# -----------------------------------------------------------------------------
resource "azurerm_storage_account" "func_storage" {
  name                     = local.storage_name
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"

  tags = var.tags
}

# -----------------------------------------------------------------------------
# Function App (Consumption / Linux, Node 20 TS).
# App settings inject Cosmos + Web PubSub connection strings so the backend
# (Milestone 2) can read them from process.env with zero hardcoding.
# -----------------------------------------------------------------------------
resource "azurerm_service_plan" "plan" {
  name                = "${var.project_name}-plan"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  os_type             = "Linux"
  sku_name            = "Y1" # Y1 = Consumption
  tags                = var.tags
}

resource "azurerm_linux_function_app" "func" {
  name                = "${var.project_name}-func-${local.suffix}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  service_plan_id     = azurerm_service_plan.plan.id

  storage_account_name       = azurerm_storage_account.func_storage.name
  storage_account_access_key = azurerm_storage_account.func_storage.primary_access_key

  site_config {
    application_stack {
      node_version = "20"
    }
    cors {
      # SWA origin is added in Milestone 4 once known; "*" + allow-creds=false is
      # fine for token-based, no-auth clients. Tighten post-deploy if desired.
      allowed_origins     = ["*"]
      support_credentials = false
    }
  }

  app_settings = {
    FUNCTIONS_WORKER_RUNTIME = "node"
    WEBSITE_NODE_DEFAULT_VERSION = "~20"

    # Cosmos — connection string + db name consumed by the data layer.
    COSMOS_CONNECTION_STRING = azurerm_cosmosdb_account.cosmos.primary_sql_connection_string
    COSMOS_DATABASE_NAME     = azurerm_cosmosdb_sql_database.db.name

    # Web PubSub — primary connection string used by input/output bindings and
    # the negotiate Function to mint group-scoped client tokens.
    WEBPUBSUB_CONNECTION_STRING = azurerm_web_pubsub.wps.primary_connection_string
    WEBPUBSUB_HUB_NAME          = azurerm_web_pubsub_hub.hub.name
  }

  tags = var.tags
}
