import { useState, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer } from "recharts";

const BACKEND = "https://cloudops-backend-venkatesh-cgfqcdffc8bhh9cd.eastus-01.azurewebsites.net";

const REGIONS = [
    // US East
    "us-east-1", "us-east-2",
    // US West
    "us-west-1", "us-west-2",
    // Canada
    "ca-central-1",
    // Europe
    "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-north-1", "eu-south-1",
    // South America
    "sa-east-1",
    // Asia Pacific
    "ap-south-1", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2", "ap-northeast-3",

].filter(Boolean); // Filter out any empty strings

const SERVICE_LABELS = {
    ec2: "EC2", lambda_fn: "Lambda", rds: "RDS",
    cloudwatch: "CloudWatch", sns: "SNS", sqs: "SQS",
    dynamodb: "DynamoDB", vpc: "VPCs",
};

const SERVICE_ICONS = {
    ec2: "🖥", lambda_fn: "⚡", rds: "🗄",
    cloudwatch: "📊", sns: "📢", sqs: "📬",
    dynamodb: "💾", vpc: "🌐",
};

// ── Utility helpers ────────────────────────────────────────────────────────────
const sumRegion = (awsData, key) => {
    if (!awsData?.services) return 0;
    return Object.values(awsData.services).reduce((total, regionData) => {
        const val = regionData?.[key];
        if (!val) return total;
        if (Array.isArray(val)) return total + val.length;
        return total;
    }, 0);
};

const getVpcCount = (awsData) => {
    if (!awsData?.services) return 0;
    return Object.values(awsData.services).reduce((total, regionData) => {
        const vpc = regionData?.vpc;
        if (!vpc) return total;
        if (Array.isArray(vpc)) return total + vpc.length;
        return total + (vpc?.vpcs?.length ?? 0);
    }, 0);
};

const parseCSV = (text) => {
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map((h) => h.trim().replace(/["\r]/g, ""));
    return lines.slice(1).map((line) => {
        const vals = [];
        let cur = "", inQ = false;
        for (const ch of line) {
            if (ch === '"') { inQ = !inQ; }
            else if (ch === "," && !inQ) { vals.push(cur.trim().replace(/["\r]/g, "")); cur = ""; }
            else cur += ch;
        }
        vals.push(cur.trim().replace(/["\r]/g, ""));
        const obj = {};
        headers.forEach((h, i) => (obj[h] = vals[i] ?? ""));
        return obj;
    }).filter((r) => r.ticket_id || r.id);
};

// ── Sub-components ─────────────────────────────────────────────────────────────

const Badge = ({ text, variant = "gray" }) => {
    const variants = {
        green:  { bg: "#e8f5ed", color: "#2b9348" },
        red:    { bg: "#fff0f0", color: "#c92a2a" },
        amber:  { bg: "#fff8e6", color: "#e67700" },
        blue:   { bg: "#eef2ff", color: "#3b5bdb" },
        gray:   { bg: "#f0f1f7", color: "#4a5070" },
    };
    const s = variants[variant] ?? variants.gray;
    return (
        <span style={{
            display: "inline-flex", alignItems: "center",
            padding: "2px 8px", borderRadius: 20,
            fontSize: 11, fontWeight: 600,
            background: s.bg, color: s.color,
            whiteSpace: "nowrap",
        }}>{text}</span>
    );
};

const stateBadge = (state) => {
    if (!state) return <Badge text="—" />;
    const s = state.toLowerCase();
    const v =
        ["running","active","ok","available"].includes(s) ? "green"
            : ["stopped","terminated","failed","alarm"].includes(s) ? "red"
                : ["pending","insufficient_data"].includes(s) ? "amber"
                    : "gray";
    return <Badge text={state} variant={v} />;
};

const Mono = ({ children }) => (
    <span style={{ fontFamily: "monospace", fontSize: 11 }}>{children ?? "—"}</span>
);

const StatCard = ({ label, value, sub, accent }) => (
    <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 12, padding: 16,
    }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", color: accent ? "var(--accent)" : "var(--text)" }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>{sub}</div>}
    </div>
);

const Card = ({ title, badge: bdg, children }) => (
    <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 12, marginBottom: 20, overflow: "hidden",
    }}>
        <div style={{
            padding: "14px 18px", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
            {bdg}
        </div>
        <div>{children}</div>
    </div>
);

const DataTable = ({ columns, rows, empty = "No data found" }) => {
    if (!rows?.length) return <div style={{ textAlign: "center", padding: "32px 20px", color: "var(--text3)", fontSize: 13 }}>{empty}</div>;
    return (
        <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                <tr>{columns.map((col) => (
                    <th key={col} style={{
                        fontSize: 11, fontWeight: 600, color: "var(--text3)",
                        textTransform: "uppercase", letterSpacing: "0.05em",
                        padding: "10px 14px", textAlign: "left",
                        borderBottom: "1px solid var(--border)",
                        background: "var(--surface2)", whiteSpace: "nowrap",
                    }}>{col}</th>
                ))}</tr>
                </thead>
                <tbody>
                {rows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                        {row.map((cell, j) => (
                            <td key={j} style={{ padding: "10px 14px", fontSize: 12, color: "var(--text2)", whiteSpace: "nowrap" }}>{cell ?? "—"}</td>
                        ))}
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
};

const Spinner = ({ size = 20 }) => (
    <div style={{
        width: size, height: size,
        border: "2px solid var(--border)", borderTopColor: "var(--accent)",
        borderRadius: "50%", animation: "spin 0.7s linear infinite",
        display: "inline-block",
    }} />
);

// ── Landing Page ───────────────────────────────────────────────────────────────
const LandingPage = ({ onLogin, onRegister, activePage, handleLogin, handleRegister, setPage }) => {
    const features = [
        { icon: "🔍", title: "Scan Cloud Resources", desc: "Compute, Storage, Databases, Networking and more across all regions and providers" },
        { icon: "🔔", title: "Real-time Alerts", desc: "Get notified instantly when alarms trigger across your cloud accounts" },
        { icon: "🎫", title: "Ticket Management", desc: "Auto-create tickets for High and Critical alerts, track and resolve them" },
        { icon: "📊", title: "Dashboard & Charts", desc: "Visualize your cloud operations with beautiful charts and summaries" },
    ];

    const steps = [
        { number: "1", title: "Register", desc: "Create your CloudOps account in seconds" },
        { number: "2", title: "Connect Cloud", desc: "Add your AWS, GCP or Azure credentials securely" },
        { number: "3", title: "Scan & Monitor", desc: "Scan resources and monitor alerts in real time" },
    ];

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "var(--font)" }}>

            {/* Login Modal Overlay */}
            {activePage === "login" && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
                     onClick={(e) => { if (e.target === e.currentTarget) setPage("landing"); }}
                >
                    <div onClick={e => e.stopPropagation()}>
                        <LoginPage onLogin={handleLogin} onRegister={() => setPage("register")} />
                    </div>
                </div>
            )}

            {/* Register Modal Overlay */}
            {activePage === "register" && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
                     onClick={(e) => { if (e.target === e.currentTarget) setPage("landing"); }}
                >
                    <div onClick={e => e.stopPropagation()}>
                        <RegisterPage onRegister={handleRegister} onBack={() => setPage("login")} />
                    </div>
                </div>
            )}

            {/* Navbar */}
            <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "0 40px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, background: "var(--accent)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                    </div>
                    <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>CloudOps</span>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                    <button onClick={onLogin} className="btn">Sign In</button>
                    <button onClick={onRegister} className="btn-primary" style={{ width: "auto", padding: "8px 20px", marginTop: 0 }}>Get Started</button>
                </div>
            </div>

            {/* Hero */}
            <div style={{ textAlign: "center", padding: "80px 24px 60px" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--accent-bg)", border: "1px solid var(--accent)", borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 600, color: "var(--accent)", marginBottom: 24 }}>
                    ☁ Multi-Cloud Management Platform
                </div>
                <h1 style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.04em", color: "var(--text)", marginBottom: 16, lineHeight: 1.15 }}>
                    Monitor your cloud<br />infrastructure in one place
                </h1>
                <p style={{ fontSize: 16, color: "var(--text2)", maxWidth: 520, margin: "0 auto 36px", lineHeight: 1.7 }}>
                    Connect AWS, GCP or Azure. Scan resources, track alerts, manage tickets and visualize your cloud operations — all from a single dashboard.
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                    <button onClick={onRegister} className="btn-primary" style={{ width: "auto", padding: "12px 32px", marginTop: 0, fontSize: 15 }}>
                        Get Started Free →
                    </button>
                    <button onClick={onLogin} className="btn" style={{ padding: "12px 32px", fontSize: 15 }}>
                        Sign In
                    </button>
                </div>
            </div>

            {/* Features */}
            <div style={{ padding: "40px 40px 60px", maxWidth: 1000, margin: "0 auto" }}>
                <div style={{ textAlign: "center", marginBottom: 40 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Features</div>
                    <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>Everything you need to manage your cloud</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
                    {features.map((f) => (
                        <div key={f.title} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
                            <div style={{ fontSize: 32, marginBottom: 14 }}>{f.icon}</div>
                            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{f.title}</div>
                            <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>{f.desc}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* How it works */}
            <div style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "60px 40px" }}>
                <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>How it works</div>
                    <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 40 }}>Get started in 3 simple steps</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
                        {steps.map((s) => (
                            <div key={s.number} style={{ textAlign: "center" }}>
                                <div style={{ width: 48, height: 48, background: "var(--accent)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 20, fontWeight: 700, color: "white" }}>
                                    {s.number}
                                </div>
                                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{s.title}</div>
                                <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>{s.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* CTA */}
            <div style={{ textAlign: "center", padding: "60px 24px" }}>
                <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 12 }}>Ready to get started?</div>
                <div style={{ fontSize: 14, color: "var(--text2)", marginBottom: 28 }}>Join and start monitoring your AWS infrastructure today.</div>
                <button onClick={onRegister} className="btn-primary" style={{ width: "auto", padding: "12px 32px", marginTop: 0, fontSize: 15 }}>
                    Create Free Account →
                </button>
            </div>

            {/* Footer */}
            <div style={{ borderTop: "1px solid var(--border)", padding: "20px 40px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 24, height: 24, background: "var(--accent)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>CloudOps</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text3)" }}>© 2026 CloudOps. All rights reserved.</div>
            </div>
        </div>
    );
};

// ── Login Page ─────────────────────────────────────────────────────────────────
const LoginPage = ({ onLogin, onRegister }) => {
    const [email, setEmail] = useState(() => {
        return localStorage.getItem('cloudops-rememberedEmail') || "";
    });
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(() => {
        return localStorage.getItem('cloudops-rememberMe') === 'true';
    });

    const handleLogin = async () => {
        setLoading(true);
        setError("");

        try {
            await onLogin(email, password);

            if (rememberMe) {
                localStorage.setItem('cloudops-rememberedEmail', email);
                localStorage.setItem('cloudops-rememberMe', 'true');
            } else {
                localStorage.removeItem('cloudops-rememberedEmail');
                localStorage.removeItem('cloudops-rememberMe');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 20, padding: 48, width: "100%", maxWidth: 440,
                boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
                    <div style={{ width: 36, height: 36, background: "var(--accent)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.03em" }}>CloudOps</span>
                </div>

                <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 6 }}>Welcome back</div>
                <div style={{ color: "var(--text2)", fontSize: 14, marginBottom: 32 }}>Sign in to your cloud management platform</div>

                {error && (
                    <div style={{ background: "var(--red-bg)", border: "1px solid rgba(201,42,42,0.2)", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "var(--red)", marginBottom: 16, display: "flex", gap: 8 }}>
                        ⚠ {error}
                    </div>
                )}

                <FormField label="Email">
                    <input className="form-input" type="email" placeholder="you@company.com" value={email}
                           onChange={(e) => setEmail(e.target.value)} />
                </FormField>
                <FormField label="Password">
                    <input className="form-input" type="password" placeholder="••••••••" value={password}
                           onChange={(e) => setPassword(e.target.value)}
                           onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
                </FormField>

                <button className="btn-primary" onClick={handleLogin} disabled={loading}>
                    {loading ? <Spinner size={16} /> : "Sign In"}
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                    <input
                        type="checkbox"
                        id="remember"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        style={{ cursor: "pointer" }}
                    />
                    <label htmlFor="remember" style={{ fontSize: 13, color: "var(--text2)", cursor: "pointer" }}>
                        Remember email
                    </label>
                </div>

                <div style={{ textAlign: "center", marginTop: 20, fontSize: 13 }}>
                    <span style={{ color: "var(--text2)" }}>New user? </span>
                    <button
                        onClick={onRegister}
                        style={{
                            background: "none",
                            border: "none",
                            color: "var(--accent)",
                            cursor: "pointer",
                            fontSize: 13,
                            fontWeight: 600,
                            textDecoration: "underline"
                        }}
                    >
                        Register here
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Register Page ──────────────────────────────────────────────────────────────
const RegisterPage = ({ onRegister, onBack }) => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        setLoading(true);
        setError("");

        try {
            if (!email || !password || !confirmPassword) {
                throw new Error("Please fill all fields.");
            }

            if (password !== confirmPassword) {
                throw new Error("Passwords do not match.");
            }

            if (password.length < 6) {
                throw new Error("Password must be at least 6 characters.");
            }

            await onRegister(email, password);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 20, padding: 48, width: "100%", maxWidth: 440,
                boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
                    <div style={{ width: 36, height: 36, background: "var(--accent)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.03em" }}>CloudOps</span>
                </div>

                <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 6 }}>Create Account</div>
                <div style={{ color: "var(--text2)", fontSize: 14, marginBottom: 32 }}>Sign up to access cloud management platform</div>

                {/* FIX #3: was broken emoji character 'â' — corrected to ⚠ */}
                {error && (
                    <div style={{ background: "var(--red-bg)", border: "1px solid rgba(201,42,42,0.2)", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "var(--red)", marginBottom: 16, display: "flex", gap: 8 }}>
                        ⚠ {error}
                    </div>
                )}

                <FormField label="Email">
                    <input className="form-input" type="email" placeholder="you@company.com" value={email}
                           onChange={(e) => setEmail(e.target.value)} />
                </FormField>
                <FormField label="Password">
                    <input className="form-input" type="password" placeholder="Create a password" value={password}
                           onChange={(e) => setPassword(e.target.value)} />
                </FormField>
                <FormField label="Confirm Password">
                    <input className="form-input" type="password" placeholder="Confirm your password" value={confirmPassword}
                           onChange={(e) => setConfirmPassword(e.target.value)}
                           onKeyDown={(e) => e.key === "Enter" && handleRegister()} />
                </FormField>

                <button className="btn-primary" onClick={handleRegister} disabled={loading}>
                    {loading ? <Spinner size={16} /> : "Create Account"}
                </button>

                <div style={{ textAlign: "center", marginTop: 20, fontSize: 13 }}>
                    <span style={{ color: "var(--text2)" }}>Already have an account? </span>
                    <button
                        onClick={onBack}
                        style={{
                            background: "none",
                            border: "none",
                            color: "var(--accent)",
                            cursor: "pointer",
                            fontSize: 13,
                            fontWeight: 600,
                            textDecoration: "underline"
                        }}
                    >
                        Sign in
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Edit Credentials Page ──────────────────────────────────────────────────────
const EditCredentialsPage = ({ onSave, onBack, userEmail }) => {
    const [activeTab, setActiveTab] = useState("aws");

    const saved = JSON.parse(localStorage.getItem(`cloudops-credentials-${userEmail}`) || '{}');
    const [accessKey, setAccessKey] = useState(saved.accessKey || "");
    const [secretKey, setSecretKey] = useState(saved.secretKey || "");

    const [newEmail, setNewEmail] = useState(userEmail || "");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");

    const showSuccess = (msg) => {
        setSuccess(msg); setError("");
        setTimeout(() => setSuccess(""), 3000);
    };
    const showError = (msg) => {
        setError(msg); setSuccess("");
    };

    const handleSaveAWS = async () => {
        if (!accessKey || !secretKey) { showError("Both keys are required."); return; }
        localStorage.setItem(`cloudops-credentials-${userEmail}`, JSON.stringify({ accessKey, secretKey }));
        // Also save to database
        try {
            const token = localStorage.getItem('cloudops-auth-token');
            await fetch(`${BACKEND}/api/auth/store-credentials`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ accessKey, secretKey }),
            });
        } catch (e) {
            console.error("Failed to store credentials in DB:", e);
        }
        showSuccess("AWS credentials updated successfully!");
        setTimeout(() => onSave(), 1200);
    };

    const handleSaveLogin = async () => {
        if (!currentPassword) { showError("Current password is required."); return; }
        if (!newEmail) { showError("Email cannot be empty."); return; }
        if (newPassword && newPassword.length < 6) { showError("New password must be at least 6 characters."); return; }
        if (newPassword && newPassword !== confirmPassword) { showError("New passwords do not match."); return; }

        const registeredUsers = JSON.parse(localStorage.getItem('cloudops-registeredUsers') || '[]');
        const defaultCredentials = [
            { email: 'admin@cloudops.com', password: 'CloudOps@2024' },
            { email: 'user@cloudops.com',  password: 'CloudOps@2024' },
            { email: 'demo@cloudops.com',  password: 'CloudOps@2024' },
        ];

        const isDefault = defaultCredentials.some(c => c.email === userEmail && c.password === currentPassword);
        const userIndex = registeredUsers.findIndex(u => u.email === userEmail && u.password === currentPassword);

        if (!isDefault && userIndex === -1) { showError("Current password is incorrect."); return; }

        if (userIndex !== -1) {
            registeredUsers[userIndex].email = newEmail;
            if (newPassword) registeredUsers[userIndex].password = newPassword;
            localStorage.setItem('cloudops-registeredUsers', JSON.stringify(registeredUsers));
        }

        if (newEmail !== userEmail) {
            const creds = localStorage.getItem(`cloudops-credentials-${userEmail}`);
            if (creds) {
                localStorage.setItem(`cloudops-credentials-${newEmail}`, creds);
                localStorage.removeItem(`cloudops-credentials-${userEmail}`);
            }
            localStorage.setItem('cloudops-userEmail', newEmail);
        }

        try {
            await fetch(
                "https://cloudops-backend-venkatesh-cgfqcdffc8bhh9cd.eastus-01.azurewebsites.net/api/auth/update",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        currentEmail: userEmail,
                        newEmail,
                        currentPassword,
                        newPassword: newPassword || undefined,
                    }),
                }
            );
        } catch (_) { /* backend optional */ }

        showSuccess("Login credentials updated successfully!");
        setTimeout(() => onSave(), 1200);
    };

    const tabStyle = (id) => ({
        flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 600,
        border: "none", cursor: "pointer", borderRadius: 8,
        background: activeTab === id ? "var(--accent)" : "transparent",
        color: activeTab === id ? "#fff" : "var(--text2)",
        transition: "all 0.15s",
    });

    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg)", padding: 24 }}>
            <div style={{ width: "100%", maxWidth: 500 }}>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Edit Credentials</div>
                <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>Update your AWS keys or login credentials</div>

                <div style={{ display: "flex", gap: 4, background: "var(--surface2)", borderRadius: 10, padding: 4, marginBottom: 20 }}>
                    <button style={tabStyle("aws")} onClick={() => { setActiveTab("aws"); setError(""); setSuccess(""); }}>
                        🔑 AWS Keys
                    </button>
                    <button style={tabStyle("login")} onClick={() => { setActiveTab("login"); setError(""); setSuccess(""); }}>
                        👤 Login Credentials
                    </button>
                </div>

                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28 }}>
                    {error && (
                        <div style={{ background: "var(--red-bg)", border: "1px solid rgba(201,42,42,0.2)", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "var(--red)", marginBottom: 16 }}>
                            ⚠ {error}
                        </div>
                    )}
                    {success && (
                        <div style={{ background: "var(--green-bg)", border: "1px solid var(--green)", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "var(--green)", marginBottom: 16 }}>
                            ✅ {success}
                        </div>
                    )}

                    {activeTab === "aws" && (
                        <>
                            <FormField label="Access Key ID">
                                <input className="form-input" type="text" placeholder="AKIA…"
                                       value={accessKey} onChange={(e) => setAccessKey(e.target.value)}
                                       style={{ fontFamily: "monospace", fontSize: 13 }} />
                            </FormField>
                            <FormField label="Secret Access Key">
                                <input className="form-input" type="password" placeholder="Your secret access key"
                                       value={secretKey} onChange={(e) => setSecretKey(e.target.value)}
                                       style={{ fontFamily: "monospace", fontSize: 13 }} />
                            </FormField>
                            <button className="btn-primary" onClick={handleSaveAWS}>Save AWS Keys</button>
                        </>
                    )}

                    {activeTab === "login" && (
                        <>
                            <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "var(--text2)", marginBottom: 16 }}>
                                Currently logged in as: <strong>{userEmail}</strong>
                            </div>
                            <FormField label="Current Password">
                                <input className="form-input" type="password" placeholder="Enter current password"
                                       value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                            </FormField>
                            <FormField label={<>New Email <span style={{ fontWeight: 400, fontSize: 11, color: "var(--text3)", textTransform: "none" }}>— leave unchanged to keep current</span></>}>
                                <input className="form-input" type="email" placeholder="you@company.com"
                                       value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                            </FormField>
                            <FormField label={<>New Password <span style={{ fontWeight: 400, fontSize: 11, color: "var(--text3)", textTransform: "none" }}>— leave blank to keep current</span></>}>
                                <input className="form-input" type="password" placeholder="New password"
                                       value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                            </FormField>
                            {newPassword && (
                                <FormField label="Confirm New Password">
                                    <input className="form-input" type="password" placeholder="Confirm new password"
                                           value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                                </FormField>
                            )}
                            <button className="btn-primary" onClick={handleSaveLogin}>Save Login Credentials</button>
                        </>
                    )}
                </div>

                <div style={{ textAlign: "center", marginTop: 16 }}>
                    <button className="btn btn-sm" onClick={onBack}>← Back</button>
                </div>
            </div>
        </div>
    );
};

