variable "subscription_id" {
  description = "Azure subscription ID. Leave empty to use the az CLI default subscription."
  type        = string
  default     = ""
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

variable "location" {
  description = "Azure region for all resources. Pick a region where Web PubSub + SWA + Cosmos serverless are all available."
  type        = string
  default     = "westeurope"
}

variable "swa_location" {
  description = <<-EOT
    Region for Static Web Apps. SWA is only available in a subset of regions.
    Valid (as of writing): westus2, centralus, eastus2, westeurope, eastasia.
    Kept separate from `location` because the main region may not host SWA.
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
