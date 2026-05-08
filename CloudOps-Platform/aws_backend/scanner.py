# #!/usr/bin/env python3
# """
# AWS Discovery — Full Multi-Region Scanner (Azure Ready)
# Extended to ~100 services with file-based persistence support
# """
#
# import json
# from datetime import datetime, timezone
# from concurrent.futures import ThreadPoolExecutor, as_completed
# from typing import Dict, List, Any
#
# import boto3
# from botocore.exceptions import ClientError
#
#
# # ── CONFIG ─────────────────────────────────────────────────────────────────────
# REGION_WORKERS  = 3
# SERVICE_WORKERS = 5
# # ──────────────────────────────────────────────────────────────────────────────
#
#
# def build_session(access_key, secret_key, region="us-east-1"):
#     return boto3.Session(
#         aws_access_key_id=access_key,
#         aws_secret_access_key=secret_key,
#         region_name=region,
#     )
#
#
# def paginate(client, method, result_key, **kwargs):
#     results = []
#     try:
#         paginator = client.get_paginator(method)
#         for page in paginator.paginate(**kwargs):
#             results.extend(page.get(result_key, []))
#     except Exception:
#         pass
#     return results
#
#
# def safe(fn, default=None, **kwargs):
#     try:
#         return fn(**kwargs)
#     except Exception:
#         return default
#
#
# # ── GLOBAL SCANS ───────────────────────────────────────────────────────────────
#
# def scan_identity(session):
#     sts = session.client("sts")
#     r = sts.get_caller_identity()
#     return {"account_id": r["Account"], "user_id": r["UserId"], "arn": r["Arn"]}
#
#
# def get_regions(session, selected):
#     if selected:
#         return selected
#     try:
#         ec2 = session.client("ec2", region_name="us-east-1")
#         resp = ec2.describe_regions()
#         return sorted(r["RegionName"] for r in resp["Regions"])
#     except Exception:
#         return [
#             "us-east-1", "us-east-2", "us-west-1", "us-west-2",
#             "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-north-1",
#             "ap-south-1", "ap-southeast-1", "ap-southeast-2",
#             "ap-northeast-1", "ap-northeast-2", "ap-northeast-3",
#             "ca-central-1", "sa-east-1"
#         ]
#
#
# # ══════════════════════════════════════════════════════════════════════════════
# # ORIGINAL SERVICES (17 per-region)
# # ══════════════════════════════════════════════════════════════════════════════
#
# def scan_ec2(session, region):
#     ec2 = session.client("ec2", region_name=region)
#     items = []
#     for r in paginate(ec2, "describe_instances", "Reservations"):
#         for i in r.get("Instances", []):
#             name = next((t["Value"] for t in i.get("Tags", []) if t["Key"] == "Name"), "—")
#             items.append({
#                 "id": i["InstanceId"],
#                 "name": name,
#                 "type": i.get("InstanceType", "—"),
#                 "state": i["State"]["Name"],
#                 "az": i.get("Placement", {}).get("AvailabilityZone", "—"),
#                 "vpc": i.get("VpcId", "—"),
#                 "private_ip": i.get("PrivateIpAddress", "—"),
#                 "public_ip": i.get("PublicIpAddress", "—"),
#                 "ami": i.get("ImageId", "—"),
#                 "region": region,
#             })
#     return items
#
#
# def scan_lambda(session, region):
#     lm = session.client("lambda", region_name=region)
#     return paginate(lm, "list_functions", "Functions")
#
#
# def scan_rds(session, region):
#     rds = session.client("rds", region_name=region)
#     return paginate(rds, "describe_db_instances", "DBInstances")
#
#
# def scan_vpc(session, region):
#     ec2 = session.client("ec2", region_name=region)
#     vpcs    = safe(ec2.describe_vpcs, {}).get("Vpcs", [])
#     subnets = paginate(ec2, "describe_subnets", "Subnets")
#     sgs     = paginate(ec2, "describe_security_groups", "SecurityGroups")
#     igws    = paginate(ec2, "describe_internet_gateways", "InternetGateways")
#     ngws    = paginate(ec2, "describe_nat_gateways", "NatGateways")
#     return {
#         "vpcs": vpcs,
#         "subnets": len(subnets),
#         "security_groups": sgs,
#         "internet_gateways": len(igws),
#         "nat_gateways": len(ngws),
#     }
#
#
# def scan_cloudwatch(session, region):
#     cw = session.client("cloudwatch", region_name=region)
#     return paginate(cw, "describe_alarms", "MetricAlarms")
#
#
# def scan_sns(session, region):
#     sns = session.client("sns", region_name=region)
#     return paginate(sns, "list_topics", "Topics")
#
#
# def scan_sqs(session, region):
#     sqs = session.client("sqs", region_name=region)
#     try:
#         return sqs.list_queues().get("QueueUrls", [])
#     except Exception:
#         return []
#
#
# def scan_dynamodb(session, region):
#     ddb = session.client("dynamodb", region_name=region)
#     return paginate(ddb, "list_tables", "TableNames")
#
#
# def scan_cloudformation(session, region):
#     cf = session.client("cloudformation", region_name=region)
#     return paginate(cf, "describe_stacks", "Stacks")
#
#
# def scan_eks(session, region):
#     eks = session.client("eks", region_name=region)
#     clusters = paginate(eks, "list_clusters", "clusters")
#     items = []
#     for c in clusters:
#         try:
#             items.append(eks.describe_cluster(name=c)["cluster"])
#         except Exception:
#             pass
#     return items
#
#
# def scan_ecs(session, region):
#     ecs = session.client("ecs", region_name=region)
#     arns = paginate(ecs, "list_clusters", "clusterArns")
#     if not arns:
#         return []
#     return ecs.describe_clusters(clusters=arns).get("clusters", [])
#
#
# def scan_elb(session, region):
#     elb = session.client("elbv2", region_name=region)
#     return paginate(elb, "describe_load_balancers", "LoadBalancers")
#
#
# def scan_autoscaling(session, region):
#     asg = session.client("autoscaling", region_name=region)
#     return paginate(asg, "describe_auto_scaling_groups", "AutoScalingGroups")
#
#
# def scan_secrets(session, region):
#     sm = session.client("secretsmanager", region_name=region)
#     return paginate(sm, "list_secrets", "SecretList")
#
#
# def scan_kms(session, region):
#     kms = session.client("kms", region_name=region)
#     return paginate(kms, "list_keys", "Keys")
#
#
# def scan_ecr(session, region):
#     ecr = session.client("ecr", region_name=region)
#     return paginate(ecr, "describe_repositories", "repositories")
#
#
# def scan_ssm(session, region):
#     ssm = session.client("ssm", region_name=region)
#     return paginate(ssm, "describe_parameters", "Parameters")
#
#
# # ══════════════════════════════════════════════════════════════════════════════
# # NEW: DATABASES
# # ══════════════════════════════════════════════════════════════════════════════
#
# def scan_elasticache(session, region):
#     try:
#         ec = session.client("elasticache", region_name=region)
#         return paginate(ec, "describe_cache_clusters", "CacheClusters")
#     except Exception:
#         return []
#
#
# def scan_redshift(session, region):
#     try:
#         rs = session.client("redshift", region_name=region)
#         return paginate(rs, "describe_clusters", "Clusters")
#     except Exception:
#         return []
#
#
# def scan_neptune(session, region):
#     try:
#         np = session.client("neptune", region_name=region)
#         return paginate(np, "describe_db_clusters", "DBClusters",
#                         Filters=[{"Name": "engine", "Values": ["neptune"]}])
#     except Exception:
#         return []
#
#
# def scan_documentdb(session, region):
#     try:
#         ddb = session.client("docdb", region_name=region)
#         return paginate(ddb, "describe_db_clusters", "DBClusters")
#     except Exception:
#         return []
#
#
# def scan_timestream(session, region):
#     try:
#         ts = session.client("timestream-write", region_name=region)
#         return paginate(ts, "list_databases", "Databases")
#     except Exception:
#         return []
#
#
# def scan_keyspaces(session, region):
#     try:
#         ks = session.client("keyspaces", region_name=region)
#         return paginate(ks, "list_keyspaces", "keyspaces")
#     except Exception:
#         return []
#
#
# def scan_aurora(session, region):
#     try:
#         rds = session.client("rds", region_name=region)
#         return paginate(rds, "describe_db_clusters", "DBClusters")
#     except Exception:
#         return []
#
#
# # ══════════════════════════════════════════════════════════════════════════════
# # NEW: NETWORKING
# # ══════════════════════════════════════════════════════════════════════════════
#
# def scan_transit_gateway(session, region):
#     try:
#         ec2 = session.client("ec2", region_name=region)
#         return paginate(ec2, "describe_transit_gateways", "TransitGateways")
#     except Exception:
#         return []
#
#
# def scan_vpn(session, region):
#     try:
#         ec2 = session.client("ec2", region_name=region)
#         return paginate(ec2, "describe_vpn_connections", "VpnConnections")
#     except Exception:
#         return []
#
#
# def scan_direct_connect(session, region):
#     try:
#         dx = session.client("directconnect", region_name=region)
#         return dx.describe_connections().get("connections", [])
#     except Exception:
#         return []
#
#
# def scan_waf(session, region):
#     try:
#         waf = session.client("wafv2", region_name=region)
#         return waf.list_web_acls(Scope="REGIONAL").get("WebACLs", [])
#     except Exception:
#         return []
#
#
# def scan_network_firewall(session, region):
#     try:
#         nf = session.client("network-firewall", region_name=region)
#         return paginate(nf, "list_firewalls", "Firewalls")
#     except Exception:
#         return []
#
#
# def scan_route53_resolver(session, region):
#     try:
#         r53r = session.client("route53resolver", region_name=region)
#         return paginate(r53r, "list_resolver_endpoints", "ResolverEndpoints")
#     except Exception:
#         return []
#
#
# def scan_vpc_peering(session, region):
#     try:
#         ec2 = session.client("ec2", region_name=region)
#         return paginate(ec2, "describe_vpc_peering_connections", "VpcPeeringConnections")
#     except Exception:
#         return []
#
#
# def scan_elastic_ip(session, region):
#     try:
#         ec2 = session.client("ec2", region_name=region)
#         return ec2.describe_addresses().get("Addresses", [])
#     except Exception:
#         return []
#
#
# # ══════════════════════════════════════════════════════════════════════════════
# # NEW: ANALYTICS
# # ══════════════════════════════════════════════════════════════════════════════
#
# def scan_glue(session, region):
#     try:
#         glue = session.client("glue", region_name=region)
#         return paginate(glue, "get_databases", "DatabaseList")
#     except Exception:
#         return []
#
#
# def scan_kinesis_streams(session, region):
#     try:
#         ks = session.client("kinesis", region_name=region)
#         return paginate(ks, "list_streams", "StreamNames")
#     except Exception:
#         return []
#
#
# def scan_kinesis_firehose(session, region):
#     try:
#         kf = session.client("firehose", region_name=region)
#         return paginate(kf, "list_delivery_streams", "DeliveryStreamNames")
#     except Exception:
#         return []
#
#
# def scan_athena(session, region):
#     try:
#         ath = session.client("athena", region_name=region)
#         return paginate(ath, "list_work_groups", "WorkGroups")
#     except Exception:
#         return []
#
#
# def scan_emr(session, region):
#     try:
#         emr = session.client("emr", region_name=region)
#         return paginate(emr, "list_clusters", "Clusters")
#     except Exception:
#         return []
#
#
# def scan_msk(session, region):
#     try:
#         msk = session.client("kafka", region_name=region)
#         return paginate(msk, "list_clusters", "ClusterInfoList")
#     except Exception:
#         return []
#
#
# def scan_opensearch(session, region):
#     try:
#         os_client = session.client("opensearch", region_name=region)
#         return os_client.list_domain_names().get("DomainNames", [])
#     except Exception:
#         return []
#
#
# def scan_quicksight(session, region):
#     try:
#         qs = session.client("quicksight", region_name=region)
#         account_id = session.client("sts").get_caller_identity()["Account"]
#         return qs.list_users(AwsAccountId=account_id, Namespace="default").get("UserList", [])
#     except Exception:
#         return []
#
#
# # ══════════════════════════════════════════════════════════════════════════════
# # NEW: SECURITY
# # ══════════════════════════════════════════════════════════════════════════════
#
# def scan_guardduty(session, region):
#     try:
#         gd = session.client("guardduty", region_name=region)
#         detectors = gd.list_detectors().get("DetectorIds", [])
#         result = []
#         for d in detectors:
#             try:
#                 info = gd.get_detector(DetectorId=d)
#                 result.append({"DetectorId": d, "Status": info.get("Status")})
#             except Exception:
#                 pass
#         return result
#     except Exception:
#         return []
#
#
# def scan_securityhub(session, region):
#     try:
#         sh = session.client("securityhub", region_name=region)
#         hub_arn = sh.describe_hub().get("HubArn")
#         return [{"enabled": True, "HubArn": hub_arn}] if hub_arn else []
#     except Exception:
#         return []
#
#
# def scan_config(session, region):
#     try:
#         cfg = session.client("config", region_name=region)
#         return cfg.describe_configuration_recorders().get("ConfigurationRecorders", [])
#     except Exception:
#         return []
#
#
# def scan_inspector(session, region):
#     try:
#         ins = session.client("inspector2", region_name=region)
#         status = ins.batch_get_account_status(
#             accountIds=[session.client("sts").get_caller_identity()["Account"]]
#         ).get("accounts", [])
#         return status
#     except Exception:
#         return []
#
#
# def scan_macie(session, region):
#     try:
#         mac = session.client("macie2", region_name=region)
#         status = mac.get_macie_session().get("status")
#         return [{"status": status}] if status else []
#     except Exception:
#         return []
#
#
# def scan_iam_analyzer(session, region):
#     try:
#         aa = session.client("accessanalyzer", region_name=region)
#         return paginate(aa, "list_analyzers", "analyzers")
#     except Exception:
#         return []
#
#
# def scan_shield(session, region):
#     try:
#         sh = session.client("shield", region_name="us-east-1")
#         return sh.list_protections().get("Protections", [])
#     except Exception:
#         return []
#
#
# def scan_cloudtrail(session, region):
#     try:
#         ct = session.client("cloudtrail", region_name=region)
#         return ct.describe_trails().get("trailList", [])
#     except Exception:
#         return []
#
#
# # ══════════════════════════════════════════════════════════════════════════════
# # NEW: DEVOPS / CICD
# # ══════════════════════════════════════════════════════════════════════════════
#
# def scan_codepipeline(session, region):
#     try:
#         cp = session.client("codepipeline", region_name=region)
#         return paginate(cp, "list_pipelines", "pipelines")
#     except Exception:
#         return []
#
#
# def scan_codebuild(session, region):
#     try:
#         cb = session.client("codebuild", region_name=region)
#         return paginate(cb, "list_projects", "projects")
#     except Exception:
#         return []
#
#
# def scan_codedeploy(session, region):
#     try:
#         cd = session.client("codedeploy", region_name=region)
#         return paginate(cd, "list_applications", "applications")
#     except Exception:
#         return []
#
#
# def scan_codecommit(session, region):
#     try:
#         cc = session.client("codecommit", region_name=region)
#         return paginate(cc, "list_repositories", "repositories")
#     except Exception:
#         return []
#
#
# def scan_codeartifact(session, region):
#     try:
#         ca = session.client("codeartifact", region_name=region)
#         return paginate(ca, "list_domains", "domains")
#     except Exception:
#         return []
#
#
# def scan_elasticbeanstalk(session, region):
#     try:
#         eb = session.client("elasticbeanstalk", region_name=region)
#         return paginate(eb, "describe_environments", "Environments")
#     except Exception:
#         return []
#
#
# def scan_amplify(session, region):
#     try:
#         amp = session.client("amplify", region_name=region)
#         return paginate(amp, "list_apps", "apps")
#     except Exception:
#         return []
#
#
# # ══════════════════════════════════════════════════════════════════════════════
# # NEW: AI / ML
# # ══════════════════════════════════════════════════════════════════════════════
#
# def scan_sagemaker(session, region):
#     try:
#         sm = session.client("sagemaker", region_name=region)
#         return paginate(sm, "list_endpoints", "Endpoints")
#     except Exception:
#         return []
#
#
# def scan_bedrock(session, region):
#     try:
#         br = session.client("bedrock", region_name=region)
#         return br.list_foundation_models().get("modelSummaries", [])
#     except Exception:
#         return []
#
#
# def scan_rekognition(session, region):
#     try:
#         rk = session.client("rekognition", region_name=region)
#         return paginate(rk, "list_collections", "CollectionIds")
#     except Exception:
#         return []
#
#
# def scan_comprehend(session, region):
#     try:
#         cp = session.client("comprehend", region_name=region)
#         return paginate(cp, "list_endpoints", "Endpoints")
#     except Exception:
#         return []
#
#
# def scan_textract(session, region):
#     try:
#         tx = session.client("textract", region_name=region)
#         return paginate(tx, "list_adapter_versions", "AdapterVersions")
#     except Exception:
#         return []
#
#
# def scan_lex(session, region):
#     try:
#         lex = session.client("lex-models", region_name=region)
#         return paginate(lex, "get_bots", "bots")
#     except Exception:
#         return []
#
#
# # ══════════════════════════════════════════════════════════════════════════════
# # NEW: MESSAGING / INTEGRATION
# # ══════════════════════════════════════════════════════════════════════════════
#
# def scan_eventbridge(session, region):
#     try:
#         eb = session.client("events", region_name=region)
#         return paginate(eb, "list_rules", "Rules")
#     except Exception:
#         return []
#
#
# def scan_stepfunctions(session, region):
#     try:
#         sf = session.client("stepfunctions", region_name=region)
#         return paginate(sf, "list_state_machines", "stateMachines")
#     except Exception:
#         return []
#
#
# def scan_appsync(session, region):
#     try:
#         aps = session.client("appsync", region_name=region)
#         return paginate(aps, "list_graphql_apis", "graphqlApis")
#     except Exception:
#         return []
#
#
# def scan_apigateway(session, region):
#     try:
#         ag = session.client("apigateway", region_name=region)
#         return paginate(ag, "get_rest_apis", "items")
#     except Exception:
#         return []
#
#
# def scan_apigatewayv2(session, region):
#     try:
#         ag2 = session.client("apigatewayv2", region_name=region)
#         return paginate(ag2, "get_apis", "Items")
#     except Exception:
#         return []
#
#
# def scan_mq(session, region):
#     try:
#         mq = session.client("mq", region_name=region)
#         return paginate(mq, "list_brokers", "BrokerSummaries")
#     except Exception:
#         return []
#
#
# def scan_iot(session, region):
#     try:
#         iot = session.client("iot", region_name=region)
#         return paginate(iot, "list_things", "things")
#     except Exception:
#         return []
#
#
# def scan_pinpoint(session, region):
#     try:
#         pp = session.client("pinpoint", region_name=region)
#         return pp.get_apps().get("ApplicationsResponse", {}).get("Item", [])
#     except Exception:
#         return []
#
#
# # ══════════════════════════════════════════════════════════════════════════════
# # NEW: COMPUTE
# # ══════════════════════════════════════════════════════════════════════════════
#
# def scan_lightsail(session, region):
#     try:
#         ls = session.client("lightsail", region_name=region)
#         return ls.get_instances().get("instances", [])
#     except Exception:
#         return []
#
#
# def scan_batch(session, region):
#     try:
#         bt = session.client("batch", region_name=region)
#         return paginate(bt, "describe_job_queues", "jobQueues")
#     except Exception:
#         return []
#
#
# def scan_apprunner(session, region):
#     try:
#         ar = session.client("apprunner", region_name=region)
#         return paginate(ar, "list_services", "ServiceSummaryList")
#     except Exception:
#         return []
#
#
# def scan_ec2_spot(session, region):
#     try:
#         ec2 = session.client("ec2", region_name=region)
#         return paginate(ec2, "describe_spot_instance_requests", "SpotInstanceRequests")
#     except Exception:
#         return []
#
#
# def scan_ec2_reserved(session, region):
#     try:
#         ec2 = session.client("ec2", region_name=region)
#         return ec2.describe_reserved_instances().get("ReservedInstances", [])
#     except Exception:
#         return []
#
#
# # ══════════════════════════════════════════════════════════════════════════════
# # NEW: STORAGE
# # ══════════════════════════════════════════════════════════════════════════════
#
# def scan_efs(session, region):
#     try:
#         efs = session.client("efs", region_name=region)
#         return paginate(efs, "describe_file_systems", "FileSystems")
#     except Exception:
#         return []
#
#
# def scan_fsx(session, region):
#     try:
#         fsx = session.client("fsx", region_name=region)
#         return paginate(fsx, "describe_file_systems", "FileSystems")
#     except Exception:
#         return []
#
#
# def scan_backup(session, region):
#     try:
#         bk = session.client("backup", region_name=region)
#         return paginate(bk, "list_backup_vaults", "BackupVaultList")
#     except Exception:
#         return []
#
#
# def scan_storagegateway(session, region):
#     try:
#         sg = session.client("storagegateway", region_name=region)
#         return paginate(sg, "list_gateways", "Gateways")
#     except Exception:
#         return []
#
#
# def scan_glacier(session, region):
#     try:
#         gl = session.client("glacier", region_name=region)
#         return paginate(gl, "list_vaults", "VaultList", accountId="-")
#     except Exception:
#         return []
#
#
# # ══════════════════════════════════════════════════════════════════════════════
# # NEW: MONITORING / GOVERNANCE
# # ══════════════════════════════════════════════════════════════════════════════
#
# def scan_xray(session, region):
#     try:
#         xr = session.client("xray", region_name=region)
#         return paginate(xr, "get_groups", "Groups")
#     except Exception:
#         return []
#
#
# def scan_servicecatalog(session, region):
#     try:
#         sc = session.client("servicecatalog", region_name=region)
#         return paginate(sc, "list_portfolios", "PortfolioDetails")
#     except Exception:
#         return []
#
#
# def scan_health(session, region):
#     try:
#         health = session.client("health", region_name="us-east-1")
#         return paginate(health, "describe_events", "events",
#                         filter={"regions": [region]})
#     except Exception:
#         return []
#
#
# # ── GLOBAL SERVICES ────────────────────────────────────────────────────────────
#
# def scan_iam(session):
#     iam = session.client("iam")
#     return paginate(iam, "list_users", "Users")
#
#
# def scan_iam_roles(session):
#     try:
#         iam = session.client("iam")
#         return paginate(iam, "list_roles", "Roles")
#     except Exception:
#         return []
#
#
# def scan_iam_policies(session):
#     try:
#         iam = session.client("iam")
#         return paginate(iam, "list_policies", "Policies", Scope="Local")
#     except Exception:
#         return []
#
#
# def scan_s3(session):
#     s3 = session.client("s3", region_name="us-east-1")
#     try:
#         return s3.list_buckets().get("Buckets", [])
#     except Exception:
#         return []
#
#
# def scan_route53(session):
#     r53 = session.client("route53")
#     try:
#         return r53.list_hosted_zones().get("HostedZones", [])
#     except Exception:
#         return []
#
#
# def scan_cloudfront(session):
#     cf = session.client("cloudfront", region_name="us-east-1")
#     try:
#         return cf.list_distributions().get("DistributionList", {}).get("Items", [])
#     except Exception:
#         return []
#
#
# def scan_organizations(session):
#     try:
#         org = session.client("organizations", region_name="us-east-1")
#         return org.describe_organization().get("Organization", {})
#     except Exception:
#         return {}
#
#
# def scan_trusted_advisor(session):
#     try:
#         ta = session.client("support", region_name="us-east-1")
#         checks = ta.describe_trusted_advisor_checks(language="en").get("checks", [])
#         return [{"id": c["id"], "name": c["name"], "category": c["category"]} for c in checks]
#     except Exception:
#         return []
#
#
# def scan_budgets(session):
#     try:
#         bud = session.client("budgets", region_name="us-east-1")
#         account_id = session.client("sts").get_caller_identity()["Account"]
#         return paginate(bud, "describe_budgets", "Budgets", AccountId=account_id)
#     except Exception:
#         return []
#
#
# def scan_costs(session):
#     ce = session.client("ce", region_name="us-east-1")
#     now = datetime.now(timezone.utc)
#     start = now.replace(day=1).strftime("%Y-%m-%d")
#     end   = now.strftime("%Y-%m-%d")
#     result = {"by_service": {}, "total": 0, "forecast": None}
#
#     try:
#         resp = ce.get_cost_and_usage(
#             TimePeriod={"Start": start, "End": end},
#             Granularity="MONTHLY",
#             Metrics=["UnblendedCost"],
#             GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}]
#         )
#         for period in resp.get("ResultsByTime", []):
#             for g in period.get("Groups", []):
#                 cost = float(g["Metrics"]["UnblendedCost"]["Amount"])
#                 if cost > 0:
#                     result["by_service"][g["Keys"][0]] = round(cost, 4)
#         result["total"] = round(sum(result["by_service"].values()), 4)
#     except Exception as e:
#         result["error"] = str(e)
#
#     try:
#         if now.month == 12:
#             forecast_end = f"{now.year + 1}-01-01"
#         else:
#             forecast_end = now.replace(month=now.month + 1, day=1).strftime("%Y-%m-%d")
#         if end != start:
#             f_resp = ce.get_cost_forecast(
#                 TimePeriod={"Start": end, "End": forecast_end},
#                 Metric="UNBLENDED_COST",
#                 Granularity="MONTHLY"
#             )
#             result["forecast"] = round(float(f_resp["Total"]["Amount"]), 2)
#     except Exception:
#         result["forecast"] = None
#
#     return result
#
#
# # ══════════════════════════════════════════════════════════════════════════════
# # MAIN SCAN
# # ══════════════════════════════════════════════════════════════════════════════
#
# def scan_all(access_key: str, secret_key: str, regions: List[str] = None) -> Dict[str, Any]:
#     results = {}
#
#     try:
#         session = build_session(access_key, secret_key)
#
#         # Identity
#         try:
#             results["identity"] = scan_identity(session)
#         except Exception as e:
#             results["identity"] = {"error": str(e), "account_id": None, "arn": None, "user_id": None}
#
#         if not regions:
#             regions = get_regions(session, [])
#
#         results["regions"] = regions
#
#         # Global services
#         results["costs"]           = scan_costs(session)
#         results["iam"]             = scan_iam(session)
#         results["iam_roles"]       = scan_iam_roles(session)
#         results["iam_policies"]    = scan_iam_policies(session)
#         results["s3"]              = scan_s3(session)
#         results["route53"]         = scan_route53(session)
#         results["cloudfront"]      = scan_cloudfront(session)
#         results["organizations"]   = scan_organizations(session)
#         results["trusted_advisor"] = scan_trusted_advisor(session)
#         results["budgets"]         = scan_budgets(session)
#
#         # ── Core services — always scanned (all regions) ──────────────────────
#         CORE_SERVICES = [
#             ("ec2",               scan_ec2),
#             ("lambda_fn",         scan_lambda),
#             ("rds",               scan_rds),
#             ("vpc",               scan_vpc),
#             ("cloudwatch",        scan_cloudwatch),
#             ("sns",               scan_sns),
#             ("sqs",               scan_sqs),
#             ("dynamodb",          scan_dynamodb),
#             ("cloudformation",    scan_cloudformation),
#             ("eks",               scan_eks),
#             ("ecs",               scan_ecs),
#             ("elb",               scan_elb),
#             ("autoscaling",       scan_autoscaling),
#             ("secrets",           scan_secrets),
#             ("kms",               scan_kms),
#             ("ecr",               scan_ecr),
#             ("ssm",               scan_ssm),
#         ]
#
#         # ── Extended services — only scanned for single region ────────────────
#         EXTENDED_SERVICES = [
#             # Databases
#             ("elasticache",       scan_elasticache),
#             ("redshift",          scan_redshift),
#             ("neptune",           scan_neptune),
#             ("documentdb",        scan_documentdb),
#             ("timestream",        scan_timestream),
#             ("keyspaces",         scan_keyspaces),
#             ("aurora",            scan_aurora),
#             # Networking
#             ("transit_gateway",   scan_transit_gateway),
#             ("vpn",               scan_vpn),
#             ("direct_connect",    scan_direct_connect),
#             ("waf",               scan_waf),
#             ("network_firewall",  scan_network_firewall),
#             ("route53_resolver",  scan_route53_resolver),
#             ("vpc_peering",       scan_vpc_peering),
#             ("elastic_ip",        scan_elastic_ip),
#             # Analytics
#             ("glue",              scan_glue),
#             ("kinesis_streams",   scan_kinesis_streams),
#             ("kinesis_firehose",  scan_kinesis_firehose),
#             ("athena",            scan_athena),
#             ("emr",               scan_emr),
#             ("msk",               scan_msk),
#             ("opensearch",        scan_opensearch),
#             ("quicksight",        scan_quicksight),
#             # Security
#             ("guardduty",         scan_guardduty),
#             ("securityhub",       scan_securityhub),
#             ("config",            scan_config),
#             ("inspector",         scan_inspector),
#             ("macie",             scan_macie),
#             ("iam_analyzer",      scan_iam_analyzer),
#             ("shield",            scan_shield),
#             ("cloudtrail",        scan_cloudtrail),
#             # DevOps
#             ("codepipeline",      scan_codepipeline),
#             ("codebuild",         scan_codebuild),
#             ("codedeploy",        scan_codedeploy),
#             ("codecommit",        scan_codecommit),
#             ("codeartifact",      scan_codeartifact),
#             ("elasticbeanstalk",  scan_elasticbeanstalk),
#             ("amplify",           scan_amplify),
#             # AI/ML
#             ("sagemaker",         scan_sagemaker),
#             ("bedrock",           scan_bedrock),
#             ("rekognition",       scan_rekognition),
#             ("comprehend",        scan_comprehend),
#             ("textract",          scan_textract),
#             ("lex",               scan_lex),
#             # Messaging
#             ("eventbridge",       scan_eventbridge),
#             ("stepfunctions",     scan_stepfunctions),
#             ("appsync",           scan_appsync),
#             ("apigateway",        scan_apigateway),
#             ("apigatewayv2",      scan_apigatewayv2),
#             ("mq",                scan_mq),
#             ("iot",               scan_iot),
#             ("pinpoint",          scan_pinpoint),
#             # Compute
#             ("lightsail",         scan_lightsail),
#             ("batch",             scan_batch),
#             ("apprunner",         scan_apprunner),
#             ("ec2_spot",          scan_ec2_spot),
#             ("ec2_reserved",      scan_ec2_reserved),
#             # Storage
#             ("efs",               scan_efs),
#             ("fsx",               scan_fsx),
#             ("backup",            scan_backup),
#             ("storagegateway",    scan_storagegateway),
#             ("glacier",           scan_glacier),
#             # Monitoring
#             ("xray",              scan_xray),
#             ("servicecatalog",    scan_servicecatalog),
#             ("health",            scan_health),
#         ]
#
#         # Use all services for single region, core only for multi-region
#         is_single_region = len(regions) == 1
#         PER_REGION_SERVICES = CORE_SERVICES + EXTENDED_SERVICES if is_single_region else CORE_SERVICES
#
#         results["services"] = {}
#
#         def scan_region(region):
#             try:
#                 reg_session = build_session(access_key, secret_key, region)
#                 region_data = {}
#
#                 with ThreadPoolExecutor(max_workers=SERVICE_WORKERS) as svc_executor:
#                     svc_futures = {
#                         svc_executor.submit(fn, reg_session, region): name
#                         for name, fn in PER_REGION_SERVICES
#                     }
#                     for future in as_completed(svc_futures):
#                         name = svc_futures[future]
#                         try:
#                             region_data[name] = future.result()
#                         except Exception as e:
#                             error_msg = str(e)
#                             if "opt-in" in error_msg.lower() or "not opted in" in error_msg.lower():
#                                 region_data[name] = {"error": f"Region {region} requires opt-in"}
#                             else:
#                                 region_data[name] = {"error": error_msg}
#
#                 return region, region_data
#
#             except Exception as e:
#                 return region, {"error": str(e)}
#
#         with ThreadPoolExecutor(max_workers=REGION_WORKERS) as executor:
#             futures = [executor.submit(scan_region, r) for r in regions]
#             for future in as_completed(futures):
#                 region, data = future.result()
#                 results["services"][region] = data
#
#     except ClientError as e:
#         results["error"] = e.response["Error"]["Message"]
#     except Exception as e:
#         results["error"] = str(e)
#
#     return results

