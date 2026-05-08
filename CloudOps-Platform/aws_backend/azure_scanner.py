# # #!/usr/bin/env python3
# # """
# # Azure Discovery — Full Scanner with Mock Data
# # Mirrors aws scanner.py structure exactly.
# # When a real Azure account is available, replace mock functions with real SDK calls.
# #
# # Azure SDK packages needed (add to requirements.txt when ready):
# #   azure-identity
# #   azure-mgmt-compute
# #   azure-mgmt-storage
# #   azure-mgmt-network
# #   azure-mgmt-sql
# #   azure-mgmt-web
# #   azure-mgmt-containerservice
# #   azure-mgmt-containerregistry
# #   azure-mgmt-keyvault
# #   azure-mgmt-monitor
# #   azure-mgmt-servicebus
# #   azure-mgmt-cdn
# #   azure-mgmt-dns
# #   azure-mgmt-costmanagement
# #   azure-mgmt-resource
# #   azure-mgmt-subscription
# # """
# #
# # import random
# # from datetime import datetime, timezone, timedelta
# # from typing import Dict, List, Any, Optional
# #
# # # ── CONFIG ─────────────────────────────────────────────────────────────────────
# # AZURE_REGIONS = [
# #     "eastus", "eastus2", "westus", "westus2", "westus3",
# #     "centralus", "northcentralus", "southcentralus",
# #     "northeurope", "westeurope", "uksouth", "ukwest",
# #     "eastasia", "southeastasia", "japaneast", "japanwest",
# #     "australiaeast", "australiasoutheast",
# #     "brazilsouth", "canadacentral", "canadaeast",
# #     "centralindia", "southindia", "westindia",
# #     "koreacentral", "koreasouth",
# #     "francecentral", "germanywestcentral",
# #     "norwayeast", "switzerlandnorth",
# #     "uaenorth", "southafricanorth",
# # ]
# #
# # AZURE_REGION_DISPLAY = {
# #     "eastus": "East US",
# #     "eastus2": "East US 2",
# #     "westus": "West US",
# #     "westus2": "West US 2",
# #     "westus3": "West US 3",
# #     "centralus": "Central US",
# #     "northcentralus": "North Central US",
# #     "southcentralus": "South Central US",
# #     "northeurope": "North Europe",
# #     "westeurope": "West Europe",
# #     "uksouth": "UK South",
# #     "ukwest": "UK West",
# #     "eastasia": "East Asia",
# #     "southeastasia": "Southeast Asia",
# #     "japaneast": "Japan East",
# #     "japanwest": "Japan West",
# #     "australiaeast": "Australia East",
# #     "australiasoutheast": "Australia Southeast",
# #     "brazilsouth": "Brazil South",
# #     "canadacentral": "Canada Central",
# #     "canadaeast": "Canada East",
# #     "centralindia": "Central India",
# #     "southindia": "South India",
# #     "westindia": "West India",
# #     "koreacentral": "Korea Central",
# #     "koreasouth": "Korea South",
# #     "francecentral": "France Central",
# #     "germanywestcentral": "Germany West Central",
# #     "norwayeast": "Norway East",
# #     "switzerlandnorth": "Switzerland North",
# #     "uaenorth": "UAE North",
# #     "southafricanorth": "South Africa North",
# # }
# # # ──────────────────────────────────────────────────────────────────────────────
# #
# #
# # def _ts(days_ago=0, hours_ago=0):
# #     """Return ISO timestamp offset from now."""
# #     dt = datetime.now(timezone.utc) - timedelta(days=days_ago, hours=hours_ago)
# #     return dt.isoformat()
# #
# #
# # def _rg(seed):
# #     """Deterministic random from seed."""
# #     rng = random.Random(seed)
# #     return rng
# #
# #
# # # ══════════════════════════════════════════════════════════════════════════════
# # # IDENTITY / SUBSCRIPTION
# # # ══════════════════════════════════════════════════════════════════════════════
# #
# # def scan_identity(tenant_id: str, client_id: str, subscription_id: str) -> Dict:
# #     """Mock Azure identity — equivalent of AWS STS get_caller_identity."""
# #     return {
# #         "tenant_id": tenant_id,
# #         "subscription_id": subscription_id,
# #         "client_id": client_id,
# #         "display_name": "CloudOps Scanner Service Principal",
# #         "subscription_name": "CloudOps Production",
# #         "environment": "AzureCloud",
# #         "mock": True,
# #     }
# #
# #
# # def get_azure_regions(selected: List[str]) -> List[str]:
# #     if selected:
# #         return selected
# #     return ["eastus", "westeurope", "southeastasia"]
# #
# #
# # # ══════════════════════════════════════════════════════════════════════════════
# # # GLOBAL SERVICES
# # # ══════════════════════════════════════════════════════════════════════════════
# #
# # def scan_resource_groups(tenant_id: str, client_id: str, subscription_id: str) -> List[Dict]:
# #     """Mock Azure Resource Groups — top-level organizational containers."""
# #     rg_names = [
# #         "rg-production", "rg-staging", "rg-development",
# #         "rg-networking", "rg-security", "rg-monitoring",
# #         "rg-data", "rg-devops", "rg-shared-services",
# #     ]
# #     groups = []
# #     for i, name in enumerate(rg_names):
# #         rng = _rg(name)
# #         region = rng.choice(["eastus", "westeurope", "southeastasia"])
# #         groups.append({
# #             "id": f"/subscriptions/{subscription_id}/resourceGroups/{name}",
# #             "name": name,
# #             "location": region,
# #             "provisioning_state": "Succeeded",
# #             "tags": {"env": name.split("-")[-1], "managed_by": "terraform"},
# #             "resource_count": rng.randint(5, 50),
# #         })
# #     return groups
# #
# #
# # def scan_costs(tenant_id: str, client_id: str, subscription_id: str) -> Dict:
# #     """Mock Azure Cost Management — equivalent of AWS Cost Explorer."""
# #     services = {
# #         "Virtual Machines": 2847.32,
# #         "Azure SQL Database": 1203.45,
# #         "Azure Kubernetes Service": 987.20,
# #         "Storage Accounts": 456.78,
# #         "Azure Functions": 123.45,
# #         "Azure App Service": 345.67,
# #         "Azure Monitor": 89.34,
# #         "Azure Key Vault": 45.23,
# #         "Azure CDN": 234.56,
# #         "Azure DNS": 12.45,
# #         "Virtual Network": 67.89,
# #         "Azure Backup": 145.23,
# #         "Container Registry": 78.90,
# #         "Service Bus": 56.34,
# #         "Azure Cognitive Services": 234.56,
# #     }
# #     total = sum(services.values())
# #     return {
# #         "currency": "USD",
# #         "billing_period": datetime.now(timezone.utc).strftime("%Y-%m"),
# #         "total": round(total, 2),
# #         "by_service": services,
# #         "forecast": round(total * 1.08, 2),
# #         "budget_limit": 8000.00,
# #         "budget_used_pct": round((total / 8000.0) * 100, 1),
# #         "mock": True,
# #     }
# #
# #
# # def scan_entra_id(tenant_id: str, client_id: str, subscription_id: str) -> Dict:
# #     """Mock Azure AD / Entra ID — equivalent of AWS IAM."""
# #     return {
# #         "users": [
# #             {"id": "usr-001", "display_name": "Alice Admin", "upn": "alice@contoso.com", "role": "Global Administrator", "mfa_enabled": True},
# #             {"id": "usr-002", "display_name": "Bob Dev", "upn": "bob@contoso.com", "role": "Contributor", "mfa_enabled": True},
# #             {"id": "usr-003", "display_name": "Carol Ops", "upn": "carol@contoso.com", "role": "Reader", "mfa_enabled": False},
# #             {"id": "usr-004", "display_name": "Dave Security", "upn": "dave@contoso.com", "role": "Security Reader", "mfa_enabled": True},
# #             {"id": "usr-005", "display_name": "Eve Monitor", "upn": "eve@contoso.com", "role": "Monitoring Contributor", "mfa_enabled": True},
# #         ],
# #         "service_principals": [
# #             {"id": "sp-001", "display_name": "cloudops-scanner", "app_id": client_id, "enabled": True},
# #             {"id": "sp-002", "display_name": "github-actions-deploy", "app_id": "aaaa-1111-bbbb-2222", "enabled": True},
# #             {"id": "sp-003", "display_name": "terraform-automation", "app_id": "cccc-3333-dddd-4444", "enabled": True},
# #         ],
# #         "groups": [
# #             {"id": "grp-001", "display_name": "CloudOps-Admins", "members": 3},
# #             {"id": "grp-002", "display_name": "Developers", "members": 12},
# #             {"id": "grp-003", "display_name": "ReadOnly-Users", "members": 8},
# #         ],
# #         "role_assignments": 47,
# #         "conditional_access_policies": 5,
# #         "mfa_users_count": 4,
# #         "mfa_users_total": 5,
# #         "mock": True,
# #     }
# #
# #
# # def scan_storage_accounts(tenant_id: str, client_id: str, subscription_id: str) -> List[Dict]:
# #     """Mock Azure Storage Accounts — equivalent of AWS S3."""
# #     accounts = []
# #     names = [
# #         "prodstorageeastus001", "backupstorageweu001", "logsstoragesea001",
# #         "datastorageprod001", "staticwebstorage001", "archivestorage001",
# #     ]
# #     for i, name in enumerate(names):
# #         rng = _rg(name)
# #         accounts.append({
# #             "id": f"/subscriptions/{subscription_id}/resourceGroups/rg-production/providers/Microsoft.Storage/storageAccounts/{name}",
# #             "name": name,
# #             "location": rng.choice(["eastus", "westeurope", "southeastasia"]),
# #             "sku": rng.choice(["Standard_LRS", "Standard_GRS", "Premium_LRS"]),
# #             "kind": rng.choice(["StorageV2", "BlobStorage", "FileStorage"]),
# #             "access_tier": rng.choice(["Hot", "Cool"]),
# #             "https_only": True,
# #             "blob_public_access": rng.choice([True, False]),
# #             "containers_count": rng.randint(1, 20),
# #             "size_gb": round(rng.uniform(10, 2000), 2),
# #             "replication": rng.choice(["LRS", "GRS", "RA-GRS", "ZRS"]),
# #             "encryption": "Microsoft Managed Keys",
# #             "created_at": _ts(days_ago=rng.randint(30, 730)),
# #         })
# #     return accounts
# #
# #
# # def scan_dns_zones(tenant_id: str, client_id: str, subscription_id: str) -> List[Dict]:
# #     """Mock Azure DNS Zones — equivalent of AWS Route53."""
# #     zones = [
# #         {"name": "contoso.com", "record_sets": 45, "type": "Public"},
# #         {"name": "internal.contoso.com", "record_sets": 23, "type": "Private"},
# #         {"name": "api.contoso.com", "record_sets": 12, "type": "Public"},
# #         {"name": "staging.contoso.com", "record_sets": 8, "type": "Public"},
# #     ]
# #     result = []
# #     for z in zones:
# #         result.append({
# #             "id": f"/subscriptions/{subscription_id}/resourceGroups/rg-networking/providers/Microsoft.Network/dnszones/{z['name']}",
# #             "name": z["name"],
# #             "type": z["type"],
# #             "record_sets": z["record_sets"],
# #             "name_servers": [
# #                 f"ns1-01.azure-dns.com", f"ns2-01.azure-dns.net",
# #                 f"ns3-01.azure-dns.org", f"ns4-01.azure-dns.info",
# #             ],
# #         })
# #     return result
# #
# #
# # def scan_cdn_profiles(tenant_id: str, client_id: str, subscription_id: str) -> List[Dict]:
# #     """Mock Azure CDN — equivalent of AWS CloudFront."""
# #     return [
# #         {
# #             "name": "cloudops-cdn-prod",
# #             "sku": "Standard_Microsoft",
# #             "endpoints": [
# #                 {"name": "app-endpoint", "hostname": "cloudops-app.azureedge.net", "origin": "app.contoso.com", "enabled": True},
# #                 {"name": "static-endpoint", "hostname": "cloudops-static.azureedge.net", "origin": "prodstorageeastus001.blob.core.windows.net", "enabled": True},
# #             ],
# #             "resource_group": "rg-production",
# #         },
# #         {
# #             "name": "cloudops-cdn-staging",
# #             "sku": "Standard_Microsoft",
# #             "endpoints": [
# #                 {"name": "staging-endpoint", "hostname": "cloudops-staging.azureedge.net", "origin": "staging.contoso.com", "enabled": True},
# #             ],
# #             "resource_group": "rg-staging",
# #         },
# #     ]
# #
# #
# # def scan_key_vaults(tenant_id: str, client_id: str, subscription_id: str) -> List[Dict]:
# #     """Mock Azure Key Vault — equivalent of AWS KMS + Secrets Manager."""
# #     vaults = []
# #     vault_names = ["kv-prod-eastus", "kv-staging-weu", "kv-shared-secrets"]
# #     for name in vault_names:
# #         rng = _rg(name)
# #         vaults.append({
# #             "id": f"/subscriptions/{subscription_id}/resourceGroups/rg-security/providers/Microsoft.KeyVault/vaults/{name}",
# #             "name": name,
# #             "location": rng.choice(["eastus", "westeurope"]),
# #             "sku": "standard",
# #             "secrets_count": rng.randint(5, 40),
# #             "keys_count": rng.randint(2, 15),
# #             "certificates_count": rng.randint(1, 8),
# #             "soft_delete_enabled": True,
# #             "purge_protection": True,
# #             "rbac_enabled": True,
# #             "access_policies": rng.randint(2, 10),
# #         })
# #     return vaults
# #
# #
# # def scan_subscriptions(tenant_id: str, client_id: str, subscription_id: str) -> List[Dict]:
# #     """Mock subscriptions list."""
# #     return [
# #         {
# #             "subscription_id": subscription_id,
# #             "display_name": "CloudOps Production",
# #             "state": "Enabled",
# #             "tenant_id": tenant_id,
# #         }
# #     ]
# #
# #
# # # ══════════════════════════════════════════════════════════════════════════════
# # # PER-REGION SERVICES
# # # ══════════════════════════════════════════════════════════════════════════════
# #
# # def scan_virtual_machines(creds: Dict, region: str) -> List[Dict]:
# #     """Mock Azure Virtual Machines — equivalent of AWS EC2."""
# #     rng = _rg(f"vm-{region}")
# #     vm_count = rng.randint(2, 8)
# #     vm_sizes = ["Standard_D2s_v3", "Standard_D4s_v3", "Standard_E8s_v3",
# #                 "Standard_B2ms", "Standard_F4s_v2", "Standard_D8s_v4"]
# #     states = ["running", "running", "running", "stopped", "deallocated"]
# #     os_types = ["Linux", "Linux", "Linux", "Windows", "Windows"]
# #     vms = []
# #     for i in range(vm_count):
# #         vm_id = f"vm-{region}-{i+1:03d}"
# #         state = rng.choice(states)
# #         vms.append({
# #             "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-production/providers/Microsoft.Compute/virtualMachines/{vm_id}",
# #             "name": vm_id,
# #             "location": region,
# #             "vm_size": rng.choice(vm_sizes),
# #             "os_type": rng.choice(os_types),
# #             "state": state,
# #             "power_state": "running" if state == "running" else "stopped",
# #             "private_ip": f"10.{rng.randint(0,255)}.{rng.randint(0,255)}.{rng.randint(4,254)}",
# #             "public_ip": f"20.{rng.randint(1,254)}.{rng.randint(1,254)}.{rng.randint(1,254)}" if rng.random() > 0.4 else None,
# #             "resource_group": "rg-production",
# #             "availability_zone": rng.choice(["1", "2", "3", None]),
# #             "os_disk_size_gb": rng.choice([64, 128, 256, 512]),
# #             "tags": {"env": "production", "team": rng.choice(["backend", "frontend", "data"])},
# #             "region": region,
# #         })
# #     return vms
# #
# #
# # def scan_azure_functions(creds: Dict, region: str) -> List[Dict]:
# #     """Mock Azure Functions — equivalent of AWS Lambda."""
# #     rng = _rg(f"func-{region}")
# #     if rng.random() < 0.4:
# #         return []
# #     fn_count = rng.randint(1, 5)
# #     runtimes = ["python:3.11", "node:18", "dotnet:6", "java:17"]
# #     functions = []
# #     for i in range(fn_count):
# #         name = f"func-{region}-{rng.choice(['api', 'worker', 'trigger', 'processor'])}-{i+1}"
# #         functions.append({
# #             "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-production/providers/Microsoft.Web/sites/{name}",
# #             "name": name,
# #             "location": region,
# #             "runtime": rng.choice(runtimes),
# #             "plan": rng.choice(["Consumption", "Premium EP1", "Premium EP2"]),
# #             "state": "Running",
# #             "invocations_24h": rng.randint(100, 50000),
# #             "avg_duration_ms": rng.randint(50, 2000),
# #             "resource_group": "rg-production",
# #             "region": region,
# #         })
# #     return functions
# #
# #
# # def scan_sql_databases(creds: Dict, region: str) -> List[Dict]:
# #     """Mock Azure SQL Databases — equivalent of AWS RDS."""
# #     rng = _rg(f"sql-{region}")
# #     if rng.random() < 0.5:
# #         return []
# #     db_count = rng.randint(1, 4)
# #     dbs = []
# #     for i in range(db_count):
# #         name = f"sql-{region}-{rng.choice(['app', 'analytics', 'reporting', 'audit'])}-{i+1}"
# #         dbs.append({
# #             "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-data/providers/Microsoft.Sql/servers/{name}-server/databases/{name}-db",
# #             "name": f"{name}-db",
# #             "server": f"{name}-server.database.windows.net",
# #             "location": region,
# #             "sku": rng.choice(["Basic", "Standard S2", "Standard S4", "Premium P1", "GeneralPurpose"]),
# #             "dtus": rng.choice([50, 100, 200, 400]),
# #             "max_size_gb": rng.choice([32, 100, 250, 500]),
# #             "status": "Online",
# #             "backup_retention_days": rng.choice([7, 14, 35]),
# #             "geo_redundant_backup": rng.choice([True, False]),
# #             "tde_enabled": True,
# #             "resource_group": "rg-data",
# #             "region": region,
# #         })
# #     return dbs
# #
# #
# # def scan_virtual_networks(creds: Dict, region: str) -> Dict:
# #     """Mock Azure Virtual Networks — equivalent of AWS VPC."""
# #     rng = _rg(f"vnet-{region}")
# #     vnet_count = rng.randint(1, 3)
# #     vnets = []
# #     for i in range(vnet_count):
# #         subnet_count = rng.randint(2, 6)
# #         subnets = []
# #         for j in range(subnet_count):
# #             subnets.append({
# #                 "name": f"subnet-{['app', 'data', 'gateway', 'mgmt', 'dmz', 'private'][j % 6]}",
# #                 "address_prefix": f"10.{i}.{j}.0/24",
# #                 "nsg": f"nsg-subnet-{j+1}" if rng.random() > 0.3 else None,
# #             })
# #         vnets.append({
# #             "name": f"vnet-{region}-{i+1:02d}",
# #             "address_space": [f"10.{i}.0.0/16"],
# #             "subnets": subnets,
# #             "peerings": rng.randint(0, 3),
# #             "service_endpoints": rng.randint(0, 5),
# #             "ddos_protection": rng.choice([True, False]),
# #             "resource_group": "rg-networking",
# #             "region": region,
# #         })
# #     nsgs = [
# #         {"name": f"nsg-{region}-web", "rules": 8, "associated_subnets": 1},
# #         {"name": f"nsg-{region}-app", "rules": 12, "associated_subnets": 2},
# #         {"name": f"nsg-{region}-db", "rules": 5, "associated_subnets": 1},
# #     ]
# #     return {
# #         "vnets": vnets,
# #         "subnets": sum(len(v["subnets"]) for v in vnets),
# #         "network_security_groups": nsgs,
# #         "nsg_count": len(nsgs),
# #         "public_ips": rng.randint(2, 10),
# #         "region": region,
# #     }
# #
# #
# # def scan_aks_clusters(creds: Dict, region: str) -> List[Dict]:
# #     """Mock Azure Kubernetes Service — equivalent of AWS EKS."""
# #     rng = _rg(f"aks-{region}")
# #     if rng.random() < 0.6:
# #         return []
# #     cluster_count = rng.randint(1, 2)
# #     clusters = []
# #     for i in range(cluster_count):
# #         name = f"aks-{region}-{rng.choice(['prod', 'staging'])}-{i+1:02d}"
# #         node_count = rng.randint(3, 12)
# #         clusters.append({
# #             "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-production/providers/Microsoft.ContainerService/managedClusters/{name}",
# #             "name": name,
# #             "location": region,
# #             "kubernetes_version": rng.choice(["1.28.5", "1.29.2", "1.30.0"]),
# #             "node_pools": [
# #                 {
# #                     "name": "systempool",
# #                     "vm_size": "Standard_D4s_v3",
# #                     "count": 3,
# #                     "min_count": 2,
# #                     "max_count": 5,
# #                     "mode": "System",
# #                     "os": "Linux",
# #                 },
# #                 {
# #                     "name": "userpool",
# #                     "vm_size": rng.choice(["Standard_D8s_v3", "Standard_E4s_v3"]),
# #                     "count": node_count - 3,
# #                     "min_count": 2,
# #                     "max_count": 20,
# #                     "mode": "User",
# #                     "os": "Linux",
# #                 }
# #             ],
# #             "total_nodes": node_count,
# #             "network_plugin": "azure",
# #             "network_policy": "calico",
# #             "rbac_enabled": True,
# #             "monitoring_enabled": True,
# #             "power_state": "Running",
# #             "resource_group": "rg-production",
# #             "region": region,
# #         })
# #     return clusters
# #
# #
# # def scan_container_registry(creds: Dict, region: str) -> List[Dict]:
# #     """Mock Azure Container Registry — equivalent of AWS ECR."""
# #     rng = _rg(f"acr-{region}")
# #     if rng.random() < 0.7:
# #         return []
# #     registries = []
# #     name = f"acr{region.replace('-', '')}prod001"
# #     repos = [
# #         "backend/api", "frontend/app", "workers/processor",
# #         "infra/nginx", "data/etl-job", "ml/inference",
# #     ]
# #     registries.append({
# #         "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-devops/providers/Microsoft.ContainerRegistry/registries/{name}",
# #         "name": name,
# #         "location": region,
# #         "sku": rng.choice(["Basic", "Standard", "Premium"]),
# #         "login_server": f"{name}.azurecr.io",
# #         "repositories": rng.randint(3, len(repos)),
# #         "images": rng.randint(20, 200),
# #         "admin_enabled": False,
# #         "geo_replication": rng.choice([True, False]),
# #         "resource_group": "rg-devops",
# #         "region": region,
# #     })
# #     return registries
# #
# #
# # def scan_app_service(creds: Dict, region: str) -> List[Dict]:
# #     """Mock Azure App Service — equivalent of AWS Elastic Beanstalk / App Runner."""
# #     rng = _rg(f"app-{region}")
# #     if rng.random() < 0.5:
# #         return []
# #     app_count = rng.randint(1, 4)
# #     apps = []
# #     for i in range(app_count):
# #         name = f"app-{region}-{rng.choice(['api', 'web', 'portal', 'admin'])}-{i+1}"
# #         apps.append({
# #             "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-production/providers/Microsoft.Web/sites/{name}",
# #             "name": name,
# #             "location": region,
# #             "plan": f"plan-{region}-{rng.choice(['B2', 'P1v3', 'P2v3', 'S2'])}",
# #             "runtime": rng.choice(["Python 3.11", "Node 18", ".NET 8", "Java 17"]),
# #             "state": "Running",
# #             "url": f"https://{name}.azurewebsites.net",
# #             "https_only": True,
# #             "always_on": rng.choice([True, False]),
# #             "resource_group": "rg-production",
# #             "region": region,
# #         })
# #     return apps
# #
# #
# # def scan_load_balancers(creds: Dict, region: str) -> List[Dict]:
# #     """Mock Azure Load Balancers + Application Gateways — equivalent of AWS ELB."""
# #     rng = _rg(f"lb-{region}")
# #     if rng.random() < 0.5:
# #         return []
# #     lbs = []
# #     lb_count = rng.randint(1, 3)
# #     for i in range(lb_count):
# #         lb_type = rng.choice(["Standard Load Balancer", "Application Gateway"])
# #         name = f"{'lb' if 'Load' in lb_type else 'agw'}-{region}-{i+1:02d}"
# #         lbs.append({
# #             "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-networking/providers/Microsoft.Network/{name}",
# #             "name": name,
# #             "location": region,
# #             "type": lb_type,
# #             "sku": "Standard",
# #             "frontend_ips": rng.randint(1, 3),
# #             "backend_pools": rng.randint(1, 4),
# #             "rules": rng.randint(2, 10),
# #             "state": "Succeeded",
# #             "resource_group": "rg-networking",
# #             "region": region,
# #         })
# #     return lbs
# #
# #
# # def scan_monitor_alerts(creds: Dict, region: str) -> List[Dict]:
# #     """Mock Azure Monitor Alerts — equivalent of AWS CloudWatch."""
# #     rng = _rg(f"mon-{region}")
# #     alert_count = rng.randint(3, 10)
# #     severities = ["Critical", "Error", "Warning", "Informational"]
# #     categories = ["Compute", "Storage", "Network", "Database", "Security"]
# #     alerts = []
# #     for i in range(alert_count):
# #         sev = rng.choice(severities)
# #         alerts.append({
# #             "id": f"alert-{region}-{i+1:03d}",
# #             "name": f"Alert-{rng.choice(categories)}-{region}-{i+1}",
# #             "description": rng.choice([
# #                 "CPU utilization exceeded threshold",
# #                 "Memory pressure detected",
# #                 "Disk I/O spike detected",
# #                 "Network latency increased",
# #                 "Failed authentication attempts detected",
# #                 "Database DTU limit approaching",
# #                 "Storage account capacity threshold",
# #                 "Function execution errors increased",
# #             ]),
# #             "severity": sev,
# #             "severity_num": severities.index(sev),
# #             "condition": "Static threshold",
# #             "frequency": f"PT{rng.choice([5, 15, 30, 60])}M",
# #             "window": f"PT{rng.choice([15, 30, 60])}M",
# #             "state": rng.choice(["Enabled", "Enabled", "Enabled", "Disabled"]),
# #             "region": region,
# #         })
# #     return alerts
# #
# #
# # def scan_service_bus(creds: Dict, region: str) -> List[Dict]:
# #     """Mock Azure Service Bus — equivalent of AWS SQS/SNS."""
# #     rng = _rg(f"sb-{region}")
# #     if rng.random() < 0.6:
# #         return []
# #     namespaces = []
# #     ns_count = rng.randint(1, 2)
# #     for i in range(ns_count):
# #         name = f"sb-{region}-{rng.choice(['prod', 'events', 'notifications'])}-{i+1}"
# #         queues = [
# #             {"name": "order-processing", "messages": rng.randint(0, 500), "dead_letter": rng.randint(0, 10)},
# #             {"name": "email-notifications", "messages": rng.randint(0, 200), "dead_letter": 0},
# #             {"name": "audit-events", "messages": rng.randint(0, 1000), "dead_letter": rng.randint(0, 5)},
# #         ]
# #         topics = [
# #             {"name": "user-events", "subscriptions": 3, "messages": rng.randint(0, 300)},
# #             {"name": "inventory-updates", "subscriptions": 2, "messages": rng.randint(0, 150)},
# #         ]
# #         namespaces.append({
# #             "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-production/providers/Microsoft.ServiceBus/namespaces/{name}",
# #             "name": name,
# #             "location": region,
# #             "sku": rng.choice(["Standard", "Premium"]),
# #             "queues": queues,
# #             "topics": topics,
# #             "resource_group": "rg-production",
# #             "region": region,
# #         })
# #     return namespaces
# #
# #
# # def scan_cosmos_db(creds: Dict, region: str) -> List[Dict]:
# #     """Mock Azure Cosmos DB — equivalent of AWS DynamoDB."""
# #     rng = _rg(f"cosmos-{region}")
# #     if rng.random() < 0.7:
# #         return []
# #     accounts = []
# #     acct_count = rng.randint(1, 2)
# #     for i in range(acct_count):
# #         name = f"cosmos-{region}-{rng.choice(['app', 'telemetry', 'sessions'])}-{i+1}"
# #         accounts.append({
# #             "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-data/providers/Microsoft.DocumentDB/databaseAccounts/{name}",
# #             "name": name,
# #             "location": region,
# #             "api": rng.choice(["Core (SQL)", "MongoDB", "Cassandra", "Table"]),
# #             "consistency": rng.choice(["Session", "Eventual", "Strong", "BoundedStaleness"]),
# #             "multi_region": rng.choice([True, False]),
# #             "autopilot": rng.choice([True, False]),
# #             "databases_count": rng.randint(1, 5),
# #             "containers_count": rng.randint(2, 15),
# #             "ru_per_second": rng.choice([400, 1000, 2000, 4000, 10000]),
# #             "resource_group": "rg-data",
# #             "region": region,
# #         })
# #     return accounts
# #
# #
# # def scan_redis_cache(creds: Dict, region: str) -> List[Dict]:
# #     """Mock Azure Cache for Redis — equivalent of AWS ElastiCache."""
# #     rng = _rg(f"redis-{region}")
# #     if rng.random() < 0.7:
# #         return []
# #     caches = []
# #     name = f"redis-{region}-{rng.choice(['session', 'cache'])}-001"
# #     caches.append({
# #         "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-production/providers/Microsoft.Cache/redis/{name}",
# #         "name": name,
# #         "location": region,
# #         "sku": rng.choice(["Basic C0", "Standard C1", "Premium P1"]),
# #         "redis_version": "7.0",
# #         "capacity_gb": rng.choice([1, 6, 13, 26]),
# #         "port": 6379,
# #         "ssl_port": 6380,
# #         "non_ssl_enabled": False,
# #         "state": "Running",
# #         "resource_group": "rg-production",
# #         "region": region,
# #     })
# #     return caches
# #
# #
# # def scan_vpn_gateways(creds: Dict, region: str) -> List[Dict]:
# #     """Mock Azure VPN Gateways — equivalent of AWS VPN."""
# #     rng = _rg(f"vpn-{region}")
# #     if rng.random() < 0.75:
# #         return []
# #     gateways = [{
# #         "name": f"vpngw-{region}-001",
# #         "location": region,
# #         "sku": rng.choice(["VpnGw1", "VpnGw2", "ErGw1AZ"]),
# #         "type": rng.choice(["VPN", "ExpressRoute"]),
# #         "connections": rng.randint(1, 5),
# #         "state": "Succeeded",
# #         "resource_group": "rg-networking",
# #         "region": region,
# #     }]
# #     return gateways
# #
# #
# # def scan_backup_vaults(creds: Dict, region: str) -> List[Dict]:
# #     """Mock Azure Backup — equivalent of AWS Backup."""
# #     rng = _rg(f"backup-{region}")
# #     if rng.random() < 0.6:
# #         return []
# #     vaults = [{
# #         "name": f"rsv-{region}-backup-001",
# #         "location": region,
# #         "sku": "Standard",
# #         "backup_items": rng.randint(5, 30),
# #         "storage_used_gb": round(rng.uniform(50, 2000), 2),
# #         "replication": rng.choice(["LocallyRedundant", "GeoRedundant", "ZoneRedundant"]),
# #         "state": "Active",
# #         "resource_group": "rg-production",
# #         "region": region,
# #     }]
# #     return vaults
# #
# #
# # def scan_security_center(creds: Dict, region: str) -> Dict:
# #     """Mock Microsoft Defender for Cloud — equivalent of AWS Security Hub / GuardDuty."""
# #     rng = _rg(f"sec-{region}")
# #     return {
# #         "secure_score": round(rng.uniform(45, 85), 1),
# #         "max_score": 100,
# #         "recommendations": [
# #             {"title": "Enable MFA for all privileged users", "severity": "High", "state": "Active"},
# #             {"title": "Apply system updates on machines", "severity": "High", "state": "Active"},
# #             {"title": "Enable endpoint protection", "severity": "Medium", "state": "Active"},
# #             {"title": "Encrypt data at rest", "severity": "Medium", "state": rng.choice(["Active", "Resolved"])},
# #             {"title": "Enable Just-in-time VM access", "severity": "Medium", "state": "Active"},
# #             {"title": "Enable Azure Defender for SQL", "severity": "High", "state": rng.choice(["Active", "Resolved"])},
# #         ],
# #         "alerts_active": rng.randint(0, 10),
# #         "alerts_resolved_30d": rng.randint(5, 40),
# #         "defender_plans": {
# #             "Servers": rng.choice(["On", "Off"]),
# #             "SQL": rng.choice(["On", "Off"]),
# #             "Storage": "On",
# #             "Kubernetes": rng.choice(["On", "Off"]),
# #             "Containers": rng.choice(["On", "Off"]),
# #         },
# #         "region": region,
# #     }
# #
# #
# # # ══════════════════════════════════════════════════════════════════════════════
# # # EXTENDED: ANALYTICS  (= Redshift / Glue / EMR / Kinesis / Athena / MSK / OpenSearch / QuickSight)
# # # ══════════════════════════════════════════════════════════════════════════════
# #
# # def scan_synapse(creds: Dict, region: str) -> List[Dict]:
# #     """Azure Synapse Analytics — equivalent of AWS Redshift + Glue + EMR."""
# #     rng = _rg(f"synapse-{region}")
# #     if rng.random() < 0.7:
# #         return []
# #     workspaces = []
# #     name = f"synapse-{region}-{rng.choice(['analytics', 'dw', 'bi'])}-001"
# #     workspaces.append({
# #         "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-data/providers/Microsoft.Synapse/workspaces/{name}",
# #         "name": name,
# #         "location": region,
# #         "sql_pools": [
# #             {
# #                 "name": f"{name}-pool-001",
# #                 "sku": rng.choice(["DW100c", "DW200c", "DW500c", "DW1000c"]),
# #                 "status": rng.choice(["Online", "Paused", "Online"]),
# #                 "max_size_tb": rng.choice([1, 5, 10]),
# #             }
# #         ],
# #         "spark_pools": [
# #             {
# #                 "name": f"{name}-spark-001",
# #                 "node_size": rng.choice(["Small", "Medium", "Large"]),
# #                 "node_count": rng.randint(3, 10),
# #                 "autoscale": True,
# #             }
# #         ],
# #         "pipelines_count": rng.randint(5, 30),
# #         "linked_services": rng.randint(3, 15),
# #         "managed_vnet": rng.choice([True, False]),
# #         "resource_group": "rg-data",
# #         "region": region,
# #     })
# #     return workspaces
# #
# #
# # def scan_data_factory(creds: Dict, region: str) -> List[Dict]:
# #     """Azure Data Factory — equivalent of AWS Glue ETL."""
# #     rng = _rg(f"adf-{region}")
# #     if rng.random() < 0.65:
# #         return []
# #     factories = []
# #     name = f"adf-{region}-{rng.choice(['etl', 'ingestion', 'transform'])}-001"
# #     factories.append({
# #         "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-data/providers/Microsoft.DataFactory/factories/{name}",
# #         "name": name,
# #         "location": region,
# #         "pipelines_count": rng.randint(10, 60),
# #         "datasets_count": rng.randint(15, 80),
# #         "linked_services_count": rng.randint(5, 25),
# #         "triggers_count": rng.randint(3, 20),
# #         "integration_runtimes": [
# #             {"name": "AutoResolveIntegrationRuntime", "type": "Managed", "state": "Online"},
# #             {"name": "SelfHostedIR", "type": "SelfHosted", "state": rng.choice(["Online", "Offline"])},
# #         ],
# #         "git_configured": rng.choice([True, False]),
# #         "resource_group": "rg-data",
# #         "region": region,
# #     })
# #     return factories
# #
# #
# # def scan_hdinsight(creds: Dict, region: str) -> List[Dict]:
# #     """Azure HDInsight — equivalent of AWS EMR."""
# #     rng = _rg(f"hdi-{region}")
# #     if rng.random() < 0.85:
# #         return []
# #     clusters = []
# #     cluster_types = ["Hadoop", "Spark", "HBase", "Kafka", "Interactive Query"]
# #     name = f"hdi-{region}-{rng.choice(['spark', 'kafka'])}-001"
# #     clusters.append({
# #         "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-data/providers/Microsoft.HDInsight/clusters/{name}",
# #         "name": name,
# #         "location": region,
# #         "cluster_type": rng.choice(cluster_types),
# #         "cluster_version": rng.choice(["4.0", "5.0"]),
# #         "os_type": "Linux",
# #         "worker_nodes": rng.randint(3, 20),
# #         "head_node_size": "Standard_D12_v2",
# #         "worker_node_size": rng.choice(["Standard_D4_v2", "Standard_D8_v2"]),
# #         "state": rng.choice(["Running", "Running", "Deleting"]),
# #         "resource_group": "rg-data",
# #         "region": region,
# #     })
# #     return clusters
# #
# #
# # def scan_event_hubs(creds: Dict, region: str) -> List[Dict]:
# #     """Azure Event Hubs — equivalent of AWS Kinesis Streams."""
# #     rng = _rg(f"evhub-{region}")
# #     if rng.random() < 0.6:
# #         return []
# #     namespaces = []
# #     name = f"evhub-{region}-{rng.choice(['telemetry', 'streaming', 'iot'])}-001"
# #     namespaces.append({
# #         "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-production/providers/Microsoft.EventHub/namespaces/{name}",
# #         "name": name,
# #         "location": region,
# #         "sku": rng.choice(["Basic", "Standard", "Premium"]),
# #         "throughput_units": rng.randint(1, 20),
# #         "auto_inflate": rng.choice([True, False]),
# #         "max_throughput_units": rng.randint(20, 40),
# #         "event_hubs": [
# #             {"name": "telemetry-stream", "partitions": rng.choice([4, 8, 16, 32]), "retention_days": rng.choice([1, 3, 7])},
# #             {"name": "clickstream", "partitions": rng.choice([4, 8]), "retention_days": 1},
# #             {"name": "audit-log", "partitions": 4, "retention_days": 7},
# #         ],
# #         "kafka_enabled": rng.choice([True, False]),
# #         "resource_group": "rg-production",
# #         "region": region,
# #     })
# #     return namespaces
# #
# #
# # def scan_stream_analytics(creds: Dict, region: str) -> List[Dict]:
# #     """Azure Stream Analytics — equivalent of AWS Kinesis Data Analytics / Firehose."""
# #     rng = _rg(f"asa-{region}")
# #     if rng.random() < 0.75:
# #         return []
# #     jobs = []
# #     job_count = rng.randint(1, 3)
# #     for i in range(job_count):
# #         name = f"asa-{region}-{rng.choice(['realtime', 'etl', 'alerts'])}-{i+1}"
# #         jobs.append({
# #             "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-data/providers/Microsoft.StreamAnalytics/streamingjobs/{name}",
# #             "name": name,
# #             "location": region,
# #             "sku": rng.choice(["Standard", "StandardV2"]),
# #             "streaming_units": rng.choice([3, 6, 12, 36]),
# #             "status": rng.choice(["Running", "Running", "Stopped"]),
# #             "inputs_count": rng.randint(1, 4),
# #             "outputs_count": rng.randint(1, 3),
# #             "query_lines": rng.randint(10, 100),
# #             "resource_group": "rg-data",
# #             "region": region,
# #         })
# #     return jobs
# #
# #
# # def scan_databricks(creds: Dict, region: str) -> List[Dict]:
# #     """Azure Databricks — equivalent of AWS EMR / Glue Spark."""
# #     rng = _rg(f"dbricks-{region}")
# #     if rng.random() < 0.75:
# #         return []
# #     workspaces = []
# #     name = f"dbw-{region}-{rng.choice(['analytics', 'ml', 'etl'])}-001"
# #     workspaces.append({
# #         "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-data/providers/Microsoft.Databricks/workspaces/{name}",
# #         "name": name,
# #         "location": region,
# #         "sku": rng.choice(["standard", "premium", "trial"]),
# #         "managed_resource_group": f"rg-dbricks-{region}-managed",
# #         "clusters_count": rng.randint(2, 10),
# #         "jobs_count": rng.randint(5, 40),
# #         "notebooks_count": rng.randint(20, 200),
# #         "state": "Active",
# #         "resource_group": "rg-data",
# #         "region": region,
# #     })
# #     return workspaces
# #
# #
# # def scan_power_bi_embedded(creds: Dict, region: str) -> List[Dict]:
# #     """Azure Power BI Embedded — equivalent of AWS QuickSight."""
# #     rng = _rg(f"pbi-{region}")
# #     if rng.random() < 0.85:
# #         return []
# #     capacities = [{
# #         "name": f"pbi-{region}-capacity-001",
# #         "location": region,
# #         "sku": rng.choice(["A1", "A2", "A3", "A4"]),
# #         "state": rng.choice(["Active", "Paused"]),
# #         "administrators": rng.randint(1, 5),
# #         "resource_group": "rg-data",
# #         "region": region,
# #     }]
# #     return capacities
# #
# #
# # # ══════════════════════════════════════════════════════════════════════════════
# # # EXTENDED: AI / ML  (= SageMaker / Bedrock / Rekognition / Comprehend / Textract / Lex)
# # # ══════════════════════════════════════════════════════════════════════════════
# #
# # def scan_ml_workspace(creds: Dict, region: str) -> List[Dict]:
# #     """Azure Machine Learning — equivalent of AWS SageMaker."""
# #     rng = _rg(f"aml-{region}")
# #     if rng.random() < 0.7:
# #         return []
# #     workspaces = []
# #     name = f"aml-{region}-{rng.choice(['prod', 'research', 'experiments'])}-001"
# #     workspaces.append({
# #         "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-data/providers/Microsoft.MachineLearningServices/workspaces/{name}",
# #         "name": name,
# #         "location": region,
# #         "sku": rng.choice(["Basic", "Enterprise"]),
# #         "compute_clusters": [
# #             {"name": "cpu-cluster", "type": "AmlCompute", "vm_size": "Standard_D4s_v3", "nodes_min": 0, "nodes_max": 10, "state": "Succeeded"},
# #             {"name": "gpu-cluster", "type": "AmlCompute", "vm_size": "Standard_NC6", "nodes_min": 0, "nodes_max": 4, "state": "Succeeded"},
# #         ],
# #         "experiments_count": rng.randint(10, 100),
# #         "models_count": rng.randint(5, 50),
# #         "endpoints_count": rng.randint(1, 10),
# #         "pipelines_count": rng.randint(3, 20),
# #         "datastores_count": rng.randint(2, 8),
# #         "resource_group": "rg-data",
# #         "region": region,
# #     })
# #     return workspaces
# #
# #
# # def scan_cognitive_services(creds: Dict, region: str) -> List[Dict]:
# #     """Azure Cognitive Services — equivalent of AWS Rekognition + Comprehend + Textract + Lex."""
# #     rng = _rg(f"cog-{region}")
# #     if rng.random() < 0.6:
# #         return []
# #     svc_types = [
# #         ("ComputerVision",     "Computer Vision",      "S1"),
# #         ("TextAnalytics",      "Language",             "S"),
# #         ("FormRecognizer",     "Document Intelligence","S0"),
# #         ("SpeechServices",     "Speech",               "S0"),
# #         ("LUIS",               "Language Understanding","S0"),
# #         ("ContentModerator",   "Content Moderator",    "S0"),
# #         ("Face",               "Face API",             "S0"),
# #     ]
# #     services = []
# #     chosen = rng.sample(svc_types, k=rng.randint(2, 5))
# #     for kind, display, sku in chosen:
# #         name = f"cog-{kind.lower()}-{region}-001"
# #         services.append({
# #             "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-production/providers/Microsoft.CognitiveServices/accounts/{name}",
# #             "name": name,
# #             "kind": kind,
# #             "display_name": display,
# #             "location": region,
# #             "sku": sku,
# #             "calls_30d": rng.randint(1000, 500000),
# #             "public_access": rng.choice(["Enabled", "Disabled"]),
# #             "resource_group": "rg-production",
# #             "region": region,
# #         })
# #     return services
# #
# #
# # def scan_openai_service(creds: Dict, region: str) -> List[Dict]:
# #     """Azure OpenAI Service — equivalent of AWS Bedrock."""
# #     rng = _rg(f"aoai-{region}")
# #     # Only available in select regions
# #     available_regions = ["eastus", "westeurope", "uksouth", "australiaeast", "canadaeast"]
# #     if region not in available_regions or rng.random() < 0.5:
# #         return []
# #     accounts = []
# #     name = f"aoai-{region}-prod-001"
# #     deployments = [
# #         {"name": "gpt-4o", "model": "gpt-4o", "version": "2024-05-13", "capacity": rng.randint(10, 100)},
# #         {"name": "gpt-35-turbo", "model": "gpt-35-turbo", "version": "0613", "capacity": rng.randint(50, 300)},
# #         {"name": "text-embedding-ada-002", "model": "text-embedding-ada-002", "version": "2", "capacity": rng.randint(100, 500)},
# #     ]
# #     selected_deployments = rng.sample(deployments, k=rng.randint(1, len(deployments)))
# #     accounts.append({
# #         "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-production/providers/Microsoft.CognitiveServices/accounts/{name}",
# #         "name": name,
# #         "kind": "OpenAI",
# #         "location": region,
# #         "sku": "S0",
# #         "deployments": selected_deployments,
# #         "calls_30d": rng.randint(10000, 2000000),
# #         "tokens_30d": rng.randint(1000000, 500000000),
# #         "resource_group": "rg-production",
# #         "region": region,
# #     })
# #     return accounts
# #
# #
# # def scan_bot_service(creds: Dict, region: str) -> List[Dict]:
# #     """Azure Bot Service — equivalent of AWS Lex."""
# #     rng = _rg(f"bot-{region}")
# #     if rng.random() < 0.85:
# #         return []
# #     bots = [{
# #         "name": f"bot-{region}-{rng.choice(['customer-support', 'helpdesk', 'faq'])}-001",
# #         "location": "global",
# #         "sku": rng.choice(["F0", "S1"]),
# #         "kind": rng.choice(["sdk", "designer"]),
# #         "endpoint": f"https://bot-{region}-001.azurewebsites.net/api/messages",
# #         "channels": rng.randint(1, 5),
# #         "messages_30d": rng.randint(500, 50000),
# #         "resource_group": "rg-production",
# #         "region": region,
# #     }]
# #     return bots
# #
# #
# # def scan_search_service(creds: Dict, region: str) -> List[Dict]:
# #     """Azure AI Search — equivalent of AWS OpenSearch."""
# #     rng = _rg(f"search-{region}")
# #     if rng.random() < 0.7:
# #         return []
# #     services = [{
# #         "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-production/providers/Microsoft.Search/searchServices/srch-{region}-001",
# #         "name": f"srch-{region}-001",
# #         "location": region,
# #         "sku": rng.choice(["free", "basic", "standard", "standard2"]),
# #         "replicas": rng.randint(1, 6),
# #         "partitions": rng.randint(1, 12),
# #         "indexes_count": rng.randint(2, 20),
# #         "indexers_count": rng.randint(1, 10),
# #         "documents_count": rng.randint(10000, 10000000),
# #         "status": "running",
# #         "resource_group": "rg-production",
# #         "region": region,
# #     }]
# #     return services
# #
# #
# # # ══════════════════════════════════════════════════════════════════════════════
# # # EXTENDED: DEVOPS  (= CodePipeline / CodeBuild / CodeDeploy / CodeCommit / CodeArtifact / Amplify)
# # # ══════════════════════════════════════════════════════════════════════════════
# #
# # def scan_devops_pipelines(creds: Dict, region: str) -> List[Dict]:
# #     """Azure DevOps Pipelines — equivalent of AWS CodePipeline + CodeBuild + CodeDeploy."""
# #     rng = _rg(f"devops-{region}")
# #     if rng.random() < 0.6:
# #         return []
# #     organizations = []
# #     org_name = f"cloudops-devops-{region}"
# #     pipeline_names = [
# #         "frontend-ci-cd", "backend-api-deploy", "infrastructure-terraform",
# #         "data-pipeline-etl", "security-scan", "release-prod",
# #         "nightly-regression", "hotfix-deploy",
# #     ]
# #     chosen = rng.sample(pipeline_names, k=rng.randint(3, len(pipeline_names)))
# #     pipelines = []
# #     for p in chosen:
# #         last_run_status = rng.choice(["succeeded", "succeeded", "succeeded", "failed", "running"])
# #         pipelines.append({
# #             "name": p,
# #             "type": rng.choice(["Build", "Release", "YAML"]),
# #             "last_run_status": last_run_status,
# #             "last_run_at": _ts(hours_ago=rng.randint(1, 72)),
# #             "duration_sec": rng.randint(60, 1800),
# #             "trigger": rng.choice(["push", "schedule", "manual", "pr"]),
# #         })
# #     organizations.append({
# #         "organization": org_name,
# #         "projects": [
# #             {"name": "CloudOps-Backend", "pipelines": pipelines[:3], "repos": rng.randint(3, 10)},
# #             {"name": "CloudOps-Frontend", "pipelines": pipelines[3:], "repos": rng.randint(2, 6)},
# #         ],
# #         "total_pipelines": len(pipelines),
# #         "agents_count": rng.randint(2, 10),
# #         "agent_pools": [
# #             {"name": "Azure Pipelines", "type": "hosted", "agents": rng.randint(1, 5)},
# #             {"name": "Self-Hosted", "type": "private", "agents": rng.randint(1, 4)},
# #         ],
# #         "region": region,
# #     })
# #     return organizations
# #
# #
# # def scan_github_actions(creds: Dict, region: str) -> List[Dict]:
# #     """Azure-integrated GitHub Actions — equivalent of AWS CodeBuild."""
# #     rng = _rg(f"gh-{region}")
# #     if rng.random() < 0.75:
# #         return []
# #     # Only show for one primary region
# #     if region not in ["eastus", "westeurope"]:
# #         return []
# #     return [{
# #         "repos": rng.randint(5, 30),
# #         "active_workflows": rng.randint(10, 60),
# #         "runs_last_7d": rng.randint(50, 500),
# #         "success_rate_pct": round(rng.uniform(75, 99), 1),
# #         "self_hosted_runners": rng.randint(0, 5),
# #         "region": region,
# #     }]
# #
# #
# # def scan_container_apps(creds: Dict, region: str) -> List[Dict]:
# #     """Azure Container Apps — equivalent of AWS App Runner / ECS Fargate."""
# #     rng = _rg(f"aca-{region}")
# #     if rng.random() < 0.6:
# #         return []
# #     environments = []
# #     env_count = rng.randint(1, 2)
# #     for i in range(env_count):
# #         env_name = f"cae-{region}-{rng.choice(['prod', 'staging'])}-{i+1}"
# #         app_count = rng.randint(2, 6)
# #         apps = []
# #         app_templates = ["api-gateway", "auth-service", "notification-svc", "payment-svc", "inventory-svc", "report-svc"]
# #         chosen_apps = rng.sample(app_templates, k=app_count)
# #         for app in chosen_apps:
# #             apps.append({
# #                 "name": f"{app}-{region}",
# #                 "image": f"acrprodeastus001.azurecr.io/{app}:latest",
# #                 "replicas_min": rng.randint(1, 2),
# #                 "replicas_max": rng.randint(5, 20),
# #                 "cpu": rng.choice([0.5, 1.0, 2.0]),
# #                 "memory_gb": rng.choice([1.0, 2.0, 4.0]),
# #                 "ingress": rng.choice(["external", "internal"]),
# #                 "revisions": rng.randint(3, 20),
# #             })
# #         environments.append({
# #             "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-production/providers/Microsoft.App/managedEnvironments/{env_name}",
# #             "name": env_name,
# #             "location": region,
# #             "apps": apps,
# #             "apps_count": len(apps),
# #             "logs_workspace": f"law-{region}-001",
# #             "resource_group": "rg-production",
# #             "region": region,
# #         })
# #     return environments
# #
# #
# # def scan_static_web_apps(creds: Dict, region: str) -> List[Dict]:
# #     """Azure Static Web Apps — equivalent of AWS Amplify."""
# #     rng = _rg(f"swa-{region}")
# #     if rng.random() < 0.7:
# #         return []
# #     apps = []
# #     app_count = rng.randint(1, 3)
# #     for i in range(app_count):
# #         name = f"swa-{region}-{rng.choice(['portal', 'docs', 'marketing', 'admin'])}-{i+1}"
# #         apps.append({
# #             "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-production/providers/Microsoft.Web/staticSites/{name}",
# #             "name": name,
# #             "location": region,
# #             "sku": rng.choice(["Free", "Standard"]),
# #             "default_hostname": f"{name}.azurestaticapps.net",
# #             "custom_domains": rng.randint(0, 2),
# #             "branch": rng.choice(["main", "master"]),
# #             "build_status": rng.choice(["Ready", "Ready", "Building"]),
# #             "api_backend": rng.choice([True, False]),
# #             "resource_group": "rg-production",
# #             "region": region,
# #         })
# #     return apps
# #
# #
# # # ══════════════════════════════════════════════════════════════════════════════
# # # EXTENDED: MESSAGING / INTEGRATION  (= EventBridge / Step Functions / API Gateway / MQ / IoT / Pinpoint)
# # # ══════════════════════════════════════════════════════════════════════════════
# #
# # def scan_logic_apps(creds: Dict, region: str) -> List[Dict]:
# #     """Azure Logic Apps — equivalent of AWS Step Functions + EventBridge."""
# #     rng = _rg(f"logic-{region}")
# #     if rng.random() < 0.6:
# #         return []
# #     apps = []
# #     app_count = rng.randint(2, 8)
# #     triggers = ["HTTP", "Recurrence", "Service Bus", "Event Hub", "Blob Storage", "SQL"]
# #     for i in range(app_count):
# #         name = f"logic-{region}-{rng.choice(['approval', 'notification', 'sync', 'alert', 'etl'])}-{i+1:02d}"
# #         apps.append({
# #             "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-production/providers/Microsoft.Logic/workflows/{name}",
# #             "name": name,
# #             "location": region,
# #             "state": rng.choice(["Enabled", "Enabled", "Enabled", "Disabled"]),
# #             "trigger": rng.choice(triggers),
# #             "actions_count": rng.randint(3, 20),
# #             "runs_last_24h": rng.randint(0, 200),
# #             "success_rate_pct": round(rng.uniform(80, 100), 1),
# #             "last_run_at": _ts(hours_ago=rng.randint(0, 24)),
# #             "resource_group": "rg-production",
# #             "region": region,
# #         })
# #     return apps
# #
# #
# # def scan_event_grid(creds: Dict, region: str) -> List[Dict]:
# #     """Azure Event Grid — equivalent of AWS EventBridge / SNS."""
# #     rng = _rg(f"evgrid-{region}")
# #     if rng.random() < 0.65:
# #         return []
# #     topics = []
# #     topic_count = rng.randint(1, 4)
# #     for i in range(topic_count):
# #         name = f"evtgrid-{region}-{rng.choice(['infra', 'app', 'security'])}-{i+1}"
# #         topics.append({
# #             "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-production/providers/Microsoft.EventGrid/topics/{name}",
# #             "name": name,
# #             "location": region,
# #             "input_schema": rng.choice(["EventGridSchema", "CloudEventSchemaV1_0", "CustomInputSchema"]),
# #             "subscriptions_count": rng.randint(1, 6),
# #             "events_30d": rng.randint(1000, 5000000),
# #             "state": "Succeeded",
# #             "resource_group": "rg-production",
# #             "region": region,
# #         })
# #     return topics
# #
# #
# # def scan_api_management(creds: Dict, region: str) -> List[Dict]:
# #     """Azure API Management — equivalent of AWS API Gateway."""
# #     rng = _rg(f"apim-{region}")
# #     if rng.random() < 0.65:
# #         return []
# #     instances = []
# #     name = f"apim-{region}-prod-001"
# #     instances.append({
# #         "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-production/providers/Microsoft.ApiManagement/service/{name}",
# #         "name": name,
# #         "location": region,
# #         "sku": rng.choice(["Developer", "Basic", "Standard", "Premium"]),
# #         "gateway_url": f"https://{name}.azure-api.net",
# #         "portal_url": f"https://{name}.developer.azure-api.net",
# #         "apis_count": rng.randint(5, 40),
# #         "products_count": rng.randint(2, 8),
# #         "subscriptions_count": rng.randint(10, 100),
# #         "policies_count": rng.randint(5, 30),
# #         "backends_count": rng.randint(3, 15),
# #         "calls_30d": rng.randint(100000, 10000000),
# #         "state": "Succeeded",
# #         "resource_group": "rg-production",
# #         "region": region,
# #     })
# #     return instances
# #
# #
# # def scan_iot_hub(creds: Dict, region: str) -> List[Dict]:
# #     """Azure IoT Hub — equivalent of AWS IoT Core."""
# #     rng = _rg(f"iot-{region}")
# #     if rng.random() < 0.8:
# #         return []
# #     hubs = [{
# #         "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-production/providers/Microsoft.Devices/IotHubs/iothub-{region}-001",
# #         "name": f"iothub-{region}-001",
# #         "location": region,
# #         "sku": rng.choice(["B1", "B2", "S1", "S2", "S3"]),
# #         "units": rng.randint(1, 10),
# #         "registered_devices": rng.randint(100, 100000),
# #         "active_devices_24h": rng.randint(50, 5000),
# #         "messages_day_limit": rng.choice([400000, 6000000, 300000000]),
# #         "messages_today": rng.randint(10000, 200000),
# #         "routing_endpoints": rng.randint(1, 5),
# #         "state": "Active",
# #         "resource_group": "rg-production",
# #         "region": region,
# #     }]
# #     return hubs
# #
# #
# # def scan_notification_hubs(creds: Dict, region: str) -> List[Dict]:
# #     """Azure Notification Hubs — equivalent of AWS Pinpoint / SNS Mobile Push."""
# #     rng = _rg(f"notif-{region}")
# #     if rng.random() < 0.8:
# #         return []
# #     namespaces = [{
# #         "name": f"nhub-{region}-prod-001",
# #         "location": region,
# #         "sku": rng.choice(["Free", "Basic", "Standard"]),
# #         "hubs_count": rng.randint(1, 5),
# #         "registrations": rng.randint(10000, 5000000),
# #         "pushes_30d": rng.randint(50000, 10000000),
# #         "platforms": rng.sample(["APNS", "GCM/FCM", "WNS", "ADM"], k=rng.randint(2, 4)),
# #         "resource_group": "rg-production",
# #         "region": region,
# #     }]
# #     return namespaces
# #
# #
# # def scan_service_fabric(creds: Dict, region: str) -> List[Dict]:
# #     """Azure Service Fabric — equivalent of AWS ECS (microservices orchestration)."""
# #     rng = _rg(f"sf-{region}")
# #     if rng.random() < 0.9:
# #         return []
# #     clusters = [{
# #         "name": f"sf-{region}-prod-001",
# #         "location": region,
# #         "node_types": [
# #             {"name": "primary", "vm_size": "Standard_D4s_v3", "count": 5, "is_primary": True},
# #             {"name": "secondary", "vm_size": "Standard_D8s_v3", "count": rng.randint(3, 10), "is_primary": False},
# #         ],
# #         "reliability": rng.choice(["Silver", "Gold", "Platinum"]),
# #         "durability": rng.choice(["Bronze", "Silver", "Gold"]),
# #         "cluster_state": "Ready",
# #         "upgrade_mode": "Automatic",
# #         "applications_count": rng.randint(3, 15),
# #         "services_count": rng.randint(10, 50),
# #         "resource_group": "rg-production",
# #         "region": region,
# #     }]
# #     return clusters
# #
# #
# # # ══════════════════════════════════════════════════════════════════════════════
# # # EXTENDED: NETWORKING  (= Transit Gateway / Direct Connect / WAF / Network Firewall / Route53 Resolver)
# # # ══════════════════════════════════════════════════════════════════════════════
# #
# # def scan_virtual_wan(creds: Dict, region: str) -> List[Dict]:
# #     """Azure Virtual WAN — equivalent of AWS Transit Gateway."""
# #     rng = _rg(f"vwan-{region}")
# #     if rng.random() < 0.8:
# #         return []
# #     wans = [{
# #         "name": f"vwan-{region}-001",
# #         "location": region,
# #         "type": rng.choice(["Basic", "Standard"]),
# #         "hubs_count": rng.randint(1, 4),
# #         "vpn_sites": rng.randint(0, 10),
# #         "express_route_circuits": rng.randint(0, 3),
# #         "state": "Succeeded",
# #         "resource_group": "rg-networking",
# #         "region": region,
# #     }]
# #     return wans
# #
# #
# # def scan_express_route(creds: Dict, region: str) -> List[Dict]:
# #     """Azure ExpressRoute — equivalent of AWS Direct Connect."""
# #     rng = _rg(f"er-{region}")
# #     if rng.random() < 0.85:
# #         return []
# #     circuits = [{
# #         "name": f"er-{region}-primary-001",
# #         "location": region,
# #         "service_provider": rng.choice(["Equinix", "Megaport", "AT&T", "Verizon"]),
# #         "peering_location": rng.choice(["Silicon Valley", "London", "Amsterdam", "Singapore"]),
# #         "bandwidth_mbps": rng.choice([50, 100, 200, 500, 1000, 2000]),
# #         "sku": rng.choice(["Standard", "Premium"]),
# #         "billing": rng.choice(["MeteredData", "UnlimitedData"]),
# #         "circuit_state": "Enabled",
# #         "peerings": ["AzurePrivatePeering"],
# #         "resource_group": "rg-networking",
# #         "region": region,
# #     }]
# #     return circuits
# #
# #
# # def scan_waf_policies(creds: Dict, region: str) -> List[Dict]:
# #     """Azure WAF Policies — equivalent of AWS WAF."""
# #     rng = _rg(f"waf-{region}")
# #     if rng.random() < 0.65:
# #         return []
# #     policies = []
# #     policy_count = rng.randint(1, 3)
# #     for i in range(policy_count):
# #         name = f"waf-policy-{region}-{i+1:02d}"
# #         policies.append({
# #             "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-security/providers/Microsoft.Network/applicationGatewayWebApplicationFirewallPolicies/{name}",
# #             "name": name,
# #             "location": region,
# #             "mode": rng.choice(["Detection", "Prevention"]),
# #             "custom_rules": rng.randint(0, 10),
# #             "managed_rule_sets": ["OWASP 3.2", "Microsoft_BotManagerRuleSet 1.0"],
# #             "associated_with": rng.randint(1, 3),
# #             "requests_blocked_24h": rng.randint(0, 5000),
# #             "resource_group": "rg-security",
# #             "region": region,
# #         })
# #     return policies
# #
# #
# # def scan_azure_firewall(creds: Dict, region: str) -> List[Dict]:
# #     """Azure Firewall — equivalent of AWS Network Firewall."""
# #     rng = _rg(f"azfw-{region}")
# #     if rng.random() < 0.75:
# #         return []
# #     firewalls = [{
# #         "name": f"azfw-{region}-hub-001",
# #         "location": region,
# #         "sku": rng.choice(["Standard", "Premium"]),
# #         "tier": rng.choice(["Regional", "Global"]),
# #         "threat_intel_mode": rng.choice(["Alert", "Deny"]),
# #         "network_rule_collections": rng.randint(3, 15),
# #         "application_rule_collections": rng.randint(2, 10),
# #         "nat_rule_collections": rng.randint(0, 5),
# #         "public_ips": rng.randint(1, 3),
# #         "state": "Succeeded",
# #         "resource_group": "rg-networking",
# #         "region": region,
# #     }]
# #     return firewalls
# #
# #
# # def scan_private_dns(creds: Dict, region: str) -> List[Dict]:
# #     """Azure Private DNS Zones — equivalent of AWS Route53 Resolver / Private Hosted Zones."""
# #     rng = _rg(f"pdns-{region}")
# #     if rng.random() < 0.6:
# #         return []
# #     zones = [
# #         {"name": "privatelink.blob.core.windows.net", "records": rng.randint(5, 30), "vnet_links": rng.randint(1, 4)},
# #         {"name": "privatelink.database.windows.net", "records": rng.randint(2, 15), "vnet_links": rng.randint(1, 3)},
# #         {"name": f"internal.{region}.cloudops.local", "records": rng.randint(20, 100), "vnet_links": rng.randint(1, 5)},
# #     ]
# #     result = []
# #     for z in zones:
# #         result.append({
# #             "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-networking/providers/Microsoft.Network/privateDnsZones/{z['name']}",
# #             "name": z["name"],
# #             "record_sets": z["records"],
# #             "vnet_links": z["vnet_links"],
# #             "region": region,
# #         })
# #     return result
# #
# #
# # def scan_ddos_protection(creds: Dict, region: str) -> List[Dict]:
# #     """Azure DDoS Protection Plans — equivalent of AWS Shield."""
# #     rng = _rg(f"ddos-{region}")
# #     if rng.random() < 0.85:
# #         return []
# #     plans = [{
# #         "name": f"ddos-plan-{region}-001",
# #         "location": region,
# #         "protected_vnets": rng.randint(1, 5),
# #         "public_ips_protected": rng.randint(5, 30),
# #         "attacks_mitigated_30d": rng.randint(0, 3),
# #         "resource_group": "rg-security",
# #         "region": region,
# #     }]
# #     return plans
# #
# #
# # # ══════════════════════════════════════════════════════════════════════════════
# # # EXTENDED: GOVERNANCE  (= Trusted Advisor / Budgets / Config / Health)
# # # ══════════════════════════════════════════════════════════════════════════════
# #
# # def scan_azure_advisor(tenant_id: str, client_id: str, subscription_id: str) -> Dict:
# #     """Azure Advisor — equivalent of AWS Trusted Advisor."""
# #     return {
# #         "score": {
# #             "overall": 72,
# #             "cost": 68,
# #             "security": 75,
# #             "reliability": 80,
# #             "performance": 70,
# #             "operational_excellence": 65,
# #         },
# #         "recommendations": [
# #             {"category": "Cost", "impact": "High", "title": "Right-size or shutdown underutilized virtual machines", "savings_monthly": 234.50, "count": 3},
# #             {"category": "Cost", "impact": "Medium", "title": "Delete unattached managed disks", "savings_monthly": 45.20, "count": 7},
# #             {"category": "Cost", "impact": "Medium", "title": "Buy reserved instances for consistent VM usage", "savings_monthly": 567.80, "count": 5},
# #             {"category": "Security", "impact": "High", "title": "Enable Microsoft Defender for Servers", "savings_monthly": 0, "count": 2},
# #             {"category": "Security", "impact": "High", "title": "Remediate vulnerabilities on your machines", "savings_monthly": 0, "count": 15},
# #             {"category": "Reliability", "impact": "Medium", "title": "Enable soft delete for Azure Blob Storage", "savings_monthly": 0, "count": 4},
# #             {"category": "Reliability", "impact": "High", "title": "Use Availability Zones for VMs", "savings_monthly": 0, "count": 6},
# #             {"category": "Performance", "impact": "Medium", "title": "Improve App Service performance and reliability", "savings_monthly": 0, "count": 2},
# #             {"category": "OperationalExcellence", "impact": "Low", "title": "Create an Azure Service Health alert", "savings_monthly": 0, "count": 1},
# #         ],
# #         "total_potential_savings_monthly": 847.50,
# #         "mock": True,
# #     }
# #
# #
# # def scan_budgets(tenant_id: str, client_id: str, subscription_id: str) -> List[Dict]:
# #     """Azure Budgets — equivalent of AWS Budgets."""
# #     return [
# #         {
# #             "name": "Monthly-Production-Budget",
# #             "amount": 8000.00,
# #             "time_grain": "Monthly",
# #             "current_spend": 6756.32,
# #             "forecast_spend": 7234.00,
# #             "currency": "USD",
# #             "alert_thresholds": [
# #                 {"threshold_pct": 80, "contact_emails": ["finance@contoso.com"], "triggered": False},
# #                 {"threshold_pct": 100, "contact_emails": ["finance@contoso.com", "cto@contoso.com"], "triggered": False},
# #             ],
# #             "status": "Active",
# #         },
# #         {
# #             "name": "Dev-Staging-Budget",
# #             "amount": 2000.00,
# #             "time_grain": "Monthly",
# #             "current_spend": 1845.20,
# #             "forecast_spend": 2134.00,
# #             "currency": "USD",
# #             "alert_thresholds": [
# #                 {"threshold_pct": 90, "contact_emails": ["devops@contoso.com"], "triggered": True},
# #             ],
# #             "status": "Active",
# #         },
# #         {
# #             "name": "Annual-Cap",
# #             "amount": 90000.00,
# #             "time_grain": "Annually",
# #             "current_spend": 52341.00,
# #             "forecast_spend": 78000.00,
# #             "currency": "USD",
# #             "alert_thresholds": [
# #                 {"threshold_pct": 75, "contact_emails": ["finance@contoso.com"], "triggered": False},
# #             ],
# #             "status": "Active",
# #         },
# #     ]
# #
# #
# # def scan_policy_compliance(tenant_id: str, client_id: str, subscription_id: str) -> Dict:
# #     """Azure Policy — equivalent of AWS Config."""
# #     return {
# #         "assignments_count": 24,
# #         "initiatives_count": 8,
# #         "compliance_state": {
# #             "compliant": 187,
# #             "non_compliant": 23,
# #             "exempt": 5,
# #             "conflict": 2,
# #         },
# #         "compliance_pct": round(187 / (187 + 23) * 100, 1),
# #         "top_non_compliant_policies": [
# #             {"name": "Require tag on resources", "non_compliant": 12},
# #             {"name": "Allowed locations", "non_compliant": 6},
# #             {"name": "Audit VMs without managed disks", "non_compliant": 3},
# #             {"name": "Require HTTPS on storage accounts", "non_compliant": 2},
# #         ],
# #         "mock": True,
# #     }
# #
# #
# # def scan_service_health(tenant_id: str, client_id: str, subscription_id: str) -> Dict:
# #     """Azure Service Health — equivalent of AWS Health / Personal Health Dashboard."""
# #     return {
# #         "active_incidents": [
# #             {
# #                 "title": "Connectivity issues in East US",
# #                 "service": "Azure Virtual Machines",
# #                 "region": "eastus",
# #                 "severity": "Warning",
# #                 "status": "Active",
# #                 "started_at": _ts(hours_ago=2),
# #                 "impacted_subscriptions": 1,
# #             }
# #         ],
# #         "planned_maintenances": [
# #             {
# #                 "title": "SQL Database maintenance window",
# #                 "service": "Azure SQL Database",
# #                 "region": "westeurope",
# #                 "scheduled_at": _ts(days_ago=-3),
# #                 "duration_hours": 2,
# #             }
# #         ],
# #         "health_advisories": [
# #             {"title": "Action required: Migrate from TLS 1.0/1.1", "service": "Azure Storage", "impact": "High"},
# #             {"title": "Retirement: Classic VMs", "service": "Azure Virtual Machines", "impact": "Medium"},
# #         ],
# #         "alerts_configured": 5,
# #         "mock": True,
# #     }
# #
# #
# # def scan_log_analytics(creds: Dict, region: str) -> List[Dict]:
# #     """Azure Log Analytics Workspaces — equivalent of AWS CloudWatch Logs + X-Ray."""
# #     rng = _rg(f"law-{region}")
# #     if rng.random() < 0.5:
# #         return []
# #     workspaces = []
# #     ws_count = rng.randint(1, 2)
# #     for i in range(ws_count):
# #         name = f"law-{region}-{rng.choice(['prod', 'security', 'ops'])}-{i+1:03d}"
# #         workspaces.append({
# #             "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-monitoring/providers/Microsoft.OperationalInsights/workspaces/{name}",
# #             "name": name,
# #             "location": region,
# #             "sku": rng.choice(["PerGB2018", "CapacityReservation"]),
# #             "retention_days": rng.choice([30, 60, 90, 180, 365]),
# #             "daily_cap_gb": rng.choice([None, 5, 10, 50]),
# #             "data_ingestion_gb_day": round(rng.uniform(0.5, 20.0), 2),
# #             "solutions": rng.sample([
# #                 "SecurityInsights (Sentinel)", "VMInsights", "ContainerInsights",
# #                 "AgentHealthAssessment", "Updates", "ChangeTracking",
# #             ], k=rng.randint(2, 6)),
# #             "connected_sources": rng.randint(5, 50),
# #             "resource_group": "rg-monitoring",
# #             "region": region,
# #         })
# #     return workspaces
# #
# #
# # def scan_sentinel(creds: Dict, region: str) -> List[Dict]:
# #     """Microsoft Sentinel — equivalent of AWS Security Hub + GuardDuty (SIEM)."""
# #     rng = _rg(f"sentinel-{region}")
# #     # Sentinel is tied to Log Analytics, not all regions will have it
# #     if rng.random() < 0.7:
# #         return []
# #     workspaces_with_sentinel = [{
# #         "workspace": f"law-{region}-security-001",
# #         "location": region,
# #         "data_connectors": rng.randint(5, 20),
# #         "analytics_rules": rng.randint(50, 200),
# #         "automation_rules": rng.randint(2, 15),
# #         "incidents_last_30d": rng.randint(10, 100),
# #         "incidents_open": rng.randint(2, 20),
# #         "incidents_by_severity": {
# #             "High": rng.randint(0, 5),
# #             "Medium": rng.randint(2, 10),
# #             "Low": rng.randint(5, 20),
# #             "Informational": rng.randint(10, 50),
# #         },
# #         "threat_intelligence_indicators": rng.randint(1000, 50000),
# #         "resource_group": "rg-security",
# #         "region": region,
# #     }]
# #     return workspaces_with_sentinel
# #
# #
# # def scan_managed_disks(creds: Dict, region: str) -> List[Dict]:
# #     """Azure Managed Disks — equivalent of AWS EBS."""
# #     rng = _rg(f"disk-{region}")
# #     disk_count = rng.randint(5, 20)
# #     disks = []
# #     disk_types = ["Premium_LRS", "StandardSSD_LRS", "Standard_LRS", "UltraSSD_LRS"]
# #     for i in range(disk_count):
# #         disk_type = rng.choice(disk_types)
# #         state = rng.choice(["Attached", "Attached", "Attached", "Unattached"])
# #         disks.append({
# #             "name": f"disk-{region}-{i+1:04d}",
# #             "location": region,
# #             "sku": disk_type,
# #             "size_gb": rng.choice([32, 64, 128, 256, 512, 1024, 2048]),
# #             "state": state,
# #             "attached_to": f"vm-{region}-{rng.randint(1,5):03d}" if state == "Attached" else None,
# #             "os_disk": rng.choice([True, False]),
# #             "encryption": "Platform-managed key",
# #             "resource_group": "rg-production",
# #             "region": region,
# #         })
# #     return disks
# #
# #
# # def scan_virtual_machine_scale_sets(creds: Dict, region: str) -> List[Dict]:
# #     """Azure VM Scale Sets — equivalent of AWS Auto Scaling Groups."""
# #     rng = _rg(f"vmss-{region}")
# #     if rng.random() < 0.6:
# #         return []
# #     scale_sets = []
# #     ss_count = rng.randint(1, 3)
# #     for i in range(ss_count):
# #         name = f"vmss-{region}-{rng.choice(['web', 'app', 'worker'])}-{i+1:02d}"
# #         capacity = rng.randint(2, 20)
# #         scale_sets.append({
# #             "id": f"/subscriptions/{creds['subscription_id']}/resourceGroups/rg-production/providers/Microsoft.Compute/virtualMachineScaleSets/{name}",
# #             "name": name,
# #             "location": region,
# #             "vm_size": rng.choice(["Standard_D2s_v3", "Standard_D4s_v3", "Standard_F4s_v2"]),
# #             "capacity": capacity,
# #             "min_capacity": rng.randint(1, 3),
# #             "max_capacity": rng.randint(20, 100),
# #             "autoscale_enabled": True,
# #             "upgrade_policy": rng.choice(["Automatic", "Rolling", "Manual"]),
# #             "os": rng.choice(["Linux", "Windows"]),
# #             "state": "Succeeded",
# #             "resource_group": "rg-production",
# #             "region": region,
# #         })
# #     return scale_sets
# #
# #
# # def scan_file_shares(creds: Dict, region: str) -> List[Dict]:
# #     """Azure File Shares — equivalent of AWS EFS."""
# #     rng = _rg(f"files-{region}")
# #     if rng.random() < 0.6:
# #         return []
# #     shares = []
# #     share_count = rng.randint(1, 4)
# #     for i in range(share_count):
# #         shares.append({
# #             "name": f"fileshare-{region}-{rng.choice(['data', 'backup', 'logs', 'uploads'])}-{i+1}",
# #             "storage_account": f"prodstorageeastus001",
# #             "location": region,
# #             "tier": rng.choice(["Transaction optimized", "Hot", "Cool", "Premium"]),
# #             "quota_gb": rng.choice([100, 500, 1024, 5120]),
# #             "used_gb": round(rng.uniform(1, 900), 2),
# #             "protocol": rng.choice(["SMB", "NFS"]),
# #             "snapshot_count": rng.randint(0, 10),
# #             "region": region,
# #         })
# #     return shares
# #
# #
# # # ══════════════════════════════════════════════════════════════════════════════
# # # MAIN SCAN ENTRY POINT
# # # ══════════════════════════════════════════════════════════════════════════════
# #
# # def scan_all(
# #     tenant_id: str,
# #     client_id: str,
# #     client_secret: str,
# #     subscription_id: str,
# #     regions: Optional[List[str]] = None,
# # ) -> Dict[str, Any]:
# #     """
# #     Main Azure scan function.
# #     Mirrors scanner.py:scan_all() structure exactly so the frontend
# #     can be extended with minimal changes.
# #     """
# #     results: Dict[str, Any] = {}
# #
# #     creds = {
# #         "tenant_id": tenant_id,
# #         "client_id": client_id,
# #         "client_secret": client_secret,
# #         "subscription_id": subscription_id,
# #     }
# #
# #     # ── Identity ──────────────────────────────────────────────────────────────
# #     try:
# #         results["identity"] = scan_identity(tenant_id, client_id, subscription_id)
# #     except Exception as e:
# #         results["identity"] = {"error": str(e)}
# #
# #     # ── Regions ───────────────────────────────────────────────────────────────
# #     if not regions:
# #         regions = get_azure_regions([])
# #     results["regions"] = regions
# #     results["region_display"] = {r: AZURE_REGION_DISPLAY.get(r, r) for r in regions}
# #
# #     # ── Global services ───────────────────────────────────────────────────────
# #     GLOBAL_SERVICES = {
# #         "costs":            lambda: scan_costs(tenant_id, client_id, subscription_id),
# #         "entra_id":         lambda: scan_entra_id(tenant_id, client_id, subscription_id),
# #         "storage_accounts": lambda: scan_storage_accounts(tenant_id, client_id, subscription_id),
# #         "dns_zones":        lambda: scan_dns_zones(tenant_id, client_id, subscription_id),
# #         "cdn_profiles":     lambda: scan_cdn_profiles(tenant_id, client_id, subscription_id),
# #         "key_vaults":       lambda: scan_key_vaults(tenant_id, client_id, subscription_id),
# #         "resource_groups":  lambda: scan_resource_groups(tenant_id, client_id, subscription_id),
# #         "subscriptions":    lambda: scan_subscriptions(tenant_id, client_id, subscription_id),
# #         # Extended global
# #         "advisor":          lambda: scan_azure_advisor(tenant_id, client_id, subscription_id),
# #         "budgets":          lambda: scan_budgets(tenant_id, client_id, subscription_id),
# #         "policy_compliance":lambda: scan_policy_compliance(tenant_id, client_id, subscription_id),
# #         "service_health":   lambda: scan_service_health(tenant_id, client_id, subscription_id),
# #     }
# #     for key, fn in GLOBAL_SERVICES.items():
# #         try:
# #             results[key] = fn()
# #         except Exception as e:
# #             results[key] = {"error": str(e)}
# #
# #     # ── Core per-region services (always scanned) ─────────────────────────────
# #     CORE_SERVICES = [
# #         ("virtual_machines",          scan_virtual_machines),
# #         ("azure_functions",           scan_azure_functions),
# #         ("sql_databases",             scan_sql_databases),
# #         ("virtual_networks",          scan_virtual_networks),
# #         ("aks_clusters",              scan_aks_clusters),
# #         ("container_registry",        scan_container_registry),
# #         ("app_service",               scan_app_service),
# #         ("load_balancers",            scan_load_balancers),
# #         ("monitor_alerts",            scan_monitor_alerts),
# #         ("service_bus",               scan_service_bus),
# #         ("cosmos_db",                 scan_cosmos_db),
# #         ("redis_cache",               scan_redis_cache),
# #         ("vpn_gateways",              scan_vpn_gateways),
# #         ("backup_vaults",             scan_backup_vaults),
# #         ("security_center",           scan_security_center),
# #     ]
# #
# #     # ── Extended per-region services (single-region scans only) ──────────────
# #     EXTENDED_SERVICES = [
# #         # Analytics
# #         ("synapse",                   scan_synapse),
# #         ("data_factory",              scan_data_factory),
# #         ("hdinsight",                 scan_hdinsight),
# #         ("event_hubs",                scan_event_hubs),
# #         ("stream_analytics",          scan_stream_analytics),
# #         ("databricks",                scan_databricks),
# #         ("power_bi_embedded",         scan_power_bi_embedded),
# #         # AI / ML
# #         ("ml_workspace",              scan_ml_workspace),
# #         ("cognitive_services",        scan_cognitive_services),
# #         ("openai_service",            scan_openai_service),
# #         ("bot_service",               scan_bot_service),
# #         ("search_service",            scan_search_service),
# #         # DevOps
# #         ("devops_pipelines",          scan_devops_pipelines),
# #         ("github_actions",            scan_github_actions),
# #         ("container_apps",            scan_container_apps),
# #         ("static_web_apps",           scan_static_web_apps),
# #         # Messaging / Integration
# #         ("logic_apps",                scan_logic_apps),
# #         ("event_grid",                scan_event_grid),
# #         ("api_management",            scan_api_management),
# #         ("iot_hub",                   scan_iot_hub),
# #         ("notification_hubs",         scan_notification_hubs),
# #         ("service_fabric",            scan_service_fabric),
# #         # Networking
# #         ("virtual_wan",               scan_virtual_wan),
# #         ("express_route",             scan_express_route),
# #         ("waf_policies",              scan_waf_policies),
# #         ("azure_firewall",            scan_azure_firewall),
# #         ("private_dns",               scan_private_dns),
# #         ("ddos_protection",           scan_ddos_protection),
# #         # Monitoring / Governance
# #         ("log_analytics",             scan_log_analytics),
# #         ("sentinel",                  scan_sentinel),
# #         # Compute / Storage
# #         ("managed_disks",             scan_managed_disks),
# #         ("vm_scale_sets",             scan_virtual_machine_scale_sets),
# #         ("file_shares",               scan_file_shares),
# #     ]
# #
# #     is_single_region = len(regions) == 1
# #     PER_REGION_SERVICES = CORE_SERVICES + EXTENDED_SERVICES if is_single_region else CORE_SERVICES
# #
# #     results["services"] = {}
# #     for region in regions:
# #         region_data = {}
# #         for svc_name, fn in PER_REGION_SERVICES:
# #             try:
# #                 region_data[svc_name] = fn(creds, region)
# #             except Exception as e:
# #                 region_data[svc_name] = {"error": str(e)}
# #         results["services"][region] = region_data
# #
# #     results["cloud"] = "azure"
# #     results["mock"] = True
# #     results["scan_time"] = datetime.now(timezone.utc).isoformat()
# #
# #     return results
# #
# #
#
#
# #!/usr/bin/env python3
# """
# Azure Discovery — Real Scanner using Azure SDK
# Makes real API calls to your Azure account.
# Returns actual resource counts (zeros if nothing deployed).
# """
#
# from datetime import datetime, timezone
# from typing import Dict, List, Any, Optional
#
# try:
#     from azure.identity import ClientSecretCredential
#     from azure.mgmt.resource import ResourceManagementClient
#     from azure.mgmt.subscription import SubscriptionClient
#     from azure.mgmt.compute import ComputeManagementClient
#     from azure.mgmt.storage import StorageManagementClient
#     from azure.mgmt.network import NetworkManagementClient
#     from azure.mgmt.sql import SqlManagementClient
#     from azure.mgmt.web import WebSiteManagementClient
#     from azure.mgmt.containerservice import ContainerServiceClient
#     from azure.mgmt.containerregistry import ContainerRegistryManagementClient
#     from azure.mgmt.keyvault import KeyVaultManagementClient
#     from azure.mgmt.monitor import MonitorManagementClient
#     from azure.mgmt.servicebus import ServiceBusManagementClient
#     from azure.mgmt.cdn import CdnManagementClient
#     from azure.mgmt.dns import DnsManagementClient
#     from azure.mgmt.authorization import AuthorizationManagementClient
#     AZURE_SDK_AVAILABLE = True
# except ImportError:
#     AZURE_SDK_AVAILABLE = False
#
# AZURE_REGIONS = [
#     "eastus","eastus2","westus","westus2","westus3",
#     "centralus","northcentralus","southcentralus",
#     "northeurope","westeurope","uksouth","ukwest",
#     "eastasia","southeastasia","japaneast","japanwest",
#     "australiaeast","australiasoutheast",
#     "brazilsouth","canadacentral","canadaeast",
#     "centralindia","southindia","westindia",
#     "koreacentral","koreasouth","francecentral","germanywestcentral",
#     "norwayeast","switzerlandnorth","uaenorth","southafricanorth",
# ]
#
# AZURE_REGION_DISPLAY = {
#     "eastus":"East US","eastus2":"East US 2","westus":"West US",
#     "westus2":"West US 2","westus3":"West US 3","centralus":"Central US",
#     "northcentralus":"North Central US","southcentralus":"South Central US",
#     "northeurope":"North Europe","westeurope":"West Europe",
#     "uksouth":"UK South","ukwest":"UK West","eastasia":"East Asia",
#     "southeastasia":"Southeast Asia","japaneast":"Japan East","japanwest":"Japan West",
#     "australiaeast":"Australia East","australiasoutheast":"Australia Southeast",
#     "brazilsouth":"Brazil South","canadacentral":"Canada Central","canadaeast":"Canada East",
#     "centralindia":"Central India","southindia":"South India","westindia":"West India",
#     "koreacentral":"Korea Central","koreasouth":"Korea South",
#     "francecentral":"France Central","germanywestcentral":"Germany West Central",
#     "norwayeast":"Norway East","switzerlandnorth":"Switzerland North",
#     "uaenorth":"UAE North","southafricanorth":"South Africa North",
# }
#
#
# def _rg_from_id(resource_id):
#     try:
#         return resource_id.split("/resourceGroups/")[1].split("/")[0]
#     except Exception:
#         return "—"
#
#
# def scan_identity(credential, subscription_id):
#     try:
#         sub_client = SubscriptionClient(credential)
#         sub = sub_client.subscriptions.get(subscription_id)
#         return {
#             "subscription_id": subscription_id,
#             "subscription_name": sub.display_name,
#             "tenant_id": sub.tenant_id,
#             "state": str(sub.state),
#             "mock": False,
#         }
#     except Exception as e:
#         return {"subscription_id": subscription_id, "error": str(e), "mock": False}
#
#
# def scan_resource_groups(credential, subscription_id):
#     try:
#         client = ResourceManagementClient(credential, subscription_id)
#         return [{
#             "id": rg.id, "name": rg.name, "location": rg.location,
#             "provisioning_state": rg.properties.provisioning_state if rg.properties else "—",
#             "tags": dict(rg.tags or {}),
#         } for rg in client.resource_groups.list()]
#     except Exception as e:
#         print(f"resource_groups error: {e}"); return []
#
#
# def scan_storage_accounts(credential, subscription_id):
#     try:
#         client = StorageManagementClient(credential, subscription_id)
#         accounts = []
#         for a in client.storage_accounts.list():
#             accounts.append({
#                 "id": a.id, "name": a.name, "location": a.location,
#                 "sku": a.sku.name if a.sku else "—",
#                 "kind": str(a.kind) if a.kind else "—",
#                 "access_tier": str(a.access_tier) if a.access_tier else "—",
#                 "https_only": a.enable_https_traffic_only,
#                 "blob_public_access": a.allow_blob_public_access,
#                 "tags": dict(a.tags or {}),
#                 "created_at": a.creation_time.isoformat() if a.creation_time else None,
#             })
#         return accounts
#     except Exception as e:
#         print(f"storage_accounts error: {e}"); return []
#
#
# def scan_dns_zones(credential, subscription_id):
#     try:
#         client = DnsManagementClient(credential, subscription_id)
#         return [{
#             "id": z.id, "name": z.name,
#             "type": "Private" if z.zone_type and "Private" in str(z.zone_type) else "Public",
#             "record_sets": z.number_of_record_sets,
#             "name_servers": list(z.name_servers or []),
#         } for z in client.zones.list()]
#     except Exception as e:
#         print(f"dns_zones error: {e}"); return []
#
#
# def scan_cdn_profiles(credential, subscription_id):
#     try:
#         client = CdnManagementClient(credential, subscription_id)
#         profiles = []
#         for p in client.profiles.list():
#             endpoints = []
#             try:
#                 rg = _rg_from_id(p.id)
#                 for ep in client.endpoints.list_by_profile(rg, p.name):
#                     endpoints.append({
#                         "name": ep.name, "hostname": ep.host_name,
#                         "origin": ep.origins[0].host_name if ep.origins else "—",
#                         "enabled": True,
#                     })
#             except Exception:
#                 pass
#             profiles.append({
#                 "id": p.id, "name": p.name,
#                 "sku": p.sku.name if p.sku else "—",
#                 "endpoints": endpoints,
#                 "resource_group": _rg_from_id(p.id),
#             })
#         return profiles
#     except Exception as e:
#         print(f"cdn_profiles error: {e}"); return []
#
#
# def scan_key_vaults(credential, subscription_id):
#     try:
#         client = KeyVaultManagementClient(credential, subscription_id)
#         return [{
#             "id": v.id, "name": v.name, "location": v.location,
#             "sku": v.properties.sku.name if v.properties and v.properties.sku else "—",
#             "soft_delete_enabled": getattr(v.properties, "enable_soft_delete", None),
#             "purge_protection": getattr(v.properties, "enable_purge_protection", None),
#             "rbac_enabled": getattr(v.properties, "enable_rbac_authorization", None),
#         } for v in client.vaults.list()]
#     except Exception as e:
#         print(f"key_vaults error: {e}"); return []
#
#
# def scan_entra_id(credential, subscription_id):
#     try:
#         auth_client = AuthorizationManagementClient(credential, subscription_id)
#         assignments = []
#         try:
#             for ra in auth_client.role_assignments.list_for_subscription():
#                 assignments.append({
#                     "principal_id": ra.principal_id,
#                     "principal_type": str(ra.principal_type) if ra.principal_type else "—",
#                     "role_definition_id": ra.role_definition_id,
#                     "scope": ra.scope,
#                 })
#         except Exception:
#             pass
#         return {
#             "role_assignments": len(assignments),
#             "role_assignment_details": assignments[:20],
#             "users": [],
#             "service_principals": [],
#             "groups": [],
#             "note": "User/group data requires Microsoft Graph API permissions. Role assignments shown from Reader access.",
#             "mock": False,
#         }
#     except Exception as e:
#         print(f"entra_id error: {e}")
#         return {"role_assignments": 0, "users": [], "service_principals": [], "groups": [], "error": str(e), "mock": False}
#
#
# def scan_costs(credential, subscription_id):
#     try:
#         from azure.mgmt.costmanagement import CostManagementClient
#         from azure.mgmt.costmanagement.models import QueryDefinition, QueryTimePeriod, QueryDataset, QueryAggregation, QueryGrouping
#         client = CostManagementClient(credential)
#         now = datetime.now(timezone.utc)
#         start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
#         scope = f"/subscriptions/{subscription_id}"
#         result = client.query.usage(scope=scope, parameters=QueryDefinition(
#             type="ActualCost", timeframe="Custom",
#             time_period=QueryTimePeriod(from_property=start, to=now),
#             dataset=QueryDataset(
#                 granularity="None",
#                 aggregation={"totalCost": QueryAggregation(name="Cost", function="Sum")},
#                 grouping=[QueryGrouping(type="Dimension", name="ServiceName")],
#             ),
#         ))
#         by_service = {}
#         total = 0.0
#         for row in (result.rows or []):
#             svc = row[1] if len(row) > 1 else "Unknown"
#             cost = float(row[0]) if row[0] else 0.0
#             by_service[svc] = round(cost, 2)
#             total += cost
#         return {
#             "currency": "USD",
#             "billing_period": now.strftime("%Y-%m"),
#             "total": round(total, 2),
#             "by_service": by_service,
#             "forecast": None,
#             "mock": False,
#         }
#     except Exception as e:
#         print(f"costs error: {e}")
#         return {
#             "currency": "USD",
#             "billing_period": datetime.now(timezone.utc).strftime("%Y-%m"),
#             "total": 0, "by_service": {},
#             "error": "Billing Reader role required for cost data.",
#             "mock": False,
#         }
#
#
# # ── Per-region scans ──────────────────────────────────────────────────────────
#
# def scan_virtual_machines(credential, subscription_id, region):
#     try:
#         compute = ComputeManagementClient(credential, subscription_id)
#         network = NetworkManagementClient(credential, subscription_id)
#         vms = []
#         for vm in compute.virtual_machines.list_all():
#             if vm.location != region:
#                 continue
#             power = "Unknown"
#             try:
#                 rg = _rg_from_id(vm.id)
#                 iv = compute.virtual_machines.instance_view(rg, vm.name)
#                 power = next((s.display_status for s in (iv.statuses or []) if s.code and s.code.startswith("PowerState/")), "Unknown")
#             except Exception:
#                 pass
#             private_ip, public_ip = None, None
#             try:
#                 if vm.network_profile and vm.network_profile.network_interfaces:
#                     nic_id = vm.network_profile.network_interfaces[0].id
#                     nic = network.network_interfaces.get(_rg_from_id(nic_id), nic_id.split("/")[-1])
#                     if nic.ip_configurations:
#                         private_ip = nic.ip_configurations[0].private_ip_address
#                         pip_ref = nic.ip_configurations[0].public_ip_address
#                         if pip_ref:
#                             pip = network.public_ip_addresses.get(_rg_from_id(pip_ref.id), pip_ref.id.split("/")[-1])
#                             public_ip = pip.ip_address
#             except Exception:
#                 pass
#             vms.append({
#                 "id": vm.id, "name": vm.name, "location": vm.location,
#                 "vm_size": vm.hardware_profile.vm_size if vm.hardware_profile else "—",
#                 "os_type": str(vm.storage_profile.os_disk.os_type) if vm.storage_profile and vm.storage_profile.os_disk else "—",
#                 "state": power, "power_state": power,
#                 "private_ip": private_ip, "public_ip": public_ip,
#                 "tags": dict(vm.tags or {}),
#                 "resource_group": _rg_from_id(vm.id), "region": region,
#             })
#         return vms
#     except Exception as e:
#         print(f"virtual_machines [{region}] error: {e}"); return []
#
#
# def scan_azure_functions(credential, subscription_id, region):
#     try:
#         client = WebSiteManagementClient(credential, subscription_id)
#         fns = []
#         for app in client.web_apps.list():
#             if app.location != region: continue
#             if not app.kind or "functionapp" not in app.kind.lower(): continue
#             fns.append({
#                 "id": app.id, "name": app.name, "location": app.location,
#                 "runtime": (app.site_config.linux_fx_version if app.site_config else None) or "—",
#                 "plan": app.server_farm_id.split("/")[-1] if app.server_farm_id else "—",
#                 "state": app.state or "Unknown",
#                 "url": f"https://{app.default_host_name}" if app.default_host_name else "—",
#                 "resource_group": app.resource_group, "region": region,
#             })
#         return fns
#     except Exception as e:
#         print(f"azure_functions [{region}] error: {e}"); return []
#
#
# def scan_app_service(credential, subscription_id, region):
#     try:
#         client = WebSiteManagementClient(credential, subscription_id)
#         apps = []
#         for app in client.web_apps.list():
#             if app.location != region: continue
#             if app.kind and "functionapp" in app.kind.lower(): continue
#             apps.append({
#                 "id": app.id, "name": app.name, "location": app.location,
#                 "state": app.state or "Unknown",
#                 "url": f"https://{app.default_host_name}" if app.default_host_name else "—",
#                 "https_only": app.https_only,
#                 "resource_group": app.resource_group, "region": region,
#             })
#         return apps
#     except Exception as e:
#         print(f"app_service [{region}] error: {e}"); return []
#
#
# def scan_sql_databases(credential, subscription_id, region):
#     try:
#         client = SqlManagementClient(credential, subscription_id)
#         dbs = []
#         for server in client.servers.list():
#             if server.location != region: continue
#             rg = _rg_from_id(server.id)
#             try:
#                 for db in client.databases.list_by_server(rg, server.name):
#                     if db.name == "master": continue
#                     dbs.append({
#                         "id": db.id, "name": db.name,
#                         "server": server.fully_qualified_domain_name or server.name,
#                         "location": db.location,
#                         "sku": db.sku.name if db.sku else "—",
#                         "max_size_gb": round(db.max_size_bytes / (1024**3), 1) if db.max_size_bytes else "—",
#                         "status": str(db.status) if db.status else "—",
#                         "resource_group": rg, "region": region,
#                     })
#             except Exception as e:
#                 print(f"  sql db list error: {e}")
#         return dbs
#     except Exception as e:
#         print(f"sql_databases [{region}] error: {e}"); return []
#
#
# def scan_virtual_networks(credential, subscription_id, region):
#     try:
#         client = NetworkManagementClient(credential, subscription_id)
#         vnets = []
#         for vnet in client.virtual_networks.list_all():
#             if vnet.location != region: continue
#             subnets = [{"name": s.name, "address_prefix": s.address_prefix, "nsg": s.network_security_group.id.split("/")[-1] if s.network_security_group else None} for s in (vnet.subnets or [])]
#             vnets.append({"id": vnet.id, "name": vnet.name, "address_space": list(vnet.address_space.address_prefixes) if vnet.address_space else [], "subnets": subnets, "resource_group": _rg_from_id(vnet.id), "region": region})
#         nsgs = [{"name": n.name, "rules": len(n.security_rules or []), "location": n.location} for n in client.network_security_groups.list_all() if n.location == region]
#         return {"vnets": vnets, "subnets": sum(len(v["subnets"]) for v in vnets), "network_security_groups": nsgs, "nsg_count": len(nsgs), "region": region}
#     except Exception as e:
#         print(f"virtual_networks [{region}] error: {e}")
#         return {"vnets": [], "subnets": 0, "network_security_groups": [], "nsg_count": 0, "region": region}
#
#
# def scan_aks_clusters(credential, subscription_id, region):
#     try:
#         client = ContainerServiceClient(credential, subscription_id)
#         clusters = []
#         for c in client.managed_clusters.list():
#             if c.location != region: continue
#             pools = [{"name": p.name, "vm_size": p.vm_size, "count": p.count, "min_count": p.min_count, "max_count": p.max_count, "mode": str(p.mode) if p.mode else "—", "os": str(p.os_type) if p.os_type else "Linux"} for p in (c.agent_pool_profiles or [])]
#             clusters.append({"id": c.id, "name": c.name, "location": c.location, "kubernetes_version": c.kubernetes_version, "node_pools": pools, "total_nodes": sum(p.get("count") or 0 for p in pools), "power_state": str(c.power_state.code) if c.power_state else "Running", "resource_group": _rg_from_id(c.id), "region": region})
#         return clusters
#     except Exception as e:
#         print(f"aks_clusters [{region}] error: {e}"); return []
#
#
# def scan_container_registry(credential, subscription_id, region):
#     try:
#         client = ContainerRegistryManagementClient(credential, subscription_id)
#         return [{"id": r.id, "name": r.name, "location": r.location, "sku": r.sku.name if r.sku else "—", "login_server": r.login_server, "admin_enabled": r.admin_user_enabled, "resource_group": _rg_from_id(r.id), "region": region} for r in client.registries.list() if r.location == region]
#     except Exception as e:
#         print(f"container_registry [{region}] error: {e}"); return []
#
#
# def scan_monitor_alerts(credential, subscription_id, region):
#     try:
#         client = MonitorManagementClient(credential, subscription_id)
#         return [{"id": r.id, "name": r.name, "description": r.description or "—", "severity": r.severity, "severity_num": r.severity, "state": "Enabled" if r.enabled else "Disabled", "region": region} for r in client.metric_alerts.list_by_subscription() if r.location == region or r.location == "global"]
#     except Exception as e:
#         print(f"monitor_alerts [{region}] error: {e}"); return []
#
#
# def scan_service_bus(credential, subscription_id, region):
#     try:
#         client = ServiceBusManagementClient(credential, subscription_id)
#         namespaces = []
#         for ns in client.namespaces.list():
#             if ns.location != region: continue
#             rg = _rg_from_id(ns.id)
#             queues = []
#             try:
#                 for q in client.queues.list_by_namespace(rg, ns.name):
#                     queues.append({"name": q.name, "messages": q.message_count or 0, "dead_letter": q.dead_letter_message_count or 0})
#             except Exception:
#                 pass
#             namespaces.append({"id": ns.id, "name": ns.name, "location": ns.location, "sku": ns.sku.name if ns.sku else "—", "queues": queues, "topics": [], "resource_group": rg, "region": region})
#         return namespaces
#     except Exception as e:
#         print(f"service_bus [{region}] error: {e}"); return []
#
#
# def scan_load_balancers(credential, subscription_id, region):
#     try:
#         client = NetworkManagementClient(credential, subscription_id)
#         return [{"id": lb.id, "name": lb.name, "location": lb.location, "sku": lb.sku.name if lb.sku else "—", "type": "Load Balancer", "frontend_ips": len(lb.frontend_ip_configurations or []), "backend_pools": len(lb.backend_address_pools or []), "rules": len(lb.load_balancing_rules or []), "resource_group": _rg_from_id(lb.id), "region": region} for lb in client.load_balancers.list_all() if lb.location == region]
#     except Exception as e:
#         print(f"load_balancers [{region}] error: {e}"); return []
#
#
# def scan_managed_disks(credential, subscription_id, region):
#     try:
#         client = ComputeManagementClient(credential, subscription_id)
#         return [{"name": d.name, "location": d.location, "sku": d.sku.name if d.sku else "—", "size_gb": d.disk_size_gb, "state": str(d.disk_state) if d.disk_state else "—", "os_disk": d.os_type is not None, "region": region} for d in client.disks.list() if d.location == region]
#     except Exception as e:
#         print(f"managed_disks [{region}] error: {e}"); return []
#
#
# def scan_public_ips(credential, subscription_id, region):
#     try:
#         client = NetworkManagementClient(credential, subscription_id)
#         return [{"name": p.name, "location": p.location, "ip_address": p.ip_address, "allocation_method": str(p.public_ip_allocation_method) if p.public_ip_allocation_method else "—", "sku": p.sku.name if p.sku else "—", "associated_with": p.ip_configuration.id.split("/")[-3] if p.ip_configuration else "Unassociated"} for p in client.public_ip_addresses.list_all() if p.location == region]
#     except Exception as e:
#         print(f"public_ips [{region}] error: {e}"); return []
#
#
# # ══════════════════════════════════════════════════════════════════════════════
# # MAIN SCAN ENTRY POINT
# # ══════════════════════════════════════════════════════════════════════════════
#
# def scan_all(tenant_id, client_id, client_secret, subscription_id, regions=None):
#     if not AZURE_SDK_AVAILABLE:
#         raise RuntimeError("Azure SDK not installed. Check requirements.txt.")
#
#     credential = ClientSecretCredential(tenant_id=tenant_id, client_id=client_id, client_secret=client_secret)
#     results = {}
#
#     print(f"Azure real scan — subscription: {subscription_id}")
#
#     results["identity"]        = scan_identity(credential, subscription_id)
#     regions                    = regions or ["eastus", "westeurope", "southeastasia"]
#     results["regions"]         = regions
#     results["region_display"]  = {r: AZURE_REGION_DISPLAY.get(r, r) for r in regions}
#     results["resource_groups"] = scan_resource_groups(credential, subscription_id)
#     results["storage_accounts"]= scan_storage_accounts(credential, subscription_id)
#     results["dns_zones"]       = scan_dns_zones(credential, subscription_id)
#     results["cdn_profiles"]    = scan_cdn_profiles(credential, subscription_id)
#     results["key_vaults"]      = scan_key_vaults(credential, subscription_id)
#     results["entra_id"]        = scan_entra_id(credential, subscription_id)
#     results["costs"]           = scan_costs(credential, subscription_id)
#     results["subscriptions"]   = [{"subscription_id": subscription_id, "display_name": results["identity"].get("subscription_name", "—"), "state": "Enabled", "tenant_id": tenant_id}]
#
#     PER_REGION = [
#         ("virtual_machines",   lambda r: scan_virtual_machines(credential, subscription_id, r)),
#         ("azure_functions",    lambda r: scan_azure_functions(credential, subscription_id, r)),
#         ("app_service",        lambda r: scan_app_service(credential, subscription_id, r)),
#         ("sql_databases",      lambda r: scan_sql_databases(credential, subscription_id, r)),
#         ("virtual_networks",   lambda r: scan_virtual_networks(credential, subscription_id, r)),
#         ("aks_clusters",       lambda r: scan_aks_clusters(credential, subscription_id, r)),
#         ("container_registry", lambda r: scan_container_registry(credential, subscription_id, r)),
#         ("load_balancers",     lambda r: scan_load_balancers(credential, subscription_id, r)),
#         ("monitor_alerts",     lambda r: scan_monitor_alerts(credential, subscription_id, r)),
#         ("service_bus",        lambda r: scan_service_bus(credential, subscription_id, r)),
#         ("managed_disks",      lambda r: scan_managed_disks(credential, subscription_id, r)),
#         ("public_ips",         lambda r: scan_public_ips(credential, subscription_id, r)),
#     ]
#
#     results["services"] = {}
#     for region in regions:
#         print(f"  region: {region}...")
#         region_data = {}
#         for svc_name, fn in PER_REGION:
#             try:
#                 region_data[svc_name] = fn(region)
#             except Exception as e:
#                 region_data[svc_name] = {"error": str(e)}
#         results["services"][region] = region_data
#
#     results["cloud"] = "azure"
#     results["mock"]  = False
#     results["scan_time"] = datetime.now(timezone.utc).isoformat()
#     print("Azure scan complete.")
#     return results
#########################################################

