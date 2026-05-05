"""
AWS Discovery — Flask Backend (Async Scan with File-based Job Store)
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
# If CORS is applied before add_auth_endpoints, the app reassignment drops CORS.
app = add_auth_endpoints(app)
CORS(app, origins="*", methods=["GET", "POST", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization"])

# ── File-based job store (survives Azure process restarts) ─────────────────────
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
    """Remove job files older than 30 minutes"""
    try:
        now = time.time()
        for fname in os.listdir(JOBS_DIR):
            fpath = os.path.join(JOBS_DIR, fname)
            if os.path.getmtime(fpath) < now - 1800:
                os.remove(fpath)
    except Exception:
        pass


# --------------------------------
# Dynamic Regions API
# --------------------------------
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


# --------------------------------
# Async Scan — Start Job
# --------------------------------
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

        # Create job file immediately with "running" status
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


# --------------------------------
# Async Scan — Poll Status
# --------------------------------
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
        import json
        response_str = json.dumps({"status": "done", "result": result}, default=json_serial)
        return app.response_class(response_str, mimetype='application/json')

    return jsonify({"error": "Unknown job status"}), 500


# --------------------------------
# Health Check
# --------------------------------
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "jobs_dir": JOBS_DIR})



# --------------------------------
# Run locally
# --------------------------------
if __name__ == "__main__":
    app.run(debug=True, port=5000)