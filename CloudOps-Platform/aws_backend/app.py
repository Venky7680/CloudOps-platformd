"""
CloudOps Discovery — Flask Backend
AWS + Azure multi-cloud scanning with async file-based job store.
"""

import uuid
import threading
import json
import os
import time
from datetime import datetime, date
from decimal import Decimal
from flask import Flask, request, jsonify
from flask_cors import CORS
from scanner import scan_all, build_session
try:
    from azure_scanner import scan_all as azure_scan_all
    AZURE_SCANNER_AVAILABLE = True
except ImportError as e:
    print(f"WARNING: azure_scanner not available: {e}")
    AZURE_SCANNER_AVAILABLE = False
from secure_auth import add_auth_endpoints
from secure_auth import get_db

def json_serial(obj):
    """Custom JSON serializer for objects not serializable by default."""
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, bytes):
        return obj.decode('utf-8', errors='replace')
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

app = Flask(__name__)

# ── IMPORTANT: add_auth_endpoints FIRST, then apply CORS ──────────────────────
app = add_auth_endpoints(app)
CORS(app, origins="*", methods=["GET", "POST", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization"])

# ── File-based job store (survives process restarts) ───────────────────────────
JOBS_DIR = os.path.join(os.environ.get("HOME", "/tmp"), "scan_jobs")
os.makedirs(JOBS_DIR, exist_ok=True)

def job_path(job_id):
    return os.path.join(JOBS_DIR, f"{job_id}.json")

def write_job(job_id, data):
    with open(job_path(job_id), "w") as f:
        json.dump(data, f, default=json_serial)

def read_job(job_id):
    path = job_path(job_id)
    if not os.path.exists(path):
        return None
    with open(path, "r") as f:
        return json.load(f)

def delete_job(job_id):
    path = job_path(job_id)
    if os.path.exists(path):
        os.remove(path)

def cleanup_old_jobs():
    """Remove job files older than 30 minutes."""
    try:
        now = time.time()
        for fname in os.listdir(JOBS_DIR):
            fpath = os.path.join(JOBS_DIR, fname)
            if os.path.getmtime(fpath) < now - 1800:
                os.remove(fpath)
    except Exception:
        pass


# ══════════════════════════════════════════════════════════════════════════════
# AWS ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/regions", methods=["POST", "OPTIONS"])
def get_regions():
    if request.method == "OPTIONS":
        return jsonify({}), 200
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON request"}), 400

        access_key = data.get("accessKey", "").strip()
        secret_key = data.get("secretKey", "").strip()

        if not access_key or not secret_key:
            return jsonify({"error": "Access Key and Secret Key are required."}), 400

        session = build_session(access_key, secret_key)
        ec2 = session.client("ec2", region_name="us-east-1")

        try:
            resp = ec2.describe_regions(AllRegions=True)
        except Exception:
            resp = ec2.describe_regions()

        regions = []
        for r in resp["Regions"]:
            status = r.get("OptInStatus", "opt-in-not-required")
            regions.append({
                "code": r["RegionName"],
                "enabled": status in ("opt-in-not-required", "opted-in"),
                "optIn": status == "opted-in",
                "optInRequired": status == "not-opted-in",
            })

        regions.sort(key=lambda x: (not x["enabled"], x["code"]))
        return jsonify({"regions": regions})

    except Exception as e:
        print("ERROR in /api/regions:", str(e))
        return jsonify({"error": str(e)}), 500


@app.route("/api/scan", methods=["POST", "OPTIONS"])
def scan():
    if request.method == "OPTIONS":
        return jsonify({}), 200

    try:
        cleanup_old_jobs()

        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON request"}), 400

        access_key = data.get("accessKey", "").strip()
        secret_key = data.get("secretKey", "").strip()
        region = data.get("region", "").strip()
        regions_list = data.get("regions", [])

        if not access_key or not secret_key:
            return jsonify({"error": "Access Key and Secret Key are required."}), 400

        if regions_list:
            regions = regions_list
        elif region:
            regions = [region]
        else:
            regions = None

        job_id = str(uuid.uuid4())
        write_job(job_id, {"status": "running", "result": None, "error": None})

        def run_scan():
            try:
                result = scan_all(access_key, secret_key, regions)
                write_job(job_id, {"status": "done", "result": result, "error": None})
            except Exception as e:
                write_job(job_id, {"status": "error", "result": None, "error": str(e)})

        thread = threading.Thread(target=run_scan, daemon=True)
        thread.start()

        return jsonify({"job_id": job_id, "status": "running"})

    except Exception as e:
        print("ERROR in /api/scan:", str(e))
        return jsonify({"error": str(e)}), 500


@app.route("/api/scan/status/<job_id>", methods=["GET", "OPTIONS"])
def scan_status(job_id):
    if request.method == "OPTIONS":
        return jsonify({}), 200

    job = read_job(job_id)

    if not job:
        return jsonify({"error": "Job not found. It may have expired."}), 404

    if job["status"] == "running":
        return jsonify({"status": "running"})

    if job["status"] == "error":
        delete_job(job_id)
        return jsonify({"status": "error", "error": job["error"]}), 500

    if job["status"] == "done":
        result = job["result"]
        delete_job(job_id)
        response_str = json.dumps({"status": "done", "result": result}, default=json_serial)
        return app.response_class(response_str, mimetype='application/json')

    return jsonify({"error": "Unknown job status"}), 500


# ══════════════════════════════════════════════════════════════════════════════
# AZURE ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/azure/regions", methods=["GET", "OPTIONS"])
def get_azure_regions():
    """Return the list of Azure regions available for scanning."""
    if request.method == "OPTIONS":
        return jsonify({}), 200
    from azure_scanner import AZURE_REGIONS, AZURE_REGION_DISPLAY
    regions = [
        {
            "code": r,
            "displayName": AZURE_REGION_DISPLAY.get(r, r),
            "enabled": True,
        }
        for r in AZURE_REGIONS
    ]
    return jsonify({"regions": regions})


@app.route("/api/azure/scan", methods=["POST", "OPTIONS"])
def azure_scan():
    """
    Start an async Azure scan job.
    Body: { tenantId, clientId, clientSecret, subscriptionId, regions? }
    Returns: { job_id, status: "running" }
    """
    if request.method == "OPTIONS":
        return jsonify({}), 200

    try:
        cleanup_old_jobs()

        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON request"}), 400

        tenant_id       = data.get("tenantId", "").strip()
        client_id       = data.get("clientId", "").strip()
        client_secret   = data.get("clientSecret", "").strip()
        subscription_id = data.get("subscriptionId", "").strip()
        regions_list    = data.get("regions", [])

        if not tenant_id or not client_id or not client_secret or not subscription_id:
            return jsonify({
                "error": "Tenant ID, Client ID, Client Secret and Subscription ID are all required."
            }), 400

        job_id = str(uuid.uuid4())
        write_job(job_id, {"status": "running", "result": None, "error": None, "cloud": "azure"})

        if not AZURE_SCANNER_AVAILABLE:
            return jsonify({"error": "azure_scanner.py not found on server. Please upload it via Kudu."}), 500

        def run_azure_scan():
            try:
                result = azure_scan_all(
                    tenant_id=tenant_id,
                    client_id=client_id,
                    client_secret=client_secret,
                    subscription_id=subscription_id,
                    regions=regions_list if regions_list else None,
                )
                write_job(job_id, {"status": "done", "result": result, "error": None, "cloud": "azure"})
            except Exception as e:
                write_job(job_id, {"status": "error", "result": None, "error": str(e), "cloud": "azure"})

        thread = threading.Thread(target=run_azure_scan, daemon=True)
        thread.start()

        return jsonify({"job_id": job_id, "status": "running", "cloud": "azure"})

    except Exception as e:
        print("ERROR in /api/azure/scan:", str(e))
        return jsonify({"error": str(e)}), 500


@app.route("/api/azure/scan/status/<job_id>", methods=["GET", "OPTIONS"])
def azure_scan_status(job_id):
    """Poll status of an Azure scan job."""
    if request.method == "OPTIONS":
        return jsonify({}), 200

    job = read_job(job_id)
    if not job:
        return jsonify({"error": "Job not found. It may have expired."}), 404

    if job["status"] == "running":
        return jsonify({"status": "running"})

    if job["status"] == "error":
        delete_job(job_id)
        return jsonify({"status": "error", "error": job["error"]}), 500

    if job["status"] == "done":
        result = job["result"]
        delete_job(job_id)
        response_str = json.dumps({"status": "done", "result": result}, default=json_serial)
        return app.response_class(response_str, mimetype='application/json')

    return jsonify({"error": "Unknown job status"}), 500


@app.route("/api/azure/store-credentials", methods=["POST", "OPTIONS"])
def azure_store_credentials():
    """
    Store Azure credentials for a user.
    Body: { tenantId, clientId, clientSecret, subscriptionId, accountName? }
    Requires Authorization header with JWT token.
    """
    if request.method == "OPTIONS":
        return jsonify({}), 200

    import jwt
    from secure_auth import SECRET_KEY

    token = request.headers.get('Authorization', '')
    try:
        token = token.split(' ')[1] if ' ' in token else token
        token_data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        current_user = token_data['email']
    except Exception:
        return jsonify({'error': 'Token is invalid'}), 401

    try:
        data = request.get_json()
        tenant_id       = data.get("tenantId", "").strip()
        client_id       = data.get("clientId", "").strip()
        client_secret   = data.get("clientSecret", "").strip()
        subscription_id = data.get("subscriptionId", "").strip()
        account_name    = data.get("accountName", "My Azure Account").strip()

        if not tenant_id or not client_id or not client_secret or not subscription_id:
            return jsonify({"error": "All four Azure credential fields are required."}), 400

        conn = get_db()
        cursor = conn.cursor()

        # Upsert: update if same tenant+subscription already stored for this user
        cursor.execute(
            "SELECT COUNT(*) FROM azure_credentials WHERE email=? AND tenant_id=? AND subscription_id=?",
            current_user, tenant_id, subscription_id
        )
        exists = cursor.fetchone()[0] > 0

        if exists:
            cursor.execute(
                """UPDATE azure_credentials
                   SET client_id=?, client_secret=?, account_name=?, stored_at=GETDATE()
                   WHERE email=? AND tenant_id=? AND subscription_id=?""",
                client_id, client_secret, account_name,
                current_user, tenant_id, subscription_id
            )
        else:
            cursor.execute(
                """INSERT INTO azure_credentials
                   (email, tenant_id, client_id, client_secret, subscription_id, account_name)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                current_user, tenant_id, client_id, client_secret, subscription_id, account_name
            )

        conn.commit()
        conn.close()
        return jsonify({"message": "Azure credentials stored successfully"})

    except Exception as e:
        print("ERROR in /api/azure/store-credentials:", str(e))
        return jsonify({"error": str(e)}), 500


@app.route("/api/azure/list-accounts", methods=["GET", "OPTIONS"])
def azure_list_accounts():
    """Return saved Azure accounts for the current user."""
    if request.method == "OPTIONS":
        return jsonify({}), 200

    import jwt
    from secure_auth import SECRET_KEY

    token = request.headers.get('Authorization', '')
    try:
        token = token.split(' ')[1] if ' ' in token else token
        token_data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        current_user = token_data['email']
    except Exception:
        return jsonify({'error': 'Token is invalid'}), 401

    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            """SELECT tenant_id, client_id, subscription_id, account_name, stored_at
               FROM azure_credentials WHERE email=? ORDER BY stored_at DESC""",
            current_user
        )
        rows = cursor.fetchall()
        conn.close()
        accounts = []
        for row in rows:
            accounts.append({
                "tenantId":        row[0],
                "clientId":        row[1],
                "subscriptionId":  row[2],
                "accountName":     row[3] or "My Azure Account",
                "storedAt":        row[4].isoformat() if row[4] else None,
            })
        return jsonify({"accounts": accounts})
    except Exception as e:
        print("ERROR in /api/azure/list-accounts:", str(e))
        return jsonify({"error": str(e)}), 500


@app.route("/api/azure/get-account-credentials", methods=["POST", "OPTIONS"])
def azure_get_account_credentials():
    """Retrieve full credentials for a specific Azure account (by tenantId + subscriptionId)."""
    if request.method == "OPTIONS":
        return jsonify({}), 200

    import jwt
    from secure_auth import SECRET_KEY

    token = request.headers.get('Authorization', '')
    try:
        token = token.split(' ')[1] if ' ' in token else token
        token_data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        current_user = token_data['email']
    except Exception:
        return jsonify({'error': 'Token is invalid'}), 401

    try:
        data = request.get_json()
        tenant_id       = data.get("tenantId", "").strip()
        subscription_id = data.get("subscriptionId", "").strip()

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            """SELECT tenant_id, client_id, client_secret, subscription_id
               FROM azure_credentials WHERE email=? AND tenant_id=? AND subscription_id=?""",
            current_user, tenant_id, subscription_id
        )
        row = cursor.fetchone()
        conn.close()

        if row:
            return jsonify({
                "tenantId":       row[0],
                "clientId":       row[1],
                "clientSecret":   row[2],
                "subscriptionId": row[3],
            })
        return jsonify({"error": "Account not found"}), 404

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ══════════════════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/auth/delete-credentials", methods=["POST", "OPTIONS"])
def delete_aws_credentials():
    if request.method == "OPTIONS": return jsonify({}), 200
    import jwt
    from secure_auth import SECRET_KEY
    token = request.headers.get('Authorization', '')
    try:
        token = token.split(' ')[1] if ' ' in token else token
        token_data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        current_user = token_data['email']
    except Exception:
        return jsonify({'error': 'Token is invalid'}), 401
    try:
        data = request.get_json()
        access_key = data.get("accessKey", "").strip()
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM user_credentials WHERE email=? AND access_key=?", current_user, access_key)
        conn.commit(); conn.close()
        return jsonify({"message": "AWS account deleted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/azure/delete-credentials", methods=["POST", "OPTIONS"])
def delete_azure_credentials():
    if request.method == "OPTIONS": return jsonify({}), 200
    import jwt
    from secure_auth import SECRET_KEY
    token = request.headers.get('Authorization', '')
    try:
        token = token.split(' ')[1] if ' ' in token else token
        token_data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        current_user = token_data['email']
    except Exception:
        return jsonify({'error': 'Token is invalid'}), 401
    try:
        data = request.get_json()
        tenant_id = data.get("tenantId", "").strip()
        subscription_id = data.get("subscriptionId", "").strip()
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM azure_credentials WHERE email=? AND tenant_id=? AND subscription_id=?",
                       current_user, tenant_id, subscription_id)
        conn.commit(); conn.close()
        return jsonify({"message": "Azure account deleted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/scan-data/save", methods=["POST", "OPTIONS"])
def save_scan_data():
    if request.method == "OPTIONS":
        return jsonify({}), 200

    import jwt
    from secure_auth import SECRET_KEY

    token = request.headers.get('Authorization', '')
    try:
        token = token.split(' ')[1] if ' ' in token else token
        token_data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        current_user = token_data['email']
    except Exception:
        return jsonify({'error': 'Token is invalid'}), 401

    try:
        data = request.get_json()
        account_key  = data.get("accountKey", "").strip()
        cloud        = data.get("cloud", "aws").strip()
        account_name = data.get("accountName", "").strip()
        scan_data    = data.get("scanData")
        scan_meta    = data.get("scanMeta")

        if not account_key or not scan_data:
            return jsonify({"error": "accountKey and scanData are required"}), 400

        scan_data_str = json.dumps(scan_data, default=json_serial)
        scan_meta_str = json.dumps(scan_meta, default=json_serial)

        conn = get_db()
        cursor = conn.cursor()

        # Check if exists
        cursor.execute(
            "SELECT COUNT(*) FROM scan_data WHERE email=? AND account_key=?",
            current_user, account_key
        )
        exists = cursor.fetchone()[0] > 0

        if exists:
            cursor.execute(
                """UPDATE scan_data
                   SET scan_data=?, scan_meta=?, cloud=?, account_name=?, scanned_at=GETDATE()
                   WHERE email=? AND account_key=?""",
                scan_data_str, scan_meta_str, cloud, account_name,
                current_user, account_key
            )
        else:
            cursor.execute(
                """INSERT INTO scan_data
                   (email, account_key, cloud, account_name, scan_data, scan_meta)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                current_user, account_key, cloud, account_name,
                scan_data_str, scan_meta_str
            )

        conn.commit()
        conn.close()
        return jsonify({"message": "Scan data saved successfully"})

    except Exception as e:
        print("ERROR in /api/scan-data/save:", str(e))
        return jsonify({"error": str(e)}), 500


@app.route("/api/scan-data/<account_key>", methods=["GET", "OPTIONS"])
def get_scan_data(account_key):
    if request.method == "OPTIONS":
        return jsonify({}), 200

    import jwt
    from secure_auth import SECRET_KEY

    token = request.headers.get('Authorization', '')
    try:
        token = token.split(' ')[1] if ' ' in token else token
        token_data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        current_user = token_data['email']
    except Exception:
        return jsonify({'error': 'Token is invalid'}), 401

    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            """SELECT scan_data, scan_meta, cloud, account_name, scanned_at
               FROM scan_data WHERE email=? AND account_key=?""",
            current_user, account_key
        )
        row = cursor.fetchone()
        conn.close()

        if not row:
            return jsonify({"found": False}), 404

        return jsonify({
            "found": True,
            "scanData":    json.loads(row[0]),
            "scanMeta":    json.loads(row[1]) if row[1] else None,
            "cloud":       row[2],
            "accountName": row[3],
            "scannedAt":   row[4].isoformat() if row[4] else None,
        })

    except Exception as e:
        print("ERROR in /api/scan-data/get:", str(e))
        return jsonify({"error": str(e)}), 500

def azure_diagnose():
    result = {}
    try:
        from azure.identity import ClientSecretCredential
        from azure.mgmt.resource import ResourceManagementClient
        from azure.mgmt.compute import ComputeManagementClient
        from azure.mgmt.storage import StorageManagementClient
        from azure.mgmt.network import NetworkManagementClient
        from azure.mgmt.web import WebSiteManagementClient
        from azure.mgmt.sql import SqlManagementClient
        from azure.mgmt.containerservice import ContainerServiceClient
        from azure.mgmt.subscription import SubscriptionClient

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT tenant_id, client_id, client_secret, subscription_id FROM azure_credentials ORDER BY stored_at DESC")
        row = cursor.fetchone()
        conn.close()

        if not row:
            return jsonify({"error": "No Azure credentials saved"})

        tenant_id, client_id, client_secret, subscription_id = row
        result["subscription_id"] = subscription_id
        result["tenant_id"] = tenant_id

        cred = ClientSecretCredential(tenant_id=tenant_id, client_id=client_id, client_secret=client_secret)

        # Auth check
        try:
            sub = SubscriptionClient(cred).subscriptions.get(subscription_id)
            result["auth"] = f"✅ {sub.display_name}"
        except Exception as e:
            result["auth"] = f"❌ {e}"; return jsonify(result)

        # Resource groups with their locations
        try:
            rgs = list(ResourceManagementClient(cred, subscription_id).resource_groups.list())
            result["resource_groups"] = [{"name": r.name, "location": r.location} for r in rgs]
        except Exception as e:
            result["resource_groups"] = f"❌ {e}"

        # ALL resources flat list
        try:
            rc = ResourceManagementClient(cred, subscription_id)
            all_resources = list(rc.resources.list())
            result["all_resources_count"] = len(all_resources)
            result["all_resources"] = [
                {"name": r.name, "type": r.type, "location": r.location}
                for r in all_resources[:50]
            ]
        except Exception as e:
            result["all_resources"] = f"❌ {e}"

        # VMs
        try:
            vms = list(ComputeManagementClient(cred, subscription_id).virtual_machines.list_all())
            result["vms"] = [{"name": v.name, "location": v.location, "size": v.hardware_profile.vm_size if v.hardware_profile else "—"} for v in vms]
        except Exception as e:
            result["vms"] = f"❌ {e}"

        # Storage
        try:
            accounts = list(StorageManagementClient(cred, subscription_id).storage_accounts.list())
            result["storage"] = [{"name": a.name, "location": a.location} for a in accounts]
        except Exception as e:
            result["storage"] = f"❌ {e}"

        # Web Apps + Functions
        try:
            apps = list(WebSiteManagementClient(cred, subscription_id).web_apps.list())
            result["web_apps"] = [{"name": a.name, "location": a.location, "kind": a.kind} for a in apps]
        except Exception as e:
            result["web_apps"] = f"❌ {e}"

        # SQL Servers
        try:
            servers = list(SqlManagementClient(cred, subscription_id).servers.list())
            result["sql_servers"] = [{"name": s.name, "location": s.location} for s in servers]
        except Exception as e:
            result["sql_servers"] = f"❌ {e}"

        # AKS
        try:
            clusters = list(ContainerServiceClient(cred, subscription_id).managed_clusters.list())
            result["aks"] = [{"name": c.name, "location": c.location} for c in clusters]
        except Exception as e:
            result["aks"] = f"❌ {e}"

        # VNets
        try:
            vnets = list(NetworkManagementClient(cred, subscription_id).virtual_networks.list_all())
            result["vnets"] = [{"name": v.name, "location": v.location} for v in vnets]
        except Exception as e:
            result["vnets"] = f"❌ {e}"

    except Exception as e:
        result["error"] = str(e)

    return jsonify(result)


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "jobs_dir": JOBS_DIR,
        "clouds": ["aws", "azure"],
    })


# ══════════════════════════════════════════════════════════════════════════════
# RUN LOCALLY
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    app.run(debug=True, port=5000)