#!/usr/bin/env python3
"""
Azure Discovery — Real Scanner using Azure SDK
Makes real API calls to your Azure account.
Returns actual resource counts (zeros if nothing deployed).
"""

from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

try:
    from azure.identity import ClientSecretCredential
    from azure.mgmt.resource import ResourceManagementClient
    from azure.mgmt.subscription import SubscriptionClient
    from azure.mgmt.compute import ComputeManagementClient
    from azure.mgmt.storage import StorageManagementClient
    from azure.mgmt.network import NetworkManagementClient
    from azure.mgmt.sql import SqlManagementClient
    from azure.mgmt.web import WebSiteManagementClient
    from azure.mgmt.containerservice import ContainerServiceClient
    from azure.mgmt.containerregistry import ContainerRegistryManagementClient
    from azure.mgmt.keyvault import KeyVaultManagementClient
    from azure.mgmt.monitor import MonitorManagementClient
    from azure.mgmt.servicebus import ServiceBusManagementClient
    from azure.mgmt.cdn import CdnManagementClient
    from azure.mgmt.dns import DnsManagementClient
    from azure.mgmt.authorization import AuthorizationManagementClient
    AZURE_SDK_AVAILABLE = True
except ImportError:
    AZURE_SDK_AVAILABLE = False

AZURE_REGIONS = [
    "eastus","eastus2","westus","westus2","westus3",
    "centralus","northcentralus","southcentralus",
    "northeurope","westeurope","uksouth","ukwest",
    "eastasia","southeastasia","japaneast","japanwest",
    "australiaeast","australiasoutheast",
    "brazilsouth","canadacentral","canadaeast",
    "centralindia","southindia","westindia",
    "koreacentral","koreasouth","francecentral","germanywestcentral",
    "norwayeast","switzerlandnorth","uaenorth","southafricanorth",
]