#!/usr/bin/env python3
"""
AWS Discovery — Full Multi-Region Scanner (Azure Ready)
Extended to ~100 services with file-based persistence support
"""

import json
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Any

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError


# ── CONFIG ─────────────────────────────────────────────────────────────────────
REGION_WORKERS  = 3
SERVICE_WORKERS = 10

# Timeout config — prevents any single AWS API call from hanging
BOTO_CONFIG = BotoConfig(
    connect_timeout=10,
    read_timeout=20,
    retries={"max_attempts": 1},
)
# ──────────────────────────────────────────────────────────────────────────────


def build_session(access_key, secret_key, region="us-east-1"):
    return boto3.Session(
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=region,
    )


def get_client(session, service, region=None):
    """Build boto3 client with timeouts."""
    kwargs = {"config": BOTO_CONFIG}
    if region:
        kwargs["region_name"] = region
    return session.client(service, **kwargs)


def paginate(client, method, result_key, **kwargs):
    results = []
    try:
        paginator = client.get_paginator(method)
        for page in paginator.paginate(**kwargs):
            results.extend(page.get(result_key, []))
    except Exception:
        pass
    return results


def safe(fn, default=None, **kwargs):
    try:
        return fn(**kwargs)
    except Exception:
        return default


# ── GLOBAL SCANS ───────────────────────────────────────────────────────────────