// ── Account Selection Page ─────────────────────────────────────────────────────
const AccountSelectionPage = ({ onSelectAccount, onAddNew, onBack }) => {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAccounts = async () => {
            setLoading(true);
            try {
                const token = localStorage.getItem('cloudops-auth-token');
                const res = await fetch(`${BACKEND}/api/auth/list-accounts`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                const json = await res.json();
                setAccounts(json.accounts || []);
            } catch (e) {
                console.error("Failed to fetch accounts:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchAccounts();
    }, []);

    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg)", padding: 24 }}>
            <div style={{ width: "100%", maxWidth: 500 }}>
                <div style={{ textAlign: "center", marginBottom: 32 }}>
                    <div style={{ width: 56, height: 56, background: "#fff3e0", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 28 }}>☁</div>
                    <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 6 }}>Select AWS Account</div>
                    <div style={{ fontSize: 13, color: "var(--text2)" }}>Choose an existing account or add a new one</div>
                </div>

                {loading ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: 40 }}>
                        <Spinner /> <span style={{ color: "var(--text2)", fontSize: 13 }}>Loading accounts…</span>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                        {accounts.map((acc) => (
                            <div
                                key={acc.accessKey}
                                onClick={() => onSelectAccount(acc)}
                                style={{
                                    background: "var(--surface)", border: "1px solid var(--border)",
                                    borderRadius: 12, padding: "16px 20px", cursor: "pointer",
                                    display: "flex", alignItems: "center", gap: 16,
                                    transition: "all 0.15s",
                                }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "var(--accent-bg)"; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--surface)"; }}
                            >
                                <div style={{ width: 40, height: 40, background: "#fff3e0", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                                    ☁
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{acc.accountName}</div>
                                    <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "monospace" }}>
                                        {acc.accountId !== 'Unknown' ? acc.accountId : acc.accessKey.slice(0, 8) + '…'}
                                    </div>
                                </div>
                                <span style={{ color: "var(--accent)", fontSize: 18 }}>→</span>
                            </div>
                        ))}

                        <div
                            onClick={onAddNew}
                            style={{
                                background: "var(--surface)", border: "2px dashed var(--border)",
                                borderRadius: 12, padding: "16px 20px", cursor: "pointer",
                                display: "flex", alignItems: "center", gap: 16,
                                transition: "all 0.15s",
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
                        >
                            <div style={{ width: 40, height: 40, background: "var(--surface2)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                                +
                            </div>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>Add New AWS Account</div>
                                <div style={{ fontSize: 11, color: "var(--text3)" }}>Connect another AWS account</div>
                            </div>
                        </div>
                    </div>
                )}

                <div style={{ textAlign: "center", marginTop: 8 }}>
                    <button className="btn btn-sm" onClick={onBack}>← Back</button>
                </div>
            </div>
        </div>
    );
};

// ── Region group labels ────────────────────────────────────────────────────────
const REGION_GROUP_LABELS = {
    "us":  "United States",
    "eu":  "Europe",
    "ap":  "Asia Pacific",
    "ca":  "Canada",
    "sa":  "South America",
    "me":  "Middle East",
    "af":  "Africa",
    "il":  "Israel",
};

const REGION_CITY_NAMES = {
    "us-east-1": "N. Virginia",    "us-east-2": "Ohio",
    "us-west-1": "N. California",  "us-west-2": "Oregon",
    "eu-west-1": "Ireland",        "eu-west-2": "London",
    "eu-west-3": "Paris",          "eu-central-1": "Frankfurt",
    "eu-central-2": "Zurich",      "eu-north-1": "Stockholm",
    "eu-south-1": "Milan",         "eu-south-2": "Spain",
    "ap-south-1": "Mumbai",        "ap-south-2": "Hyderabad",
    "ap-southeast-1": "Singapore", "ap-southeast-2": "Sydney",
    "ap-southeast-3": "Jakarta",   "ap-southeast-4": "Melbourne",
    "ap-southeast-5": "Malaysia",  "ap-southeast-7": "Bangkok",
    "ap-northeast-1": "Tokyo",     "ap-northeast-2": "Seoul",
    "ap-northeast-3": "Osaka",
    "ca-central-1": "Central",     "ca-west-1": "Calgary",
    "sa-east-1": "São Paulo",
    "me-south-1": "Bahrain",       "me-central-1": "UAE",
    "af-south-1": "Cape Town",
    "il-central-1": "Tel Aviv",
};

const groupRegions = (regions) => {
    const groups = {};
    for (const r of regions) {
        const prefix = r.code.split("-")[0];
        const label = REGION_GROUP_LABELS[prefix] || prefix.toUpperCase();
        if (!groups[label]) groups[label] = [];
        groups[label].push(r);
    }
    // Sort groups in preferred order
    const order = ["United States", "Europe", "Asia Pacific", "Canada", "South America", "Middle East", "Africa", "Israel"];
    return Object.entries(groups).sort(([a], [b]) => {
        const ai = order.indexOf(a), bi = order.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });
};