AZURE_REGION_DISPLAY = {
    "eastus":"East US","eastus2":"East US 2","westus":"West US",
    "westus2":"West US 2","westus3":"West US 3","centralus":"Central US",
    "northcentralus":"North Central US","southcentralus":"South Central US",
    "northeurope":"North Europe","westeurope":"West Europe",
    "uksouth":"UK South","ukwest":"UK West","eastasia":"East Asia",
    "southeastasia":"Southeast Asia","japaneast":"Japan East","japanwest":"Japan West",
    "australiaeast":"Australia East","australiasoutheast":"Australia Southeast",
    "brazilsouth":"Brazil South","canadacentral":"Canada Central","canadaeast":"Canada East",
    "centralindia":"Central India","southindia":"South India","westindia":"West India",
    "koreacentral":"Korea Central","koreasouth":"Korea South",
    "francecentral":"France Central","germanywestcentral":"Germany West Central",
    "norwayeast":"Norway East","switzerlandnorth":"Switzerland North",
    "uaenorth":"UAE North","southafricanorth":"South Africa North",
}


def _rg_from_id(resource_id):
    try:
        return resource_id.split("/resourceGroups/")[1].split("/")[0]
    except Exception:
        return "—"


def scan_identity(credential, subscription_id):
    try:
        sub_client = SubscriptionClient(credential)
        sub = sub_client.subscriptions.get(subscription_id)
        return {
            "subscription_id": subscription_id,
            "subscription_name": sub.display_name,
            "tenant_id": sub.tenant_id,
            "state": str(sub.state),
            "mock": False,
        }
    except Exception as e:
        return {"subscription_id": subscription_id, "error": str(e), "mock": False}


