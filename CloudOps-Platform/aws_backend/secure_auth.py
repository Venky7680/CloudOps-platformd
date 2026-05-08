"""
Secure Authentication Module for CloudOps Backend
Users, credentials and tickets stored in Azure SQL database.
"""

import jwt
import os
import datetime
import pyodbc
import bcrypt
from functools import wraps
from flask import request, jsonify

SECRET_KEY = 'your-secret-key-change-in-production'

DB_SERVER   = 'itsmdb.database.windows.net'
DB_NAME     = 'cloudopsdb'
DB_USER     = 'itsmdb'
DB_PASSWORD = 'Intertec@2026'

def get_db():
    conn_str = (
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={DB_SERVER};"
        f"DATABASE={DB_NAME};"
        f"UID={DB_USER};"
        f"PWD={DB_PASSWORD};"
        f"Encrypt=yes;"
        f"TrustServerCertificate=no;"
        f"Connection Timeout=30;"
    )
    return pyodbc.connect(conn_str)


def init_db():
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
            CREATE TABLE users (
                id INT IDENTITY(1,1) PRIMARY KEY,
                email NVARCHAR(255) UNIQUE NOT NULL,
                password NVARCHAR(255) NOT NULL,
                role NVARCHAR(50) DEFAULT 'user',
                created_at DATETIME DEFAULT GETDATE()
            )
        """)
        cursor.execute("""
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='aws_credentials' AND xtype='U')
            CREATE TABLE aws_credentials (
                id INT IDENTITY(1,1) PRIMARY KEY,
                email NVARCHAR(255) NOT NULL,
                access_key NVARCHAR(255) NOT NULL,
                secret_key NVARCHAR(255) NOT NULL,
                stored_at DATETIME DEFAULT GETDATE()
            )
        """)
        cursor.execute("""
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tickets' AND xtype='U')
            CREATE TABLE tickets (
                id INT IDENTITY(1,1) PRIMARY KEY,
                email NVARCHAR(255) NOT NULL,
                title NVARCHAR(500) NOT NULL,
                description NVARCHAR(MAX),
                status NVARCHAR(50) DEFAULT 'open',
                priority NVARCHAR(50) DEFAULT 'medium',
                created_at DATETIME DEFAULT GETDATE(),
                updated_at DATETIME DEFAULT GETDATE()
            )
        """)
        cursor.execute("""
            IF NOT EXISTS (SELECT * FROM users WHERE email = 'admin@cloudops.com')
            INSERT INTO users (email, password_hash, role)
            VALUES ('admin@cloudops.com', 'CloudOps@2024', 'admin')
        """)

        cursor.execute("""
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='azure_credentials' AND xtype='U')
            CREATE TABLE azure_credentials (
                id INT IDENTITY(1,1) PRIMARY KEY,
                email NVARCHAR(255) NOT NULL,
                tenant_id NVARCHAR(255) NOT NULL,
                client_id NVARCHAR(255) NOT NULL,
                client_secret NVARCHAR(255) NOT NULL,
                subscription_id NVARCHAR(255) NOT NULL,
                account_name NVARCHAR(255),
                stored_at DATETIME DEFAULT GETDATE()
            )
        """)
        # Add subscription_id column if the table already exists without it
        try:
            cursor.execute("""
                IF NOT EXISTS (
                    SELECT * FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_NAME='azure_credentials' AND COLUMN_NAME='subscription_id'
                )
                ALTER TABLE azure_credentials ADD subscription_id NVARCHAR(255) NOT NULL DEFAULT ''
            """)
        except Exception:
            pass

        # Hash any plain text passwords
        cursor.execute("SELECT email, password_hash FROM users WHERE password_hash NOT LIKE '$2b$%'")
        users = cursor.fetchall()
        for user in users:
            email_u = user[0]
            pwd = user[1]
            if pwd and not pwd.startswith('$2b$'):
                hashed = bcrypt.hashpw(pwd.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                cursor.execute("UPDATE users SET password_hash = ? WHERE email = ?", hashed, email_u)
        conn.commit()
        conn.close()
        print("Database initialized successfully")
    except Exception as e:
        print(f"Database initialization error: {e}")


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        try:
            token = token.split(' ')[1] if ' ' in token else token
            data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            current_user = data['email']
        except Exception:
            return jsonify({'error': 'Token is invalid'}), 401
        return f(current_user, *args, **kwargs)
    return decorated


def generate_token(email, role):
    return jwt.encode({
        'email': email,
        'role': role,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }, SECRET_KEY)


def verify_token(token):
    try:
        token = token.split(' ')[1] if ' ' in token else token
        return jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
    except Exception:
        return None


def authenticate_user(email, password):
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT role, password_hash FROM users WHERE email = ?", email)
        row = cursor.fetchone()
        if not row:
            conn.close()
            return None
        role = row[0]
        stored_hash = row[1].strip()
        if not bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8')):
            conn.close()
            return None
        cursor.execute("SELECT COUNT(*) FROM aws_credentials WHERE email = ?", email)
        has_creds = cursor.fetchone()[0] > 0
        conn.close()
        return {'email': email, 'role': role, 'isNewUser': not has_creds}
    except Exception as e:
            print(f"authenticate_user error: {type(e).__name__}: {e}")
            return None


def register_user(email, password):
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users WHERE email = ?", email)
        if cursor.fetchone()[0] > 0:
            conn.close()
            return None
        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cursor.execute("INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'user')", email, hashed)
        conn.commit()
        conn.close()
        return {'email': email, 'role': 'user', 'isNewUser': True}
    except Exception as e:
        print(f"register_user error: {e}")
        return None


def store_user_credentials(email, access_key, secret_key, account_name=None, account_id=None):
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM aws_credentials WHERE email = ? AND access_key = ?", email, access_key)
        exists = cursor.fetchone()[0] > 0
        if exists:
            cursor.execute("UPDATE aws_credentials SET secret_key = ?, account_name = ?, account_id = ?, stored_at = GETDATE() WHERE email = ? AND access_key = ?", secret_key, account_name, account_id, email, access_key)
        else:
            cursor.execute("INSERT INTO aws_credentials (email, access_key, secret_key, account_name, account_id) VALUES (?, ?, ?, ?, ?)", email, access_key, secret_key, account_name, account_id)
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"store_user_credentials error: {e}")


def get_user_credentials(email):
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT access_key, secret_key FROM aws_credentials WHERE email = ?", email)
        row = cursor.fetchone()
        conn.close()
        if row:
            return {'accessKey': row[0], 'secretKey': row[1]}
        return None
    except Exception as e:
        print(f"get_user_credentials error: {e}")
        return None


def add_auth_endpoints(app):

    _db_initialized = [False]

    def ensure_db():
        if not _db_initialized[0]:
            init_db()
            _db_initialized[0] = True

    @app.before_request
    def lazy_init():
        ensure_db()

    @app.route("/api/auth/login", methods=["POST", "OPTIONS"])
    def login():
        if request.method == "OPTIONS":
            return jsonify({}), 200
        try:
            data = request.get_json()
            email = data.get('email', '').strip().lower()
            password = data.get('password', '').strip()
            if not email or not password:
                return jsonify({'error': 'Email and password are required'}), 400
            user_data = authenticate_user(email, password)
            if not user_data:
                return jsonify({'error': 'Invalid email or password'}), 401
            token = generate_token(email, user_data['role'])
            return jsonify({'token': token, 'email': email, 'role': user_data['role'], 'isNewUser': user_data['isNewUser']})
        except Exception as e:
            print("ERROR in /api/auth/login:", str(e))
            return jsonify({'error': 'Internal server error'}), 500

    @app.route("/api/auth/register", methods=["POST", "OPTIONS"])
    def register():
        if request.method == "OPTIONS":
            return jsonify({}), 200
        try:
            data = request.get_json()
            email = data.get('email', '').strip().lower()
            password = data.get('password', '').strip()
            if not email or not password:
                return jsonify({'error': 'Email and password are required'}), 400
            if len(password) < 6:
                return jsonify({'error': 'Password must be at least 6 characters'}), 400
            user_data = register_user(email, password)
            if not user_data:
                return jsonify({'error': 'Email already registered'}), 400
            token = generate_token(email, user_data['role'])
            return jsonify({'token': token, 'email': email, 'role': user_data['role'], 'isNewUser': True})
        except Exception as e:
            print("ERROR in /api/auth/register:", str(e))
            return jsonify({'error': 'Internal server error'}), 500

    @app.route("/api/auth/store-credentials", methods=["POST", "OPTIONS"])
    def store_credentials():
        if request.method == "OPTIONS":
            return jsonify({}), 200
        token = request.headers.get('Authorization', '')
        try:
            token = token.split(' ')[1] if ' ' in token else token
            token_data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            current_user = token_data['email']
        except Exception:
            return jsonify({'error': 'Token is invalid'}), 401
        try:
            data = request.get_json()
            access_key = data.get('accessKey', '').strip()
            secret_key = data.get('secretKey', '').strip()
            account_name = data.get('accountName', '').strip()
            account_id = data.get('accountId', '').strip()
            if not access_key or not secret_key:
                return jsonify({'error': 'Access Key and Secret Key are required'}), 400
            store_user_credentials(current_user, access_key, secret_key, account_name, account_id)
            return jsonify({'message': 'Credentials stored successfully'})
        except Exception as e:
            print("ERROR in /api/auth/store-credentials:", str(e))
            return jsonify({'error': 'Internal server error'}), 500

    @app.route("/api/tickets", methods=["GET", "OPTIONS"])
    def get_tickets():
        if request.method == "OPTIONS":
            return jsonify({}), 200
        try:
            account_id = request.args.get("account_id", "")
            conn = get_db()
            cursor = conn.cursor()
            if account_id:
                cursor.execute("SELECT * FROM tickets WHERE account_id=? ORDER BY created_at DESC", account_id)
            else:
                cursor.execute("SELECT * FROM tickets ORDER BY created_at DESC")
            columns = [col[0] for col in cursor.description]
            tickets = []
            for row in cursor.fetchall():
                ticket = dict(zip(columns, row))
                for key, val in ticket.items():
                    if hasattr(val, 'isoformat'):
                        ticket[key] = val.isoformat()
                tickets.append(ticket)
            conn.close()
            return jsonify({"tickets": tickets})
        except Exception as e:
            print("ERROR in /api/tickets GET:", str(e))
            return jsonify({'error': str(e)}), 500

    @app.route("/api/tickets", methods=["POST"])
    @token_required
    def create_ticket(current_user):
        try:
            data = request.get_json()
            title = data.get('title', '').strip()
            description = data.get('description', '').strip()
            priority = data.get('priority', 'medium').strip()
            if not title:
                return jsonify({'error': 'Title is required'}), 400
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("INSERT INTO tickets (email, title, description, priority) VALUES (?, ?, ?, ?)", current_user, title, description, priority)
            conn.commit()
            conn.close()
            return jsonify({'message': 'Ticket created successfully'})
        except Exception as e:
            print("ERROR in /api/tickets POST:", str(e))
            return jsonify({'error': 'Internal server error'}), 500



    @app.route("/api/tickets/update", methods=["POST", "OPTIONS"])
    def update_ticket():
        if request.method == "OPTIONS":
            return jsonify({}), 200
        try:
            data = request.get_json()
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE tickets
                SET status=?, severity=?, category=?, notes=?, updated_at=GETDATE()
                WHERE ticket_id=?
            """, (
                data.get("status"),
                data.get("severity"),
                data.get("category"),
                data.get("notes"),
                data.get("ticket_id"),
            ))
            conn.commit()
            conn.close()
            return jsonify({"success": True})
        except Exception as e:
            print("ERROR in /api/tickets/update:", str(e))
            return jsonify({'error': str(e)}), 500

    @app.route("/api/tickets/create", methods=["POST", "OPTIONS"])
    def create_ticket_from_lambda():
        if request.method == "OPTIONS":
            return jsonify({}), 200
        try:
            data = request.get_json()
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO tickets
                (ticket_id, title, description, status, severity, category, created_by, account_id, alert_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                data.get("ticket_id"),
                data.get("title"),
                data.get("description"),
                data.get("status", "New"),
                data.get("severity", "Medium"),
                data.get("category", "Infrastructure"),
                data.get("source", "AWS CloudWatch"),
                data.get("account_id", "unknown"),
                data.get("alert_id"),
            ))
            conn.commit()
            conn.close()
            return jsonify({"success": True, "ticket_id": data.get("ticket_id")})
        except Exception as e:
            print("ERROR in /api/tickets/create:", str(e))
            return jsonify({'error': str(e)}), 500

    @app.route("/api/tickets/delete", methods=["POST", "OPTIONS"])
    def delete_ticket():
        if request.method == "OPTIONS":
            return jsonify({}), 200
        try:
            data = request.get_json()
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM tickets WHERE ticket_id=?", data.get("ticket_id"))
            conn.commit()
            conn.close()
            return jsonify({"success": True})
        except Exception as e:
            return jsonify({'error': str(e)}), 500


    @app.route("/api/alerts/create", methods=["POST", "OPTIONS"])
    def create_alert():
        if request.method == "OPTIONS":
            return jsonify({}), 200
        try:
            data = request.get_json()
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO alerts
                (alert_id, title, description, severity, status, category, source, account_id, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                data.get("alert_id"),
                data.get("title"),
                data.get("description"),
                data.get("severity", "Medium"),
                data.get("status", "Active"),
                data.get("category", "Infrastructure"),
                data.get("source", "AWS CloudWatch"),
                data.get("account_id", "unknown"),
                data.get("timestamp"),
            ))
            conn.commit()

            # Delete alerts older than 30 days
            cursor.execute("DELETE FROM alerts WHERE created_at < DATEADD(day, -30, GETDATE())")
            conn.commit()

            conn.close()
            return jsonify({"success": True, "alert_id": data.get("alert_id")})
        except Exception as e:
            print("ERROR in /api/alerts/create:", str(e))
            return jsonify({'error': str(e)}), 500

    @app.route("/api/alerts", methods=["GET", "OPTIONS"])
    def get_alerts():
        if request.method == "OPTIONS":
            return jsonify({}), 200
        try:
            account_id = request.args.get("account_id", "")
            conn = get_db()
            cursor = conn.cursor()
            if account_id:
                cursor.execute("SELECT * FROM alerts WHERE account_id=? ORDER BY created_at DESC", account_id)
            else:
                cursor.execute("SELECT * FROM alerts ORDER BY created_at DESC")
            columns = [col[0] for col in cursor.description]
            alerts = []
            for row in cursor.fetchall():
                alert = dict(zip(columns, row))
                for key, val in alert.items():
                    if hasattr(val, 'isoformat'):
                        alert[key] = val.isoformat()
                alerts.append(alert)
            conn.close()
            return jsonify({"alerts": alerts})
        except Exception as e:
            print("ERROR in /api/alerts GET:", str(e))
            return jsonify({'error': str(e)}), 500

    @app.route("/api/auth/get-credentials", methods=["GET", "OPTIONS"])
    def get_credentials():
        if request.method == "OPTIONS":
            return jsonify({}), 200
        token = request.headers.get('Authorization', '')
        try:
            token = token.split(' ')[1] if ' ' in token else token
            token_data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            current_user = token_data['email']
        except Exception:
            return jsonify({'error': 'Token is invalid'}), 401
        try:
            creds = get_user_credentials(current_user)
            if creds:
                return jsonify(creds)
            return jsonify({}), 200
        except Exception as e:
            print("ERROR in /api/auth/get-credentials:", str(e))
            return jsonify({'error': str(e)}), 500

    @app.route("/api/alerts/resolve", methods=["POST", "OPTIONS"])
    def resolve_alert():
        if request.method == "OPTIONS":
            return jsonify({}), 200
        try:
            data = request.get_json()
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE alerts
                SET status = 'Resolved'
                WHERE alert_id = ?
            """, (data.get("alert_id"),))
            conn.commit()
            conn.close()
            return jsonify({"success": True})
        except Exception as e:
            print("ERROR in /api/alerts/resolve:", str(e))
            return jsonify({'error': str(e)}), 500

    @app.route("/api/auth/list-accounts", methods=["GET", "OPTIONS"])
    def list_accounts():
        if request.method == "OPTIONS":
            return jsonify({}), 200
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
            cursor.execute("SELECT access_key, account_name, account_id, stored_at FROM aws_credentials WHERE email = ? ORDER BY stored_at DESC", current_user)
            rows = cursor.fetchall()
            conn.close()
            accounts = []
            for row in rows:
                accounts.append({
                    'accessKey': row[0],
                    'accountName': row[1] or 'My AWS Account',
                    'accountId': row[2] or 'Unknown',
                    'storedAt': row[3].isoformat() if row[3] else None,
                })
            return jsonify({"accounts": accounts})
        except Exception as e:
            print("ERROR in /api/auth/list-accounts:", str(e))
            return jsonify({'error': str(e)}), 500

    @app.route("/api/auth/get-account-credentials", methods=["POST", "OPTIONS"])
    def get_account_credentials():
        if request.method == "OPTIONS":
            return jsonify({}), 200
        token = request.headers.get('Authorization', '')
        try:
            token = token.split(' ')[1] if ' ' in token else token
            token_data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            current_user = token_data['email']
        except Exception:
            return jsonify({'error': 'Token is invalid'}), 401
        try:
            data = request.get_json()
            access_key = data.get('accessKey', '')
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT access_key, secret_key FROM aws_credentials WHERE email = ? AND access_key = ?", current_user, access_key)
            row = cursor.fetchone()
            conn.close()
            if row:
                return jsonify({'accessKey': row[0], 'secretKey': row[1]})
            return jsonify({'error': 'Account not found'}), 404
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    return app