// ── Region Selection Page ──────────────────────────────────────────────────────
const RegionSelectionPage = ({ onScanRegions, onBack, userEmail }) => {
    const [selectedRegions, setSelectedRegions] = useState([]);
    const [scanning, setScanning] = useState(false);
    const [fetchingRegions, setFetchingRegions] = useState(true);
    const [fetchError, setFetchError] = useState("");
    const [availableRegions, setAvailableRegions] = useState([]);

    // Fetch regions dynamically from the AWS account on mount
    useEffect(() => {
        const fetchRegions = async () => {
            setFetchingRegions(true);
            setFetchError("");
            try {
                const email = localStorage.getItem("cloudops-userEmail");
                const creds = JSON.parse(localStorage.getItem(`cloudops-credentials-${email}`) || "{}");

                if (!creds.accessKey || !creds.secretKey) {
                    throw new Error("No saved AWS credentials found.");
                }

                const res = await fetch(
                    "https://cloudops-backend-venkatesh-cgfqcdffc8bhh9cd.eastus-01.azurewebsites.net/api/regions",
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ accessKey: creds.accessKey, secretKey: creds.secretKey }),
                    }
                );
                const json = await res.json();
                if (json.error) throw new Error(json.error);

                setAvailableRegions(json.regions);
            } catch (err) {
                setFetchError(err.message);
                // Fallback to static list
                setAvailableRegions(REGIONS.map(code => ({ code, enabled: true, optIn: false, optInRequired: false })));
            } finally {
                setFetchingRegions(false);
            }
        };
        fetchRegions();
    }, []);

    const enabledRegions = availableRegions.filter(r => r.enabled);
    const grouped = groupRegions(availableRegions);

    const handleRegionToggle = (code) => {
        setSelectedRegions(prev =>
            prev.includes(code) ? prev.filter(r => r !== code) : [...prev, code]
        );
    };

    const handleSelectGroup = (groupRegions) => {
        const codes = groupRegions.filter(r => r.enabled).map(r => r.code);
        const allSelected = codes.every(c => selectedRegions.includes(c));
        if (allSelected) {
            setSelectedRegions(prev => prev.filter(c => !codes.includes(c)));
        } else {
            setSelectedRegions(prev => [...new Set([...prev, ...codes])]);
        }
    };

    const handleScan = async () => {
        if (selectedRegions.length === 0) {
            alert("Please select at least one region to scan.");
            return;
        }
        if (selectedRegions.length > 10) {
            const ok = window.confirm(
                `Scanning ${selectedRegions.length} regions may take a long time and could timeout. Consider selecting fewer regions. Continue anyway?`
            );
            if (!ok) return;
        }
        setScanning(true);
        try {
            await onScanRegions(selectedRegions);
            // Navigation to "app" page happens inside onScanRegions on success
            // Don't reset scanning state here — component unmounts on success
        } catch (error) {
            alert("Failed to start scan: " + error.message);
            setScanning(false);
        }
    };

    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg)", padding: 24 }}>
            <div style={{ width: "100%", maxWidth: 640 }}>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4 }}>Select Regions to Scan</div>
                <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>
                    {fetchingRegions
                        ? "Fetching available regions from your AWS account…"
                        : `${enabledRegions.length} regions available in your AWS account`}
                </div>

                {userEmail && (
                    <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "var(--text2)" }}>
                        Scanning with credentials for: <strong>{userEmail}</strong>
                    </div>
                )}

                {fetchError && (
                    <div style={{ background: "var(--amber-bg)", border: "1px solid var(--amber)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "var(--amber)", marginBottom: 16 }}>
                        ⚠ {fetchError} — showing default region list.
                    </div>
                )}

                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>

                    {fetchingRegions ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "40px 0", color: "var(--text3)", fontSize: 13 }}>
                            <Spinner size={20} /> Fetching regions from AWS…
                        </div>
                    ) : (
                        <>
                            {/* Header controls */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                <div style={{ fontSize: 13, color: "var(--text2)" }}>
                                    <strong>{selectedRegions.length}</strong> of <strong>{enabledRegions.length}</strong> selected
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <button className="btn btn-sm" onClick={() => setSelectedRegions(enabledRegions.map(r => r.code))}>
                                        Select All
                                    </button>
                                    <button className="btn btn-sm" onClick={() => setSelectedRegions([])}>
                                        Clear
                                    </button>
                                </div>
                            </div>

                            {/* Grouped regions */}
                            {grouped.map(([groupName, groupRegions]) => {
                                const enabledInGroup = groupRegions.filter(r => r.enabled);
                                const selectedInGroup = enabledInGroup.filter(r => selectedRegions.includes(r.code));
                                const allGroupSelected = enabledInGroup.length > 0 && selectedInGroup.length === enabledInGroup.length;

                                return (
                                    <div key={groupName} style={{ marginBottom: 16 }}>
                                        {/* Group header */}
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                                                {groupName}
                                            </div>
                                            {enabledInGroup.length > 0 && (
                                                <button
                                                    className="btn btn-sm"
                                                    style={{ fontSize: 10, padding: "2px 8px" }}
                                                    onClick={() => handleSelectGroup(groupRegions)}
                                                >
                                                    {allGroupSelected ? "Deselect" : "Select all"}
                                                </button>
                                            )}
                                        </div>

                                        {/* Region grid */}
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
                                            {groupRegions.map((r) => {
                                                const isSelected = selectedRegions.includes(r.code);
                                                const disabled = !r.enabled;
                                                const cityName = REGION_CITY_NAMES[r.code] || "";
                                                return (
                                                    <label key={r.code} style={{
                                                        display: "flex", alignItems: "center", gap: 8,
                                                        cursor: disabled ? "not-allowed" : "pointer",
                                                        padding: "7px 10px", borderRadius: 6,
                                                        opacity: disabled ? 0.5 : 1,
                                                        background: isSelected ? "var(--accent-bg)" : "var(--surface2)",
                                                        border: isSelected ? "1px solid var(--accent)" : "1px solid var(--border)",
                                                    }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            disabled={disabled}
                                                            onChange={() => !disabled && handleRegionToggle(r.code)}
                                                            style={{ cursor: disabled ? "not-allowed" : "pointer" }}
                                                        />
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text)" }}>
                                                                {cityName || r.code}
                                                            </div>
                                                            <div style={{ fontSize: 10, color: "var(--text3)", fontFamily: "monospace" }}>{r.code}</div>
                                                        </div>
                                                        {r.optInRequired && (
                                                            <span title="Not opted-in. Enable in AWS Console → Account → Regions" style={{
                                                                fontSize: 9, background: "var(--amber-bg)", color: "var(--amber)",
                                                                border: "1px solid var(--amber)", borderRadius: 4,
                                                                padding: "1px 4px", fontWeight: 700, whiteSpace: "nowrap",
                                                            }}>OPT-IN</span>
                                                        )}
                                                        {r.optIn && (
                                                            <span title="Opted-in region" style={{
                                                                fontSize: 9, background: "var(--green-bg)", color: "var(--green)",
                                                                border: "1px solid var(--green)", borderRadius: 4,
                                                                padding: "1px 4px", fontWeight: 700, whiteSpace: "nowrap",
                                                            }}>✓ OPT-IN</span>
                                                        )}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}

                    <button
                        className="btn-primary"
                        onClick={handleScan}
                        disabled={scanning || fetchingRegions || selectedRegions.length === 0}
                        style={{ marginTop: 16 }}
                    >
                        {scanning ? (
                            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <Spinner size={16} />
                                Scanning {selectedRegions.length} region{selectedRegions.length !== 1 ? "s" : ""}… (may take a few min)
                            </span>
                        ) : (
                            selectedRegions.length === 0
                                ? "Select regions to scan"
                                : selectedRegions.length === 1
                                    ? `Scan ${selectedRegions[0]}`
                                    : `Scan ${selectedRegions.length} Regions`
                        )}
                    </button>
                </div>

                <div style={{ textAlign: "center", marginTop: 16 }}>
                    <button className="btn btn-sm" onClick={onBack}>← Back</button>
                </div>
            </div>
        </div>
    );
};

const FormField = ({ label, children }) => (
    <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</label>
        {children}
    </div>
);

// ── Cloud Select Page ──────────────────────────────────────────────────────────
const CloudSelectPage = ({ onSelectCloud, onBack, userEmail }) => {
    const isNewUser = localStorage.getItem('cloudops-isNewUser') === 'true';

    const clouds = [
        {
            id: "aws", name: "Amazon AWS", desc: isNewUser ? "Setup credentials and scan resources" : "Select regions and scan resources",
            iconBg: "#fff3e0", available: true,
            icon: (
                <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
                    <path d="M13.5 28.5C10.5 27 8 24 8 20.5C8 15.8 11.8 12 16.5 12C17.3 12 18.1 12.1 18.8 12.3C20.2 9.7 23 8 26.2 8C30.8 8 34.5 11.7 34.5 16.3C34.5 16.7 34.5 17.1 34.4 17.5C37.5 18.4 39.8 21.2 39.8 24.6C39.8 28.8 36.4 32.2 32.2 32.2H16C15 32.2 14.2 32 13.5 28.5Z" fill="#FF9900" opacity="0.2"/>
                    <path d="M16 32.2H32.2C36.4 32.2 39.8 28.8 39.8 24.6C39.8 21.2 37.5 18.4 34.4 17.5C34.5 17.1 34.5 16.7 34.5 16.3C34.5 11.7 30.8 8 26.2 8C23 8 20.2 9.7 18.8 12.3C18.1 12.1 17.3 12 16.5 12C11.8 12 8 15.8 8 20.5C8 24 10.5 27 13.5 28.5" stroke="#FF9900" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M20 38L24 42L28 38" stroke="#FF9900" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M24 36V42" stroke="#FF9900" strokeWidth="2" strokeLinecap="round"/>
                </svg>
            ),
        },
        {
            id: "gcp", name: "Google Cloud", desc: "GCE, GCS, Cloud Functions",
            iconBg: "#e8f0fe", available: false,
            icon: (
                <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
                    <rect x="8" y="8" width="14" height="14" rx="2" fill="#4285F4" opacity="0.7"/>
                    <rect x="26" y="8" width="14" height="14" rx="2" fill="#34A853" opacity="0.7"/>
                    <rect x="8" y="26" width="14" height="14" rx="2" fill="#EA4335" opacity="0.7"/>
                    <rect x="26" y="26" width="14" height="14" rx="2" fill="#FBBC05" opacity="0.7"/>
                </svg>
            ),
        },
        {
            id: "azure", name: "Microsoft Azure", desc: "VMs, Storage, Functions",
            iconBg: "#e6f2ff", available: false,
            icon: (
                <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
                    <path d="M8 24C8 15.2 15.2 8 24 8C28.6 8 32.8 9.9 35.8 13L40 9V21H28L32.5 16.5C30.3 14.3 27.3 13 24 13C17.9 13 13 17.9 13 24H8Z" fill="#0089D6" opacity="0.7"/>
                    <path d="M40 24C40 32.8 32.8 40 24 40C19.4 40 15.2 38.1 12.2 35L8 39V27H20L15.5 31.5C17.7 33.7 20.7 35 24 35C30.1 35 35 30.1 35 24H40Z" fill="#0089D6" opacity="0.5"/>
                </svg>
            ),
        },
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg)", padding: 24 }}>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>CloudOps Platform</div>
                <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.04em", marginBottom: 10 }}>Choose your cloud</h1>
                <p style={{ color: "var(--text2)", fontSize: 15 }}>Select a platform to view resources, services, and tickets</p>

                {userEmail && (
                    <div style={{
                        background: "var(--surface2)",
                        borderRadius: 8,
                        padding: "8px 16px",
                        marginTop: 16,
                        fontSize: 13,
                        color: "var(--text2)"
                    }}>
                        Logged in as: <strong>{userEmail}</strong>
                    </div>
                )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, maxWidth: 680, width: "100%" }}>
                {clouds.map((cloud) => (
                    <div key={cloud.id}
                         onClick={() => cloud.available && onSelectCloud(cloud.id)}
                         style={{
                             background: "var(--surface)", border: "2px solid var(--border)",
                             borderRadius: 20, padding: "36px 24px", textAlign: "center",
                             cursor: cloud.available ? "pointer" : "default",
                             opacity: cloud.available ? 1 : 0.6,
                             position: "relative", transition: "all 0.2s",
                         }}
                         onMouseEnter={(e) => {
                             if (cloud.available) {
                                 e.currentTarget.style.borderColor = "var(--accent)";
                                 e.currentTarget.style.transform = "translateY(-3px)";
                             }
                         }}
                         onMouseLeave={(e) => {
                             e.currentTarget.style.borderColor = "var(--border)";
                             e.currentTarget.style.transform = "none";
                         }}
                    >
                        {!cloud.available && (
                            <span style={{
                                position: "absolute", top: 12, right: 12,
                                background: "var(--surface2)", border: "1px solid var(--border)",
                                borderRadius: 20, padding: "2px 8px", fontSize: 10,
                                fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em",
                            }}>Soon</span>
                        )}
                        <div style={{ width: 64, height: 64, background: cloud.iconBg, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                            {cloud.icon}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{cloud.name}</div>
                        <div style={{ fontSize: 12, color: "var(--text2)" }}>{cloud.desc}</div>
                    </div>
                ))}
            </div>

            <button onClick={onBack} style={{ marginTop: 32, background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 13 }}>← Back</button>
        </div>
    );
};

// ── AWS Setup Guide Page ───────────────────────────────────────────────────────
const SetupGuidePage = ({ onContinue, onBack, isNewUser }) => {
    const [copied, setCopied] = useState(false);

    const policy = JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Effect: "Allow",
            Action: [
                "ce:GetCostAndUsage",
                "ce:GetCostForecast",
                "sts:GetCallerIdentity"
            ],
            Resource: "*"
        }]
    }, null, 2);

    const fallbackCopy = () => {
        const textarea = document.createElement("textarea");
        textarea.value = policy;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        try {
            document.execCommand("copy");
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            alert("Copy failed. Please manually select and copy the policy text.");
        }
        document.body.removeChild(textarea);
    };

    const copyPolicy = () => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(policy).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                }).catch(() => fallbackCopy());
            } else {
                fallbackCopy();
            }
        } catch {
            fallbackCopy();
        }
    };

    const steps = [
        {
            number: "1",
            title: "Attach ReadOnlyAccess",
            desc: "Allows scanning EC2, Lambda, RDS, S3, VPC, SNS, SQS, ECS, EKS and more.",
            details: [
                "Go to AWS Console → IAM → Users → click your user",
                "Click Permissions tab → Add permissions",
                "Click Attach policies directly",
                'Search "ReadOnlyAccess" → check it → Add permissions',
            ]
        },
        {
            number: "2",
            title: "Attach IAMReadOnlyAccess",
            desc: "Allows scanning IAM users, roles, groups and policies.",
            details: [
                "Same place → Add permissions → Attach policies directly",
                'Search "IAMReadOnlyAccess" → check it → Add permissions',
            ]
        },
        {
            number: "3",
            title: "Add Cost Explorer Policy",
            desc: "Allows viewing month-to-date costs, forecast and billing by service.",
            details: [
                "Add permissions → Create inline policy",
                'Click "JSON" tab → paste the policy below',
                'Click Next → name it "CloudOps-Cost-Policy" → Create policy',
            ],
            showPolicy: true,
        },
    ];

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "40px 24px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ maxWidth: 640, width: "100%" }}>

                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: 36 }}>
                    <div style={{ width: 56, height: 56, background: "#fff3e0", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 28 }}>🔐</div>
                    <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 8 }}>AWS Permission Setup</h1>
                    <p style={{ color: "var(--text2)", fontSize: 14, lineHeight: 1.6 }}>
                        Before scanning, your AWS IAM user needs these permissions.<br />
                        This is a one-time setup. All permissions are <strong>read-only</strong> — nothing can be modified or deleted.
                    </p>
                </div>

                {/* Steps */}
                {steps.map((step, i) => (
                    <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, marginBottom: 16 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--accent)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                                {step.number}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{step.title}</div>
                                <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 12 }}>{step.desc}</div>
                                {step.details.map((d, j) => (
                                    <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                                        <span style={{ color: "var(--accent)", fontWeight: 700, fontSize: 13, marginTop: 1 }}>→</span>
                                        <span style={{ fontSize: 13, color: "var(--text2)" }}>{d}</span>
                                    </div>
                                ))}
                                {step.showPolicy && (
                                    <div style={{ marginTop: 12, position: "relative" }}>
                                        <pre style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, fontSize: 11, color: "var(--text)", overflowX: "auto", margin: 0, lineHeight: 1.6 }}>
                                            {policy}
                                        </pre>
                                        <button
                                            onClick={copyPolicy}
                                            style={{ position: "absolute", top: 10, right: 10, background: copied ? "#22c55e" : "var(--accent)", color: "white", border: "none", borderRadius: 8, padding: "4px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
                                        >
                                            {copied ? "✓ Copied!" : "Copy"}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {/* Info box */}
                <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 24, display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 18 }}>ℹ️</span>
                    <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>
                        These permissions are <strong>read-only</strong>. Your AWS resources cannot be modified, deleted, or created by this app. We only read resource data to display it in your dashboard.
                    </div>
                </div>

                {/* Buttons */}
                <div style={{ display: "flex", gap: 12 }}>
                    <button
                        onClick={onBack}
                        style={{ flex: 1, padding: "14px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", color: "var(--text)" }}
                    >
                        ← Back
                    </button>
                    <button
                        onClick={onContinue}
                        style={{ flex: 2, padding: "14px", background: "var(--accent)", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", color: "white" }}
                    >
                        I've set up permissions → Continue
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Scan Form ─────────────────────────────────────────────────────────────────
const ScanForm = ({ onCredentialsSaved }) => {
    const [key, setKey] = useState("");
    const [secret, setSecret] = useState("");
    const [accountName, setAccountName] = useState("");
    const [error, setError] = useState("");

    const handleSave = async () => {
        if (!key || !secret) {
            setError("Access Key and Secret Key are required.");
            return;
        }
        const email = localStorage.getItem('cloudops-userEmail');
        if (email) {
            localStorage.setItem(`cloudops-credentials-${email}`, JSON.stringify({
                accessKey: key,
                secretKey: secret
            }));
            localStorage.setItem('cloudops-isNewUser', 'false');
        }
        // Also save to database
        try {
            const token = localStorage.getItem('cloudops-auth-token');
            await fetch(`${BACKEND}/api/auth/store-credentials`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ accessKey: key, secretKey: secret, accountName: accountName || "My AWS Account" }),
            });
        } catch (e) {
            console.error("Failed to store credentials in DB:", e);
        }
        onCredentialsSaved();
    };

    return (
        <div style={{ maxWidth: 560, margin: "0 auto", paddingTop: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4 }}>Connect AWS Account</div>
            <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>Enter your AWS credentials to start scanning resources</div>
            <div style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 12, padding: 28, boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}>
                {error && (
                    <div style={{ background: "var(--red-bg)", border: "1px solid rgba(201,42,42,0.2)", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "var(--red)", marginBottom: 16, display: "flex", gap: 8 }}>
                        ⚠ {error}
                    </div>
                )}
                <FormField label="Account Name">
                    <input className="form-input" type="text" placeholder="e.g. Production, Development…" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
                </FormField>
                <FormField label="Access Key ID">
                    <input className="form-input" type="text" placeholder="AKIA…" value={key} onChange={(e) => setKey(e.target.value)} style={{ fontFamily: "monospace", fontSize: 13 }} />
                </FormField>
                <FormField label="Secret Access Key">
                    <input className="form-input" type="password" placeholder="Your secret access key" value={secret} onChange={(e) => setSecret(e.target.value)} style={{ fontFamily: "monospace", fontSize: 13 }} />
                </FormField>
                <button className="btn-primary" onClick={handleSave}>Save & Continue →</button>
                <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: "var(--text3)" }}>
                    Read-only permissions required · Credentials are stored securely
                </div>
            </div>
        </div>
    );
};