def scan_resource_groups(credential, subscription_id):
    try:
        client = ResourceManagementClient(credential, subscription_id)
        return [{
            "id": rg.id, "name": rg.name, "location": rg.location,
            "provisioning_state": rg.properties.provisioning_state if rg.properties else "—",
            "tags": dict(rg.tags or {}),
        } for rg in client.resource_groups.list()]
    except Exception as e:
        print(f"resource_groups error: {e}"); return []


def scan_storage_accounts(credential, subscription_id):
    try:
        client = StorageManagementClient(credential, subscription_id)
        accounts = []
        for a in client.storage_accounts.list():
            accounts.append({
                "id": a.id, "name": a.name, "location": a.location,
                "sku": a.sku.name if a.sku else "—",
                "kind": str(a.kind) if a.kind else "—",
                "access_tier": str(a.access_tier) if a.access_tier else "—",
                "https_only": a.enable_https_traffic_only,
                "blob_public_access": a.allow_blob_public_access,
                "tags": dict(a.tags or {}),
                "created_at": a.creation_time.isoformat() if a.creation_time else None,
            })
        return accounts
    except Exception as e:
        print(f"storage_accounts error: {e}"); return []


def scan_dns_zones(credential, subscription_id):
    try:
        client = DnsManagementClient(credential, subscription_id)
        return [{
            "id": z.id, "name": z.name,
            "type": "Private" if z.zone_type and "Private" in str(z.zone_type) else "Public",
            "record_sets": z.number_of_record_sets,
            "name_servers": list(z.name_servers or []),
        } for z in client.zones.list()]
    except Exception as e:
        print(f"dns_zones error: {e}"); return []