def scan_identity(session):
    sts = get_client(session, "sts")
    r = sts.get_caller_identity()
    return {"account_id": r["Account"], "user_id": r["UserId"], "arn": r["Arn"]}


def get_regions(session, selected):
    if selected:
        return selected
    try:
        ec2 = get_client(session, "ec2", region="us-east-1")
        resp = ec2.describe_regions()
        return sorted(r["RegionName"] for r in resp["Regions"])
    except Exception:
        return [
            "us-east-1", "us-east-2", "us-west-1", "us-west-2",
            "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-north-1",
            "ap-south-1", "ap-southeast-1", "ap-southeast-2",
            "ap-northeast-1", "ap-northeast-2", "ap-northeast-3",
            "ca-central-1", "sa-east-1"
        ]


# ══════════════════════════════════════════════════════════════════════════════
# ORIGINAL SERVICES (17 per-region)
# ══════════════════════════════════════════════════════════════════════════════

def scan_ec2(session, region):
    ec2 = get_client(session, "ec2", region=region)
    items = []
    for r in paginate(ec2, "describe_instances", "Reservations"):
        for i in r.get("Instances", []):
            name = next((t["Value"] for t in i.get("Tags", []) if t["Key"] == "Name"), "—")
            items.append({
                "id": i["InstanceId"],
                "name": name,
                "type": i.get("InstanceType", "—"),
                "state": i["State"]["Name"],
                "az": i.get("Placement", {}).get("AvailabilityZone", "—"),
                "vpc": i.get("VpcId", "—"),
                "private_ip": i.get("PrivateIpAddress", "—"),
                "public_ip": i.get("PublicIpAddress", "—"),
                "ami": i.get("ImageId", "—"),
                "region": region,
            })
    return items