// ── Overview Section ───────────────────────────────────────────────────────────
const Overview = ({ awsData, scanMeta }) => {
    const id = awsData.identity || {};
    const costs = awsData.costs || {};
    const regionCount = (awsData.regions || []).length;
    const byService = Object.entries(costs.by_service || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = byService[0]?.[1] || 1;
    const costAccessDenied = costs.error?.includes("Cost Explorer access denied");

    const iamUsers = Array.isArray(awsData.iam) ? awsData.iam : (awsData.iam?.users || []);

    const stats = [
        { label: "EC2 Instances",     value: sumRegion(awsData, "ec2"),       sub: `across ${regionCount} regions` },
        { label: "Lambda Functions",  value: sumRegion(awsData, "lambda_fn") },
        { label: "RDS Instances",     value: sumRegion(awsData, "rds") },
        { label: "S3 Buckets",        value: (awsData.s3 || []).length },
        { label: "IAM Users",         value: iamUsers.length },
        { label: "CloudWatch Alarms", value: sumRegion(awsData, "cloudwatch") },
        { label: "SNS Topics",        value: sumRegion(awsData, "sns") },
        { label: "VPCs",              value: getVpcCount(awsData) },
    ];

    return (
        <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4 }}>Overview</div>
            <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>Account identity and resource summary</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12, marginBottom: 24 }}>
                {[
                    { label: "Account ID",      value: id.account_id || "—" },
                    { label: "User ARN",        value: id.arn || "—", mono: true },
                    { label: "Regions Scanned", value: regionCount },
                    { label: "Scan Duration",   value: `${scanMeta?.duration || "—"}s` },
                ].map(({ label, value, mono }) => (
                    <div key={label} style={{ background: "var(--surface2)", borderRadius: 8, padding: "12px 14px" }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
                        <div style={{ fontFamily: mono ? "monospace" : "inherit", fontSize: mono ? 10 : 12, color: "var(--text)", wordBreak: "break-all" }}>{value}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12, marginBottom: 24 }}>
                {stats.map((s) => <StatCard key={s.label} {...s} />)}
            </div>

            <Card title={`Cost & Usage — ${costs.period || ""}`}>
                <div style={{ padding: 18 }}>
                    {costAccessDenied && (
                        <div style={{ background: "var(--amber-bg)", border: "1px solid var(--amber)", borderRadius: 8, padding: 16, marginBottom: 20 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                                <span style={{ fontSize: 20 }}>🔒</span>
                                <div>
                                    <div style={{ fontWeight: 600, color: "var(--amber)", marginBottom: 4, fontSize: 13 }}>Cost Explorer Access Required</div>
                                    <div style={{ fontSize: 12, color: "var(--text2)" }}>Enable Cost Explorer and grant permissions to view cost data</div>
                                </div>
                            </div>
                            <div style={{ background: "var(--surface)", borderRadius: 8, padding: 12, fontSize: 11, color: "var(--text3)" }}>
                                <div style={{ fontWeight: 600, marginBottom: 8 }}>Required steps:</div>
                                <div style={{ marginBottom: 6 }}>1. Enable Cost Explorer in AWS Console → Billing & Cost Management</div>
                                <div style={{ marginBottom: 6 }}>2. Add IAM permissions: ce:GetCostAndUsage, ce:GetCostForecast</div>
                                <div>3. Wait 24–48 hours after enabling for data to appear</div>
                            </div>
                        </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                        <StatCard label="Month-to-Date" value={costs.error ? "—" : `$${costs.total ?? 0}`} accent />
                        <StatCard label="Forecast" value={costs.error ? "—" : (costs.forecast != null ? `$${costs.forecast}` : "—")} />
                    </div>

                    {byService.length > 0 && !costs.error && (
                        <>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 10 }}>By service</div>
                            {byService.map(([name, val]) => (
                                <div key={name} style={{ marginBottom: 10 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, color: "var(--text2)" }}>
                                        <span>{name}</span><span>${val.toFixed(2)}</span>
                                    </div>
                                    <div style={{ height: 6, background: "var(--surface2)", borderRadius: 3, overflow: "hidden" }}>
                                        <div style={{ height: "100%", background: "var(--accent)", borderRadius: 3, width: `${(val / max * 100).toFixed(1)}%` }} />
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </Card>
        </div>
    );
};

// ── IAM Section ───────────────────────────────────────────────────────────────
const IAMSection = ({ awsData }) => {
    const iamRaw = awsData.iam || [];
    const users = Array.isArray(iamRaw) ? iamRaw : (iamRaw.users || []);
    const roles = Array.isArray(iamRaw) ? [] : (iamRaw.roles || []);
    const groups = Array.isArray(iamRaw) ? [] : (iamRaw.groups || []);
    const policies = Array.isArray(iamRaw) ? [] : (iamRaw.policies || []);

    return (
        <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 20 }}>IAM</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
                {[["Users", users.length], ["Roles", roles.length], ["Groups", groups.length], ["Policies", policies.length]].map(([l, v]) => (
                    <StatCard key={l} label={l} value={v} />
                ))}
            </div>
            <Card title={`Users (${users.length})`}>
                <DataTable
                    columns={["Username", "ARN", "Created", "MFA"]}
                    rows={users.map((u) => [
                        <strong style={{ fontSize: 12 }}>{u.UserName || u.username || u.name || "—"}</strong>,
                        <Mono>{u.Arn || u.arn}</Mono>,
                        (u.CreateDate || u.created || "").toString().slice(0, 19),
                        u.mfa_active ? <Badge text="Enabled" variant="green" /> : <Badge text="Disabled" variant="red" />,
                    ])}
                />
            </Card>
            {roles.length > 0 && (
                <Card title={`Roles (${roles.length})`}>
                    <DataTable
                        columns={["Role Name", "ARN", "Created"]}
                        rows={roles.map((r) => [
                            <strong style={{ fontSize: 12 }}>{r.name || "—"}</strong>,
                            <Mono>{r.arn}</Mono>,
                            (r.created || "").toString().slice(0, 19),
                        ])}
                    />
                </Card>
            )}
        </div>
    );
};

// ── S3 Section ────────────────────────────────────────────────────────────────
const S3Section = ({ awsData }) => {
    const s3Raw = awsData.s3 || [];
    const buckets = Array.isArray(s3Raw) ? s3Raw : Object.values(s3Raw).flat();

    return (
        <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 20 }}>S3 Buckets</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12, marginBottom: 24 }}>
                <StatCard label="Total Buckets" value={buckets.length} />
            </div>
            <Card title={`Buckets (${buckets.length})`}>
                <DataTable
                    columns={["Bucket Name", "Region", "Created", "Versioning", "Public Access"]}
                    rows={buckets.map((b) => [
                        <strong style={{ fontSize: 12 }}>{b.Name || b.name || "—"}</strong>,
                        b.region || "—",
                        (b.CreationDate || b.created || "").toString().slice(0, 19),
                        b.versioning ? <Badge text={b.versioning} variant={b.versioning === "Enabled" ? "green" : "gray"} /> : "—",
                        b.public_access_blocked ? <Badge text="Blocked" variant="red" /> : <Badge text="Public" variant="amber" />,
                    ])}
                />
            </Card>
        </div>
    );
};

// ── Route53 Section ────────────────────────────────────────────────────────────
const Route53Section = ({ awsData }) => {
    const r53Raw = awsData.route53 || [];
    const zones = Array.isArray(r53Raw) ? r53Raw : Object.values(r53Raw).flat();

    return (
        <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 20 }}>Route 53</div>
            <Card title={`Hosted Zones (${zones.length})`}>
                <DataTable
                    columns={["Name", "ID", "Type", "Record Count"]}
                    rows={zones.map((z) => [
                        z.Name || z.name || "—",
                        <Mono>{z.Id || z.id}</Mono>,
                        <Badge text={z.Config?.PrivateZone ? "Private" : "Public"} />,
                        z.ResourceRecordSetCount || z.record_count || "—",
                    ])}
                    empty="No hosted zones found"
                />
            </Card>
        </div>
    );
};