def scan_cdn_profiles(credential, subscription_id):
    try:
        client = CdnManagementClient(credential, subscription_id)
        profiles = []
        for p in client.profiles.list():
            endpoints = []
            try:
                rg = _rg_from_id(p.id)
                for ep in client.endpoints.list_by_profile(rg, p.name):
                    endpoints.append({
                        "name": ep.name, "hostname": ep.host_name,
                        "origin": ep.origins[0].host_name if ep.origins else "—",
                        "enabled": True,
                    })
            except Exception:
                pass
            profiles.append({
                "id": p.id, "name": p.name,
                "sku": p.sku.name if p.sku else "—",
                "endpoints": endpoints,
                "resource_group": _rg_from_id(p.id),
            })
        return profiles
    except Exception as e:
        print(f"cdn_profiles error: {e}"); return []


def scan_key_vaults(credential, subscription_id):
    try:
        client = KeyVaultManagementClient(credential, subscription_id)
        return [{
            "id": v.id, "name": v.name, "location": v.location,
            "sku": v.properties.sku.name if v.properties and v.properties.sku else "—",
            "soft_delete_enabled": getattr(v.properties, "enable_soft_delete", None),
            "purge_protection": getattr(v.properties, "enable_purge_protection", None),
            "rbac_enabled": getattr(v.properties, "enable_rbac_authorization", None),
        } for v in client.vaults.list()]
    except Exception as e:
        print(f"key_vaults error: {e}"); return []