def scan_lambda(session, region):
    lm = get_client(session, "lambda", region=region)
    return paginate(lm, "list_functions", "Functions")


def scan_rds(session, region):
    rds = get_client(session, "rds", region=region)
    return paginate(rds, "describe_db_instances", "DBInstances")


def scan_vpc(session, region):
    ec2 = get_client(session, "ec2", region=region)
    vpcs    = safe(ec2.describe_vpcs, {}).get("Vpcs", [])
    subnets = paginate(ec2, "describe_subnets", "Subnets")
    sgs     = paginate(ec2, "describe_security_groups", "SecurityGroups")
    igws    = paginate(ec2, "describe_internet_gateways", "InternetGateways")
    ngws    = paginate(ec2, "describe_nat_gateways", "NatGateways")
    return {
        "vpcs": vpcs,
        "subnets": len(subnets),
        "security_groups": sgs,
        "internet_gateways": len(igws),
        "nat_gateways": len(ngws),
    }


def scan_cloudwatch(session, region):
    cw = get_client(session, "cloudwatch", region=region)
    return paginate(cw, "describe_alarms", "MetricAlarms")


def scan_sns(session, region):
    sns = get_client(session, "sns", region=region)
    return paginate(sns, "list_topics", "Topics")


def scan_sqs(session, region):
    sqs = get_client(session, "sqs", region=region)
    try:
        return sqs.list_queues().get("QueueUrls", [])
    except Exception:
        return []


