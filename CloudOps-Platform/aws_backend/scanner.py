#!/usr/bin/env python3
"""
AWS Discovery — Full Multi-Region Scanner (Azure Ready)
"""

import json
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Any

import boto3
from botocore.exceptions import ClientError


# ── CONFIG ─────────────────────────────────────────────────────────────────────
# Reduced from 6x5=30 threads to 3x3=9 threads to prevent Azure 502 on full scan
REGION_WORKERS  = 3
SERVICE_WORKERS = 3

# ──────────────────────────────────────────────────────────────────────────────


def build_session(access_key, secret_key, region="us-east-1"):
    return boto3.Session(
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=region,
    )


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
    sts = session.client("sts")
    r = sts.get_caller_identity()
    return {"account_id": r["Account"], "user_id": r["UserId"], "arn": r["Arn"]}


def get_regions(session, selected):
    if selected:
        return selected
    try:
        ec2 = session.client("ec2", region_name="us-east-1")
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


# ── PER-REGION SERVICES ────────────────────────────────────────────────────────

def scan_ec2(session, region):
    ec2 = session.client("ec2", region_name=region)
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
    lm = session.client("lambda", region_name=region)
    return paginate(lm, "list_functions", "Functions")


def scan_rds(session, region):
    rds = session.client("rds", region_name=region)
    return paginate(rds, "describe_db_instances", "DBInstances")


def scan_vpc(session, region):
    ec2 = session.client("ec2", region_name=region)
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
    cw = session.client("cloudwatch", region_name=region)
    return paginate(cw, "describe_alarms", "MetricAlarms")


def scan_sns(session, region):
    sns = session.client("sns", region_name=region)
    return paginate(sns, "list_topics", "Topics")


def scan_sqs(session, region):
    sqs = session.client("sqs", region_name=region)
    try:
        return sqs.list_queues().get("QueueUrls", [])
    except Exception:
        return []


def scan_dynamodb(session, region):
    ddb = session.client("dynamodb", region_name=region)
    return paginate(ddb, "list_tables", "TableNames")


def scan_cloudformation(session, region):
    cf = session.client("cloudformation", region_name=region)
    return paginate(cf, "describe_stacks", "Stacks")


def scan_eks(session, region):
    eks = session.client("eks", region_name=region)
    clusters = paginate(eks, "list_clusters", "clusters")
    items = []
    for c in clusters:
        try:
            items.append(eks.describe_cluster(name=c)["cluster"])
        except Exception:
            pass
    return items


def scan_ecs(session, region):
    ecs = session.client("ecs", region_name=region)
    arns = paginate(ecs, "list_clusters", "clusterArns")
    if not arns:
        return []
    return ecs.describe_clusters(clusters=arns).get("clusters", [])


def scan_elb(session, region):
    elb = session.client("elbv2", region_name=region)
    return paginate(elb, "describe_load_balancers", "LoadBalancers")


def scan_autoscaling(session, region):
    asg = session.client("autoscaling", region_name=region)
    return paginate(asg, "describe_auto_scaling_groups", "AutoScalingGroups")


def scan_secrets(session, region):
    sm = session.client("secretsmanager", region_name=region)
    return paginate(sm, "list_secrets", "SecretList")


def scan_kms(session, region):
    kms = session.client("kms", region_name=region)
    return paginate(kms, "list_keys", "Keys")


def scan_ecr(session, region):
    ecr = session.client("ecr", region_name=region)
    return paginate(ecr, "describe_repositories", "repositories")


def scan_ssm(session, region):
    ssm = session.client("ssm", region_name=region)
    return paginate(ssm, "describe_parameters", "Parameters")


# ── GLOBAL SERVICES ────────────────────────────────────────────────────────────

def scan_iam(session):
    iam = session.client("iam")
    return paginate(iam, "list_users", "Users")


def scan_s3(session):
    s3 = session.client("s3", region_name="us-east-1")
    try:
        return s3.list_buckets().get("Buckets", [])
    except Exception:
        return []


def scan_route53(session):
    r53 = session.client("route53")
    try:
        return r53.list_hosted_zones().get("HostedZones", [])
    except Exception:
        return []


def scan_cloudfront(session):
    cf = session.client("cloudfront", region_name="us-east-1")
    try:
        return cf.list_distributions().get("DistributionList", {}).get("Items", [])
    except Exception:
        return []


def scan_costs(session):
    ce = session.client("ce", region_name="us-east-1")
    now = datetime.now(timezone.utc)

    start = now.replace(day=1).strftime("%Y-%m-%d")
    end   = now.strftime("%Y-%m-%d")

    result = {"by_service": {}, "total": 0, "forecast": None}

    # ── Month-to-date cost by service ─────────────────────────────────────────
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

    # ── End-of-month forecast ──────────────────────────────────────────────────
    # AWS requires at least 3 days of spend data to generate a forecast.
    # If insufficient data, forecast stays None and frontend shows "No data yet".
    try:
        if now.month == 12:
            forecast_end = f"{now.year + 1}-01-01"
        else:
            forecast_end = now.replace(month=now.month + 1, day=1).strftime("%Y-%m-%d")

        # Only fetch forecast if start != end (i.e. not the first day of month)
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


# ── MAIN ───────────────────────────────────────────────────────────────────────

def scan_all(access_key: str, secret_key: str, regions: List[str] = None) -> Dict[str, Any]:
    results = {}

    try:
        session = build_session(access_key, secret_key)

        # ── Identity (safe — missing sts permission shows warning, not crash) ──
        try:
            results["identity"] = scan_identity(session)
        except Exception as e:
            results["identity"] = {
                "error": str(e),
                "account_id": None,
                "arn": None,
                "user_id": None
            }

        if not regions:
            regions = get_regions(session, [])

        results["regions"]    = regions
        results["costs"]      = scan_costs(session)
        results["iam"]        = scan_iam(session)
        results["s3"]         = scan_s3(session)
        results["route53"]    = scan_route53(session)
        results["cloudfront"] = scan_cloudfront(session)

        # ── Per-region services ────────────────────────────────────────────────
        PER_REGION_SERVICES = [
            ("ec2",            scan_ec2),
            ("lambda_fn",      scan_lambda),
            ("rds",            scan_rds),
            ("vpc",            scan_vpc),
            ("cloudwatch",     scan_cloudwatch),
            ("sns",            scan_sns),
            ("sqs",            scan_sqs),
            ("dynamodb",       scan_dynamodb),
            ("cloudformation", scan_cloudformation),
            ("eks",            scan_eks),
            ("ecs",            scan_ecs),
            ("elb",            scan_elb),
            ("autoscaling",    scan_autoscaling),
            ("secrets",        scan_secrets),
            ("kms",            scan_kms),
            ("ecr",            scan_ecr),
            ("ssm",            scan_ssm),
        ]

        results["services"] = {}

        def scan_region(region):
            """Scan all services for one region. Skips opt-in regions gracefully."""
            try:
                reg_session = build_session(access_key, secret_key, region)
                region_data = {}

                with ThreadPoolExecutor(max_workers=SERVICE_WORKERS) as svc_executor:
                    svc_futures = {
                        svc_executor.submit(fn, reg_session, region): name
                        for name, fn in PER_REGION_SERVICES
                    }
                    for future in as_completed(svc_futures):
                        name = svc_futures[future]
                        try:
                            region_data[name] = future.result()
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