def scan_entra_id(credential, subscription_id):
    try:
        auth_client = AuthorizationManagementClient(credential, subscription_id)
        assignments = []
        try:
            for ra in auth_client.role_assignments.list_for_subscription():
                assignments.append({
                    "principal_id": ra.principal_id,
                    "principal_type": str(ra.principal_type) if ra.principal_type else "—",
                    "role_definition_id": ra.role_definition_id,
                    "scope": ra.scope,
                })
        except Exception:
            pass
        return {
            "role_assignments": len(assignments),
            "role_assignment_details": assignments[:20],
            "users": [],
            "service_principals": [],
            "groups": [],
            "note": "User/group data requires Microsoft Graph API permissions. Role assignments shown from Reader access.",
            "mock": False,
        }
    except Exception as e:
        print(f"entra_id error: {e}")
        return {"role_assignments": 0, "users": [], "service_principals": [], "groups": [], "error": str(e), "mock": False}


def scan_costs(credential, subscription_id):
    try:
        from azure.mgmt.costmanagement import CostManagementClient
        from azure.mgmt.costmanagement.models import QueryDefinition, QueryTimePeriod, QueryDataset, QueryAggregation, QueryGrouping
        client = CostManagementClient(credential)
        now = datetime.now(timezone.utc)
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        scope = f"/subscriptions/{subscription_id}"
        result = client.query.usage(scope=scope, parameters=QueryDefinition(
            type="ActualCost", timeframe="Custom",
            time_period=QueryTimePeriod(from_property=start, to=now),
            dataset=QueryDataset(
                granularity="None",
                aggregation={"totalCost": QueryAggregation(name="Cost", function="Sum")},
                grouping=[QueryGrouping(type="Dimension", name="ServiceName")],
            ),
        ))
        by_service = {}
        total = 0.0
        for row in (result.rows or []):
            svc = row[1] if len(row) > 1 else "Unknown"
            cost = float(row[0]) if row[0] else 0.0
            by_service[svc] = round(cost, 2)
            total += cost
        return {
            "currency": "USD",
            "billing_period": now.strftime("%Y-%m"),
            "total": round(total, 2),
            "by_service": by_service,
            "forecast": None,
            "mock": False,
        }
    except Exception as e:
        print(f"costs error: {e}")
        return {
            "currency": "USD",
            "billing_period": datetime.now(timezone.utc).strftime("%Y-%m"),
            "total": 0, "by_service": {},
            "error": "Billing Reader role required for cost data.",
            "mock": False,
        }


