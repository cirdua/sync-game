# Guild Live — Infrastructure (Milestone 1)

Terraform that stands up everything Guild Live needs in **one resource group** with **local tfstate**.

## What it provisions

| Resource | Tier / Mode | Why |
|---|---|---|
| Resource group | — | Single container; one-command teardown |
| Cosmos DB account + DB + 4 containers | **Serverless** NoSQL | Pay-per-request; avoids ~$24/mo provisioned floor |
| Web PubSub | **Standard_S1, 1 unit** | Group fan-out for 200 players; the only metered cost |
| Function App + Storage | **Consumption (Y1)**, Linux Node 20 | Pay-per-exec backend |
| Static Web App | **Free** | CDN-hosted React frontend |

Containers (`sessions`, `questions`, `players`, `answers`) are all partitioned by `/sessionCode`.

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/downloads) >= 1.5
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli), logged in: `az login`
- If you have multiple subscriptions: `az account set --subscription "<id>"` (or set `subscription_id` in tfvars)

## Apply

> **Resource group:** this config deploys into an **existing** RG that you supply
> via `resource_group_name`. Terraform consumes it as a data source and never
> creates or destroys it.

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars   # then set resource_group_name (REQUIRED)
terraform init
terraform plan
terraform apply
```

## Verify (Milestone 1 "done" check)

```bash
terraform output                       # non-sensitive outputs populated
terraform output -raw cosmos_connection_string      # secrets readable
terraform output -raw webpubsub_connection_string
terraform output -raw static_web_app_api_key
```

All resources should show in the Azure Portal under your resource group. Confirm:
- Cosmos account → **Capacity mode = Serverless**
- Static Web App → **Plan = Free**
- Web PubSub → **Pricing tier = Standard, Unit count = 1**

## Outputs you'll use later

- `function_app_base_url` — frontend points its API calls here
- `static_web_app_default_hostname` — the live app URL
- `static_web_app_api_key` (sensitive) — SWA deploy token (Milestone 4)
- `functions_local_settings` (sensitive) — dump straight into `api/local.settings.json` (Milestone 2):
  ```bash
  terraform output -raw functions_local_settings > ../api/local.settings.json
  ```

## ⚠️ Teardown — DO THIS AFTER THE EVENT

Web PubSub bills **per unit per day** with no hourly proration. Destroy the
resources Terraform created:

```bash
cd infra
terraform destroy
```

This removes Cosmos, Web PubSub, Functions, Storage, and the Static Web App.
The **resource group itself is left intact** (it pre-existed and is consumed as a
data source). The Web PubSub charge stops as soon as its resource is gone.
