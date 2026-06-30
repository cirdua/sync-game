variable "subscription_id" {
  description = "Azure subscription ID. Leave empty to use the az CLI default subscription."
  type        = string
  default     = ""
}

variable "resource_group_name" {
  description = "Name of the EXISTING resource group to deploy into. It must already exist; Terraform consumes it as a data source and does NOT create or destroy it."
  type        = string
}

variable "project_name" {
  description = "Short project slug used to build resource names. Lowercase letters/numbers only."
  type        = string
  default     = "guildlive"

  validation {
    condition     = can(regex("^[a-z0-9]{3,12}$", var.project_name))
    error_message = "project_name must be 3-12 lowercase alphanumeric characters (used in globally-unique resource names)."
  }
}

# NOTE: Cosmos, Web PubSub, Functions, and Storage all inherit the EXISTING
# resource group's location (data.azurerm_resource_group.rg.location) — there is
# no separate `location` variable, so they always land in the RG's region.

variable "swa_location" {
  description = <<-EOT
    Region for Static Web Apps. SWA is only available in a subset of regions, so
    it is set explicitly rather than inheriting the RG location (which may not
    host SWA). Valid (as of writing): westus2, centralus, eastus2, westeurope,
    eastasia. Set this in tfvars to the supported region nearest your RG.
  EOT
  type        = string
  default     = "westeurope"
}

variable "tags" {
  description = "Tags applied to every resource (handy for cost tracking / cleanup)."
  type        = map(string)
  default = {
    project    = "guild-live"
    owner      = "cloud-engineering-guild"
    managed_by = "terraform"
    lifecycle  = "ephemeral-destroy-after-event"
  }
}