# ── Per-region scans ──────────────────────────────────────────────────────────

def scan_virtual_machines(credential, subscription_id, region):
    try:
        compute = ComputeManagementClient(credential, subscription_id)
        network = NetworkManagementClient(credential, subscription_id)
        vms = []
        for vm in compute.virtual_machines.list_all():
            if vm.location != region:
                continue
            power = "Unknown"
            try:
                rg = _rg_from_id(vm.id)
                iv = compute.virtual_machines.instance_view(rg, vm.name)
                power = next((s.display_status for s in (iv.statuses or []) if s.code and s.code.startswith("PowerState/")), "Unknown")
            except Exception:
                pass
            private_ip, public_ip = None, None
            try:
                if vm.network_profile and vm.network_profile.network_interfaces:
                    nic_id = vm.network_profile.network_interfaces[0].id
                    nic = network.network_interfaces.get(_rg_from_id(nic_id), nic_id.split("/")[-1])
                    if nic.ip_configurations:
                        private_ip = nic.ip_configurations[0].private_ip_address
                        pip_ref = nic.ip_configurations[0].public_ip_address
                        if pip_ref:
                            pip = network.public_ip_addresses.get(_rg_from_id(pip_ref.id), pip_ref.id.split("/")[-1])
                            public_ip = pip.ip_address
            except Exception:
                pass
            vms.append({
                "id": vm.id, "name": vm.name, "location": vm.location,
                "vm_size": vm.hardware_profile.vm_size if vm.hardware_profile else "—",
                "os_type": str(vm.storage_profile.os_disk.os_type) if vm.storage_profile and vm.storage_profile.os_disk else "—",
                "state": power, "power_state": power,
                "private_ip": private_ip, "public_ip": public_ip,
                "tags": dict(vm.tags or {}),
                "resource_group": _rg_from_id(vm.id), "region": region,
            })
        return vms
    except Exception as e:
        print(f"virtual_machines [{region}] error: {e}"); return []