def scan_dynamodb(session, region):
    ddb = get_client(session, "dynamodb", region=region)
    return paginate(ddb, "list_tables", "TableNames")


def scan_cloudformation(session, region):
    cf = get_client(session, "cloudformation", region=region)
    return paginate(cf, "describe_stacks", "Stacks")


def scan_eks(session, region):
    eks = get_client(session, "eks", region=region)
    clusters = paginate(eks, "list_clusters", "clusters")
    items = []
    for c in clusters:
        try:
            items.append(eks.describe_cluster(name=c)["cluster"])
        except Exception:
            pass
    return items


def scan_ecs(session, region):
    ecs = get_client(session, "ecs", region=region)
    arns = paginate(ecs, "list_clusters", "clusterArns")
    if not arns:
        return []
    return ecs.describe_clusters(clusters=arns).get("clusters", [])


def scan_elb(session, region):
    elb = get_client(session, "elbv2", region=region)
    return paginate(elb, "describe_load_balancers", "LoadBalancers")


def scan_autoscaling(session, region):
    asg = get_client(session, "autoscaling", region=region)
    return paginate(asg, "describe_auto_scaling_groups", "AutoScalingGroups")


def scan_secrets(session, region):
    sm = get_client(session, "secretsmanager", region=region)
    return paginate(sm, "list_secrets", "SecretList")


def scan_kms(session, region):
    kms = get_client(session, "kms", region=region)
    return paginate(kms, "list_keys", "Keys")


def scan_ecr(session, region):
    ecr = get_client(session, "ecr", region=region)
    return paginate(ecr, "describe_repositories", "repositories")


def scan_ssm(session, region):
    ssm = get_client(session, "ssm", region=region)
    return paginate(ssm, "describe_parameters", "Parameters")