// ── CloudFront Section ─────────────────────────────────────────────────────────
const CloudFrontSection = ({ awsData }) => {
    const cfRaw = awsData.cloudfront || [];
    const dists = Array.isArray(cfRaw) ? cfRaw : Object.values(cfRaw).flat();

    return (
        <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 20 }}>CloudFront</div>
            <Card title={`Distributions (${dists.length})`}>
                <DataTable
                    columns={["ID", "Domain", "Status", "Origins", "Price Class"]}
                    rows={dists.map((d) => [
                        <Mono>{d.Id || d.id}</Mono>,
                        d.DomainName || d.domain_name || "—",
                        stateBadge(d.Status || d.status),
                        d.Origins?.Quantity || d.origins || "—",
                        d.PriceClass || d.price_class || "—",
                    ])}
                    empty="No CloudFront distributions found"
                />
            </Card>
        </div>
    );
};

// ── Regional Services Section ──────────────────────────────────────────────────
const RegionalSection = ({ awsData }) => {
    const services = ["ec2", "lambda_fn", "rds", "cloudwatch", "sns", "sqs", "dynamodb", "vpc"];

    const allRegions = new Set(Object.keys(awsData.services || {}));

    const counts = Array.from(allRegions).map((region) => {
        const regionData = awsData.services?.[region] || {};
        const rc = { region, total: 0 };
        services.forEach((s) => {
            let count = 0;
            if (s === "vpc") {
                const vpc = regionData.vpc;
                if (!vpc) count = 0;
                else if (Array.isArray(vpc)) count = vpc.length;
                else count = vpc?.vpcs?.length ?? 0;
            } else {
                const val = regionData[s];
                count = Array.isArray(val) ? val.length : 0;
            }
            rc[s] = count;
            rc.total += count;
        });
        return rc;
    }).filter((r) => r.total > 0);

    const totals = counts.reduce((acc, r) => {
        services.forEach((s) => { acc[s] = (acc[s] || 0) + (r[s] || 0); });
        acc.total = (acc.total || 0) + r.total;
        return acc;
    }, {});

    const maxCount = Math.max(...counts.map((r) => r.total), 1);

    return (
        <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 20 }}>Regional Services</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12, marginBottom: 24 }}>
                <StatCard label="Regions" value={allRegions.size} />
                <StatCard label="Total Resources" value={totals.total || 0} />
                <StatCard label="Active Services" value={services.filter((s) => totals[s] > 0).length} />
                <StatCard label="Max per Region" value={Math.max(...counts.map((r) => r.total), 0)} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 20, marginBottom: 24 }}>
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Resource distribution by service</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(100px,1fr))", gap: 10 }}>
                        {services.filter((s) => totals[s] > 0).map((s) => (
                            <div key={s} style={{ textAlign: "center", padding: 12, background: "var(--surface2)", borderRadius: 8 }}>
                                <div style={{ fontSize: 22, marginBottom: 6 }}>{SERVICE_ICONS[s]}</div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)" }}>{totals[s]}</div>
                                <div style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{SERVICE_LABELS[s]}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Region activity heatmap</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(90px,1fr))", gap: 8 }}>
                        {counts.map((r) => {
                            const intensity = r.total / maxCount;
                            const bg = intensity > 0.6 ? "rgba(201,42,42,0.1)" : intensity > 0.3 ? "rgba(230,119,0,0.1)" : "rgba(43,147,72,0.1)";
                            const border = intensity > 0.6 ? "1px solid rgba(201,42,42,0.3)" : intensity > 0.3 ? "1px solid rgba(230,119,0,0.3)" : "1px solid rgba(43,147,72,0.3)";
                            return (
                                <div key={r.region} style={{ padding: "12px 8px", textAlign: "center", background: bg, border, borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
                                    <div style={{ fontWeight: 600 }}>{r.region.split("-")[1]}</div>
                                    <div style={{ fontSize: 10, color: "var(--text3)" }}>{r.total}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <Card title="Services by region">
                <DataTable
                    columns={["Region", "EC2", "Lambda", "RDS", "CloudWatch", "SNS", "SQS", "DynamoDB", "VPCs"]}
                    rows={counts.map((r) => [
                        <strong style={{ fontSize: 12 }}>{r.region}</strong>,
                        r.ec2 || "—", r.lambda_fn || "—", r.rds || "—",
                        r.cloudwatch || "—", r.sns || "—", r.sqs || "—",
                        r.dynamodb || "—", r.vpc || "—",
                    ])}
                />
            </Card>

            {[
                {
                    key: "ec2", label: "EC2",
                    cols: ["ID","Name","Type","State","AZ","Private IP","Public IP"],
                    row: (i) => [<Mono>{i.InstanceId||i.id}</Mono>, i.name||"—", <Mono>{i.InstanceType||i.type}</Mono>, stateBadge(i.State?.Name||i.state), i.Placement?.AvailabilityZone||i.az, i.PrivateIpAddress||i.private_ip, i.PublicIpAddress||i.public_ip||"—"],
                },
                {
                    key: "cloudwatch", label: "CloudWatch Alarms",
                    cols: ["Name","State","Metric","Namespace","Threshold"],
                    row: (a) => [<strong style={{fontSize:12}}>{a.AlarmName||a.name||"—"}</strong>, stateBadge(a.StateValue||a.state), a.MetricName||a.metric, a.Namespace||a.namespace, a.Threshold||a.threshold],
                },
                {
                    key: "lambda_fn", label: "Lambda Functions",
                    cols: ["Name","Runtime","Memory","Timeout","Last Modified"],
                    row: (f) => [<strong style={{fontSize:12}}>{f.FunctionName||f.name||"—"}</strong>, f.Runtime||f.runtime||"—", f.MemorySize||f.memory_mb||"—", f.Timeout||f.timeout_s||"—", (f.LastModified||f.last_modified||"").toString().slice(0,19)],
                },
                {
                    key: "rds", label: "RDS Instances",
                    cols: ["ID","Engine","Version","Class","State","Multi-AZ"],
                    row: (i) => [<Mono>{i.DBInstanceIdentifier||i.id}</Mono>, i.Engine||i.engine||"—", i.EngineVersion||i.engine_version||"—", i.DBInstanceClass||i.instance_class||"—", stateBadge(i.DBInstanceStatus||i.status||i.state), (i.MultiAZ||i.multi_az)?"Yes":"No"],
                },
                {
                    key: "sns", label: "SNS Topics",
                    cols: ["ARN"],
                    row: (t) => [<Mono>{t.TopicArn||t.arn||t}</Mono>],
                },
                {
                    key: "sqs", label: "SQS Queues",
                    cols: ["Queue URL"],
                    row: (q) => [<Mono>{q.url||q}</Mono>],
                },
                {
                    key: "dynamodb", label: "DynamoDB Tables",
                    cols: ["Table Name"],
                    row: (t) => [<strong style={{fontSize:12}}>{t.name||t||"—"}</strong>],
                },
            ].map(({ key, label, cols, row }) =>
                Object.entries(awsData.services || {})
                    .filter(([, regionData]) => Array.isArray(regionData?.[key]) && regionData[key].length > 0)
                    .map(([region, regionData]) => {
                        const items = regionData[key];
                        return (
                            <Card key={`${key}-${region}`} title={`${label} — ${region}`} badge={<Badge text={`${items.length} items`} variant="blue" />}>
                                <DataTable columns={cols} rows={items.map(row)} />
                            </Card>
                        );
                    })
            )}

            {Object.entries(awsData.services || {})
                .filter(([, regionData]) => regionData?.vpc?.vpcs?.length > 0)
                .map(([region, regionData]) => {
                    const vpc = regionData.vpc;
                    return (
                        <Card key={`vpc-${region}`} title={`VPCs — ${region}`} badge={<Badge text={`${vpc.vpcs.length} VPCs`} variant="blue" />}>
                            <DataTable
                                columns={["ID","Name","CIDR","State","Default"]}
                                rows={vpc.vpcs.map((v) => [
                                    <Mono>{v.VpcId||v.id}</Mono>,
                                    v.name || (v.Tags?.find(t=>t.Key==="Name")?.Value) || "—",
                                    <Mono>{v.CidrBlock||v.cidr}</Mono>,
                                    stateBadge(v.State||v.state),
                                    (v.IsDefault||v.default) ? "Yes" : "No",
                                ])}
                            />
                        </Card>
                    );
                })}

            {Object.entries(awsData.services || {})
                .filter(([, regionData]) => regionData?.vpc?.security_groups?.length > 0)
                .map(([region, regionData]) => {
                    const sgs = regionData.vpc.security_groups;
                    return (
                        <Card key={`sg-${region}`} title={`Security Groups — ${region}`} badge={<Badge text={`${sgs.length} SGs`} variant="blue" />}>
                            <DataTable
                                columns={["ID","Name","VPC","Inbound Rules","Outbound Rules"]}
                                rows={sgs.map((sg) => [
                                    <Mono>{sg.GroupId||sg.id}</Mono>,
                                    sg.GroupName||sg.name||"—",
                                    <Mono>{sg.VpcId||sg.vpc}</Mono>,
                                    sg.IpPermissions?.length||sg.inbound||"—",
                                    sg.IpPermissionsEgress?.length||sg.outbound||"—",
                                ])}
                            />
                        </Card>
                    );
                })}
        </div>
    );
};

// ── Dashboard Section ─────────────────────────────────────────────────────────────
const DashboardSection = ({ awsData, accountId }) => {
    const [alerts, setAlerts] = useState([]);
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                if (!accountId) {
                    setAlerts([]);
                    setTickets([]);
                    setLoading(false);
                    return;
                }
                const [alertRes, ticketRes] = await Promise.all([
                    fetch(`${BACKEND}/api/alerts?account_id=${accountId}`),
                    fetch(`${BACKEND}/api/tickets?account_id=${accountId}`),
                ]);
                const alertJson = await alertRes.json();
                const ticketJson = await ticketRes.json();
                setAlerts(alertJson.alerts || []);
                setTickets(ticketJson.tickets || []);
            } catch (e) {
                console.error("Dashboard fetch error:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [accountId]);

    const activeAlerts = alerts.filter(a => a.status === "Active").length;
    const resolvedAlerts = alerts.filter(a => a.status === "Resolved").length;
    const criticalAlerts = alerts.filter(a => ["high","critical"].includes((a.severity||"").toLowerCase())).length;
    const newTickets = tickets.filter(t => (t.status||"").toLowerCase() === "new").length;
    const inProgressTickets = tickets.filter(t => (t.status||"").toLowerCase() === "in progress").length;
    const closedTickets = tickets.filter(t => (t.status||"").toLowerCase() === "closed").length;

    // Chart data
    const alertStatusData = [
        { name: "Active", value: activeAlerts, fill: "#c92a2a" },
        { name: "Resolved", value: resolvedAlerts, fill: "#2b9348" },
    ].filter(d => d.value > 0);

    const ticketSeverityData = [
        { name: "High", value: tickets.filter(t => (t.severity||"").toLowerCase() === "high").length, fill: "#c92a2a" },
        { name: "Critical", value: tickets.filter(t => (t.severity||"").toLowerCase() === "critical").length, fill: "#862e2e" },
        { name: "Medium", value: tickets.filter(t => (t.severity||"").toLowerCase() === "medium").length, fill: "#e67700" },
        { name: "Low", value: tickets.filter(t => (t.severity||"").toLowerCase() === "low").length, fill: "#2b9348" },
    ].filter(d => d.value > 0);

    const ticketStatusData = [
        { name: "New", value: newTickets },
        { name: "In Progress", value: inProgressTickets },
        { name: "Closed", value: closedTickets },
    ];

    // Alerts over time (group by date)
    const alertsByDate = alerts.reduce((acc, a) => {
        const date = (a.created_at || "").slice(0, 10);
        if (!date) return acc;
        acc[date] = (acc[date] || 0) + 1;
        return acc;
    }, {});
    const alertTimeData = Object.entries(alertsByDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-7)
        .map(([date, count]) => ({ date: date.slice(5), count }));

    const sVariant = (s) => {
        const v = (s || "").toLowerCase();
        return v === "high" || v === "critical" ? "red" : v === "medium" ? "amber" : "green";
    };
    const tVariant = (s) => {
        const v = (s || "").toLowerCase();
        return v === "new" ? "blue" : v === "in progress" ? "amber" : v === "closed" ? "green" : "gray";
    };



    if (loading) return (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 24 }}>
            <Spinner /> <span style={{ color: "var(--text2)", fontSize: 13 }}>Loading dashboard…</span>
        </div>
    );

    return (
        <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4 }}>Dashboard</div>
            <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>Overview of your cloud operations</div>

            {/* Summary Cards */}
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Alerts</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
                {[
                    { label: "Total Alerts", value: alerts.length, color: "var(--text)" },
                    { label: "Active", value: activeAlerts, color: "var(--red)" },
                    { label: "Resolved", value: resolvedAlerts, color: "var(--green)" },
                    { label: "High / Critical", value: criticalAlerts, color: "var(--amber)" },
                ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, borderLeft: `4px solid ${color}` }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{label}</div>
                        <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
                    </div>
                ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Tickets</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
                {[
                    { label: "Total Tickets", value: tickets.length, color: "var(--text)" },
                    { label: "New", value: newTickets, color: "var(--accent)" },
                    { label: "In Progress", value: inProgressTickets, color: "var(--amber)" },
                    { label: "Closed", value: closedTickets, color: "var(--green)" },
                ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, borderLeft: `4px solid ${color}` }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{label}</div>
                        <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>

                {/* Alert Status Pie Chart */}
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Alert Status</div>
                    {alertStatusData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie data={alertStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                                    {alertStatusData.map((entry, index) => (
                                        <Cell key={index} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ textAlign: "center", padding: 40, color: "var(--text3)", fontSize: 13 }}>No alerts</div>
                    )}
                </div>

                {/* Ticket Severity Bar Chart */}
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Tickets by Severity</div>
                    {ticketSeverityData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={ticketSeverityData}>
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                    {ticketSeverityData.map((entry, index) => (
                                        <Cell key={index} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ textAlign: "center", padding: 40, color: "var(--text3)", fontSize: 13 }}>No tickets</div>
                    )}
                </div>

                {/* Ticket Status Bar Chart */}
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Tickets by Status</div>
                    {tickets.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={ticketStatusData}>
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ textAlign: "center", padding: 40, color: "var(--text3)", fontSize: 13 }}>No tickets</div>
                    )}
                </div>
            </div>

            {/* Alerts over time */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Alerts Over Time</div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 16 }}>Last 7 days</div>
                {alertTimeData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={alertTimeData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="alertGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b5bdb" stopOpacity={0.15}/>
                                    <stop offset="95%" stopColor="#3b5bdb" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: "var(--text3)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                            <Line type="monotone" dataKey="count" stroke="#3b5bdb" strokeWidth={2.5} dot={{ r: 5, fill: "#3b5bdb", strokeWidth: 2, stroke: "white" }} activeDot={{ r: 7 }} />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text3)", fontSize: 13 }}>
                        No alert data available yet
                    </div>
                )}
            </div>

            {/* Recent Alerts & Tickets */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <Card title="Recent Alerts">
                    <DataTable
                        columns={["Title", "Severity", "Status"]}
                        rows={alerts.slice(0, 5).map((a) => [
                            <span style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", display: "block", fontSize: 12 }}>{a.title || "—"}</span>,
                            <Badge text={a.severity || "—"} variant={sVariant(a.severity)} />,
                            <Badge text={a.status || "Active"} variant={a.status === "Active" ? "red" : "green"} />,
                        ])}
                        empty="No alerts"
                    />
                </Card>
                <Card title="Recent Tickets">
                    <DataTable
                        columns={["Title", "Status", "Severity"]}
                        rows={tickets.slice(0, 5).map((t) => [
                            <span style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", display: "block", fontSize: 12 }}>{t.title || "—"}</span>,
                            <Badge text={t.status || "New"} variant={tVariant(t.status)} />,
                            <Badge text={t.severity || "—"} variant={sVariant(t.severity)} />,
                        ])}
                        empty="No tickets"
                    />
                </Card>
            </div>
        </div>
    );
};

// ── Alerts Section ────────────────────────────────────────────────────────────────//

const AlertsSection = ({ accountId }) => {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [severityFilter, setSeverityFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    const loadAlerts = useCallback(async () => {
        setLoading(true); setError("");
        try {
            if (!accountId) {
                setAlerts([]);
                setLoading(false);
                return;
            }
            const res = await fetch(`${BACKEND}/api/alerts?account_id=${accountId}`);
            const json = await res.json();
            setAlerts(json.alerts || []);
        } catch (e) {
            setError(`Failed to load alerts: ${e.message}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadAlerts(); }, [loadAlerts]);

    const sVariant = (s) => {
        const v = (s || "").toLowerCase();
        return v === "high" || v === "critical" ? "red" : v === "medium" ? "amber" : "green";
    };

    const stVariant = (s) => {
        const v = (s || "").toLowerCase();
        return v === "active" ? "red" : v === "resolved" ? "green" : "gray";
    };

    const filtered = alerts.filter((a) => {
        const q = search.toLowerCase();
        if (q && ![(a.alert_id), a.title, a.description].some((f) => (f || "").toLowerCase().includes(q))) return false;
        if (severityFilter && (a.severity || "").toLowerCase() !== severityFilter.toLowerCase()) return false;
        if (statusFilter && (a.status || "").toLowerCase() !== statusFilter.toLowerCase()) return false;
        return true;
    });

    return (
        <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                    <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4 }}>Alerts</div>
                    <div style={{ fontSize: 13, color: "var(--text2)" }}>{alerts.length} alerts</div>
                </div>
                <button className="btn btn-sm" onClick={loadAlerts}>↺ Refresh</button>
            </div>

            {loading && <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 24 }}><Spinner /> <span style={{ color: "var(--text2)", fontSize: 13 }}>Loading alerts…</span></div>}
            {error && <div style={{ background: "var(--red-bg)", border: "1px solid rgba(201,42,42,0.2)", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "var(--red)", marginBottom: 16 }}>⚠ {error}</div>}

            {!loading && (
                <>
                    <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                        <input className="form-input" placeholder="Search alerts…"
                               style={{ maxWidth: 280, padding: "7px 12px", fontSize: 13 }}
                               value={search} onChange={(e) => setSearch(e.target.value)} />
                        <select className="form-input" style={{ maxWidth: 140, padding: "7px 12px", fontSize: 13 }}
                                value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
                            <option value="">All Severity</option>
                            {["High","Medium","Low","Critical"].map((s) => <option key={s}>{s}</option>)}
                        </select>
                        <select className="form-input" style={{ maxWidth: 140, padding: "7px 12px", fontSize: 13 }}
                                value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="">All Status</option>
                            {["Active","Resolved"].map((s) => <option key={s}>{s}</option>)}
                        </select>
                    </div>
                    <Card title={`Alerts (${filtered.length})`}>
                        <DataTable
                            columns={["Alert ID","Title","Severity","Status","Category","Source","Timestamp","Actions"]}
                            rows={filtered.map((a) => [
                                <Mono>{a.alert_id}</Mono>,
                                <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{a.title || "—"}</span>,
                                <Badge text={a.severity || "—"} variant={sVariant(a.severity)} />,
                                <Badge text={a.status || "Active"} variant={stVariant(a.status)} />,
                                a.category || "—",
                                a.source || "—",
                                <span style={{ fontSize: 11 }}>{(a.timestamp || "").slice(0, 19).replace("T", " ")}</span>,
                                a.status === "Active" ? (
                                    <button
                                        className="btn btn-sm"
                                        style={{ fontSize: 11, color: "var(--green)", borderColor: "var(--green)" }}
                                        onClick={async () => {
                                            try {
                                                await fetch(`${BACKEND}/api/alerts/resolve`, {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({ alert_id: a.alert_id }),
                                                });
                                                loadAlerts();
                                            } catch (e) {
                                                console.error("Resolve failed:", e);
                                            }
                                        }}
                                    >
                                        ✓ Resolve
                                    </button>
                                ) : <Badge text="Resolved" variant="green" />,
                            ])}
                            empty="No alerts found"
                        />
                    </Card>
                </>
            )}
        </div>
    );
};

// ── Tickets Section ────────────────────────────────────────────────────────────
const TicketsSection = ({ accountId }) => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [severityFilter, setSeverityFilter] = useState("");
    const [selected, setSelected] = useState(null);

    const loadTickets = useCallback(async () => {
        setLoading(true); setError("");
        try {
            if (!accountId) {
                setTickets([]);
                setLoading(false);
                return;
            }
            const res = await fetch(`${BACKEND}/api/tickets?account_id=${accountId}`);
            const json = await res.json();
            setTickets(json.tickets || []);
        } catch (e) {
            setError(`Failed to load tickets: ${e.message}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadTickets(); }, [loadTickets]);

    const tVariant = (s) => {
        const v = (s || "").toLowerCase();
        return v === "new" ? "blue" : v === "in progress" ? "amber" : v === "closed" ? "green" : "gray";
    };
    const sVariant = (s) => {
        const v = (s || "").toLowerCase();
        return v === "high" || v === "critical" ? "red" : v === "medium" ? "amber" : "green";
    };

    const filtered = tickets.filter((t) => {
        const q = search.toLowerCase();
        if (q && ![(t.ticket_id || t.id), t.title, t.description].some((f) => (f || "").toLowerCase().includes(q))) return false;
        if (statusFilter && (t.status || "").toLowerCase() !== statusFilter.toLowerCase()) return false;
        if (severityFilter && (t.severity || "").toLowerCase() !== severityFilter.toLowerCase()) return false;
        return true;
    }).sort((a, b) => {
        const tA = new Date(a.updated_at || a.timestamp || "").getTime();
        const tB = new Date(b.updated_at || b.timestamp || "").getTime();
        const validA = !isNaN(tA) && tA > 0;
        const validB = !isNaN(tB) && tB > 0;
        if (validA && validB) return tB - tA;
        if (validA) return -1;
        if (validB) return 1;
        return 0;
    });

    if (selected) return <TicketDetail ticket={selected} tickets={tickets} setTickets={setTickets} onBack={() => setSelected(null)} tVariant={tVariant} sVariant={sVariant} />;

    return (
        <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                    <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4 }}>Tickets</div>
                    <div style={{ fontSize: 13, color: "var(--text2)" }}>{tickets.length} tickets</div>
                </div>
                <button className="btn btn-sm" onClick={loadTickets}>↺ Refresh</button>
            </div>

            {loading && <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 24 }}><Spinner /> <span style={{ color: "var(--text2)", fontSize: 13 }}>Loading tickets…</span></div>}
            {error && <div style={{ background: "var(--red-bg)", border: "1px solid rgba(201,42,42,0.2)", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "var(--red)", marginBottom: 16 }}>⚠ {error}</div>}

            {!loading && (
                <>
                    <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                        <input className="form-input" placeholder="Search by ID or description…"
                               style={{ maxWidth: 280, padding: "7px 12px", fontSize: 13 }}
                               value={search} onChange={(e) => setSearch(e.target.value)} />
                        <select className="form-input" style={{ maxWidth: 140, padding: "7px 12px", fontSize: 13 }}
                                value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="">All Status</option>
                            {["New","In Progress","Closed"].map((s) => <option key={s}>{s}</option>)}
                        </select>
                        <select className="form-input" style={{ maxWidth: 140, padding: "7px 12px", fontSize: 13 }}
                                value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
                            <option value="">All Severity</option>
                            {["High","Medium","Low"].map((s) => <option key={s}>{s}</option>)}
                        </select>
                    </div>
                    <Card title={`Tickets (${filtered.length})`}>
                        <DataTable
                            columns={["Ticket ID","Title","Status","Severity","Category","Timestamp","Actions"]}
                            rows={filtered.map((t) => [
                                <Mono>{t.ticket_id || t.id}</Mono>,
                                <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{t.title || "—"}</span>,
                                <Badge text={t.status || "New"} variant={tVariant(t.status)} />,
                                <Badge text={t.severity || "—"} variant={sVariant(t.severity)} />,
                                t.category || "—",
                                <span style={{ fontSize: 11 }}>{(t.timestamp || "").slice(0, 19).replace("T", " ")}</span>,
                                <button className="btn btn-sm" onClick={() => setSelected(t)}>View</button>,
                            ])}
                            empty="No tickets found"
                        />
                    </Card>
                </>
            )}
        </div>
    );
};

const TicketDetail = ({ ticket: t, tickets, setTickets, onBack, tVariant, sVariant }) => {
    const [status, setStatus] = useState(t.status || "New");
    const [severity, setSeverity] = useState(t.severity || "Low");
    const [category, setCategory] = useState(t.category || "Other");
    const [notes, setNotes] = useState(t.notes || "");
    const [saveState, setSaveState] = useState("");
    const [confirmDelete, setConfirmDelete] = useState(false);

    const save = async () => {
        setSaveState("saving");
        try {
            const res = await fetch(`${BACKEND}/api/tickets/update`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ticket_id: t.ticket_id || t.id,
                    status,
                    severity,
                    category,
                    notes
                }),
            });

            const text = await res.text();
            console.log("Response:", res.status, text);

            if (!res.ok) throw new Error("Request failed");

            setTickets((prev) =>
                prev.map((tk) =>
                    (tk.ticket_id || tk.id) === (t.ticket_id || t.id)
                        ? { ...tk, status, severity, category, notes }
                        : tk
                )
            );

            setSaveState("saved");

        } catch (err) {
            console.error("Save error:", err);
            setSaveState("error");
        }
    };

    return (
        <div style={{ maxWidth: 720 }}>
            <button className="btn btn-sm" onClick={onBack} style={{ marginBottom: 16 }}>← Back to Tickets</button>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div>
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}><Mono>{t.ticket_id || t.id}</Mono></div>
                    <div style={{ fontSize: 13, color: "var(--text2)" }}>Created: {(t.timestamp || "").slice(0, 19).replace("T", " ")}</div>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    <Badge text={t.status || "New"} variant={tVariant(t.status)} />
                    <Badge text={t.severity || "—"} variant={sVariant(t.severity)} />
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16 }}>
                <div>
                    {t.alert_id && (
                        <Card title="Linked Alert">
                            <div style={{ padding: 18, display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 13, color: "var(--text2)" }}>This ticket was created from alert:</span>
                                <Mono>{t.alert_id}</Mono>
                            </div>
                        </Card>
                    )}
                    <Card title="Title"><div style={{ padding: 18, fontSize: 14, fontWeight: 500 }}>{t.title || "—"}</div></Card>
                    <Card title="Description"><div style={{ padding: 18, fontSize: 13, color: "var(--text2)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{t.description || "—"}</div></Card>
                    <Card title="Resolution Notes">
                        <div style={{ padding: 18 }}>
                            <textarea className="form-input" rows={5} placeholder="Add resolution notes…"
                                      style={{ resize: "vertical", fontFamily: "var(--font)", fontSize: 13, width: "100%" }}
                                      value={notes} onChange={(e) => setNotes(e.target.value)} />
                        </div>
                    </Card>
                </div>
                <div>
                    <Card title="Actions">
                        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                            {[
                                { label: "Status", value: status, set: setStatus, opts: ["New","In Progress","Closed"] },
                                { label: "Severity", value: severity, set: setSeverity, opts: ["Low","Medium","High","Critical"] },
                                { label: "Category", value: category, set: setCategory, opts: ["Infrastructure","Network","Database","Other"] },
                            ].map(({ label, value, set, opts }) => (
                                <div key={label}>
                                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</label>
                                    <select className="form-input" style={{ fontSize: 13, padding: "8px 12px" }} value={value} onChange={(e) => set(e.target.value)}>
                                        {opts.map((o) => <option key={o}>{o}</option>)}
                                    </select>
                                </div>
                            ))}


                            <button className="btn-primary" onClick={save}>Save Changes</button>
                            {saveState === "saving" && <div style={{ fontSize: 12, textAlign: "center", color: "var(--text3)" }}>Saving…</div>}
                            {saveState === "saved"  && <div style={{ fontSize: 12, textAlign: "center", color: "var(--green)" }}>✓ Saved successfully</div>}
                            {saveState === "error"  && <div style={{ fontSize: 12, textAlign: "center", color: "var(--red)" }}>✗ Save failed</div>}

                            {!confirmDelete ? (
                                <button
                                    onClick={() => setConfirmDelete(true)}
                                    style={{
                                        width: "100%", padding: "10px", background: "var(--red-bg)",
                                        border: "1px solid var(--red)", borderRadius: 8,
                                        color: "var(--red)", fontSize: 13, fontWeight: 600,
                                        cursor: "pointer", marginTop: 8,
                                    }}
                                >
                                    🗑 Delete Ticket
                                </button>
                            ) : (
                                <div style={{ marginTop: 8, background: "var(--red-bg)", border: "1px solid var(--red)", borderRadius: 8, padding: 12 }}>
                                    <div style={{ fontSize: 12, color: "var(--red)", fontWeight: 600, marginBottom: 8 }}>
                                        Are you sure you want to delete this ticket?
                                    </div>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const res = await fetch(`${BACKEND}/api/tickets/delete`, {
                                                        method: "POST",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({ ticket_id: t.ticket_id || t.id }),
                                                    });
                                                    if (res.ok) onBack();
                                                } catch (e) {
                                                    setConfirmDelete(false);
                                                }
                                            }}
                                            style={{ flex: 1, padding: "8px", background: "var(--red)", border: "none", borderRadius: 6, color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                                        >
                                            Yes, Delete
                                        </button>
                                        <button
                                            onClick={() => setConfirmDelete(false)}
                                            style={{ flex: 1, padding: "8px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};





// ── App Shell ─────────────────────────────────────────────────────────────────

const NAV_LABELS = {
    aws: {
        iam: { label: "IAM", icon: "👤" },
        s3: { label: "S3 Buckets", icon: "🗄" },
        route53: { label: "Route 53", icon: "🌐" },
        cloudfront: { label: "CloudFront", icon: "⚡" },
        regional: { label: "Regional Services", icon: "🗺" },
    },
    gcp: {
        iam: { label: "Cloud IAM", icon: "👤" },
        s3: { label: "Cloud Storage", icon: "🗄" },
        route53: { label: "Cloud DNS", icon: "🌐" },
        cloudfront: { label: "Cloud CDN", icon: "⚡" },
        regional: { label: "Compute Engine", icon: "🗺" },
    },
    azure: {
        iam: { label: "Active Directory", icon: "👤" },
        s3: { label: "Blob Storage", icon: "🗄" },
        route53: { label: "Azure DNS", icon: "🌐" },
        cloudfront: { label: "Azure CDN", icon: "⚡" },
        regional: { label: "Virtual Machines", icon: "🗺" },
    },
    default: {
        iam: { label: "Identity & Access", icon: "👤" },
        s3: { label: "Object Storage", icon: "🗄" },
        route53: { label: "DNS", icon: "🌐" },
        cloudfront: { label: "CDN", icon: "⚡" },
        regional: { label: "Compute & Network", icon: "🗺" },
    },
};

const getNavItems = (cloud) => {
    const labels = NAV_LABELS[cloud] || NAV_LABELS.default;
    return [
        { id: "dashboard",  label: "Dashboard",            icon: "📊", section: "Resources" },
        { id: "overview",   label: "Overview",             icon: "◻",  section: "Resources" },
        { id: "iam",        label: labels.iam.label,        icon: labels.iam.icon,         section: "Resources" },
        { id: "s3",         label: labels.s3.label,         icon: labels.s3.icon,          section: "Resources" },
        { id: "route53",    label: labels.route53.label,    icon: labels.route53.icon,     section: "Resources" },
        { id: "cloudfront", label: labels.cloudfront.label, icon: labels.cloudfront.icon,  section: "Resources" },
        { id: "regional",   label: labels.regional.label,   icon: labels.regional.icon,    section: "Resources" },
        { id: "alerts",     label: "Alerts",               icon: "🔔", section: "Operations" },
        { id: "tickets",    label: "Tickets",              icon: "🎫", section: "Operations" },
    ];
};


const AppShell = ({ awsData, scanMeta, accountId, selectedCloud, userEmail, initialSection, onNewScan, onSwitchCloud, onSignOut, onScanRegions, onSetSelectedCloud, onClearData }) => {
    const [section, setSection] = useState(() => {
        return localStorage.getItem('cloudops-section') || "overview";
    });
    const [appSection, setAppSection] = useState(initialSection || "main");
    const [sectionHistory, setSectionHistory] = useState([]);

    const navigateTo = (newSection) => {
        setSectionHistory(prev => [...prev, appSection]);
        setAppSection(newSection);
        window.history.pushState({ section: newSection }, "", `#${newSection}`);
    };

    const navigateBack = () => {
        if (sectionHistory.length > 0) {
            const previousSection = sectionHistory[sectionHistory.length - 1];
            setSectionHistory(history => history.slice(0, -1));
            setAppSection(previousSection);
            window.history.pushState({ section: previousSection }, "", `#${previousSection}`);
        } else {
            setAppSection("main");
            window.history.pushState({ section: "main" }, "", "#main");
        }
    };

    useEffect(() => {
        const handlePopState = (event) => {
            if (event.state?.section) {
                setAppSection(event.state.section);
            } else {
                setAppSection("main");
            }
        };
        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    useEffect(() => {
        if (initialSection && initialSection !== "main") {
            setAppSection(initialSection);
        }
    }, [initialSection]);

    const [activeAlertCount, setActiveAlertCount] = useState(0);
    const [newTicketCount, setNewTicketCount] = useState(0);
    useEffect(() => {
        const fetchCounts = async () => {
            try {
                if (!accountId) {
                    setActiveAlertCount(0);
                    setNewTicketCount(0);
                    return;
                }
                const alertRes = await fetch(`${BACKEND}/api/alerts?account_id=${accountId}`);
                const alertJson = await alertRes.json();
                const active = (alertJson.alerts || []).filter(a => a.status === "Active").length;
                setActiveAlertCount(active);

                const ticketRes = await fetch(`${BACKEND}/api/tickets?account_id=${accountId}`);
                const ticketJson = await ticketRes.json();
                const newTickets = (ticketJson.tickets || []).filter(t => (t.status || "").toLowerCase() === "new").length;
                setNewTicketCount(newTickets);
            } catch (e) {
                console.error("Failed to fetch counts:", e);
            }
        };
        fetchCounts();
        const interval = setInterval(fetchCounts, 30000);
        return () => clearInterval(interval);
    }, [accountId]);

    const renderContent = () => {
        // Inner app pages
        if (appSection === "cloudSelect") return <CloudSelectPage
            onSelectCloud={(cloud) => {
                if (cloud === "aws") {
                    onClearData();
                    onSetSelectedCloud("aws");
                    navigateTo("accountSelection");
                }
            }}
            onBack={() => {
                if (accountId) {
                    onSetSelectedCloud("aws");
                }
                navigateBack();
            }}
            onSignOut={onSignOut}
            userEmail={userEmail}
        />;
        if (appSection === "editCredentials") return <EditCredentialsPage userEmail={userEmail} onSave={navigateBack} onBack={navigateBack} />;
        if (appSection === "setupGuide") return <SetupGuidePage onContinue={() => navigateTo("scan")} onBack={navigateBack} />;
        if (appSection === "scan") return <ScanForm onCredentialsSaved={() => navigateTo("accountSelection")} />;
        if (appSection === "accountSelection") return <AccountSelectionPage
            onSelectAccount={async (acc) => {
                const email = localStorage.getItem('cloudops-userEmail');
                const token = localStorage.getItem('cloudops-auth-token');
                try {
                    const res = await fetch(`${BACKEND}/api/auth/get-account-credentials`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                        body: JSON.stringify({ accessKey: acc.accessKey }),
                    });
                    const json = await res.json();
                    if (json.accessKey && json.secretKey) {
                        localStorage.setItem(`cloudops-credentials-${email}`, JSON.stringify({
                            accessKey: json.accessKey,
                            secretKey: json.secretKey,
                        }));
                    }
                } catch (e) {
                    console.error("Failed to fetch account credentials:", e);
                }
                navigateTo("regionSelection");
            }}
            onAddNew={() => navigateTo("setupGuide")}
            onBack={navigateBack}
        />;
        if (appSection === "regionSelection") return <RegionSelectionPage
            onScanRegions={async (regions) => {
                await onScanRegions(regions);
                setAppSection("main");
                setSection("overview");
            }}
            onBack={navigateBack}
            userEmail={userEmail}
        />;

        // Main sections
        if (!accountId && ["dashboard", "overview", "iam", "s3", "route53", "cloudfront", "regional"].includes(section)) {
            return (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 16 }}>
                    <div style={{ fontSize: 48 }}>☁</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>No cloud data yet</div>
                    <div style={{ fontSize: 13, color: "var(--text2)", textAlign: "center" }}>
                        Connect a cloud provider and run a scan to see your resources here.
                    </div>
                    <button
                        className="btn-primary"
                        style={{ width: "auto", padding: "10px 24px", marginTop: 8 }}
                        onClick={() => navigateTo("cloudSelect")}
                    >
                        Select Your Cloud →
                    </button>
                </div>
            );
        }
        switch (section) {
            case "dashboard":   return <DashboardSection awsData={awsData} accountId={accountId} />;
            case "overview":    return <Overview awsData={awsData} scanMeta={scanMeta} />;
            case "iam":         return <IAMSection awsData={awsData} />;
            case "s3":          return <S3Section awsData={awsData} />;
            case "route53":     return <Route53Section awsData={awsData} />;
            case "cloudfront":  return <CloudFrontSection awsData={awsData} />;
            case "regional":    return <RegionalSection awsData={awsData} />;
            case "alerts":      return <AlertsSection accountId={accountId} />;
            case "tickets":     return <TicketsSection accountId={accountId} />;
            default:            return null;
        }
    };

    const NAV_ITEMS = getNavItems(selectedCloud || "default");
    const sectionTitle = NAV_ITEMS.find((n) => n.id === section)?.label || "Overview";

    return (
        <div style={{ display: "flex", minHeight: "100vh" }}>
            <nav style={{
                width: 220, minHeight: "100vh", background: "var(--surface)",
                borderRight: "1px solid var(--border)", display: "flex",
                flexDirection: "column", position: "sticky", top: 0, height: "100vh",
                overflowY: "auto", flexShrink: 0,
            }}>
                <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <div style={{ width: 28, height: 28, background: "var(--accent)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em" }}>CloudOps</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "var(--accent-bg)", borderRadius: 6, fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" /></svg>
                        Cloud Provider
                    </div>
                </div>

                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Account ID</div>
                    <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text2)" }}>{accountId || "Not connected"}</div>
                    {scanMeta && <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>{scanMeta.duration}s · {scanMeta.region}</div>}
                </div>

                <div style={{ padding: "8px", flex: 1 }}>
                    {["Resources", "Operations"].map((sectionName) => (
                        <div key={sectionName}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "12px 8px 6px" }}>{sectionName}</div>
                            {NAV_ITEMS.filter((n) => n.section === sectionName).map((nav) => (
                                <button key={nav.id}
                                        onClick={() => {
                                            setSection(nav.id);
                                            localStorage.setItem('cloudops-section', nav.id);
                                            setAppSection("main");
                                            setSectionHistory([]);
                                        }}
                                        style={{
                                            display: "flex", alignItems: "center", gap: 8,
                                            padding: "8px 10px", borderRadius: 6, cursor: "pointer",
                                            fontSize: 13, width: "100%", textAlign: "left",
                                            border: "none", fontFamily: "inherit",
                                            background: section === nav.id ? "var(--accent-bg)" : "transparent",
                                            color: section === nav.id ? "var(--accent)" : "var(--text2)",
                                            fontWeight: section === nav.id ? 500 : 400,
                                        }}>
                                    <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>{nav.icon}</span>
                                    {nav.label}
                                    {nav.id === "alerts" && activeAlertCount > 0 && (
                                                <span style={{
                                                    marginLeft: "auto",
                                                    background: "var(--red)",
                                                    color: "white",
                                                    borderRadius: 20,
                                                    fontSize: 10,
                                                    fontWeight: 700,
                                                    padding: "1px 6px",
                                                    minWidth: 18,
                                                    textAlign: "center",
                                                }}>
                                                    {activeAlertCount}
                                                </span>
                                            )}
                                            {nav.id === "tickets" && newTicketCount > 0 && (
                                                <span style={{
                                                    marginLeft: "auto",
                                                    background: "var(--red)",
                                                    color: "white",
                                                    borderRadius: 20,
                                                    fontSize: 10,
                                                    fontWeight: 700,
                                                    padding: "1px 6px",
                                                    minWidth: 18,
                                                    textAlign: "center",
                                                }}>
                                                    {newTicketCount}
                                                </span>
                                            )}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>

                <div style={{ padding: "8px 8px 0" }}>
                    <button
                        onClick={() => navigateTo("editCredentials")}
                        style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "8px 10px", borderRadius: 6, cursor: "pointer",
                            fontSize: 13, width: "100%", textAlign: "left",
                            border: "none", background: "transparent",
                            color: "var(--text2)", fontFamily: "inherit",
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = "var(--surface2)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                        <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>⚙</span>
                        Edit Credentials
                    </button>
                </div>

                <div style={{ padding: "12px 8px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 4 }}>
                    <button onClick={() => { onSwitchCloud(); navigateTo("cloudSelect"); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, cursor: "pointer", fontSize: 13, width: "100%", textAlign: "left", border: "none", background: "transparent", color: "var(--text2)", fontFamily: "inherit" }}
                            onMouseEnter={e => e.currentTarget.style.background = "var(--surface2)"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                        <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>☁</span> Switch Provider
                    </button>
                    <button onClick={onSignOut} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, cursor: "pointer", fontSize: 13, width: "100%", textAlign: "left", border: "none", background: "transparent", color: "var(--red)", fontFamily: "inherit" }}
                        onMouseEnter={e => e.currentTarget.style.background = "var(--red-bg)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                        <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>→</span> Sign Out
                    </button>
                </div>
            </nav>

            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                <div style={{ height: 52, background: "var(--surface)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "0 24px", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>{sectionTitle}</span>
                    <button className="btn btn-sm" onClick={() => { onNewScan(); navigateTo("regionSelection"); }}>↺ New Scan</button>
                </div>
                <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
    const [page, setPage] = useState(() => {
        const token = localStorage.getItem('cloudops-auth-token');
        if (!token) return "landing";
        try {
            if (token.includes('.')) {
                const parts = token.split('.');
                if (parts.length !== 3) return "landing";
            } else {
                const tokenData = atob(token);
                if (!tokenData.includes(':')) return "landing";
            }
        } catch (e) {
            return "landing";
        }
        return "app";
    });
    const [awsData, setAwsData] = useState(null);
    const [scanMeta, setScanMeta] = useState(null);
    const [accountId, setAccountId] = useState("");
    const [userEmail, setUserEmail] = useState(() => {
        return localStorage.getItem('cloudops-userEmail') || "";
    });
    const [selectedCloud, setSelectedCloud] = useState("");
    const [cloudAppSection, setCloudAppSection] = useState("main");

    // Clear all stale cloud data on app start
    localStorage.removeItem('cloudops-awsData');
    localStorage.removeItem('cloudops-scanMeta');
    localStorage.removeItem('cloudops-accountId');
    localStorage.removeItem('cloudops-selectedCloud');

    useEffect(() => {
        localStorage.setItem('cloudops-page', page);
    }, [page]);



    useEffect(() => {
        localStorage.setItem('cloudops-userEmail', userEmail);
    }, [userEmail]);



    // FIX #1: handleLogin previously referenced undefined `body` variable.
    // The fetch to /api/scan was nonsensical here (login ≠ scan).
    // Corrected to use the auth/login endpoint with a properly constructed body,
    // with correct fallback to demo credentials.
    const handleLogin = async (email, password) => {
        if (!email || !password) {
            throw new Error("Please enter email and password.");
        }

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);

            const res = await fetch(
                "https://cloudops-backend-venkatesh-cgfqcdffc8bhh9cd.eastus-01.azurewebsites.net/api/auth/login",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password }),
                    signal: controller.signal,
                }
            ).finally(() => clearTimeout(timeout));

            const result = await res.json();

            if (!res.ok || result.error) {
                throw new Error(result.error || "Invalid email or password.");
            }

            localStorage.setItem('cloudops-auth-token', result.token);
            localStorage.setItem('cloudops-userEmail', email);
            localStorage.setItem('cloudops-isNewUser', result.isNewUser ? 'true' : 'false');

            // Clear all old data
            localStorage.removeItem('cloudops-accountId');
            localStorage.removeItem('cloudops-awsData');
            localStorage.removeItem('cloudops-scanMeta');
            localStorage.removeItem('cloudops-section');
            localStorage.removeItem('cloudops-registeredUsers');
            // Clear all user specific cached data
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith('cloudops-awsData-') ||
                    key.startsWith('cloudops-scanMeta-') ||
                    key.startsWith('cloudops-accountId-')) {
                    localStorage.removeItem(key);
                }
            });
            setAccountId("");
            setAwsData(null);
            setScanMeta(null);

            // Load AWS credentials from database
            try {
                const credsRes = await fetch(`${BACKEND}/api/auth/get-credentials`, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${result.token}`
                    },
                });
                const credsJson = await credsRes.json();
                if (credsJson.accessKey && credsJson.secretKey) {
                    localStorage.setItem(`cloudops-credentials-${email}`, JSON.stringify({
                        accessKey: credsJson.accessKey,
                        secretKey: credsJson.secretKey
                    }));
                    localStorage.setItem('cloudops-isNewUser', 'false');
                }
            } catch (e) {
                console.error("Failed to load credentials from DB:", e);
            }

            setUserEmail(email);
            setPage("app");

        } catch (error) {
            throw new Error("Invalid email or password. If you are a new user, please register.");
        }
    };

    const handleRegister = async (email, password) => {
        try {
            const res = await fetch(
                "https://cloudops-backend-venkatesh-cgfqcdffc8bhh9cd.eastus-01.azurewebsites.net/api/auth/register",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password }),
                }
            );
            const result = await res.json();
            if (!res.ok || result.error) {
                throw new Error(result.error || "Registration failed.");
            }
            localStorage.setItem('cloudops-auth-token', result.token);
            localStorage.setItem('cloudops-userEmail', email);
            localStorage.setItem('cloudops-isNewUser', 'true');
            setUserEmail(email);
            setPage("app");
        } catch (error) {
            throw new Error(error.message || "Registration failed.");
        }
    };

    // FIX #4: handleLogout read cloudops-userEmail AFTER removing it.
    // Capture email first, then clear storage.
    const handleLogout = () => {
        const currentEmail = localStorage.getItem('cloudops-userEmail');

        localStorage.removeItem('cloudops-auth-token');
        localStorage.removeItem('cloudops-userEmail');
        localStorage.removeItem('cloudops-page');
        localStorage.removeItem('cloudops-awsData');
        localStorage.removeItem('cloudops-scanMeta');
        localStorage.removeItem('cloudops-accountId');
        localStorage.removeItem('cloudops-isNewUser');
        localStorage.removeItem('cloudops-selectedCloud');

        if (currentEmail) {
            localStorage.removeItem(`cloudops-awsData-${currentEmail}`);
            localStorage.removeItem(`cloudops-scanMeta-${currentEmail}`);
            localStorage.removeItem(`cloudops-accountId-${currentEmail}`);
        }

        setUserEmail("");
        setAwsData(null);
        setScanMeta(null);
        setAccountId("");
        setPage("login");
        setSelectedCloud("");
    };

    // Async scan with polling — avoids Azure 230s timeout
    const handleScanRegions = async (regions) => {
        const start = Date.now();
        const BACKEND = "https://cloudops-backend-venkatesh-cgfqcdffc8bhh9cd.eastus-01.azurewebsites.net";

        setAwsData(null);
        setScanMeta(null);
        setAccountId("");

        try {
            const email = localStorage.getItem('cloudops-userEmail');
            const savedCredentials = JSON.parse(localStorage.getItem(`cloudops-credentials-${email}`) || '{}');

            if (!savedCredentials.accessKey || !savedCredentials.secretKey) {
                localStorage.setItem('cloudops-isNewUser', 'true');
                setPage("scan");
                return;
            }

            // Step 1: Start the scan — backend returns job_id immediately
            const startRes = await fetch(`${BACKEND}/api/scan`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    accessKey: savedCredentials.accessKey,
                    secretKey: savedCredentials.secretKey,
                    regions,
                }),
            });

            const startJson = await startRes.json();
            if (startJson.error) throw new Error(startJson.error);

            const jobId = startJson.job_id;
            if (!jobId) throw new Error("No job ID returned from server.");

            // Step 2: Poll every 5 seconds until done (max 15 minutes)
            const MAX_WAIT_MS = 15 * 60 * 1000;
            const POLL_INTERVAL_MS = 5000;
            const deadline = Date.now() + MAX_WAIT_MS;

            while (Date.now() < deadline) {
                await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

                const pollRes = await fetch(`${BACKEND}/api/scan/status/${jobId}`);
                const pollJson = await pollRes.json();

                if (pollJson.status === "running") {
                    continue; // still working, keep polling
                }

                if (pollJson.status === "error") {
                    throw new Error(pollJson.error || "Scan failed on server.");
                }

                if (pollJson.status === "done") {
                    const json = pollJson.result;
                    if (json.error) throw new Error(json.error);

                    const meta = {
                        duration: ((Date.now() - start) / 1000).toFixed(1),
                        region: regions.join(', '),
                    };

                    if (email) {
                        localStorage.setItem(`cloudops-awsData-${email}`, JSON.stringify(json));
                        localStorage.setItem(`cloudops-scanMeta-${email}`, JSON.stringify(meta));
                    }

                    setAwsData(json);
                    setScanMeta(meta);
                    const aid = json.identity?.account_id || "";
                    setAccountId(aid);
                    localStorage.setItem('cloudops-accountId', aid);
                    return;
                }
            }

            throw new Error("Scan timed out after 15 minutes. Try selecting fewer regions.");

        } catch (err) {
            console.error(err);
            throw new Error(err.message || "Failed to scan regions.");
        }
    };

    const handleScanComplete = (data, meta) => {
        const email = localStorage.getItem('cloudops-userEmail');
        setAwsData(data);
        setScanMeta(meta);
        setAccountId(data.identity?.account_id || "—");
        if (email) {
            localStorage.setItem(`cloudops-awsData-${email}`, JSON.stringify(data));
            localStorage.setItem('cloudops-isNewUser', 'false');
        }
        setPage("app");
    };

    return (
        <>
            <style>{`
              :root {
                --bg: #f5f6fa; --surface: #ffffff; --surface2: #f0f1f7;
                --border: #e2e4ed; --border2: #d0d3e0;
                --text: #0f1117; --text2: #4a5070; --text3: #8890aa;
                --accent: #3b5bdb; --accent2: #2f4ac0; --accent-bg: #eef2ff;
                --green: #2b9348; --green-bg: #e8f5ed;
                --red: #c92a2a; --red-bg: #fff0f0;
                --amber: #e67700; --amber-bg: #fff8e6;
                --font: system-ui, -apple-system, sans-serif;
              }
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: var(--font); background: var(--bg); color: var(--text); font-size: 14px; line-height: 1.5; }
              @keyframes spin { to { transform: rotate(360deg); } }
              .btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; font-family: var(--font); font-size: 12px; font-weight: 500; color: var(--text2); cursor: pointer; transition: all 0.15s; }
              .btn:hover { border-color: var(--border2); color: var(--text); }
              .btn-sm { padding: 4px 10px; font-size: 11px; }
              .btn-primary { width: 100%; padding: 11px; background: var(--accent); color: #fff; border: none; border-radius: 8px; font-family: var(--font); font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 8px; }
              .btn-primary:hover { background: var(--accent2); }
              .form-input { width: 100%; padding: 10px 14px; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; font-family: var(--font); font-size: 14px; color: var(--text); outline: none; }
              .form-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(59,91,219,0.12); }
              ::-webkit-scrollbar { width: 6px; height: 6px; }
              ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }
            `}</style>

            {(page === "landing" || page === "login" || page === "register") && (
                <LandingPage
                    onLogin={() => setPage("login")}
                    onRegister={() => setPage("register")}
                    activePage={page}
                    handleLogin={handleLogin}
                    handleRegister={handleRegister}
                    setPage={setPage}
                />
            )}





            {page === "app" && (
                <AppShell
                    awsData={awsData}
                    scanMeta={scanMeta}
                    accountId={accountId}
                    selectedCloud={selectedCloud}
                    userEmail={userEmail}
                    initialSection={cloudAppSection}
                    onScanRegions={handleScanRegions}
                    onNewScan={() => {
                        setAwsData(null);
                        setScanMeta(null);
                        setAccountId("");
                        setSelectedCloud("");
                        localStorage.removeItem('cloudops-accountId');
                        localStorage.removeItem('cloudops-selectedCloud');
                    }}
                    onSwitchCloud={() => {}}
                    onSignOut={handleLogout}
                    onSetSelectedCloud={setSelectedCloud}
                    onClearData={() => {
                        setAwsData(null);
                        setScanMeta(null);
                        setAccountId("");
                        setSelectedCloud("");
                        localStorage.removeItem('cloudops-accountId');
                        localStorage.removeItem('cloudops-selectedCloud');
                    }}
                />
            )}
        </>
    );
}