def scan_azure_functions(credential, subscription_id, region):
    try:
        client = WebSiteManagementClient(credential, subscription_id)
        fns = []
        for app in client.web_apps.list():
            if app.location != region: continue
            if not app.kind or "functionapp" not in app.kind.lower(): continue
            fns.append({
                "id": app.id, "name": app.name, "location": app.location,
                "runtime": (app.site_config.linux_fx_version if app.site_config else None) or "—",
                "plan": app.server_farm_id.split("/")[-1] if app.server_farm_id else "—",
                "state": app.state or "Unknown",
                "url": f"https://{app.default_host_name}" if app.default_host_name else "—",
                "resource_group": app.resource_group, "region": region,
            })
        return fns
    except Exception as e:
        print(f"azure_functions [{region}] error: {e}"); return []


def scan_app_service(credential, subscription_id, region):
    try:
        client = WebSiteManagementClient(credential, subscription_id)
        apps = []
        for app in client.web_apps.list():
            if app.location != region: continue
            if app.kind and "functionapp" in app.kind.lower(): continue
            apps.append({
                "id": app.id, "name": app.name, "location": app.location,
                "state": app.state or "Unknown",
                "url": f"https://{app.default_host_name}" if app.default_host_name else "—",
                "https_only": app.https_only,
                "resource_group": app.resource_group, "region": region,
            })
        return apps
    except Exception as e:
        print(f"app_service [{region}] error: {e}"); return []


def scan_sql_databases(credential, subscription_id, region):
    try:
        client = SqlManagementClient(credential, subscription_id)
        dbs = []
        for server in client.servers.list():
            if server.location != region: continue
            rg = _rg_from_id(server.id)
            try:
                for db in client.databases.list_by_server(rg, server.name):
                    if db.name == "master": continue
                    dbs.append({
                        "id": db.id, "name": db.name,
                        "server": server.fully_qualified_domain_name or server.name,
                        "location": db.location,
                        "sku": db.sku.name if db.sku else "—",
                        "max_size_gb": round(db.max_size_bytes / (1024**3), 1) if db.max_size_bytes else "—",
                        "status": str(db.status) if db.status else "—",
                        "resource_group": rg, "region": region,
                    })
            except Exception as e:
                print(f"  sql db list error: {e}")
        return dbs
    except Exception as e:
        print(f"sql_databases [{region}] error: {e}"); return []


def scan_virtual_networks(credential, subscription_id, region):
    try:
        client = NetworkManagementClient(credential, subscription_id)
        vnets = []
        for vnet in client.virtual_networks.list_all():
            if vnet.location != region: continue
            subnets = [{"name": s.name, "address_prefix": s.address_prefix, "nsg": s.network_security_group.id.split("/")[-1] if s.network_security_group else None} for s in (vnet.subnets or [])]
            vnets.append({"id": vnet.id, "name": vnet.name, "address_space": list(vnet.address_space.address_prefixes) if vnet.address_space else [], "subnets": subnets, "resource_group": _rg_from_id(vnet.id), "region": region})
        nsgs = [{"name": n.name, "rules": len(n.security_rules or []), "location": n.location} for n in client.network_security_groups.list_all() if n.location == region]
        return {"vnets": vnets, "subnets": sum(len(v["subnets"]) for v in vnets), "network_security_groups": nsgs, "nsg_count": len(nsgs), "region": region}
    except Exception as e:
        print(f"virtual_networks [{region}] error: {e}")
        return {"vnets": [], "subnets": 0, "network_security_groups": [], "nsg_count": 0, "region": region}


def scan_aks_clusters(credential, subscription_id, region):
    try:
        client = ContainerServiceClient(credential, subscription_id)
        clusters = []
        for c in client.managed_clusters.list():
            if c.location != region: continue
            pools = [{"name": p.name, "vm_size": p.vm_size, "count": p.count, "min_count": p.min_count, "max_count": p.max_count, "mode": str(p.mode) if p.mode else "—", "os": str(p.os_type) if p.os_type else "Linux"} for p in (c.agent_pool_profiles or [])]
            clusters.append({"id": c.id, "name": c.name, "location": c.location, "kubernetes_version": c.kubernetes_version, "node_pools": pools, "total_nodes": sum(p.get("count") or 0 for p in pools), "power_state": str(c.power_state.code) if c.power_state else "Running", "resource_group": _rg_from_id(c.id), "region": region})
        return clusters
    except Exception as e:
        print(f"aks_clusters [{region}] error: {e}"); return []


def scan_container_registry(credential, subscription_id, region):
    try:
        client = ContainerRegistryManagementClient(credential, subscription_id)
        return [{"id": r.id, "name": r.name, "location": r.location, "sku": r.sku.name if r.sku else "—", "login_server": r.login_server, "admin_enabled": r.admin_user_enabled, "resource_group": _rg_from_id(r.id), "region": region} for r in client.registries.list() if r.location == region]
    except Exception as e:
        print(f"container_registry [{region}] error: {e}"); return []


def scan_monitor_alerts(credential, subscription_id, region):
    try:
        client = MonitorManagementClient(credential, subscription_id)
        return [{"id": r.id, "name": r.name, "description": r.description or "—", "severity": r.severity, "severity_num": r.severity, "state": "Enabled" if r.enabled else "Disabled", "region": region} for r in client.metric_alerts.list_by_subscription() if r.location == region or r.location == "global"]
    except Exception as e:
        print(f"monitor_alerts [{region}] error: {e}"); return []


def scan_service_bus(credential, subscription_id, region):
    try:
        client = ServiceBusManagementClient(credential, subscription_id)
        namespaces = []
        for ns in client.namespaces.list():
            if ns.location != region: continue
            rg = _rg_from_id(ns.id)
            queues = []
            try:
                for q in client.queues.list_by_namespace(rg, ns.name):
                    queues.append({"name": q.name, "messages": q.message_count or 0, "dead_letter": q.dead_letter_message_count or 0})
            except Exception:
                pass
            namespaces.append({"id": ns.id, "name": ns.name, "location": ns.location, "sku": ns.sku.name if ns.sku else "—", "queues": queues, "topics": [], "resource_group": rg, "region": region})
        return namespaces
    except Exception as e:
        print(f"service_bus [{region}] error: {e}"); return []


def scan_load_balancers(credential, subscription_id, region):
    try:
        client = NetworkManagementClient(credential, subscription_id)
        return [{"id": lb.id, "name": lb.name, "location": lb.location, "sku": lb.sku.name if lb.sku else "—", "type": "Load Balancer", "frontend_ips": len(lb.frontend_ip_configurations or []), "backend_pools": len(lb.backend_address_pools or []), "rules": len(lb.load_balancing_rules or []), "resource_group": _rg_from_id(lb.id), "region": region} for lb in client.load_balancers.list_all() if lb.location == region]
    except Exception as e:
        print(f"load_balancers [{region}] error: {e}"); return []


def scan_managed_disks(credential, subscription_id, region):
    try:
        client = ComputeManagementClient(credential, subscription_id)
        return [{"name": d.name, "location": d.location, "sku": d.sku.name if d.sku else "—", "size_gb": d.disk_size_gb, "state": str(d.disk_state) if d.disk_state else "—", "os_disk": d.os_type is not None, "region": region} for d in client.disks.list() if d.location == region]
    except Exception as e:
        print(f"managed_disks [{region}] error: {e}"); return []


def scan_public_ips(credential, subscription_id, region):
    try:
        client = NetworkManagementClient(credential, subscription_id)
        return [{"name": p.name, "location": p.location, "ip_address": p.ip_address, "allocation_method": str(p.public_ip_allocation_method) if p.public_ip_allocation_method else "—", "sku": p.sku.name if p.sku else "—", "associated_with": p.ip_configuration.id.split("/")[-3] if p.ip_configuration else "Unassociated"} for p in client.public_ip_addresses.list_all() if p.location == region]
    except Exception as e:
        print(f"public_ips [{region}] error: {e}"); return []


# ══════════════════════════════════════════════════════════════════════════════
# MAIN SCAN ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

def scan_all(tenant_id, client_id, client_secret, subscription_id, regions=None):
    if not AZURE_SDK_AVAILABLE:
        raise RuntimeError("Azure SDK not installed. Check requirements.txt.")

    credential = ClientSecretCredential(tenant_id=tenant_id, client_id=client_id, client_secret=client_secret)
    results = {}

    print(f"Azure real scan — subscription: {subscription_id}")

    results["identity"]        = scan_identity(credential, subscription_id)
    regions                    = regions or ["eastus", "westeurope", "southeastasia"]
    results["regions"]         = regions
    results["region_display"]  = {r: AZURE_REGION_DISPLAY.get(r, r) for r in regions}
    results["resource_groups"] = scan_resource_groups(credential, subscription_id)

    # Flat list of ALL resources in subscription
    try:
        rc = ResourceManagementClient(credential, subscription_id)
        all_res = list(rc.resources.list())
        results["all_resources"] = [
            {"id": r.id, "name": r.name, "type": r.type, "location": r.location, "tags": dict(r.tags or {})}
            for r in all_res
        ]
    except Exception as e:
        print(f"all_resources error: {e}")
        results["all_resources"] = []
    results["storage_accounts"]= scan_storage_accounts(credential, subscription_id)
    results["dns_zones"]       = scan_dns_zones(credential, subscription_id)
    results["cdn_profiles"]    = scan_cdn_profiles(credential, subscription_id)
    results["key_vaults"]      = scan_key_vaults(credential, subscription_id)
    results["entra_id"]        = scan_entra_id(credential, subscription_id)
    results["costs"]           = scan_costs(credential, subscription_id)
    results["subscriptions"]   = [{"subscription_id": subscription_id, "display_name": results["identity"].get("subscription_name", "—"), "state": "Enabled", "tenant_id": tenant_id}]

    PER_REGION = [
        ("virtual_machines",   lambda r: scan_virtual_machines(credential, subscription_id, r)),
        ("azure_functions",    lambda r: scan_azure_functions(credential, subscription_id, r)),
        ("app_service",        lambda r: scan_app_service(credential, subscription_id, r)),
        ("sql_databases",      lambda r: scan_sql_databases(credential, subscription_id, r)),
        ("virtual_networks",   lambda r: scan_virtual_networks(credential, subscription_id, r)),
        ("aks_clusters",       lambda r: scan_aks_clusters(credential, subscription_id, r)),
        ("container_registry", lambda r: scan_container_registry(credential, subscription_id, r)),
        ("load_balancers",     lambda r: scan_load_balancers(credential, subscription_id, r)),
        ("monitor_alerts",     lambda r: scan_monitor_alerts(credential, subscription_id, r)),
        ("service_bus",        lambda r: scan_service_bus(credential, subscription_id, r)),
        ("managed_disks",      lambda r: scan_managed_disks(credential, subscription_id, r)),
        ("public_ips",         lambda r: scan_public_ips(credential, subscription_id, r)),
    ]

    results["services"] = {}
    for region in regions:
        print(f"  region: {region}...")
        region_data = {}
        for svc_name, fn in PER_REGION:
            try:
                region_data[svc_name] = fn(region)
            except Exception as e:
                region_data[svc_name] = {"error": str(e)}
        results["services"][region] = region_data

    results["cloud"] = "azure"
    results["mock"]  = False
    results["scan_time"] = datetime.now(timezone.utc).isoformat()
    print("Azure scan complete.")
    return results