# ══════════════════════════════════════════════════════════════════════════════
# NEW: DATABASES
# ══════════════════════════════════════════════════════════════════════════════

def scan_elasticache(session, region):
    try:
        ec = get_client(session, "elasticache", region=region)
        return paginate(ec, "describe_cache_clusters", "CacheClusters")
    except Exception:
        return []


def scan_redshift(session, region):
    try:
        rs = get_client(session, "redshift", region=region)
        return paginate(rs, "describe_clusters", "Clusters")
    except Exception:
        return []


def scan_neptune(session, region):
    try:
        np = get_client(session, "neptune", region=region)
        return paginate(np, "describe_db_clusters", "DBClusters",
                        Filters=[{"Name": "engine", "Values": ["neptune"]}])
    except Exception:
        return []


def scan_documentdb(session, region):
    try:
        ddb = get_client(session, "docdb", region=region)
        return paginate(ddb, "describe_db_clusters", "DBClusters")
    except Exception:
        return []


def scan_timestream(session, region):
    try:
        ts = get_client(session, "timestream-write", region=region)
        return paginate(ts, "list_databases", "Databases")
    except Exception:
        return []


def scan_keyspaces(session, region):
    try:
        ks = get_client(session, "keyspaces", region=region)
        return paginate(ks, "list_keyspaces", "keyspaces")
    except Exception:
        return []


def scan_aurora(session, region):
    try:
        rds = get_client(session, "rds", region=region)
        return paginate(rds, "describe_db_clusters", "DBClusters")
    except Exception:
        return []


# ══════════════════════════════════════════════════════════════════════════════
# NEW: NETWORKING
# ══════════════════════════════════════════════════════════════════════════════

def scan_transit_gateway(session, region):
    try:
        ec2 = get_client(session, "ec2", region=region)
        return paginate(ec2, "describe_transit_gateways", "TransitGateways")
    except Exception:
        return []


def scan_vpn(session, region):
    try:
        ec2 = get_client(session, "ec2", region=region)
        return paginate(ec2, "describe_vpn_connections", "VpnConnections")
    except Exception:
        return []


def scan_direct_connect(session, region):
    try:
        dx = get_client(session, "directconnect", region=region)
        return dx.describe_connections().get("connections", [])
    except Exception:
        return []


def scan_waf(session, region):
    try:
        waf = get_client(session, "wafv2", region=region)
        return waf.list_web_acls(Scope="REGIONAL").get("WebACLs", [])
    except Exception:
        return []


def scan_network_firewall(session, region):
    try:
        nf = get_client(session, "network-firewall", region=region)
        return paginate(nf, "list_firewalls", "Firewalls")
    except Exception:
        return []


def scan_route53_resolver(session, region):
    try:
        r53r = get_client(session, "route53resolver", region=region)
        return paginate(r53r, "list_resolver_endpoints", "ResolverEndpoints")
    except Exception:
        return []


def scan_vpc_peering(session, region):
    try:
        ec2 = get_client(session, "ec2", region=region)
        return paginate(ec2, "describe_vpc_peering_connections", "VpcPeeringConnections")
    except Exception:
        return []


def scan_elastic_ip(session, region):
    try:
        ec2 = get_client(session, "ec2", region=region)
        return ec2.describe_addresses().get("Addresses", [])
    except Exception:
        return []


# ══════════════════════════════════════════════════════════════════════════════
# NEW: ANALYTICS
# ══════════════════════════════════════════════════════════════════════════════

def scan_glue(session, region):
    try:
        glue = get_client(session, "glue", region=region)
        return paginate(glue, "get_databases", "DatabaseList")
    except Exception:
        return []


def scan_kinesis_streams(session, region):
    try:
        ks = get_client(session, "kinesis", region=region)
        return paginate(ks, "list_streams", "StreamNames")
    except Exception:
        return []


def scan_kinesis_firehose(session, region):
    try:
        kf = get_client(session, "firehose", region=region)
        return paginate(kf, "list_delivery_streams", "DeliveryStreamNames")
    except Exception:
        return []


def scan_athena(session, region):
    try:
        ath = get_client(session, "athena", region=region)
        return paginate(ath, "list_work_groups", "WorkGroups")
    except Exception:
        return []


def scan_emr(session, region):
    try:
        emr = get_client(session, "emr", region=region)
        return paginate(emr, "list_clusters", "Clusters")
    except Exception:
        return []


def scan_msk(session, region):
    try:
        msk = get_client(session, "kafka", region=region)
        return paginate(msk, "list_clusters", "ClusterInfoList")
    except Exception:
        return []


def scan_opensearch(session, region):
    try:
        os_client = get_client(session, "opensearch", region=region)
        return os_client.list_domain_names().get("DomainNames", [])
    except Exception:
        return []


def scan_quicksight(session, region):
    try:
        qs = get_client(session, "quicksight", region=region)
        account_id = get_client(session, "sts").get_caller_identity()["Account"]
        return qs.list_users(AwsAccountId=account_id, Namespace="default").get("UserList", [])
    except Exception:
        return []


# ══════════════════════════════════════════════════════════════════════════════
# NEW: SECURITY
# ══════════════════════════════════════════════════════════════════════════════

def scan_guardduty(session, region):
    try:
        gd = get_client(session, "guardduty", region=region)
        detectors = gd.list_detectors().get("DetectorIds", [])
        result = []
        for d in detectors:
            try:
                info = gd.get_detector(DetectorId=d)
                result.append({"DetectorId": d, "Status": info.get("Status")})
            except Exception:
                pass
        return result
    except Exception:
        return []


def scan_securityhub(session, region):
    try:
        sh = get_client(session, "securityhub", region=region)
        hub_arn = sh.describe_hub().get("HubArn")
        return [{"enabled": True, "HubArn": hub_arn}] if hub_arn else []
    except Exception:
        return []


def scan_config(session, region):
    try:
        cfg = get_client(session, "config", region=region)
        return cfg.describe_configuration_recorders().get("ConfigurationRecorders", [])
    except Exception:
        return []


def scan_inspector(session, region):
    try:
        ins = get_client(session, "inspector2", region=region)
        status = ins.batch_get_account_status(
            accountIds=[get_client(session, "sts").get_caller_identity()["Account"]]
        ).get("accounts", [])
        return status
    except Exception:
        return []


def scan_macie(session, region):
    try:
        mac = get_client(session, "macie2", region=region)
        status = mac.get_macie_session().get("status")
        return [{"status": status}] if status else []
    except Exception:
        return []


def scan_iam_analyzer(session, region):
    try:
        aa = get_client(session, "accessanalyzer", region=region)
        return paginate(aa, "list_analyzers", "analyzers")
    except Exception:
        return []


def scan_shield(session, region):
    try:
        sh = get_client(session, "shield", region="us-east-1")
        return sh.list_protections().get("Protections", [])
    except Exception:
        return []


def scan_cloudtrail(session, region):
    try:
        ct = get_client(session, "cloudtrail", region=region)
        return ct.describe_trails().get("trailList", [])
    except Exception:
        return []


# ══════════════════════════════════════════════════════════════════════════════
# NEW: DEVOPS / CICD
# ══════════════════════════════════════════════════════════════════════════════

def scan_codepipeline(session, region):
    try:
        cp = get_client(session, "codepipeline", region=region)
        return paginate(cp, "list_pipelines", "pipelines")
    except Exception:
        return []


def scan_codebuild(session, region):
    try:
        cb = get_client(session, "codebuild", region=region)
        return paginate(cb, "list_projects", "projects")
    except Exception:
        return []


def scan_codedeploy(session, region):
    try:
        cd = get_client(session, "codedeploy", region=region)
        return paginate(cd, "list_applications", "applications")
    except Exception:
        return []


def scan_codecommit(session, region):
    try:
        cc = get_client(session, "codecommit", region=region)
        return paginate(cc, "list_repositories", "repositories")
    except Exception:
        return []


