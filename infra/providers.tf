terraform {
  required_version = ">= 1.5.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Local backend — tfstate lives next to this config (infra/terraform.tfstate).
  # Single environment, single operator: no remote state / locking needed for a
  # one-off event. Do NOT commit terraform.tfstate (it holds secrets) — see .gitignore.
  backend "local" {}
}

provider "azurerm" {
  features {}
  # Authenticate with `az login` before running terraform.
  # Set subscription explicitly if you have more than one:
  #   export ARM_SUBSCRIPTION_ID="<your-sub-id>"   (or set in variables)
  subscription_id = var.subscription_id != "" ? var.subscription_id : null
}

provider "random" {}
