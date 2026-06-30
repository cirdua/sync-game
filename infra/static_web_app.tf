# -----------------------------------------------------------------------------
# Static Web Apps — FREE tier. Hosts the React frontend (Milestone 3) on a
# global CDN. Deployment of built assets happens in Milestone 4 via the SWA CLI
# or `az staticwebapp` using the deployment token output below.
#
# NOTE: We deliberately do NOT wire SWA's "linked backend" / managed Functions.
# The Function App is standalone (Consumption) and the frontend calls it by URL,
# which keeps SWA on the Free tier (linked backends require Standard).
# -----------------------------------------------------------------------------
resource "azurerm_static_web_app" "swa" {
  name                = "${var.project_name}-swa-${local.suffix}"
  resource_group_name = data.azurerm_resource_group.rg.name
  location            = var.swa_location

  sku_tier = "Free"
  sku_size = "Free"

  tags = var.tags
}