def scan_codeartifact(session, region):
    try:
        ca = get_client(session, "codeartifact", region=region)
        return paginate(ca, "list_domains", "domains")
    except Exception:
        return []


def scan_elasticbeanstalk(session, region):
    try:
        eb = get_client(session, "elasticbeanstalk", region=region)
        return paginate(eb, "describe_environments", "Environments")
    except Exception:
        return []


def scan_amplify(session, region):
    try:
        amp = get_client(session, "amplify", region=region)
        return paginate(amp, "list_apps", "apps")
    except Exception:
        return []


# ══════════════════════════════════════════════════════════════════════════════
# NEW: AI / ML
# ══════════════════════════════════════════════════════════════════════════════

def scan_sagemaker(session, region):
    try:
        sm = get_client(session, "sagemaker", region=region)
        return paginate(sm, "list_endpoints", "Endpoints")
    except Exception:
        return []


def scan_bedrock(session, region):
    try:
        br = get_client(session, "bedrock", region=region)
        return br.list_foundation_models().get("modelSummaries", [])
    except Exception:
        return []


def scan_rekognition(session, region):
    try:
        rk = get_client(session, "rekognition", region=region)
        return paginate(rk, "list_collections", "CollectionIds")
    except Exception:
        return []


def scan_comprehend(session, region):
    try:
        cp = get_client(session, "comprehend", region=region)
        return paginate(cp, "list_endpoints", "Endpoints")
    except Exception:
        return []


def scan_textract(session, region):
    try:
        tx = get_client(session, "textract", region=region)
        return paginate(tx, "list_adapter_versions", "AdapterVersions")
    except Exception:
        return []


def scan_lex(session, region):
    try:
        lex = get_client(session, "lex-models", region=region)
        return paginate(lex, "get_bots", "bots")
    except Exception:
        return []


# ══════════════════════════════════════════════════════════════════════════════
# NEW: MESSAGING / INTEGRATION
# ══════════════════════════════════════════════════════════════════════════════

def scan_eventbridge(session, region):
    try:
        eb = get_client(session, "events", region=region)
        return paginate(eb, "list_rules", "Rules")
    except Exception:
        return []


def scan_stepfunctions(session, region):
    try:
        sf = get_client(session, "stepfunctions", region=region)
        return paginate(sf, "list_state_machines", "stateMachines")
    except Exception:
        return []


def scan_appsync(session, region):
    try:
        aps = get_client(session, "appsync", region=region)
        return paginate(aps, "list_graphql_apis", "graphqlApis")
    except Exception:
        return []


def scan_apigateway(session, region):
    try:
        ag = get_client(session, "apigateway", region=region)
        return paginate(ag, "get_rest_apis", "items")
    except Exception:
        return []


def scan_apigatewayv2(session, region):
    try:
        ag2 = get_client(session, "apigatewayv2", region=region)
        return paginate(ag2, "get_apis", "Items")
    except Exception:
        return []


def scan_mq(session, region):
    try:
        mq = get_client(session, "mq", region=region)
        return paginate(mq, "list_brokers", "BrokerSummaries")
    except Exception:
        return []


def scan_iot(session, region):
    try:
        iot = get_client(session, "iot", region=region)
        return paginate(iot, "list_things", "things")
    except Exception:
        return []


def scan_pinpoint(session, region):
    try:
        pp = get_client(session, "pinpoint", region=region)
        return pp.get_apps().get("ApplicationsResponse", {}).get("Item", [])
    except Exception:
        return []


# ══════════════════════════════════════════════════════════════════════════════
# NEW: COMPUTE
# ══════════════════════════════════════════════════════════════════════════════

def scan_lightsail(session, region):
    try:
        ls = get_client(session, "lightsail", region=region)
        return ls.get_instances().get("instances", [])
    except Exception:
        return []


def scan_batch(session, region):
    try:
        bt = get_client(session, "batch", region=region)
        return paginate(bt, "describe_job_queues", "jobQueues")
    except Exception:
        return []


def scan_apprunner(session, region):
    try:
        ar = get_client(session, "apprunner", region=region)
        return paginate(ar, "list_services", "ServiceSummaryList")
    except Exception:
        return []


def scan_ec2_spot(session, region):
    try:
        ec2 = get_client(session, "ec2", region=region)
        return paginate(ec2, "describe_spot_instance_requests", "SpotInstanceRequests")
    except Exception:
        return []


def scan_ec2_reserved(session, region):
    try:
        ec2 = get_client(session, "ec2", region=region)
        return ec2.describe_reserved_instances().get("ReservedInstances", [])
    except Exception:
        return []


# ══════════════════════════════════════════════════════════════════════════════
# NEW: STORAGE
# ══════════════════════════════════════════════════════════════════════════════

def scan_efs(session, region):
    try:
        efs = get_client(session, "efs", region=region)
        return paginate(efs, "describe_file_systems", "FileSystems")
    except Exception:
        return []


def scan_fsx(session, region):
    try:
        fsx = get_client(session, "fsx", region=region)
        return paginate(fsx, "describe_file_systems", "FileSystems")
    except Exception:
        return []


def scan_backup(session, region):
    try:
        bk = get_client(session, "backup", region=region)
        return paginate(bk, "list_backup_vaults", "BackupVaultList")
    except Exception:
        return []


def scan_storagegateway(session, region):
    try:
        sg = get_client(session, "storagegateway", region=region)
        return paginate(sg, "list_gateways", "Gateways")
    except Exception:
        return []


def scan_glacier(session, region):
    try:
        gl = get_client(session, "glacier", region=region)
        return paginate(gl, "list_vaults", "VaultList", accountId="-")
    except Exception:
        return []


# ══════════════════════════════════════════════════════════════════════════════
# NEW: MONITORING / GOVERNANCE
# ══════════════════════════════════════════════════════════════════════════════

def scan_xray(session, region):
    try:
        xr = get_client(session, "xray", region=region)
        return paginate(xr, "get_groups", "Groups")
    except Exception:
        return []


def scan_servicecatalog(session, region):
    try:
        sc = get_client(session, "servicecatalog", region=region)
        return paginate(sc, "list_portfolios", "PortfolioDetails")
    except Exception:
        return []


def scan_health(session, region):
    try:
        health = get_client(session, "health", region="us-east-1")
        return paginate(health, "describe_events", "events",
                        filter={"regions": [region]})
    except Exception:
        return []


# ── GLOBAL SERVICES ────────────────────────────────────────────────────────────

def scan_iam(session):
    iam = get_client(session, "iam")
    return paginate(iam, "list_users", "Users")


def scan_iam_roles(session):
    try:
        iam = get_client(session, "iam")
        return paginate(iam, "list_roles", "Roles")
    except Exception:
        return []


def scan_iam_policies(session):
    try:
        iam = get_client(session, "iam")
        return paginate(iam, "list_policies", "Policies", Scope="Local")
    except Exception:
        return []


def scan_s3(session):
    s3 = get_client(session, "s3", region="us-east-1")
    try:
        return s3.list_buckets().get("Buckets", [])
    except Exception:
        return []


def scan_route53(session):
    r53 = get_client(session, "route53")
    try:
        return r53.list_hosted_zones().get("HostedZones", [])
    except Exception:
        return []


def scan_cloudfront(session):
    cf = get_client(session, "cloudfront", region="us-east-1")
    try:
        return cf.list_distributions().get("DistributionList", {}).get("Items", [])
    except Exception:
        return []


def scan_organizations(session):
    try:
        org = get_client(session, "organizations", region="us-east-1")
        return org.describe_organization().get("Organization", {})
    except Exception:
        return {}


def scan_trusted_advisor(session):
    try:
        ta = get_client(session, "support", region="us-east-1")
        checks = ta.describe_trusted_advisor_checks(language="en").get("checks", [])
        return [{"id": c["id"], "name": c["name"], "category": c["category"]} for c in checks]
    except Exception:
        return []


def scan_budgets(session):
    try:
        bud = get_client(session, "budgets", region="us-east-1")
        account_id = get_client(session, "sts").get_caller_identity()["Account"]
        return paginate(bud, "describe_budgets", "Budgets", AccountId=account_id)
    except Exception:
        return []


def scan_costs(session):
    ce = get_client(session, "ce", region="us-east-1")
    now = datetime.now(timezone.utc)
    start = now.replace(day=1).strftime("%Y-%m-%d")
    end   = now.strftime("%Y-%m-%d")
    result = {"by_service": {}, "total": 0, "forecast": None}

    try:
        resp = ce.get_cost_and_usage(
            TimePeriod={"Start": start, "End": end},
            Granularity="MONTHLY",
            Metrics=["UnblendedCost"],
            GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}]
        )
        for period in resp.get("ResultsByTime", []):
            for g in period.get("Groups", []):
                cost = float(g["Metrics"]["UnblendedCost"]["Amount"])
                if cost > 0:
                    result["by_service"][g["Keys"][0]] = round(cost, 4)
        result["total"] = round(sum(result["by_service"].values()), 4)
    except Exception as e:
        result["error"] = str(e)

    try:
        if now.month == 12:
            forecast_end = f"{now.year + 1}-01-01"
        else:
            forecast_end = now.replace(month=now.month + 1, day=1).strftime("%Y-%m-%d")
        if end != start:
            f_resp = ce.get_cost_forecast(
                TimePeriod={"Start": end, "End": forecast_end},
                Metric="UNBLENDED_COST",
                Granularity="MONTHLY"
            )
            result["forecast"] = round(float(f_resp["Total"]["Amount"]), 2)
    except Exception:
        result["forecast"] = None

    return result


# ══════════════════════════════════════════════════════════════════════════════
# MAIN SCAN
# ══════════════════════════════════════════════════════════════════════════════

def scan_all(access_key: str, secret_key: str, regions: List[str] = None) -> Dict[str, Any]:
    results = {}

    try:
        session = build_session(access_key, secret_key)

        try:
            results["identity"] = scan_identity(session)
        except Exception as e:
            results["identity"] = {"error": str(e), "account_id": None, "arn": None, "user_id": None}

        if not regions:
            regions = get_regions(session, [])

        results["regions"] = regions

        results["costs"]           = scan_costs(session)
        results["iam"]             = scan_iam(session)
        results["iam_roles"]       = scan_iam_roles(session)
        results["iam_policies"]    = scan_iam_policies(session)
        results["s3"]              = scan_s3(session)
        results["route53"]         = scan_route53(session)
        results["cloudfront"]      = scan_cloudfront(session)
        results["organizations"]   = scan_organizations(session)
        results["trusted_advisor"] = scan_trusted_advisor(session)
        results["budgets"]         = scan_budgets(session)

        CORE_SERVICES = [
            ("ec2",               scan_ec2),
            ("lambda_fn",         scan_lambda),
            ("rds",               scan_rds),
            ("vpc",               scan_vpc),
            ("cloudwatch",        scan_cloudwatch),
            ("sns",               scan_sns),
            ("sqs",               scan_sqs),
            ("dynamodb",          scan_dynamodb),
            ("cloudformation",    scan_cloudformation),
            ("eks",               scan_eks),
            ("ecs",               scan_ecs),
            ("elb",               scan_elb),
            ("autoscaling",       scan_autoscaling),
            ("secrets",           scan_secrets),
            ("kms",               scan_kms),
            ("ecr",               scan_ecr),
            ("ssm",               scan_ssm),
        ]

        EXTENDED_SERVICES = [
            ("elasticache",       scan_elasticache),
            ("redshift",          scan_redshift),
            ("neptune",           scan_neptune),
            ("documentdb",        scan_documentdb),
            ("timestream",        scan_timestream),
            ("keyspaces",         scan_keyspaces),
            ("aurora",            scan_aurora),
            ("transit_gateway",   scan_transit_gateway),
            ("vpn",               scan_vpn),
            ("direct_connect",    scan_direct_connect),
            ("waf",               scan_waf),
            ("network_firewall",  scan_network_firewall),
            ("route53_resolver",  scan_route53_resolver),
            ("vpc_peering",       scan_vpc_peering),
            ("elastic_ip",        scan_elastic_ip),
            ("glue",              scan_glue),
            ("kinesis_streams",   scan_kinesis_streams),
            ("kinesis_firehose",  scan_kinesis_firehose),
            ("athena",            scan_athena),
            ("emr",               scan_emr),
            ("msk",               scan_msk),
            ("opensearch",        scan_opensearch),
            ("quicksight",        scan_quicksight),
            ("guardduty",         scan_guardduty),
            ("securityhub",       scan_securityhub),
            ("config",            scan_config),
            ("inspector",         scan_inspector),
            ("macie",             scan_macie),
            ("iam_analyzer",      scan_iam_analyzer),
            ("shield",            scan_shield),
            ("cloudtrail",        scan_cloudtrail),
            ("codepipeline",      scan_codepipeline),
            ("codebuild",         scan_codebuild),
            ("codedeploy",        scan_codedeploy),
            ("codecommit",        scan_codecommit),
            ("codeartifact",      scan_codeartifact),
            ("elasticbeanstalk",  scan_elasticbeanstalk),
            ("amplify",           scan_amplify),
            ("sagemaker",         scan_sagemaker),
            ("bedrock",           scan_bedrock),
            ("rekognition",       scan_rekognition),
            ("comprehend",        scan_comprehend),
            ("textract",          scan_textract),
            ("lex",               scan_lex),
            ("eventbridge",       scan_eventbridge),
            ("stepfunctions",     scan_stepfunctions),
            ("appsync",           scan_appsync),
            ("apigateway",        scan_apigateway),
            ("apigatewayv2",      scan_apigatewayv2),
            ("mq",                scan_mq),
            ("iot",               scan_iot),
            ("pinpoint",          scan_pinpoint),
            ("lightsail",         scan_lightsail),
            ("batch",             scan_batch),
            ("apprunner",         scan_apprunner),
            ("ec2_spot",          scan_ec2_spot),
            ("ec2_reserved",      scan_ec2_reserved),
            ("efs",               scan_efs),
            ("fsx",               scan_fsx),
            ("backup",            scan_backup),
            ("storagegateway",    scan_storagegateway),
            ("glacier",           scan_glacier),
            ("xray",              scan_xray),
            ("servicecatalog",    scan_servicecatalog),
            ("health",            scan_health),
        ]

        is_single_region = len(regions) == 1
        PER_REGION_SERVICES = CORE_SERVICES + EXTENDED_SERVICES if is_single_region else CORE_SERVICES

        results["services"] = {}

        def scan_region(region):
            try:
                reg_session = build_session(access_key, secret_key, region)
                region_data = {}
                with ThreadPoolExecutor(max_workers=SERVICE_WORKERS) as svc_executor:
                    svc_futures = {
                        svc_executor.submit(fn, reg_session, region): name
                        for name, fn in PER_REGION_SERVICES
                    }
                    for future in as_completed(svc_futures, timeout=180):
                        name = svc_futures[future]
                        try:
                            region_data[name] = future.result(timeout=30)
                        except Exception as e:
                            error_msg = str(e)
                            if "opt-in" in error_msg.lower() or "not opted in" in error_msg.lower():
                                region_data[name] = {"error": f"Region {region} requires opt-in"}
                            else:
                                region_data[name] = {"error": error_msg}
                return region, region_data
            except Exception as e:
                return region, {"error": str(e)}

        with ThreadPoolExecutor(max_workers=REGION_WORKERS) as executor:
            futures = [executor.submit(scan_region, r) for r in regions]
            for future in as_completed(futures):
                region, data = future.result()
                results["services"][region] = data

    except ClientError as e:
        results["error"] = e.response["Error"]["Message"]
    except Exception as e:
        results["error"] = str(e)

    return results
