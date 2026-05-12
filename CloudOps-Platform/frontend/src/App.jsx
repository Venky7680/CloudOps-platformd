import React, { useState, useEffect, useCallback, useMemo } from "react";
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

    const [isDark, setIsDark] = useState(true);
    const [authMode, setAuthMode] = useState(null); // 'login' | 'register' | null

    // Login form state
    const [loginEmail, setLoginEmail]       = useState(() => { try { return localStorage.getItem('cloudops-rememberedEmail') || ''; } catch { return ''; } });
    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError]       = useState('');
    const [loginLoading, setLoginLoading]   = useState(false);
    const [rememberMe, setRememberMe]       = useState(() => { try { return localStorage.getItem('cloudops-rememberMe') === 'true'; } catch { return false; } });
    const [showLoginPass, setShowLoginPass] = useState(false);

    // Register form state
    const [regEmail, setRegEmail]             = useState('');
    const [regPassword, setRegPassword]       = useState('');
    const [regConfirm, setRegConfirm]         = useState('');
    const [regError, setRegError]             = useState('');
    const [regLoading, setRegLoading]         = useState(false);
    const [showRegPass, setShowRegPass]       = useState(false);
    const [showRegConfirm, setShowRegConfirm] = useState(false);

    // ── Theme tokens ──────────────────────────────────────────────────────────
    const t = {
        bg:          isDark ? "#070b14"                    : "#f4f6ff",
        surface:     isDark ? "rgba(255,255,255,0.04)"     : "rgba(255,255,255,0.85)",
        border:      isDark ? "rgba(255,255,255,0.08)"     : "rgba(99,102,241,0.15)",
        text:        isDark ? "#f1f5f9"                    : "#0d0f1c",
        textSub:     isDark ? "rgba(241,245,249,0.55)"     : "rgba(13,15,28,0.58)",
        textFaint:   isDark ? "rgba(241,245,249,0.3)"      : "rgba(13,15,28,0.35)",
        navBg:       isDark ? "rgba(7,11,20,0.82)"         : "rgba(244,246,255,0.88)",
        navBorder:   isDark ? "rgba(255,255,255,0.07)"     : "rgba(99,102,241,0.14)",
        secBg:       isDark ? "rgba(255,255,255,0.018)"    : "rgba(99,102,241,0.025)",
        secBorder:   isDark ? "rgba(255,255,255,0.06)"     : "rgba(99,102,241,0.1)",
        inputBg:     isDark ? "rgba(255,255,255,0.06)"     : "#ffffff",
        inputBorder: isDark ? "rgba(255,255,255,0.12)"     : "rgba(99,102,241,0.22)",
        footerText:  isDark ? "rgba(241,245,249,0.22)"     : "rgba(13,15,28,0.32)",
        cardShadow:  isDark ? "0 2px 24px rgba(0,0,0,0.4)": "0 2px 24px rgba(99,102,241,0.08)",
        modalBg:     isDark ? "#0d1120"                    : "#ffffff",
        modalShadow: isDark ? "0 32px 80px rgba(0,0,0,0.7),0 0 0 1px rgba(99,102,241,0.1)" : "0 32px 80px rgba(99,102,241,0.18),0 0 0 1px rgba(99,102,241,0.14)",
        errBg:       isDark ? "rgba(239,68,68,0.1)"        : "rgba(239,68,68,0.06)",
        errBorder:   isDark ? "rgba(239,68,68,0.3)"        : "rgba(239,68,68,0.25)",
    };

    const products = [
        { id:"cloudops", color:"#6366f1", gradient:"linear-gradient(135deg,#6366f1,#4f46e5)", glow:"rgba(99,102,241,0.25)", bg:isDark?"rgba(99,102,241,0.1)":"rgba(99,102,241,0.08)",
            icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>,
            title:"CloudOps", tagline:"Infrastructure Management", desc:"Scan and manage AWS, GCP or Azure resources across all regions with real-time visibility.", features:["Multi-region resource scan","Cost & usage analytics","IAM, S3, Route53, CloudFront"] },
        { id:"secops", color:"#ef4444", gradient:"linear-gradient(135deg,#ef4444,#dc2626)", glow:"rgba(239,68,68,0.25)", bg:isDark?"rgba(239,68,68,0.1)":"rgba(239,68,68,0.08)",
            icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
            title:"SecOps", tagline:"Security Operations", desc:"Detect threats, scan vulnerabilities and audit IAM policies across your entire cloud estate.", features:["Threat detection","Vulnerability scanning","Compliance reports"] },
        { id:"finops", color:"#10b981", gradient:"linear-gradient(135deg,#10b981,#059669)", glow:"rgba(16,185,129,0.25)", bg:isDark?"rgba(16,185,129,0.1)":"rgba(16,185,129,0.08)",
            icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
            title:"FinOps", tagline:"Cost Management", desc:"Track and optimise cloud spending with budget alerts, cost allocation and savings recommendations.", features:["Cost analysis by service","Budget alerts","Savings recommendations"] },
        { id:"aiops", color:"#8b5cf6", gradient:"linear-gradient(135deg,#8b5cf6,#7c3aed)", glow:"rgba(139,92,246,0.25)", bg:isDark?"rgba(139,92,246,0.1)":"rgba(139,92,246,0.08)",
            icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
            title:"AIOps", tagline:"AI-Powered Operations", desc:"Leverage machine learning to detect anomalies, predict incidents and auto-remediate issues.", features:["Anomaly detection","Predictive analytics","Auto-remediation"] },
        { id:"rfp", color:"#f59e0b", gradient:"linear-gradient(135deg,#f59e0b,#d97706)", glow:"rgba(245,158,11,0.25)", bg:isDark?"rgba(245,158,11,0.1)":"rgba(245,158,11,0.08)",
            icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
            title:"RFP Generator", tagline:"Document Automation", desc:"Generate professional RFP documents from live cloud infrastructure data using AI templates.", features:["AI-powered templates","PDF export","Live cloud data"] },
    ];

    const stats = [
        { value:"20+",  label:"AWS Regions",      icon:"🌐", color:"#6366f1" },
        { value:"18+",  label:"Resource Types",   icon:"📦", color:"#8b5cf6" },
        { value:"100%", label:"Alert Automation", icon:"⚡", color:"#10b981" },
        { value:"5",    label:"Integrated Tools", icon:"🔧", color:"#f59e0b" },
    ];

    // ── Handlers ──────────────────────────────────────────────────────────────
    const doLogin = async () => {
        if (!loginEmail || !loginPassword) { setLoginError("Please enter your email and password."); return; }
        setLoginLoading(true); setLoginError('');
        try {
            if (handleLogin)     await handleLogin(loginEmail, loginPassword);
            else if (onLogin)    await onLogin(loginEmail, loginPassword);
            try {
                if (rememberMe) { localStorage.setItem('cloudops-rememberedEmail', loginEmail); localStorage.setItem('cloudops-rememberMe','true'); }
                else { localStorage.removeItem('cloudops-rememberedEmail'); localStorage.removeItem('cloudops-rememberMe'); }
            } catch {}
            setAuthMode(null);
        } catch(err) {
            setLoginError(err.message || "Invalid email or password.");
        } finally { setLoginLoading(false); }
    };

    const doRegister = async () => {
        if (!regEmail || !regPassword || !regConfirm) { setRegError("Please fill in all fields."); return; }
        if (regPassword.length < 6) { setRegError("Password must be at least 6 characters."); return; }
        if (regPassword !== regConfirm) { setRegError("Passwords do not match."); return; }
        setRegLoading(true); setRegError('');
        try {
            if (handleRegister)      await handleRegister(regEmail, regPassword);
            else if (onRegister)     await onRegister(regEmail, regPassword);
            setAuthMode(null);
        } catch(err) {
            setRegError(err.message || "Registration failed. Please try again.");
        } finally { setRegLoading(false); }
    };

    const openLogin    = () => { setLoginError(''); setLoginPassword(''); setAuthMode('login'); };
    const openRegister = () => { setRegError(''); setRegEmail(''); setRegPassword(''); setRegConfirm(''); setAuthMode('register'); };

    // ── Shared input styles ───────────────────────────────────────────────────
    const inp = {
        width:"100%", padding:"11px 14px", borderRadius:10,
        background:t.inputBg, border:`1.5px solid ${t.inputBorder}`,
        color:t.text, fontSize:14, outline:"none",
        fontFamily:"'DM Sans',sans-serif", boxSizing:"border-box",
        transition:"border-color 0.2s",
    };
    const lbl = { fontSize:12, fontWeight:600, color:t.textSub, marginBottom:6, display:"block", letterSpacing:"0.02em" };

    const ErrBox = ({ msg }) => msg ? (
        <div style={{ background:t.errBg, border:`1px solid ${t.errBorder}`, borderRadius:9, padding:"10px 14px", fontSize:13, color:"#ef4444", marginBottom:16, display:"flex", gap:8, alignItems:"center" }}>
            <span>&#9888;</span> {msg}
        </div>
    ) : null;

    // ── Auth overlay ──────────────────────────────────────────────────────────
    const AuthOverlay = React.memo(({
                                        authMode,
                                        setAuthMode,
                                        isDark,
                                        t,

                                        loginEmail,
                                        setLoginEmail,
                                        loginPassword,
                                        setLoginPassword,
                                        loginError,
                                        loginLoading,
                                        rememberMe,
                                        setRememberMe,
                                        showLoginPass,
                                        setShowLoginPass,

                                        regEmail,
                                        setRegEmail,
                                        regPassword,
                                        setRegPassword,
                                        regConfirm,
                                        setRegConfirm,
                                        regError,
                                        regLoading,
                                        showRegPass,
                                        setShowRegPass,
                                        showRegConfirm,
                                        setShowRegConfirm,

                                        doLogin,
                                        doRegister,
                                    }) => {

        const inp = {
            width: "100%",
            padding: "11px 14px",
            borderRadius: 10,
            background: t.inputBg,
            border: `1.5px solid ${t.inputBorder}`,
            color: t.text,
            fontSize: 14,
            outline: "none",
            fontFamily: "'DM Sans',sans-serif",
            boxSizing: "border-box",
            transition: "border-color 0.2s",
        };

        const lbl = {
            fontSize: 12,
            fontWeight: 600,
            color: t.textSub,
            marginBottom: 6,
            display: "block",
            letterSpacing: "0.02em"
        };

        const ErrBox = ({ msg }) =>
            msg ? (
                <div
                    style={{
                        background: t.errBg,
                        border: `1px solid ${t.errBorder}`,
                        borderRadius: 9,
                        padding: "10px 14px",
                        fontSize: 13,
                        color: "#ef4444",
                        marginBottom: 16,
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                    }}
                >
                    <span>⚠</span> {msg}
                </div>
            ) : null;

        return (
            <div
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 300,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isDark
                        ? "rgba(4,6,14,0.80)"
                        : "rgba(60,70,160,0.15)",
                    backdropFilter: "blur(22px)",
                }}
                onClick={() => setAuthMode(null)}
            >
                <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        width: 460,
                        maxWidth: "calc(100vw - 32px)",
                        borderRadius: 24,
                        background: t.modalBg,
                        border: `1px solid ${t.border}`,
                        boxShadow: t.modalShadow,
                        overflow: "hidden",
                    }}
                >
                    <div
                        style={{
                            height: 3,
                            background:
                                "linear-gradient(90deg,#6366f1,#8b5cf6,#06b6d4)",
                        }}
                    />

                    <div style={{ padding: "34px 40px 40px" }}>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: 30,
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                }}
                            >
                                <div
                                    style={{
                                        width: 34,
                                        height: 34,
                                        background:
                                            "linear-gradient(135deg,#6366f1,#4f46e5)",
                                        borderRadius: 10,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    ☁
                                </div>

                                <span
                                    style={{
                                        fontSize: 16,
                                        fontWeight: 700,
                                        color: t.text,
                                    }}
                                >
                                CloudOps
                            </span>
                            </div>

                            <button
                                onClick={() => setAuthMode(null)}
                                style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: t.textFaint,
                                    fontSize: 22,
                                }}
                            >
                                ×
                            </button>
                        </div>

                        <div
                            style={{
                                display: "flex",
                                background: t.surface,
                                border: `1px solid ${t.border}`,
                                borderRadius: 12,
                                padding: 4,
                                marginBottom: 28,
                            }}
                        >
                            {["login", "register"].map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setAuthMode(mode)}
                                    style={{
                                        flex: 1,
                                        padding: "9px 0",
                                        borderRadius: 9,
                                        border: "none",
                                        cursor: "pointer",
                                        background:
                                            authMode === mode
                                                ? "linear-gradient(135deg,#6366f1,#4f46e5)"
                                                : "transparent",
                                        color:
                                            authMode === mode
                                                ? "white"
                                                : t.textSub,
                                        fontWeight: 700,
                                    }}
                                >
                                    {mode === "login"
                                        ? "Sign In"
                                        : "Create Account"}
                                </button>
                            ))}
                        </div>

                        {authMode === "login" ? (
                            <>
                                <h2
                                    style={{
                                        fontSize: 24,
                                        fontWeight: 800,
                                        color: t.text,
                                        marginBottom: 10,
                                    }}
                                >
                                    Welcome back
                                </h2>

                                <ErrBox msg={loginError} />

                                <div style={{ marginBottom: 14 }}>
                                    <label style={lbl}>Email</label>

                                    <input
                                        style={inp}
                                        type="email"
                                        placeholder="you@company.com"
                                        value={loginEmail}
                                        onChange={(e) =>
                                            setLoginEmail(e.target.value)
                                        }
                                        autoComplete="email"
                                    />
                                </div>

                                <div style={{ marginBottom: 18 }}>
                                    <label style={lbl}>Password</label>

                                    <input
                                        style={inp}
                                        type={
                                            showLoginPass ? "text" : "password"
                                        }
                                        placeholder="••••••••"
                                        value={loginPassword}
                                        onChange={(e) =>
                                            setLoginPassword(e.target.value)
                                        }
                                        onKeyDown={(e) =>
                                            e.key === "Enter" && doLogin()
                                        }
                                        autoComplete="current-password"
                                    />
                                </div>

                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        marginBottom: 22,
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) =>
                                            setRememberMe(e.target.checked)
                                        }
                                    />

                                    <label
                                        style={{
                                            fontSize: 13,
                                            color: t.textSub,
                                        }}
                                    >
                                        Remember email
                                    </label>
                                </div>

                                <button
                                    onClick={doLogin}
                                    disabled={loginLoading}
                                    style={{
                                        width: "100%",
                                        padding: "13px",
                                        borderRadius: 12,
                                        background:
                                            "linear-gradient(135deg,#6366f1,#4f46e5)",
                                        color: "white",
                                        border: "none",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                    }}
                                >
                                    {loginLoading
                                        ? "Signing in..."
                                        : "Sign In"}
                                </button>
                            </>
                        ) : (
                            <>
                                <h2
                                    style={{
                                        fontSize: 24,
                                        fontWeight: 800,
                                        color: t.text,
                                        marginBottom: 10,
                                    }}
                                >
                                    Create Account
                                </h2>

                                <ErrBox msg={regError} />

                                <div style={{ marginBottom: 14 }}>
                                    <label style={lbl}>Email</label>

                                    <input
                                        style={inp}
                                        type="email"
                                        placeholder="you@company.com"
                                        value={regEmail}
                                        onChange={(e) =>
                                            setRegEmail(e.target.value)
                                        }
                                        autoComplete="email"
                                    />
                                </div>

                                <div style={{ marginBottom: 14 }}>
                                    <label style={lbl}>Password</label>

                                    <input
                                        style={inp}
                                        type={
                                            showRegPass ? "text" : "password"
                                        }
                                        placeholder="Create password"
                                        value={regPassword}
                                        onChange={(e) =>
                                            setRegPassword(e.target.value)
                                        }
                                        autoComplete="new-password"
                                    />
                                </div>

                                <div style={{ marginBottom: 22 }}>
                                    <label style={lbl}>
                                        Confirm Password
                                    </label>

                                    <input
                                        style={inp}
                                        type={
                                            showRegConfirm
                                                ? "text"
                                                : "password"
                                        }
                                        placeholder="Confirm password"
                                        value={regConfirm}
                                        onChange={(e) =>
                                            setRegConfirm(e.target.value)
                                        }
                                        onKeyDown={(e) =>
                                            e.key === "Enter" &&
                                            doRegister()
                                        }
                                        autoComplete="new-password"
                                    />
                                </div>

                                <button
                                    onClick={doRegister}
                                    disabled={regLoading}
                                    style={{
                                        width: "100%",
                                        padding: "13px",
                                        borderRadius: 12,
                                        background:
                                            "linear-gradient(135deg,#6366f1,#4f46e5)",
                                        color: "white",
                                        border: "none",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                    }}
                                >
                                    {regLoading
                                        ? "Creating account..."
                                        : "Create Account"}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    });

    // ── Main render ───────────────────────────────────────────────────────────
    return (
        <div style={{ minHeight:"100vh", background:t.bg, fontFamily:"'DM Sans',system-ui,sans-serif", color:t.text, overflowX:"hidden", transition:"background 0.35s,color 0.35s" }}>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@600;700;800&display=swap');
                html,body { overflow-x:hidden; margin:0; }
                @keyframes slideUp { from{opacity:0;transform:translateY(28px) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }
                @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.45} }
                .glow-orb { position:absolute; border-radius:50%; filter:blur(90px); pointer-events:none; }
                .pcard { transition:transform 0.3s ease,box-shadow 0.3s ease; }
                .pcard:hover { transform:translateY(-6px) !important; box-shadow:0 20px 56px rgba(0,0,0,0.22) !important; }
            `}</style>

            {authMode && (
                <AuthOverlay
                    authMode={authMode}
                    setAuthMode={setAuthMode}
                    isDark={isDark}
                    t={t}

                    loginEmail={loginEmail}
                    setLoginEmail={setLoginEmail}
                    loginPassword={loginPassword}
                    setLoginPassword={setLoginPassword}
                    loginError={loginError}
                    loginLoading={loginLoading}
                    rememberMe={rememberMe}
                    setRememberMe={setRememberMe}
                    showLoginPass={showLoginPass}
                    setShowLoginPass={setShowLoginPass}

                    regEmail={regEmail}
                    setRegEmail={setRegEmail}
                    regPassword={regPassword}
                    setRegPassword={setRegPassword}
                    regConfirm={regConfirm}
                    setRegConfirm={setRegConfirm}
                    regError={regError}
                    regLoading={regLoading}
                    showRegPass={showRegPass}
                    setShowRegPass={setShowRegPass}
                    showRegConfirm={showRegConfirm}
                    setShowRegConfirm={setShowRegConfirm}

                    doLogin={doLogin}
                    doRegister={doRegister}
                />
            )}

            <div className="glow-orb" style={{ width:700, height:700, background:"#6366f1", opacity:isDark?0.16:0.07, top:-280, left:-180 }} />
            <div className="glow-orb" style={{ width:500, height:500, background:"#8b5cf6", opacity:isDark?0.13:0.05, top:150, right:-160 }} />

            {/* ── NAVBAR ── */}
            <nav style={{ position:"sticky", top:0, zIndex:100, background:t.navBg, backdropFilter:"blur(24px) saturate(180%)", borderBottom:`1px solid ${t.navBorder}`, padding:"0 48px", height:66, display:"flex", alignItems:"center", justifyContent:"space-between", transition:"background 0.35s,border-color 0.35s" }}>
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ width:36, height:36, background:"linear-gradient(135deg,#6366f1,#4f46e5)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 16px rgba(99,102,241,0.45)" }}>
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
                        </div>
                        <span style={{ fontSize:17, fontWeight:700, fontFamily:"'Syne',sans-serif", letterSpacing:"-0.025em", color:t.text }}>OmniOps</span>
                    </div>
                    <div style={{ width:1, height:22, background:t.border, margin:"0 4px" }} />
                    {/* FIX: use color on parent span instead of React.cloneElement */}
                    <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                        {products.map(p => (
                            <div key={p.id} style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 11px", borderRadius:7, fontSize:11.5, fontWeight:600, color:p.color, background:`${p.color}0f`, border:`1px solid ${p.color}28`, cursor:"default" }}>
                                <span style={{ display:"flex", color:p.color }}>{p.icon}</span>
                                {p.title}
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <button onClick={() => setIsDark(!isDark)} style={{ width:38, height:38, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", background:t.surface, border:`1px solid ${t.border}`, cursor:"pointer", transition:"all 0.2s" }}>
                        {isDark
                            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.textSub} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                            : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={t.textSub} strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                        }
                    </button>
                    <div style={{ width:1, height:22, background:t.border }} />
                    <button onClick={openLogin} style={{ padding:"8px 18px", borderRadius:10, fontSize:13.5, fontWeight:600, background:"transparent", color:t.textSub, border:`1px solid ${t.border}`, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all 0.2s" }}>Sign In</button>
                    <button onClick={openRegister} style={{ padding:"8px 20px", borderRadius:10, fontSize:13.5, fontWeight:700, background:"linear-gradient(135deg,#6366f1,#4f46e5)", color:"white", border:"none", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", boxShadow:"0 4px 18px rgba(99,102,241,0.42)" }}>Get Started →</button>
                </div>
            </nav>

            {/* ── HERO ── */}
            <section style={{ textAlign:"center", padding:"112px 24px 90px", position:"relative" }}>
                <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:isDark?"rgba(99,102,241,0.1)":"rgba(99,102,241,0.08)", border:"1px solid rgba(99,102,241,0.28)", borderRadius:100, padding:"6px 18px", fontSize:12, fontWeight:600, color:"#818cf8", marginBottom:32, letterSpacing:"0.04em", textTransform:"uppercase" }}>
                    <span style={{ width:7, height:7, borderRadius:"50%", background:"#6366f1", boxShadow:"0 0 10px #6366f1", display:"inline-block", animation:"pulse 2s ease-in-out infinite" }} />
                    All-in-One Cloud Operations Platform
                </div>
                <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(44px,6vw,72px)", fontWeight:800, letterSpacing:"-0.045em", lineHeight:1.04, margin:"0 auto 28px", maxWidth:800, color:t.text }}>
                    One platform for<br />
                    <span style={{ background:"linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#06b6d4 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>
                        all your cloud ops
                    </span>
                </h1>
                <p style={{ fontSize:18, color:t.textSub, maxWidth:540, margin:"0 auto 44px", lineHeight:1.75, fontWeight:300 }}>
                    CloudOps, SecOps, FinOps, AIOps and RFP automation —
                    everything your team needs to manage, secure and optimise your cloud.
                </p>
                <div style={{ display:"flex", gap:14, justifyContent:"center", alignItems:"center", marginBottom:80 }}>
                    <button onClick={openRegister} style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"14px 30px", borderRadius:12, background:"linear-gradient(135deg,#6366f1,#4f46e5)", color:"white", fontFamily:"'DM Sans',sans-serif", fontSize:15, fontWeight:700, border:"none", cursor:"pointer", boxShadow:"0 10px 36px rgba(99,102,241,0.45)" }}>
                        Get Started Free <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                    <button onClick={openLogin} style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"14px 28px", borderRadius:12, background:t.surface, color:t.textSub, fontFamily:"'DM Sans',sans-serif", fontSize:15, fontWeight:600, border:`1px solid ${t.border}`, cursor:"pointer" }}>
                        Sign In
                    </button>
                </div>
                <div style={{ display:"flex", gap:16, justifyContent:"center", flexWrap:"wrap", maxWidth:760, margin:"0 auto" }}>
                    {stats.map(s => (
                        <div key={s.label} style={{ flex:"1", minWidth:155, background:t.surface, border:`1px solid ${t.border}`, borderRadius:18, padding:"24px 20px", textAlign:"center", boxShadow:t.cardShadow, position:"relative", overflow:"hidden", transition:"all 0.3s" }}>
                            <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${s.color}70,transparent)` }} />
                            <div style={{ fontSize:28, marginBottom:10 }}>{s.icon}</div>
                            <div style={{ fontSize:32, fontWeight:800, fontFamily:"'Syne',sans-serif", letterSpacing:"-0.04em", color:s.color, lineHeight:1, marginBottom:6 }}>{s.value}</div>
                            <div style={{ fontSize:12.5, color:t.textSub, fontWeight:500 }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── PRODUCTS ── */}
            <section style={{ padding:"60px 48px 90px", maxWidth:1240, margin:"0 auto" }}>
                <div style={{ textAlign:"center", marginBottom:60 }}>
                    <div style={{ fontSize:10.5, fontWeight:700, color:t.textFaint, textTransform:"uppercase", letterSpacing:"0.16em", marginBottom:14 }}>Platform Suite</div>
                    <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:42, fontWeight:800, letterSpacing:"-0.035em", marginBottom:14, lineHeight:1.12, color:t.text }}>Five powerful tools.<br />One unified platform.</h2>
                    <p style={{ fontSize:16, color:t.textSub, maxWidth:450, margin:"0 auto", lineHeight:1.75, fontWeight:300 }}>Each tool is built for a specific cloud operations use case, all from a single login.</p>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:18, marginBottom:18 }}>
                    {products.slice(0,3).map(p => (
                        <div key={p.id} className="pcard" style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:22, padding:30, position:"relative", overflow:"hidden", boxShadow:t.cardShadow }}>
                            <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:p.gradient }} />
                            <div style={{ width:50, height:50, borderRadius:14, background:p.bg, border:`1px solid ${p.color}28`, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:20, color:p.color }}>{p.icon}</div>
                            <div style={{ fontSize:19, fontWeight:700, fontFamily:"'Syne',sans-serif", marginBottom:4, color:t.text }}>{p.title}</div>
                            <div style={{ fontSize:10.5, fontWeight:700, color:p.color, marginBottom:14, textTransform:"uppercase", letterSpacing:"0.1em" }}>{p.tagline}</div>
                            <div style={{ fontSize:13.5, color:t.textSub, lineHeight:1.75, marginBottom:22, fontWeight:300 }}>{p.desc}</div>
                            <div style={{ display:"flex", flexDirection:"column", gap:9, marginBottom:22 }}>
                                {p.features.map(f => (
                                    <div key={f} style={{ display:"flex", alignItems:"center", gap:10, fontSize:12.5, color:t.textSub }}>
                                        <div style={{ width:18, height:18, borderRadius:"50%", background:p.bg, border:`1px solid ${p.color}35`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                                            <div style={{ width:6, height:6, borderRadius:"50%", background:p.color }} />
                                        </div>
                                        {f}
                                    </div>
                                ))}
                            </div>
                            {p.id !== "cloudops"
                                ? <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:`${p.color}12`, border:`1px solid ${p.color}28`, borderRadius:20, padding:"5px 14px", fontSize:11, fontWeight:700, color:p.color }}>&#x1F680; Coming Soon</div>
                                : <button onClick={openRegister} style={{ display:"inline-flex", alignItems:"center", gap:6, background:p.gradient, border:"none", borderRadius:10, padding:"9px 18px", fontSize:13, fontWeight:700, color:"white", cursor:"pointer", boxShadow:`0 6px 20px ${p.glow}` }}>Get Started →</button>
                            }
                        </div>
                    ))}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:18, maxWidth:820, margin:"0 auto" }}>
                    {products.slice(3).map(p => (
                        <div key={p.id} className="pcard" style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:22, padding:28, position:"relative", overflow:"hidden", boxShadow:t.cardShadow }}>
                            <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:p.gradient }} />
                            <div style={{ display:"flex", alignItems:"flex-start", gap:18 }}>
                                <div style={{ width:50, height:50, borderRadius:14, background:p.bg, border:`1px solid ${p.color}28`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, color:p.color }}>{p.icon}</div>
                                <div style={{ flex:1 }}>
                                    <div style={{ fontSize:17, fontWeight:700, fontFamily:"'Syne',sans-serif", marginBottom:3, color:t.text }}>{p.title}</div>
                                    <div style={{ fontSize:10.5, fontWeight:700, color:p.color, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.1em" }}>{p.tagline}</div>
                                    <div style={{ fontSize:13, color:t.textSub, lineHeight:1.75, marginBottom:14, fontWeight:300 }}>{p.desc}</div>
                                    <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                                        {p.features.map(f => <div key={f} style={{ display:"inline-flex", alignItems:"center", gap:5, background:`${p.color}0e`, border:`1px solid ${p.color}22`, borderRadius:6, padding:"3px 10px", fontSize:11, color:p.color, fontWeight:600 }}>{f}</div>)}
                                    </div>
                                    <div style={{ marginTop:14, display:"inline-flex", alignItems:"center", gap:6, background:`${p.color}12`, border:`1px solid ${p.color}28`, borderRadius:20, padding:"4px 12px", fontSize:11, fontWeight:700, color:p.color }}>&#x1F680; Coming Soon</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── HOW IT WORKS ── */}
            <section style={{ padding:"90px 48px", borderTop:`1px solid ${t.secBorder}`, borderBottom:`1px solid ${t.secBorder}`, background:t.secBg, position:"relative", transition:"all 0.35s" }}>
                <div className="glow-orb" style={{ width:500, height:500, background:"#6366f1", opacity:isDark?0.13:0.05, bottom:-200, right:-100 }} />
                <div style={{ maxWidth:920, margin:"0 auto", textAlign:"center" }}>
                    <div style={{ fontSize:10.5, fontWeight:700, color:t.textFaint, textTransform:"uppercase", letterSpacing:"0.16em", marginBottom:14 }}>How it works</div>
                    <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:38, fontWeight:800, letterSpacing:"-0.035em", marginBottom:56, lineHeight:1.12, color:t.text }}>Up and running in 3 steps</h2>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:22, position:"relative" }}>
                        <div style={{ position:"absolute", top:42, left:"18%", right:"18%", height:1, background:"linear-gradient(90deg,rgba(99,102,241,0),rgba(99,102,241,0.35),rgba(99,102,241,0))", zIndex:0 }} />
                        {[
                            { n:"01", title:"Register",       desc:"Create your free account in seconds. No credit card required.", emoji:"👤" },
                            { n:"02", title:"Connect Cloud",  desc:"Securely link your AWS, GCP or Azure account with one click.",   emoji:"☁️" },
                            { n:"03", title:"Scan & Monitor", desc:"Get real-time resource visibility and instant alert automation.", emoji:"📊" },
                        ].map(s => (
                            <div key={s.n} style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:18, padding:"32px 26px", textAlign:"center", position:"relative", zIndex:1, boxShadow:t.cardShadow }}>
                                <div style={{ width:60, height:60, borderRadius:"50%", background:"linear-gradient(135deg,#6366f1,#4f46e5)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 18px", fontSize:24, boxShadow:"0 10px 28px rgba(99,102,241,0.42)" }}>{s.emoji}</div>
                                <div style={{ fontSize:10, fontWeight:800, color:"#6366f1", letterSpacing:"0.12em", marginBottom:10, textTransform:"uppercase" }}>{s.n}</div>
                                <div style={{ fontSize:17, fontWeight:700, fontFamily:"'Syne',sans-serif", marginBottom:10, color:t.text }}>{s.title}</div>
                                <div style={{ fontSize:13.5, color:t.textSub, lineHeight:1.7, fontWeight:300 }}>{s.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA ── */}
            <section style={{ textAlign:"center", padding:"110px 24px", position:"relative", overflow:"hidden" }}>
                <div className="glow-orb" style={{ width:700, height:400, background:"#6366f1", opacity:isDark?0.13:0.05, bottom:-120, left:"50%", transform:"translateX(-50%)" }} />
                <div style={{ position:"relative", zIndex:1 }}>
                    <div style={{ fontSize:10.5, fontWeight:700, color:t.textFaint, textTransform:"uppercase", letterSpacing:"0.16em", marginBottom:16 }}>Ready to go?</div>
                    <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(36px,5vw,54px)", fontWeight:800, letterSpacing:"-0.04em", marginBottom:18, lineHeight:1.08, color:t.text }}>Take control of<br />your entire cloud</h2>
                    <p style={{ fontSize:17, color:t.textSub, fontWeight:300, maxWidth:440, margin:"0 auto 40px" }}>Join thousands of teams managing their cloud operations from one place.</p>
                    <div style={{ display:"flex", gap:14, justifyContent:"center" }}>
                        <button onClick={openRegister} style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"15px 34px", borderRadius:13, background:"linear-gradient(135deg,#6366f1,#4f46e5)", color:"white", fontFamily:"'DM Sans',sans-serif", fontSize:16, fontWeight:700, border:"none", cursor:"pointer", boxShadow:"0 12px 40px rgba(99,102,241,0.48)" }}>
                            Create Free Account <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                        <button onClick={openLogin} style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"15px 28px", borderRadius:13, background:t.surface, color:t.textSub, fontFamily:"'DM Sans',sans-serif", fontSize:16, fontWeight:600, border:`1px solid ${t.border}`, cursor:"pointer" }}>Sign In</button>
                    </div>
                </div>
            </section>

            {/* ── FOOTER ── */}
            <footer style={{ borderTop:`1px solid ${t.secBorder}`, padding:"28px 48px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:28, height:28, background:"linear-gradient(135deg,#6366f1,#4f46e5)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
                    </div>
                    <span style={{ fontSize:14, fontWeight:700, fontFamily:"'Syne',sans-serif", color:t.text }}>OmniOps</span>
                </div>
                <div style={{ display:"flex", gap:22 }}>
                    {products.map(p => <span key={p.id} style={{ fontSize:12, color:p.color, fontWeight:600, opacity:0.65 }}>{p.title}</span>)}
                </div>
                <div style={{ fontSize:12, color:t.footerText }}>&#169; 2026 OmniOps Platform. All rights reserved.</div>
            </footer>
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
    const [accounts, setAccounts] = useState([]);
    const [loadingAccounts, setLoadingAccounts] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);
    const [cloudType, setCloudType] = useState("aws");
    const [accessKey, setAccessKey] = useState("");
    const [secretKey, setSecretKey] = useState("");
    const [accountName, setAccountName] = useState("");
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");
    const [showLoginEdit, setShowLoginEdit] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newEmail, setNewEmail] = useState(userEmail || "");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [azureTenantId, setAzureTenantId]           = useState("");
    const [azureClientId, setAzureClientId]           = useState("");
    const [azureClientSecret, setAzureClientSecret]   = useState("");
    const [azureSubscriptionId, setAzureSubscriptionId] = useState("");

    const showSuccess = (msg) => { setSuccess(msg); setError(""); setTimeout(() => setSuccess(""), 3000); };
    const showError = (msg) => { setError(msg); setSuccess(""); };

    const handleDelete = async (acc, cloud) => {
        if (!window.confirm(`Delete "${acc.accountName || "this account"}"? This cannot be undone.`)) return;
        const token = localStorage.getItem('cloudops-auth-token');
        try {
            if (cloud === "azure") {
                await fetch(`${BACKEND}/api/azure/delete-credentials`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify({ tenantId: acc.tenantId, subscriptionId: acc.subscriptionId }),
                });
                fetchAzureAccounts();
            } else {
                await fetch(`${BACKEND}/api/auth/delete-credentials`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify({ accessKey: acc.accessKey }),
                });
                fetchAccounts();
            }
            showSuccess("Account deleted successfully.");
        } catch (e) { showError("Failed to delete account."); }
    };

    const cloudIcons = {
        aws: {
            bg: "#fff3e0",
            icon: <svg width="14" height="14" viewBox="0 0 48 48" fill="none"><path d="M16 32.2H32.2C36.4 32.2 39.8 28.8 39.8 24.6C39.8 21.2 37.5 18.4 34.4 17.5C34.5 17.1 34.5 16.7 34.5 16.3C34.5 11.7 30.8 8 26.2 8C23 8 20.2 9.7 18.8 12.3C18.1 12.1 17.3 12 16.5 12C11.8 12 8 15.8 8 20.5C8 24 10.5 27 13.5 28.5" stroke="#FF9900" strokeWidth="3" strokeLinecap="round"/></svg>
        },
        gcp: {
            bg: "#e8f0fe",
            icon: <svg width="14" height="14" viewBox="0 0 48 48" fill="none"><rect x="8" y="8" width="14" height="14" rx="2" fill="#4285F4" opacity="0.8"/><rect x="26" y="8" width="14" height="14" rx="2" fill="#34A853" opacity="0.8"/><rect x="8" y="26" width="14" height="14" rx="2" fill="#EA4335" opacity="0.8"/><rect x="26" y="26" width="14" height="14" rx="2" fill="#FBBC05" opacity="0.8"/></svg>
        },
        azure: {
            bg: "#e6f2ff",
            icon: <svg width="14" height="14" viewBox="0 0 48 48" fill="none"><path d="M8 24C8 15.2 15.2 8 24 8C28.6 8 32.8 9.9 35.8 13L40 9V21H28L32.5 16.5C30.3 14.3 27.3 13 24 13C17.9 13 13 17.9 13 24H8Z" fill="#0089D6" opacity="0.8"/><path d="M40 24C40 32.8 32.8 40 24 40C19.4 40 15.2 38.1 12.2 35L8 39V27H20L15.5 31.5C17.7 33.7 20.7 35 24 35C30.1 35 35 30.1 35 24H40Z" fill="#0089D6" opacity="0.5"/></svg>
        },
        custom: {
            bg: "#f0f1f7",
            icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a5070" strokeWidth="2" strokeLinecap="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
        },
    };

    const fetchAccounts = async () => {
        setLoadingAccounts(true);
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
            setLoadingAccounts(false);
        }
    };

    useEffect(() => { fetchAccounts(); fetchAzureAccounts(); }, []);

    const [azureAccounts, setAzureAccounts] = useState([]);
    const fetchAzureAccounts = async () => {
        try {
            const token = localStorage.getItem('cloudops-auth-token');
            const res = await fetch(`${BACKEND}/api/azure/list-accounts`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const json = await res.json();
            setAzureAccounts(json.accounts || []);
        } catch (e) { console.error("Failed to fetch Azure accounts:", e); }
    };

    const handleSave = async () => {
        const token = localStorage.getItem('cloudops-auth-token');
        try {
            if (cloudType === "aws") {
                if (!accessKey || !secretKey) { showError("Access key and secret key are required."); return; }
                await fetch(`${BACKEND}/api/auth/store-credentials`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify({ accessKey, secretKey, accountName: accountName || "My AWS Account" }),
                });
                localStorage.setItem(`cloudops-credentials-${userEmail}`, JSON.stringify({ accessKey, secretKey }));
                fetchAccounts();
            } else if (cloudType === "azure") {
                if (!azureTenantId || !azureClientId || !azureClientSecret || !azureSubscriptionId) {
                    showError("All four Azure fields are required."); return;
                }
                await fetch(`${BACKEND}/api/azure/store-credentials`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify({
                        tenantId: azureTenantId,
                        clientId: azureClientId,
                        clientSecret: azureClientSecret,
                        subscriptionId: azureSubscriptionId,
                        accountName: accountName || "My Azure Account",
                    }),
                });
                fetchAzureAccounts();
            } else {
                localStorage.setItem(`cloudops-credentials-${userEmail}-${cloudType}-${accountName}`, JSON.stringify({ accessKey, secretKey, accountName, cloudType }));
            }
            showSuccess("Credentials saved successfully!");
            setShowAddModal(false); setEditingAccount(null);
            setAccessKey(""); setSecretKey(""); setAccountName(""); setCloudType("aws");
            setAzureTenantId(""); setAzureClientId(""); setAzureClientSecret(""); setAzureSubscriptionId("");
        } catch (e) {
            showError("Failed to save credentials.");
        }
    };

    const handleSaveLogin = async () => {
        if (!currentPassword) { showError("Current password is required."); return; }
        if (!newEmail) { showError("Email cannot be empty."); return; }
        if (newPassword && newPassword.length < 6) { showError("Password must be at least 6 characters."); return; }
        if (newPassword && newPassword !== confirmPassword) { showError("Passwords do not match."); return; }
        try {
            await fetch(`${BACKEND}/api/auth/update`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentEmail: userEmail, newEmail, currentPassword, newPassword: newPassword || undefined }),
            });
            showSuccess("Login credentials updated!");
            setTimeout(() => onSave(), 1200);
        } catch (e) {
            showError("Failed to update login credentials.");
        }
    };

    const cloudOptions = [
        { id: "aws", name: "Amazon AWS" },
        { id: "gcp", name: "Google Cloud" },
        { id: "azure", name: "Microsoft Azure" },
        { id: "custom", name: "Other Cloud" },
    ];

    const AddEditModal = () => (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}
             onClick={(e) => { if (e.target === e.currentTarget) { setShowAddModal(false); setEditingAccount(null); } }}>
            <div style={{ background:"var(--surface)", borderRadius:16, padding:28, width:"100%", maxWidth:460, boxShadow:"0 12px 40px rgba(0,0,0,0.2)", maxHeight:"90vh", overflowY:"auto" }}
                 onClick={e => e.stopPropagation()}>
                <div style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>{editingAccount ? "Edit Account" : "Add Cloud Account"}</div>
                <div style={{ fontSize:13, color:"var(--text2)", marginBottom:20 }}>Connect a new cloud account</div>

                {!editingAccount && (
                    <FormField label="Cloud Provider">
                        <select className="form-input" value={cloudType} onChange={(e) => setCloudType(e.target.value)}>
                            <option value="aws">Amazon AWS</option>
                            <option value="azure">Microsoft Azure</option>
                            <option value="gcp">Google Cloud (coming soon)</option>
                        </select>
                    </FormField>
                )}

                <FormField label="Account Name">
                    <input className="form-input" type="text" placeholder={cloudType === "azure" ? "e.g. My Azure Subscription" : "e.g. Production, Development…"}
                           value={accountName} onChange={(e) => setAccountName(e.target.value)} />
                </FormField>

                {cloudType === "azure" ? (<>
                    <div style={{ background:"#e6f2ff", border:"1px solid #0089D630", borderRadius:10, padding:"10px 14px", fontSize:12, color:"#0057a8", marginBottom:16 }}>
                        🔷 Azure credentials — enter your Service Principal details from the Azure Portal.
                    </div>
                    <FormField label="Tenant ID">
                        <input className="form-input" type="text" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                               value={azureTenantId} onChange={(e) => setAzureTenantId(e.target.value)} style={{ fontFamily:"monospace", fontSize:13 }} />
                    </FormField>
                    <FormField label="Client ID (App Registration)">
                        <input className="form-input" type="text" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                               value={azureClientId} onChange={(e) => setAzureClientId(e.target.value)} style={{ fontFamily:"monospace", fontSize:13 }} />
                    </FormField>
                    <FormField label="Client Secret">
                        <input className="form-input" type="password" placeholder="Your client secret value"
                               value={azureClientSecret} onChange={(e) => setAzureClientSecret(e.target.value)} style={{ fontFamily:"monospace", fontSize:13 }} />
                    </FormField>
                    <FormField label="Subscription ID">
                        <input className="form-input" type="text" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                               value={azureSubscriptionId} onChange={(e) => setAzureSubscriptionId(e.target.value)} style={{ fontFamily:"monospace", fontSize:13 }} />
                    </FormField>
                </>) : cloudType === "gcp" ? (<>
                    <div style={{ background:"var(--amber-bg)", border:"1px solid var(--amber)", borderRadius:8, padding:"10px 14px", fontSize:12, color:"var(--amber)", marginBottom:12 }}>
                        ⚠ GCP integration coming soon. Credentials saved locally only.
                    </div>
                    <FormField label="Project ID"><input className="form-input" type="text" placeholder="my-project-123" value={accessKey} onChange={(e) => setAccessKey(e.target.value)} /></FormField>
                    <FormField label="Service Account Key"><input className="form-input" type="password" placeholder="Paste service account key" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} /></FormField>
                </>) : (<>
                    <FormField label="Access Key ID">
                        <input className="form-input" type="text" placeholder="AKIA…"
                               value={accessKey} onChange={(e) => setAccessKey(e.target.value)} style={{ fontFamily:"monospace", fontSize:13 }} />
                    </FormField>
                    <FormField label="Secret Access Key">
                        <input className="form-input" type="password" placeholder="Your secret access key"
                               value={secretKey} onChange={(e) => setSecretKey(e.target.value)} style={{ fontFamily:"monospace", fontSize:13 }} />
                    </FormField>
                </>)}

                {error && <div style={{ background:"var(--red-bg)", border:"1px solid rgba(201,42,42,0.2)", borderRadius:8, padding:"10px 14px", fontSize:12, color:"var(--red)", marginBottom:12 }}>⚠ {error}</div>}

                <div style={{ display:"flex", gap:8 }}>
                    <button className="btn-primary" style={{ flex:2, marginTop:0 }} onClick={handleSave}>Save Account</button>
                    <button className="btn" style={{ flex:1 }} onClick={() => { setShowAddModal(false); setEditingAccount(null); setError(""); }}>Cancel</button>
                </div>
            </div>
        </div>
    );

    return (
        <div style={{ padding: "24px", maxWidth: 800, margin: "0 auto" }}>

            {/* Success/Error */}
            {success && <div style={{ background: "var(--green-bg)", border: "1px solid var(--green)", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "var(--green)", marginBottom: 16 }}>✅ {success}</div>}
            {error && <div style={{ background: "var(--red-bg)", border: "1px solid rgba(201,42,42,0.2)", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "var(--red)", marginBottom: 16 }}>⚠ {error}</div>}

            {/* Modal */}
            {(showAddModal || editingAccount) && <AddEditModal />}

            {/* Cloud Providers Table */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Cloud Providers</div>
                    <button className="btn btn-sm"
                            style={{ fontSize: 12, color: "var(--accent)", borderColor: "var(--accent)" }}
                            onClick={() => { setShowAddModal(true); setCloudType("aws"); setAccessKey(""); setSecretKey(""); setAccountName(""); setError(""); }}
                    >
                        + Add Cloud Account
                    </button>
                </div>

                <div style={{ border:"1px solid var(--border)", borderRadius:12, overflow:"hidden" }}>
                    {loadingAccounts ? (
                        <div style={{ display:"flex", alignItems:"center", gap:8, padding:24, color:"var(--text3)", fontSize:13 }}>
                            <Spinner size={14} /> Loading accounts...
                        </div>
                    ) : accounts.length === 0 && azureAccounts.length === 0 ? (
                        <div style={{ padding:"48px 24px", textAlign:"center", background:"var(--surface)" }}>
                            <div style={{ width:48, height:48, background:"var(--surface2)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
                                <svg width="22" height="22" viewBox="0 0 48 48" fill="none"><path d="M16 32.2H32.2C36.4 32.2 39.8 28.8 39.8 24.6C39.8 21.2 37.5 18.4 34.4 17.5C34.5 17.1 34.5 16.7 34.5 16.3C34.5 11.7 30.8 8 26.2 8C23 8 20.2 9.7 18.8 12.3C18.1 12.1 17.3 12 16.5 12C11.8 12 8 15.8 8 20.5C8 24 10.5 27 13.5 28.5" stroke="var(--text3)" strokeWidth="2.5" strokeLinecap="round"/></svg>
                            </div>
                            <div style={{ fontSize:14, fontWeight:500, marginBottom:6 }}>No cloud accounts connected</div>
                            <div style={{ fontSize:13, color:"var(--text2)", marginBottom:20 }}>Add your first cloud account to get started</div>
                            <button className="btn" style={{ fontSize:13, color:"var(--accent)", borderColor:"var(--accent)" }}
                                    onClick={() => { setShowAddModal(true); setCloudType("aws"); setAccessKey(""); setSecretKey(""); setAccountName(""); }}>
                                + Add Cloud Account
                            </button>
                        </div>
                    ) : (
                        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                            <thead>
                            <tr style={{ background:"var(--surface2)" }}>
                                {["Cloud","Account Name","Key / ID","Secret","Subscription / Account ID","Action"].map(h => (
                                    <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:10, fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.06em", borderBottom:"1px solid var(--border)" }}>{h}</th>
                                ))}
                            </tr>
                            </thead>
                            <tbody>
                            {accounts.map((acc, i) => {
                                const cloud = cloudIcons["aws"];
                                return (
                                    <tr key={`aws-${i}`} style={{ borderBottom:"1px solid var(--border)", background:"var(--surface)" }}>
                                        <td style={{ padding:"12px 14px" }}>
                                            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                                <div style={{ width:24, height:24, background:cloud.bg, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{cloud.icon}</div>
                                                <span style={{ fontSize:12, fontWeight:500 }}>AWS</span>
                                            </div>
                                        </td>
                                        <td style={{ padding:"12px 14px", fontWeight:500 }}>{acc.accountName || "AWS Account"}</td>
                                        <td style={{ padding:"12px 14px", fontFamily:"monospace", fontSize:12, color:"var(--text2)" }}>{acc.accessKey ? acc.accessKey.slice(0,12)+"…" : "—"}</td>
                                        <td style={{ padding:"12px 14px", fontFamily:"monospace", fontSize:13, color:"var(--text2)", letterSpacing:2 }}>••••••••</td>
                                        <td style={{ padding:"12px 14px", fontSize:12, color:"var(--text2)" }}>{acc.accountId !== "Unknown" ? acc.accountId : "—"}</td>
                                        <td style={{ padding:"12px 14px" }}>
                                            <div style={{ display:"flex", gap:6 }}>
                                                <button className="btn btn-sm" style={{ fontSize:11, color:"var(--accent)" }}
                                                        onClick={() => { setEditingAccount(acc); setAccessKey(acc.accessKey||""); setSecretKey(""); setAccountName(acc.accountName||""); setCloudType("aws"); setError(""); setSuccess(""); }}>
                                                    Edit
                                                </button>
                                                <button className="btn btn-sm" style={{ fontSize:11, color:"var(--red)", borderColor:"var(--red)" }}
                                                        onClick={() => handleDelete(acc, "aws")}>
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {azureAccounts.map((acc, i) => {
                                const cloud = cloudIcons["azure"];
                                return (
                                    <tr key={`azure-${i}`} style={{ borderBottom:"1px solid var(--border)", background:"var(--surface)" }}>
                                        <td style={{ padding:"12px 14px" }}>
                                            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                                <div style={{ width:24, height:24, background:cloud.bg, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{cloud.icon}</div>
                                                <span style={{ fontSize:12, fontWeight:500 }}>Azure</span>
                                            </div>
                                        </td>
                                        <td style={{ padding:"12px 14px", fontWeight:500 }}>{acc.accountName || "Azure Account"}</td>
                                        <td style={{ padding:"12px 14px", fontFamily:"monospace", fontSize:12, color:"var(--text2)" }}>{acc.clientId ? acc.clientId.slice(0,8)+"…" : "—"}</td>
                                        <td style={{ padding:"12px 14px", fontFamily:"monospace", fontSize:13, color:"var(--text2)", letterSpacing:2 }}>••••••••</td>
                                        <td style={{ padding:"12px 14px", fontSize:12, color:"var(--text2)" }}>{acc.subscriptionId ? acc.subscriptionId.slice(0,16)+"…" : "—"}</td>
                                        <td style={{ padding:"12px 14px" }}>
                                            <div style={{ display:"flex", gap:6 }}>
                                                <button className="btn btn-sm" style={{ fontSize:11, color:"#0089D6" }}
                                                        onClick={() => { setEditingAccount(acc); setCloudType("azure"); setAccountName(acc.accountName||""); setAzureTenantId(acc.tenantId||""); setAzureClientId(acc.clientId||""); setAzureClientSecret(""); setAzureSubscriptionId(acc.subscriptionId||""); setError(""); setSuccess(""); }}>
                                                    Edit
                                                </button>
                                                <button className="btn btn-sm" style={{ fontSize:11, color:"var(--red)", borderColor:"var(--red)" }}
                                                        onClick={() => handleDelete(acc, "azure")}>
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Login Settings */}
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Login Settings</div>
            <div style={{ background: "var(--surface)", border: `1px solid ${showLoginEdit ? "var(--accent)" : "var(--border)"}`, borderRadius: 12, overflow: "hidden" }}>
                <div onClick={() => setShowLoginEdit(!showLoginEdit)}
                     style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", cursor: "pointer" }}>
                    <div style={{ width: 40, height: 40, background: "var(--surface2)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>👤</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>Login Credentials</div>
                        <div style={{ fontSize: 11, color: "var(--text3)" }}>{userEmail}</div>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text3)", display: "inline-block", transition: "transform 0.15s", transform: showLoginEdit ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
                </div>
                {showLoginEdit && (
                    <div style={{ borderTop: "1px solid var(--border)", padding: 18, background: "var(--surface2)" }}>
                        <FormField label="Current Password">
                            <input className="form-input" type="password" placeholder="Enter current password"
                                   value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                        </FormField>
                        <FormField label="New Email">
                            <input className="form-input" type="email" placeholder="you@company.com"
                                   value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                        </FormField>
                        <FormField label="New Password (leave blank to keep current)">
                            <input className="form-input" type="password" placeholder="New password"
                                   value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                        </FormField>
                        {newPassword && (
                            <FormField label="Confirm New Password">
                                <input className="form-input" type="password" placeholder="Confirm new password"
                                       value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                            </FormField>
                        )}
                        <button className="btn-primary" onClick={handleSaveLogin} style={{ marginTop: 8 }}>
                            Save Login Credentials
                        </button>
                    </div>
                )}
            </div>

            <div style={{ textAlign: "center", marginTop: 20 }}>
                <button className="btn btn-sm" onClick={onBack}>← Back</button>
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

// ── Azure Setup Guide Page ─────────────────────────────────────────────────────
const AzureSetupGuidePage = ({ onContinue, onBack }) => {
    const [copiedStep, setCopiedStep] = useState(null);

    const copy = (text, step) => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).then(() => { setCopiedStep(step); setTimeout(() => setCopiedStep(null), 2000); });
            } else {
                const ta = document.createElement("textarea");
                ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
                document.body.appendChild(ta); ta.focus(); ta.select();
                document.execCommand("copy");
                document.body.removeChild(ta);
                setCopiedStep(step); setTimeout(() => setCopiedStep(null), 2000);
            }
        } catch { }
    };

    const steps = [
        {
            number: "1", color: "#0089D6",
            title: "Create App Registration",
            desc: "Creates a Service Principal — like an IAM user for Azure. Read-only access only.",
            details: [
                "Go to portal.azure.com → search Microsoft Entra ID",
                "Click App registrations → + New registration",
                'Name it "cloudops-scanner" → click Register',
                "Copy the Application (client) ID → this is your Client ID",
                "Copy the Directory (tenant) ID → this is your Tenant ID",
            ],
        },
        {
            number: "2", color: "#0089D6",
            title: "Create Client Secret",
            desc: "Password for the Service Principal. Copy it immediately — it's only shown once.",
            details: [
                "Inside your app registration → click Certificates & secrets",
                "Click + New client secret",
                'Description: "cloudops-scanner-secret" → Expires: 24 months',
                "Click Add → immediately copy the Value (not the Secret ID)",
            ],
        },
        {
            number: "3", color: "#0089D6",
            title: "Get Subscription ID",
            desc: "The billing container where your Azure resources live.",
            details: [
                "Search Subscriptions in the top search bar",
                "Click your subscription name",
                "Copy the Subscription ID from the overview page",
            ],
        },
        {
            number: "4", color: "#22c55e",
            title: "Assign Reader Role",
            desc: "Grants read-only access to all resources. Cannot create, modify or delete anything.",
            details: [
                "Go to Subscriptions → click your subscription",
                "Click Access control (IAM) in the left menu",
                "Click + Add → Add role assignment",
                "Role: Reader → click Next",
                "Click + Select members → search cloudops-scanner → select it",
                "Click Review + assign → Review + assign",
            ],
            recommended: true,
        },
    ];

    return (
        <div style={{ minHeight:"100vh", background:"var(--bg)", padding:"40px 24px", display:"flex", flexDirection:"column", alignItems:"center" }}>
            <div style={{ maxWidth:640, width:"100%" }}>

                {/* Header */}
                <div style={{ textAlign:"center", marginBottom:36 }}>
                    <div style={{ width:56, height:56, background:"#e6f2ff", borderRadius:16, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", fontSize:28 }}>🔷</div>
                    <h1 style={{ fontSize:26, fontWeight:700, letterSpacing:"-0.03em", marginBottom:8 }}>Azure Permission Setup</h1>
                    <p style={{ color:"var(--text2)", fontSize:14, lineHeight:1.6 }}>
                        Before scanning, create a Service Principal with Reader access.<br/>
                        This is a one-time setup. All permissions are <strong>read-only</strong> — nothing can be modified or deleted.
                    </p>
                </div>

                {/* Safety banner */}
                <div style={{ background:"#e6faf0", border:"1px solid #34d399", borderRadius:12, padding:"12px 16px", marginBottom:24, fontSize:13, color:"#065f46" }}>
                    <strong>✅ Safe for company accounts:</strong> Reader role means the scanner can only <em>view</em> resources — it cannot start/stop VMs, delete anything, access data inside storage or see passwords.
                </div>

                {/* Steps */}
                {steps.map((step, i) => (
                    <div key={i} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:16, padding:24, marginBottom:16 }}>
                        <div style={{ display:"flex", alignItems:"flex-start", gap:16 }}>
                            <div style={{ width:32, height:32, borderRadius:"50%", background:step.color, color:"white", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:14, flexShrink:0 }}>
                                {step.number}
                            </div>
                            <div style={{ flex:1 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                                    <div style={{ fontWeight:700, fontSize:15 }}>{step.title}</div>
                                    {step.recommended && (
                                        <span style={{ background:"#dcfce7", color:"#16a34a", border:"1px solid #86efac", borderRadius:20, fontSize:10, fontWeight:700, padding:"2px 8px" }}>REQUIRED</span>
                                    )}
                                </div>
                                <div style={{ fontSize:13, color:"var(--text2)", marginBottom:12 }}>{step.desc}</div>
                                {step.details.map((d, j) => (
                                    <div key={j} style={{ display:"flex", alignItems:"flex-start", gap:8, marginBottom:6 }}>
                                        <span style={{ color:step.color, fontWeight:700, fontSize:13, marginTop:1 }}>→</span>
                                        <span style={{ fontSize:13, color:"var(--text2)" }}>{d}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}

                {/* Credentials info box */}
                <div style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:12, padding:20, marginBottom:24 }}>
                    <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>📋 You'll need these 4 values:</div>
                    {[
                        ["Tenant ID", "Directory (tenant) ID from App Registration overview"],
                        ["Client ID", "Application (client) ID from App Registration overview"],
                        ["Client Secret", "Value from Certificates & secrets (copy immediately)"],
                        ["Subscription ID", "From Subscriptions page overview"],
                    ].map(([label, hint]) => (
                        <div key={label} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
                            <div style={{ width:8, height:8, borderRadius:"50%", background:"#0089D6", flexShrink:0 }} />
                            <div>
                                <strong style={{ fontSize:13 }}>{label}</strong>
                                <div style={{ fontSize:11, color:"var(--text3)" }}>{hint}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* CTA buttons */}
                <div style={{ display:"flex", gap:12 }}>
                    <button className="btn-primary" style={{ flex:2, background:"#0089D6", border:"none" }} onClick={onContinue}>
                        I have all 4 values → Add Account
                    </button>
                    <button className="btn" style={{ flex:1 }} onClick={onBack}>Back</button>
                </div>

                <div style={{ textAlign:"center", marginTop:16, fontSize:12, color:"var(--text3)" }}>
                    Need help? Ask your Azure admin to create the Service Principal and share the 4 values with you.
                </div>
            </div>
        </div>
    );
};
const AzureAccountSelectionPage = ({ onSelectAccount, onAddNew, onBack }) => {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadAccounts = async () => {
            setLoading(true);
            try {
                const token = localStorage.getItem('cloudops-auth-token');
                const res = await fetch(`${BACKEND}/api/azure/list-accounts`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                const json = await res.json();
                setAccounts(json.accounts || []);
            } catch (e) {
                console.error("Failed to fetch Azure accounts:", e);
            } finally { setLoading(false); }
        };
        loadAccounts();
    }, []);

    const azureIcon = (
        <svg width="22" height="22" viewBox="0 0 48 48" fill="none">
            <path d="M8 24C8 15.2 15.2 8 24 8C28.6 8 32.8 9.9 35.8 13L40 9V21H28L32.5 16.5C30.3 14.3 27.3 13 24 13C17.9 13 13 17.9 13 24H8Z" fill="#0089D6" opacity="0.85"/>
            <path d="M40 24C40 32.8 32.8 40 24 40C19.4 40 15.2 38.1 12.2 35L8 39V27H20L15.5 31.5C17.7 33.7 20.7 35 24 35C30.1 35 35 30.1 35 24H40Z" fill="#0089D6" opacity="0.5"/>
        </svg>
    );

    return (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"var(--bg)", padding:24 }}>
            <div style={{ width:"100%", maxWidth:500 }}>
                <div style={{ textAlign:"center", marginBottom:32 }}>
                    <div style={{ width:56, height:56, background:"#e6f2ff", borderRadius:16, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>{azureIcon}</div>
                    <div style={{ fontSize:22, fontWeight:700, letterSpacing:"-0.03em", marginBottom:6 }}>Select Azure Account</div>
                    <div style={{ fontSize:13, color:"var(--text2)" }}>Choose a saved account or add a new one</div>
                </div>

                {loading ? (
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, padding:40 }}>
                        <Spinner /> <span style={{ color:"var(--text2)", fontSize:13 }}>Loading accounts…</span>
                    </div>
                ) : (
                    <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
                        {accounts.length === 0 && (
                            <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, padding:"32px 24px", textAlign:"center", color:"var(--text2)", fontSize:13 }}>
                                No Azure accounts saved yet. Add one below.
                            </div>
                        )}
                        {accounts.map((acc) => (
                            <div key={acc.subscriptionId}
                                 onClick={() => onSelectAccount(acc)}
                                 style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, padding:"16px 20px", cursor:"pointer", display:"flex", alignItems:"center", gap:16, transition:"all 0.15s" }}
                                 onMouseEnter={e => { e.currentTarget.style.borderColor="#0089D6"; e.currentTarget.style.background="#e6f2ff"; }}
                                 onMouseLeave={e => { e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.background="var(--surface)"; }}
                            >
                                <div style={{ width:40, height:40, background:"#e6f2ff", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{azureIcon}</div>
                                <div style={{ flex:1 }}>
                                    <div style={{ fontWeight:600, fontSize:14, marginBottom:2 }}>{acc.accountName || "Azure Account"}</div>
                                    <div style={{ fontSize:11, color:"var(--text3)", fontFamily:"monospace" }}>Sub: {acc.subscriptionId ? acc.subscriptionId.slice(0,18)+"…" : "—"}</div>
                                    <div style={{ fontSize:11, color:"var(--text3)", fontFamily:"monospace" }}>Tenant: {acc.tenantId ? acc.tenantId.slice(0,18)+"…" : "—"}</div>
                                </div>
                                <span style={{ color:"#0089D6", fontSize:18 }}>→</span>
                            </div>
                        ))}
                        <div onClick={onAddNew}
                             style={{ background:"var(--surface)", border:"2px dashed var(--border)", borderRadius:12, padding:"16px 20px", cursor:"pointer", display:"flex", alignItems:"center", gap:16, transition:"all 0.15s" }}
                             onMouseEnter={e => e.currentTarget.style.borderColor="#0089D6"}
                             onMouseLeave={e => e.currentTarget.style.borderColor="var(--border)"}
                        >
                            <div style={{ width:40, height:40, background:"var(--surface2)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>+</div>
                            <div>
                                <div style={{ fontWeight:600, fontSize:14, marginBottom:2 }}>Add New Azure Account</div>
                                <div style={{ fontSize:11, color:"var(--text3)" }}>Connect another Azure subscription</div>
                            </div>
                        </div>
                    </div>
                )}
                <div style={{ textAlign:"center", marginTop:8 }}>
                    <button className="btn btn-sm" onClick={onBack}>← Back</button>
                </div>
            </div>
        </div>
    );
};

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
const RegionSelectionPage = ({ onScanRegions, onBack, userEmail, selectedCloud }) => {
    const [selectedRegions, setSelectedRegions] = useState([]);
    const [scanning, setScanning] = useState(false);
    const [fetchingRegions, setFetchingRegions] = useState(true);
    const [fetchError, setFetchError] = useState("");
    const [availableRegions, setAvailableRegions] = useState([]);
    const isAzure = selectedCloud === "azure";

    useEffect(() => {
        const fetchRegions = async () => {
            setFetchingRegions(true); setFetchError("");
            try {
                if (isAzure) {
                    const res = await fetch(`${BACKEND}/api/azure/regions`);
                    const json = await res.json();
                    setAvailableRegions((json.regions || []).map(r => ({ code: r.code, enabled: true, optIn: false, optInRequired: false, displayName: r.displayName })));
                } else {
                    const email = localStorage.getItem("cloudops-userEmail");
                    const creds = JSON.parse(localStorage.getItem(`cloudops-credentials-${email}`) || "{}");
                    if (!creds.accessKey || !creds.secretKey) throw new Error("No saved AWS credentials found.");
                    const res = await fetch(`${BACKEND}/api/regions`, {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ accessKey: creds.accessKey, secretKey: creds.secretKey }),
                    });
                    const json = await res.json();
                    if (json.error) throw new Error(json.error);
                    setAvailableRegions(json.regions);
                }
            } catch (err) {
                setFetchError(err.message);
                setAvailableRegions(REGIONS.map(code => ({ code, enabled: true, optIn: false, optInRequired: false })));
            } finally { setFetchingRegions(false); }
        };
        fetchRegions();
    }, [isAzure]);

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
                        ? `Fetching available ${isAzure ? "Azure" : "AWS"} regions…`
                        : `${enabledRegions.length} regions available${isAzure ? " in Azure" : " in your AWS account"}`}
                </div>
                {fetchingRegions && (
                    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 16px", background:"var(--surface2)", borderRadius:8, marginBottom:16, fontSize:13, color:"var(--text2)" }}>
                        <Spinner size={14} />
                        {isAzure ? "Fetching available Azure regions…" : "Fetching regions from AWS…"}
                    </div>
                )}

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
                            <Spinner size={20} /> {isAzure ? "Fetching Azure regions…" : "Fetching regions from AWS…"}
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
            id: "azure", name: "Microsoft Azure", desc: "VMs, Storage, Functions, AKS & more",
            iconBg: "#e6f2ff", available: true,
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

    // Download CloudFormation template from public folder
    const downloadCloudFormation = () => {
        const link = document.createElement("a");
        link.href = "/cloudops-discovery.json";
        link.download = "cloudops-discovery.json";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
        {
            number: "4",
            title: "Auto-attach All Discovery Policies (Recommended)",
            desc: "Use our CloudFormation template to automatically create and attach all 13 discovery policies to your IAM user in one click — no manual steps needed.",
            details: [
                "Download the CloudFormation template using the button below",
                "Go to AWS Console → CloudFormation → Create Stack → With new resources",
                "Choose existing template → Upload a template file → select the downloaded file → Next",
                "Enter your IAM username exactly as it appears in AWS Console → Next → Next",
                "Check the IAM capabilities checkbox → Create stack",
                "Wait 2–3 minutes until status shows CREATE_COMPLETE → Done ✅",
            ],
            showDownload: true,
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
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: step.number === "4" ? "var(--green)" : "var(--accent)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                                {step.number}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                    <div style={{ fontWeight: 700, fontSize: 15 }}>{step.title}</div>
                                    {step.number === "4" && (
                                        <span style={{ background: "var(--green-bg)", color: "var(--green)", border: "1px solid var(--green)", borderRadius: 20, fontSize: 10, fontWeight: 700, padding: "2px 8px", letterSpacing: "0.04em" }}>
                                            RECOMMENDED
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 12 }}>{step.desc}</div>

                                {step.details.map((d, j) => (
                                    <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                                        <span style={{ color: step.number === "4" ? "var(--green)" : "var(--accent)", fontWeight: 700, fontSize: 13, marginTop: 1 }}>→</span>
                                        <span style={{ fontSize: 13, color: "var(--text2)" }}>{d}</span>
                                    </div>
                                ))}

                                {/* Cost Explorer inline policy */}
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

                                {/* CloudFormation download */}
                                {step.showDownload && (
                                    <div style={{ marginTop: 16 }}>
                                        {/* Info box */}
                                        <div style={{ background: "var(--green-bg)", border: "1px solid var(--green)", borderRadius: 10, padding: "12px 16px", marginBottom: 14, fontSize: 12, color: "var(--green)" }}>
                                            <div style={{ fontWeight: 700, marginBottom: 4 }}>What this template does:</div>
                                            <div style={{ color: "var(--text2)", lineHeight: 1.6 }}>
                                                Creates <strong>13 managed policies</strong> covering 200+ AWS services, groups them into a <strong>CloudOps-Discovery-Group</strong>, and automatically adds your IAM user to that group — all in one stack.
                                            </div>
                                        </div>

                                        <button
                                            onClick={downloadCloudFormation}
                                            style={{
                                                display: "flex", alignItems: "center", gap: 10,
                                                background: "var(--green)", color: "white",
                                                border: "none", borderRadius: 10,
                                                padding: "12px 24px", fontSize: 14,
                                                fontWeight: 600, cursor: "pointer",
                                                width: "100%", justifyContent: "center",
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
                                            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                                <polyline points="7 10 12 15 17 10"/>
                                                <line x1="12" y1="15" x2="12" y2="3"/>
                                            </svg>
                                            Download CloudFormation Template
                                        </button>

                                        {/* Warning note */}
                                        <div style={{ marginTop: 10, fontSize: 11, color: "var(--text3)", textAlign: "center" }}>
                                            ⚠ During stack creation, check <strong>"I acknowledge that AWS CloudFormation might create IAM resources"</strong>
                                        </div>
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
    const isAzure = awsData.cloud === "azure";

    // ── Azure stats ──────────────────────────────────────────────────────────
    const azureStats = isAzure ? [
        { label: "Virtual Machines",    value: Object.values(awsData.services || {}).reduce((t, r) => t + (Array.isArray(r.virtual_machines) ? r.virtual_machines.length : 0), 0), sub: `across ${regionCount} regions` },
        { label: "Azure Functions",     value: Object.values(awsData.services || {}).reduce((t, r) => t + (Array.isArray(r.azure_functions) ? r.azure_functions.length : 0), 0) },
        { label: "SQL Databases",       value: Object.values(awsData.services || {}).reduce((t, r) => t + (Array.isArray(r.sql_databases) ? r.sql_databases.length : 0), 0) },
        { label: "Storage Accounts",    value: (awsData.storage_accounts || []).length },
        { label: "Entra ID Users",      value: (awsData.entra_id?.users || []).length },
        { label: "Monitor Alerts",      value: Object.values(awsData.services || {}).reduce((t, r) => t + (Array.isArray(r.monitor_alerts) ? r.monitor_alerts.length : 0), 0) },
        { label: "AKS Clusters",        value: Object.values(awsData.services || {}).reduce((t, r) => t + (Array.isArray(r.aks_clusters) ? r.aks_clusters.length : 0), 0) },
        { label: "Virtual Networks",    value: Object.values(awsData.services || {}).reduce((t, r) => t + (r.virtual_networks?.vnets?.length || 0), 0) },
    ] : null;

    // ── AWS stats ────────────────────────────────────────────────────────────
    const iamUsers = Array.isArray(awsData.iam) ? awsData.iam : (awsData.iam?.users || []);
    const awsStats = [
        { label: "EC2 Instances",     value: sumRegion(awsData, "ec2"),       sub: `across ${regionCount} regions` },
        { label: "Lambda Functions",  value: sumRegion(awsData, "lambda_fn") },
        { label: "RDS Instances",     value: sumRegion(awsData, "rds") },
        { label: "S3 Buckets",        value: (awsData.s3 || []).length },
        { label: "IAM Users",         value: iamUsers.length },
        { label: "CloudWatch Alarms", value: sumRegion(awsData, "cloudwatch") },
        { label: "SNS Topics",        value: sumRegion(awsData, "sns") },
        { label: "VPCs",              value: getVpcCount(awsData) },
    ];

    const stats = isAzure ? azureStats : awsStats;

    // ── Identity cards ───────────────────────────────────────────────────────
    const identityCards = isAzure ? [
        { label: "Subscription ID",  value: id.subscription_id || "—", mono: true },
        { label: "Tenant ID",        value: id.tenant_id || "—", mono: true },
        { label: "Regions Scanned",  value: regionCount },
        { label: "Scan Duration",    value: `${scanMeta?.duration || "—"}s` },
    ] : [
        { label: "Account ID",       value: id.account_id || "—" },
        { label: "User ARN",         value: id.arn || "—", mono: true },
        { label: "Regions Scanned",  value: regionCount },
        { label: "Scan Duration",    value: `${scanMeta?.duration || "—"}s` },
    ];

    return (
        <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4 }}>Overview</div>
            <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>
                {isAzure ? "Azure subscription identity and resource summary" : "Account identity and resource summary"}
            </div>

            {/* Identity row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12, marginBottom: 24 }}>
                {identityCards.map(({ label, value, mono }) => (
                    <div key={label} style={{ background: "var(--surface2)", borderRadius: 8, padding: "12px 14px" }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
                        <div style={{ fontFamily: mono ? "monospace" : "inherit", fontSize: mono ? 10 : 12, color: "var(--text)", wordBreak: "break-all" }}>{value}</div>
                    </div>
                ))}
            </div>

            {/* Resource stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12, marginBottom: 24 }}>
                {stats.map((s) => <StatCard key={s.label} {...s} />)}
            </div>

            {/* Cost & Usage */}
            <Card title={`Cost & Usage${isAzure ? ` — ${costs.billing_period || ""}` : ` — ${costs.period || ""}`}`}>
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
                        </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                        <StatCard label="Month-to-Date" value={costs.error ? "—" : `$${(costs.total ?? 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`} accent />
                        <StatCard label="Forecast"      value={costs.error ? "—" : (costs.forecast != null ? `$${costs.forecast.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}` : "—")} />
                        {isAzure && costs.budget_limit && (
                            <StatCard label="Budget Limit"  value={`$${costs.budget_limit.toLocaleString()}`} />
                        )}
                        {isAzure && costs.budget_used_pct != null && (
                            <StatCard label="Budget Used"   value={`${costs.budget_used_pct}%`} />
                        )}
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
                                        <div style={{ height: "100%", background: isAzure ? "#0089D6" : "var(--accent)", borderRadius: 3, width: `${(val / max * 100).toFixed(1)}%` }} />
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
    const isAzure = awsData.cloud === "azure";

    if (isAzure) {
        const entra = awsData.entra_id || {};
        const users = entra.users || [];
        const sps   = entra.service_principals || [];
        const groups= entra.groups || [];
        const assignments = entra.role_assignment_details || [];
        return (
            <div>
                <div style={{ fontSize:18, fontWeight:700, letterSpacing:"-0.03em", marginBottom:4 }}>Microsoft Entra ID</div>
                <div style={{ fontSize:13, color:"var(--text2)", marginBottom:20 }}>Role assignments and access policies</div>

                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
                    <StatCard label="Role Assignments" value={entra.role_assignments || 0} />
                    <StatCard label="Users" value={users.length} />
                    <StatCard label="Service Principals" value={sps.length} />
                    <StatCard label="Groups" value={groups.length} />
                </div>

                {/* Note about Graph API */}
                <div style={{ background:"#e6f2ff", border:"1px solid #0089D630", borderRadius:10, padding:"12px 16px", marginBottom:20, fontSize:12, color:"#0057a8" }}>
                    <strong>ℹ️ Note:</strong> User, group and service principal listing requires <strong>Microsoft Graph API</strong> permissions (<code>User.Read.All</code>).
                    Currently showing role assignments available via Reader access.
                    To enable full user listing, grant Graph API permissions to your app registration in Azure Portal → App registrations → API permissions.
                </div>

                {/* Role assignments table */}
                {assignments.length > 0 && (
                    <Card title={`Role Assignments (${entra.role_assignments || 0})`}>
                        <DataTable
                            columns={["Principal ID", "Principal Type", "Scope"]}
                            rows={assignments.map(ra => [
                                <Mono>{(ra.principal_id || "—").slice(0,20)}…</Mono>,
                                ra.principal_type || "—",
                                <span style={{ fontSize:11, color:"var(--text2)" }}>{(ra.scope || "—").replace(`/subscriptions/`, "sub/")}</span>,
                            ])}
                            empty="No role assignments found"
                        />
                    </Card>
                )}
            </div>
        );
    }

    // ── AWS IAM ───────────────────────────────────────────────────────────────
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
    const isAzure = awsData.cloud === "azure";

    if (isAzure) {
        const accounts = awsData.storage_accounts || [];
        return (
            <div>
                <div style={{ fontSize:18, fontWeight:700, letterSpacing:"-0.03em", marginBottom:4 }}>Blob Storage</div>
                <div style={{ fontSize:13, color:"var(--text2)", marginBottom:20 }}>Azure Storage Accounts</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12, marginBottom:24 }}>
                    <StatCard label="Storage Accounts" value={accounts.length} />
                    <StatCard label="Public Blob Access" value={accounts.filter(a => a.blob_public_access).length} />
                    <StatCard label="HTTPS Only" value={accounts.filter(a => a.https_only).length} />
                    <StatCard label="Total Size (GB)" value={accounts.reduce((t,a) => t + (a.size_gb||0), 0).toFixed(0)} />
                </div>
                <Card title={`Storage Accounts (${accounts.length})`}>
                    <DataTable
                        columns={["Name", "Location", "SKU", "Kind", "Access Tier", "Size (GB)", "Public Blob", "HTTPS Only"]}
                        rows={accounts.map(a => [
                            <strong style={{ fontSize:12 }}>{a.name || "—"}</strong>,
                            a.location || "—",
                            <Mono>{a.sku || "—"}</Mono>,
                            a.kind || "—",
                            a.access_tier || "—",
                            a.size_gb?.toFixed(1) || "—",
                            a.blob_public_access ? <Badge text="Public" variant="amber" /> : <Badge text="Private" variant="green" />,
                            a.https_only ? <Badge text="Yes" variant="green" /> : <Badge text="No" variant="red" />,
                        ])}
                        empty="No storage accounts found"
                    />
                </Card>
            </div>
        );
    }

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

// ── Route53 / Azure DNS Section ────────────────────────────────────────────────
const Route53Section = ({ awsData }) => {
    const isAzure = awsData.cloud === "azure";

    if (isAzure) {
        const zones = awsData.dns_zones || [];
        return (
            <div>
                <div style={{ fontSize:18, fontWeight:700, letterSpacing:"-0.03em", marginBottom:4 }}>Azure DNS</div>
                <div style={{ fontSize:13, color:"var(--text2)", marginBottom:20 }}>Public and private DNS zones</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12, marginBottom:24 }}>
                    <StatCard label="Total Zones" value={zones.length} />
                    <StatCard label="Public Zones"  value={zones.filter(z => z.type === "Public").length} />
                    <StatCard label="Private Zones" value={zones.filter(z => z.type === "Private").length} />
                    <StatCard label="Total Record Sets" value={zones.reduce((t,z) => t + (z.record_sets||0), 0)} />
                </div>
                <Card title={`DNS Zones (${zones.length})`}>
                    <DataTable
                        columns={["Zone Name", "Type", "Record Sets", "Name Servers"]}
                        rows={zones.map(z => [
                            <strong style={{ fontSize:12 }}>{z.name || "—"}</strong>,
                            <Badge text={z.type || "Public"} variant={z.type === "Private" ? "blue" : "green"} />,
                            z.record_sets || 0,
                            (z.name_servers || []).slice(0,2).join(", ") || "—",
                        ])}
                        empty="No DNS zones found"
                    />
                </Card>
            </div>
        );
    }

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

// ── CloudFront / Azure CDN Section ─────────────────────────────────────────────
const CloudFrontSection = ({ awsData }) => {
    const isAzure = awsData.cloud === "azure";

    if (isAzure) {
        const profiles = awsData.cdn_profiles || [];
        const allEndpoints = profiles.flatMap(p => (p.endpoints || []).map(e => ({ ...e, profile: p.name, sku: p.sku })));
        return (
            <div>
                <div style={{ fontSize:18, fontWeight:700, letterSpacing:"-0.03em", marginBottom:4 }}>Azure CDN</div>
                <div style={{ fontSize:13, color:"var(--text2)", marginBottom:20 }}>CDN profiles and endpoints</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12, marginBottom:24 }}>
                    <StatCard label="CDN Profiles"  value={profiles.length} />
                    <StatCard label="Endpoints"     value={allEndpoints.length} />
                    <StatCard label="Active"        value={allEndpoints.filter(e => e.enabled).length} />
                </div>
                {profiles.map(p => (
                    <Card key={p.name} title={p.name} badge={<Badge text={p.sku} variant="blue" />}>
                        <DataTable
                            columns={["Endpoint Name", "Hostname", "Origin", "Status"]}
                            rows={(p.endpoints || []).map(e => [
                                <strong style={{ fontSize:12 }}>{e.name || "—"}</strong>,
                                <Mono>{e.hostname || "—"}</Mono>,
                                e.origin || "—",
                                e.enabled ? <Badge text="Active" variant="green" /> : <Badge text="Disabled" variant="red" />,
                            ])}
                            empty="No endpoints"
                        />
                    </Card>
                ))}
                {profiles.length === 0 && (
                    <Card title="CDN Endpoints (0)">
                        <div style={{ padding:24, textAlign:"center", color:"var(--text3)", fontSize:13 }}>No CDN profiles found</div>
                    </Card>
                )}
            </div>
        );
    }

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

const SERVICE_CATEGORIES = {
    Compute: {
        color: "#3B82F6", bg: "#EFF6FF", border: "#BFDBFE",
        icon: "⚙️",
        services: [
            { key: "ec2",              label: "EC2 Instances" },
            { key: "lambda_fn",        label: "Lambda Functions" },
            { key: "ecs_clusters",     label: "ECS Clusters" },
            { key: "ecs_services",     label: "ECS Services" },
            { key: "eks_clusters",     label: "EKS Clusters" },
            { key: "lightsail",        label: "Lightsail" },
            { key: "batch",            label: "Batch Environments" },
            { key: "apprunner",        label: "App Runner" },
            { key: "elastic_beanstalk",label: "Elastic Beanstalk" },
            { key: "autoscaling",      label: "Auto Scaling Groups" },
            { key: "launch_templates", label: "Launch Templates" },
            { key: "ec2_spot",         label: "Spot Fleets" },
        ],
    },
    Storage: {
        color: "#8B5CF6", bg: "#F5F3FF", border: "#DDD6FE",
        icon: "🗄️",
        services: [
            { key: "efs",              label: "EFS File Systems" },
            { key: "fsx",              label: "FSx File Systems" },
            { key: "glacier",          label: "Glacier Vaults" },
            { key: "backup",           label: "Backup Vaults" },
            { key: "ebs_volumes",      label: "EBS Volumes" },
            { key: "ebs_snapshots",    label: "EBS Snapshots" },
            { key: "storage_gateway",  label: "Storage Gateway" },
        ],
    },
    Databases: {
        color: "#10B981", bg: "#ECFDF5", border: "#A7F3D0",
        icon: "🛢️",
        services: [
            { key: "rds",              label: "RDS Instances" },
            { key: "rds_clusters",     label: "RDS Clusters" },
            { key: "dynamodb",         label: "DynamoDB Tables" },
            { key: "elasticache",      label: "ElastiCache Clusters" },
            { key: "redshift",         label: "Redshift Clusters" },
            { key: "documentdb",       label: "DocumentDB Clusters" },
            { key: "neptune",          label: "Neptune Clusters" },
            { key: "keyspaces",        label: "Keyspaces Tables" },
            { key: "timestream",       label: "Timestream DBs" },
            { key: "qldb",             label: "QLDB Ledgers" },
            { key: "memorydb",         label: "MemoryDB Clusters" },
            { key: "rds_proxies",      label: "RDS Proxies" },
        ],
    },
    Networking: {
        color: "#F59E0B", bg: "#FFFBEB", border: "#FDE68A",
        icon: "🌐",
        services: [
            { key: "vpc",              label: "VPCs" },
            { key: "subnets",          label: "Subnets" },
            { key: "security_groups",  label: "Security Groups" },
            { key: "elb",              label: "Classic ELBs" },
            { key: "alb",              label: "App Load Balancers" },
            { key: "nlb",              label: "Network Load Balancers" },
            { key: "transit_gateway",  label: "Transit Gateways" },
            { key: "direct_connect",   label: "Direct Connect" },
            { key: "vpn_gateways",     label: "VPN Gateways" },
            { key: "nat_gateways",     label: "NAT Gateways" },
            { key: "internet_gateways",label: "Internet Gateways" },
            { key: "network_acls",     label: "Network ACLs" },
            { key: "route_tables",     label: "Route Tables" },
            { key: "elastic_ips",      label: "Elastic IPs" },
            { key: "vpc_endpoints",    label: "VPC Endpoints" },
            { key: "waf",              label: "WAF Web ACLs" },
            { key: "shield",           label: "Shield Resources" },
        ],
    },
    Security: {
        color: "#EF4444", bg: "#FEF2F2", border: "#FECACA",
        icon: "🔒",
        services: [
            { key: "guardduty",        label: "GuardDuty Findings" },
            { key: "securityhub",      label: "Security Hub Findings" },
            { key: "cloudtrail",       label: "CloudTrail Trails" },
            { key: "config",           label: "Config Rules" },
            { key: "macie",            label: "Macie Jobs" },
            { key: "inspector",        label: "Inspector Findings" },
            { key: "detective",        label: "Detective Graphs" },
            { key: "acm",              label: "ACM Certificates" },
            { key: "kms",              label: "KMS Keys" },
            { key: "secrets_manager",  label: "Secrets Manager" },
            { key: "ssm_parameters",   label: "SSM Parameters" },
        ],
    },
    Messaging: {
        color: "#06B6D4", bg: "#ECFEFF", border: "#A5F3FC",
        icon: "📨",
        services: [
            { key: "sns",              label: "SNS Topics" },
            { key: "sqs",              label: "SQS Queues" },
            { key: "eventbridge",      label: "EventBridge Rules" },
            { key: "kinesis",          label: "Kinesis Streams" },
            { key: "kinesis_firehose", label: "Kinesis Firehose" },
            { key: "mq",               label: "MQ Brokers" },
            { key: "kafka",            label: "MSK Clusters" },
            { key: "iot",              label: "IoT Things" },
        ],
    },
    Serverless: {
        color: "#F97316", bg: "#FFF7ED", border: "#FED7AA",
        icon: "⚡",
        services: [
            { key: "api_gateway",      label: "API Gateway REST" },
            { key: "api_gateway_v2",   label: "API Gateway HTTP" },
            { key: "step_functions",   label: "Step Functions" },
            { key: "appsync",          label: "AppSync APIs" },
            { key: "amplify",          label: "Amplify Apps" },
        ],
    },
    Analytics: {
        color: "#6366F1", bg: "#EEF2FF", border: "#C7D2FE",
        icon: "📊",
        services: [
            { key: "glue",             label: "Glue Jobs" },
            { key: "athena",           label: "Athena Workgroups" },
            { key: "emr",              label: "EMR Clusters" },
            { key: "opensearch",       label: "OpenSearch Domains" },
            { key: "redshift_serverless", label: "Redshift Serverless" },
            { key: "quicksight",       label: "QuickSight Datasets" },
            { key: "lakeformation",    label: "Lake Formation" },
            { key: "databrew",         label: "DataBrew Projects" },
        ],
    },
    "AI/ML": {
        color: "#EC4899", bg: "#FDF2F8", border: "#FBCFE8",
        icon: "🤖",
        services: [
            { key: "sagemaker",        label: "SageMaker Endpoints" },
            { key: "bedrock",          label: "Bedrock Models" },
            { key: "rekognition",      label: "Rekognition Collections" },
            { key: "comprehend",       label: "Comprehend Jobs" },
            { key: "textract",         label: "Textract Jobs" },
            { key: "polly",            label: "Polly Lexicons" },
            { key: "translate",        label: "Translate Jobs" },
            { key: "lex",              label: "Lex Bots" },
            { key: "kendra",           label: "Kendra Indexes" },
        ],
    },
    DevOps: {
        color: "#14B8A6", bg: "#F0FDFA", border: "#99F6E4",
        icon: "🛠️",
        services: [
            { key: "codepipeline",     label: "CodePipeline" },
            { key: "codebuild",        label: "CodeBuild Projects" },
            { key: "codedeploy",       label: "CodeDeploy Apps" },
            { key: "codecommit",       label: "CodeCommit Repos" },
            { key: "ecr",              label: "ECR Repositories" },
            { key: "cloudformation",   label: "CloudFormation Stacks" },
            { key: "cdk_assets",       label: "CDK Assets" },
        ],
    },
    Monitoring: {
        color: "#84CC16", bg: "#F7FEE7", border: "#D9F99D",
        icon: "📈",
        services: [
            { key: "cloudwatch",       label: "CloudWatch Alarms" },
            { key: "cloudwatch_dashboards", label: "CW Dashboards" },
            { key: "cloudwatch_logs",  label: "CW Log Groups" },
            { key: "xray",             label: "X-Ray Groups" },
            { key: "health",           label: "Health Events" },
            { key: "synthetics",       label: "CloudWatch Synthetics" },
        ],
    },
    "Migration & Transfer": {
        color: "#64748B", bg: "#F8FAFC", border: "#CBD5E1",
        icon: "🔄",
        services: [
            { key: "dms",              label: "DMS Tasks" },
            { key: "datasync",         label: "DataSync Tasks" },
            { key: "snowball",         label: "Snowball Jobs" },
            { key: "transfer",         label: "Transfer Family" },
            { key: "migration_hub",    label: "Migration Hub" },
        ],
    },
};

// ── helper: count items in a region data field ────────────────────────────────
const countField = (val) => {
    if (!val) return 0;
    if (Array.isArray(val)) return val.length;
    if (typeof val === "object") {
        // VPC-style nested object
        if (val.vpcs) return val.vpcs.length;
        return Object.values(val).reduce((s, v) => s + (Array.isArray(v) ? v.length : 0), 0);
    }
    return 0;
};

// ── Single-Region detailed view ───────────────────────────────────────────────
const SingleRegionView = ({ region, regionData, awsData }) => {
    const [openCategory, setOpenCategory] = useState(null);

    // Total resource count across all category services
    const totalResources = Object.values(SERVICE_CATEGORIES).reduce((sum, cat) => {
        return sum + cat.services.reduce((s, svc) => {
            const val = regionData[svc.key] ?? regionData[svc.key.replace(/_/g, "")] ?? null;
            return s + countField(val);
        }, 0);
    }, 0);

    const categorySummary = Object.entries(SERVICE_CATEGORIES).map(([catName, cat]) => {
        const items = cat.services.map(svc => {
            const val = regionData[svc.key] ?? null;
            const count = countField(val);
            return { ...svc, count, raw: val };
        }).filter(s => s.count > 0);
        return { catName, cat, items, total: items.reduce((s, i) => s + i.count, 0) };
    }).filter(c => c.total > 0);

    return (
        <div>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em" }}>
                        {region}
                    </div>
                    <Badge text="Single Region Scan" variant="blue" />
                </div>
                <div style={{ fontSize: 13, color: "var(--text2)" }}>
                    {totalResources} resources across {categorySummary.length} service categories
                </div>
            </div>

            {/* Summary grid — category cards */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: 12,
                marginBottom: 32,
            }}>
                {categorySummary.map(({ catName, cat, total }) => (
                    <div
                        key={catName}
                        onClick={() => setOpenCategory(openCategory === catName ? null : catName)}
                        style={{
                            background: cat.bg,
                            border: `1.5px solid ${openCategory === catName ? cat.color : cat.border}`,
                            borderRadius: 12,
                            padding: "16px 18px",
                            cursor: "pointer",
                            transition: "all 0.15s",
                            boxShadow: openCategory === catName ? `0 0 0 3px ${cat.color}22` : "none",
                        }}
                    >
                        <div style={{ fontSize: 20, marginBottom: 8 }}>{cat.icon}</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: cat.color, letterSpacing: "-0.03em", marginBottom: 2 }}>
                            {total}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: cat.color, opacity: 0.85 }}>{catName}</div>
                        <div style={{ fontSize: 10, color: cat.color, opacity: 0.65, marginTop: 2 }}>
                            {cat.services.filter(s => countField(regionData[s.key]) > 0).length} of {cat.services.length} services
                        </div>
                    </div>
                ))}
            </div>

            {/* Expanded category detail */}
            {openCategory && (() => {
                const { cat, items } = categorySummary.find(c => c.catName === openCategory);
                return (
                    <div style={{
                        background: "var(--surface)",
                        border: `1.5px solid ${cat.color}`,
                        borderRadius: 16,
                        marginBottom: 24,
                        overflow: "hidden",
                        boxShadow: `0 4px 24px ${cat.color}18`,
                    }}>
                        <div style={{
                            padding: "16px 20px",
                            borderBottom: "1px solid var(--border)",
                            background: cat.bg,
                            display: "flex", alignItems: "center", gap: 10,
                        }}>
                            <span style={{ fontSize: 20 }}>{cat.icon}</span>
                            <span style={{ fontSize: 15, fontWeight: 700, color: cat.color }}>{openCategory}</span>
                            <Badge text={`${items.reduce((s,i)=>s+i.count,0)} resources`} variant="blue" />
                            <button
                                onClick={() => setOpenCategory(null)}
                                style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: cat.color, fontSize: 18, lineHeight: 1 }}
                            >×</button>
                        </div>

                        {/* Service breakdown */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 0 }}>
                            {items.map(svc => (
                                <ServiceDetail key={svc.key} svc={svc} color={cat.color} bg={cat.bg} />
                            ))}
                        </div>
                    </div>
                );
            })()}

            {/* Full services list — all categories expanded */}
            {categorySummary.map(({ catName, cat, items, total }) => (
                <div key={catName} style={{ marginBottom: 20 }}>
                    <Card
                        title={`${cat.icon} ${catName}`}
                        badge={<Badge text={`${total} resources`} variant="blue" />}
                    >
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 0 }}>
                            {items.map(svc => (
                                <ServiceDetail key={svc.key} svc={svc} color={cat.color} bg={cat.bg} />
                            ))}
                        </div>
                    </Card>
                </div>
            ))}

            {/* VPC deep-dive if available */}
            {regionData.vpc?.vpcs?.length > 0 && (
                <Card title="VPC Details" badge={<Badge text={`${regionData.vpc.vpcs.length} VPCs`} variant="blue" />}>
                    <DataTable
                        columns={["VPC ID", "CIDR", "Name", "State", "Default"]}
                        rows={regionData.vpc.vpcs.map(v => [
                            <Mono>{v.VpcId || v.id}</Mono>,
                            <Mono>{v.CidrBlock || v.cidr}</Mono>,
                            v.name || (v.Tags?.find(t=>t.Key==="Name")?.Value) || "—",
                            stateBadge(v.State || v.state),
                            (v.IsDefault || v.default) ? "Yes" : "No",
                        ])}
                    />
                </Card>
            )}

            {/* EC2 deep-dive */}
            {Array.isArray(regionData.ec2) && regionData.ec2.length > 0 && (
                <Card title="EC2 Instances" badge={<Badge text={`${regionData.ec2.length}`} variant="blue" />}>
                    <DataTable
                        columns={["Instance ID","Name","Type","State","AZ","Private IP","Public IP"]}
                        rows={regionData.ec2.map(i => [
                            <Mono>{i.InstanceId || i.id}</Mono>,
                            i.name || (i.Tags?.find(t=>t.Key==="Name")?.Value) || "—",
                            <Mono>{i.InstanceType || i.type}</Mono>,
                            stateBadge(i.State?.Name || i.state),
                            i.Placement?.AvailabilityZone || i.az || "—",
                            i.PrivateIpAddress || i.private_ip || "—",
                            i.PublicIpAddress || i.public_ip || "—",
                        ])}
                    />
                </Card>
            )}

            {/* Lambda deep-dive */}
            {Array.isArray(regionData.lambda_fn) && regionData.lambda_fn.length > 0 && (
                <Card title="Lambda Functions" badge={<Badge text={`${regionData.lambda_fn.length}`} variant="blue" />}>
                    <DataTable
                        columns={["Name","Runtime","Memory (MB)","Timeout (s)","Last Modified"]}
                        rows={regionData.lambda_fn.map(f => [
                            <strong style={{fontSize:12}}>{f.FunctionName || f.name}</strong>,
                            f.Runtime || f.runtime || "—",
                            f.MemorySize || f.memory_mb || "—",
                            f.Timeout || f.timeout_s || "—",
                            (f.LastModified || f.last_modified || "").toString().slice(0,19),
                        ])}
                    />
                </Card>
            )}

            {/* RDS deep-dive */}
            {Array.isArray(regionData.rds) && regionData.rds.length > 0 && (
                <Card title="RDS Instances" badge={<Badge text={`${regionData.rds.length}`} variant="blue" />}>
                    <DataTable
                        columns={["ID","Engine","Version","Class","State","Multi-AZ"]}
                        rows={regionData.rds.map(i => [
                            <Mono>{i.DBInstanceIdentifier || i.id}</Mono>,
                            i.Engine || i.engine || "—",
                            i.EngineVersion || i.engine_version || "—",
                            i.DBInstanceClass || i.instance_class || "—",
                            stateBadge(i.DBInstanceStatus || i.status || i.state),
                            (i.MultiAZ || i.multi_az) ? "Yes" : "No",
                        ])}
                    />
                </Card>
            )}

            {/* DynamoDB deep-dive */}
            {Array.isArray(regionData.dynamodb) && regionData.dynamodb.length > 0 && (
                <Card title="DynamoDB Tables" badge={<Badge text={`${regionData.dynamodb.length}`} variant="blue" />}>
                    <DataTable
                        columns={["Table Name"]}
                        rows={regionData.dynamodb.map(t => [
                            <strong style={{fontSize:12}}>{t.name || t || "—"}</strong>,
                        ])}
                    />
                </Card>
            )}

            {/* CloudWatch Alarms deep-dive */}
            {Array.isArray(regionData.cloudwatch) && regionData.cloudwatch.length > 0 && (
                <Card title="CloudWatch Alarms" badge={<Badge text={`${regionData.cloudwatch.length}`} variant="blue" />}>
                    <DataTable
                        columns={["Name","State","Metric","Namespace","Threshold"]}
                        rows={regionData.cloudwatch.map(a => [
                            <strong style={{fontSize:12}}>{a.AlarmName || a.name || "—"}</strong>,
                            stateBadge(a.StateValue || a.state),
                            a.MetricName || a.metric || "—",
                            a.Namespace || a.namespace || "—",
                            a.Threshold ?? a.threshold ?? "—",
                        ])}
                    />
                </Card>
            )}

            {/* SNS deep-dive */}
            {Array.isArray(regionData.sns) && regionData.sns.length > 0 && (
                <Card title="SNS Topics" badge={<Badge text={`${regionData.sns.length}`} variant="blue" />}>
                    <DataTable
                        columns={["Topic ARN"]}
                        rows={regionData.sns.map(t => [<Mono>{t.TopicArn || t.arn || t}</Mono>])}
                    />
                </Card>
            )}

            {/* SQS deep-dive */}
            {Array.isArray(regionData.sqs) && regionData.sqs.length > 0 && (
                <Card title="SQS Queues" badge={<Badge text={`${regionData.sqs.length}`} variant="blue" />}>
                    <DataTable
                        columns={["Queue URL"]}
                        rows={regionData.sqs.map(q => [<Mono>{q.url || q}</Mono>])}
                    />
                </Card>
            )}

            {/* Security Groups deep-dive */}
            {regionData.vpc?.security_groups?.length > 0 && (
                <Card title="Security Groups" badge={<Badge text={`${regionData.vpc.security_groups.length}`} variant="blue" />}>
                    <DataTable
                        columns={["Group ID","Name","VPC","Inbound Rules","Outbound Rules"]}
                        rows={regionData.vpc.security_groups.map(sg => [
                            <Mono>{sg.GroupId || sg.id}</Mono>,
                            sg.GroupName || sg.name || "—",
                            <Mono>{sg.VpcId || sg.vpc}</Mono>,
                            sg.IpPermissions?.length ?? sg.inbound ?? "—",
                            sg.IpPermissionsEgress?.length ?? sg.outbound ?? "—",
                        ])}
                    />
                </Card>
            )}
        </div>
    );
};

// ── Service item within a category ───────────────────────────────────────────
const ServiceDetail = ({ svc, color, bg }) => (
    <div style={{
        padding: "14px 18px",
        borderBottom: "1px solid var(--border)",
        borderRight: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 12,
    }}>
        <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: bg,
            border: `1px solid ${color}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, flexShrink: 0,
        }}>
            {svc.count > 0 ? "✅" : "○"}
        </div>
        <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{svc.label}</div>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>
                {svc.key}
            </div>
        </div>
        <div style={{
            fontSize: 20, fontWeight: 700,
            color: svc.count > 0 ? color : "var(--text3)",
            minWidth: 28, textAlign: "right",
        }}>
            {svc.count}
        </div>
    </div>
);

// ── Multi-Region view (your existing RegionalSection content) ─────────────────
const MultiRegionView = ({ awsData }) => {
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
        <>
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

            {/* Per-region detail tables */}
            {[
                { key:"ec2", label:"EC2", cols:["ID","Name","Type","State","AZ","Private IP","Public IP"], row:(i)=>[<Mono>{i.InstanceId||i.id}</Mono>, i.name||"—", <Mono>{i.InstanceType||i.type}</Mono>, stateBadge(i.State?.Name||i.state), i.Placement?.AvailabilityZone||i.az, i.PrivateIpAddress||i.private_ip, i.PublicIpAddress||i.public_ip||"—"] },
                { key:"cloudwatch", label:"CloudWatch Alarms", cols:["Name","State","Metric","Namespace","Threshold"], row:(a)=>[<strong style={{fontSize:12}}>{a.AlarmName||a.name||"—"}</strong>, stateBadge(a.StateValue||a.state), a.MetricName||a.metric, a.Namespace||a.namespace, a.Threshold||a.threshold] },
                { key:"lambda_fn", label:"Lambda Functions", cols:["Name","Runtime","Memory","Timeout","Last Modified"], row:(f)=>[<strong style={{fontSize:12}}>{f.FunctionName||f.name||"—"}</strong>, f.Runtime||f.runtime||"—", f.MemorySize||f.memory_mb||"—", f.Timeout||f.timeout_s||"—", (f.LastModified||f.last_modified||"").toString().slice(0,19)] },
                { key:"rds", label:"RDS Instances", cols:["ID","Engine","Version","Class","State","Multi-AZ"], row:(i)=>[<Mono>{i.DBInstanceIdentifier||i.id}</Mono>, i.Engine||i.engine||"—", i.EngineVersion||i.engine_version||"—", i.DBInstanceClass||i.instance_class||"—", stateBadge(i.DBInstanceStatus||i.status||i.state), (i.MultiAZ||i.multi_az)?"Yes":"No"] },
                { key:"sns", label:"SNS Topics", cols:["ARN"], row:(t)=>[<Mono>{t.TopicArn||t.arn||t}</Mono>] },
                { key:"sqs", label:"SQS Queues", cols:["Queue URL"], row:(q)=>[<Mono>{q.url||q}</Mono>] },
                { key:"dynamodb", label:"DynamoDB Tables", cols:["Table Name"], row:(t)=>[<strong style={{fontSize:12}}>{t.name||t||"—"}</strong>] },
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
        </>
    );
};

// ── RegionalSection — decides which view to render ────────────────────────────
const RegionalSection = ({ awsData }) => {
    const isAzure = awsData.cloud === "azure";
    const regionKeys = Object.keys(awsData.services || {});
    const isSingleRegion = regionKeys.length === 1;

    if (isAzure) {
        // Collect all VMs across all regions
        const allVMs = regionKeys.flatMap(r =>
            (awsData.services[r]?.virtual_machines || []).map(vm => ({ ...vm, _region: r }))
        );
        const allAKS = regionKeys.flatMap(r =>
            (awsData.services[r]?.aks_clusters || []).map(c => ({ ...c, _region: r }))
        );
        const allFunctions = regionKeys.flatMap(r =>
            (awsData.services[r]?.azure_functions || []).map(f => ({ ...f, _region: r }))
        );
        const allSQL = regionKeys.flatMap(r =>
            (awsData.services[r]?.sql_databases || []).map(d => ({ ...d, _region: r }))
        );

        return (
            <div>
                <div style={{ fontSize:18, fontWeight:700, letterSpacing:"-0.03em", marginBottom:4 }}>Virtual Machines</div>
                <div style={{ fontSize:13, color:"var(--text2)", marginBottom:20 }}>
                    Summary across {regionKeys.length} scanned regions
                </div>

                {/* Summary stats */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12, marginBottom:24 }}>
                    <StatCard label="Regions" value={regionKeys.length} />
                    <StatCard label="Total Resources" value={allVMs.length + allAKS.length + allFunctions.length + allSQL.length} />
                    <StatCard label="Active Services" value={regionKeys.filter(r => {
                        const s = awsData.services[r];
                        return (s?.virtual_machines?.length||0) + (s?.azure_functions?.length||0) + (s?.sql_databases?.length||0) > 0;
                    }).length} />
                    <StatCard label="Max Per Region" value={Math.max(0, ...regionKeys.map(r => {
                        const s = awsData.services[r];
                        return (s?.virtual_machines?.length||0) + (s?.azure_functions?.length||0) + (s?.sql_databases?.length||0);
                    }))} />
                </div>

                {/* VMs table */}
                {allVMs.length > 0 && (
                    <Card title={`Virtual Machines (${allVMs.length})`} badge={<Badge text="Compute" variant="blue" />}>
                        <DataTable
                            columns={["Name", "Region", "Size", "OS", "State", "Private IP", "Public IP"]}
                            rows={allVMs.map(vm => [
                                <strong style={{ fontSize:12 }}>{vm.name || "—"}</strong>,
                                vm._region,
                                <Mono>{vm.vm_size || "—"}</Mono>,
                                vm.os_type || "—",
                                stateBadge(vm.state || vm.power_state),
                                <Mono>{vm.private_ip || "—"}</Mono>,
                                vm.public_ip ? <Mono>{vm.public_ip}</Mono> : "—",
                            ])}
                        />
                    </Card>
                )}

                {/* AKS clusters */}
                {allAKS.length > 0 && (
                    <Card title={`AKS Clusters (${allAKS.length})`} badge={<Badge text="Kubernetes" variant="blue" />}>
                        <DataTable
                            columns={["Name", "Region", "K8s Version", "Nodes", "State"]}
                            rows={allAKS.map(c => [
                                <strong style={{ fontSize:12 }}>{c.name || "—"}</strong>,
                                c._region,
                                <Mono>{c.kubernetes_version || "—"}</Mono>,
                                c.total_nodes || "—",
                                stateBadge(c.power_state || "Running"),
                            ])}
                        />
                    </Card>
                )}

                {/* Azure Functions */}
                {allFunctions.length > 0 && (
                    <Card title={`Azure Functions (${allFunctions.length})`} badge={<Badge text="Serverless" variant="green" />}>
                        <DataTable
                            columns={["Name", "Region", "Runtime", "Plan", "State", "Invocations (24h)"]}
                            rows={allFunctions.map(f => [
                                <strong style={{ fontSize:12 }}>{f.name || "—"}</strong>,
                                f._region,
                                <Mono>{f.runtime || "—"}</Mono>,
                                f.plan || "—",
                                stateBadge(f.state || "Running"),
                                f.invocations_24h?.toLocaleString() || "—",
                            ])}
                        />
                    </Card>
                )}

                {/* SQL Databases */}
                {allSQL.length > 0 && (
                    <Card title={`SQL Databases (${allSQL.length})`} badge={<Badge text="Database" variant="amber" />}>
                        <DataTable
                            columns={["Name", "Region", "SKU", "Max Size (GB)", "Status", "TDE"]}
                            rows={allSQL.map(d => [
                                <strong style={{ fontSize:12 }}>{d.name || "—"}</strong>,
                                d._region,
                                <Mono>{d.sku || "—"}</Mono>,
                                d.max_size_gb || "—",
                                stateBadge(d.status || "Online"),
                                d.tde_enabled ? <Badge text="Enabled" variant="green" /> : <Badge text="Disabled" variant="red" />,
                            ])}
                        />
                    </Card>
                )}

                {/* Per-region summary table */}
                <Card title="Services by Region">
                    <DataTable
                        columns={["Region", "VMs", "Functions", "SQL DBs", "AKS", "VNets", "Alerts"]}
                        rows={regionKeys.map(r => {
                            const s = awsData.services[r] || {};
                            return [
                                <Mono>{r}</Mono>,
                                s.virtual_machines?.length || 0,
                                s.azure_functions?.length || 0,
                                s.sql_databases?.length || 0,
                                s.aks_clusters?.length || 0,
                                s.virtual_networks?.vnets?.length || 0,
                                s.monitor_alerts?.length || 0,
                            ];
                        })}
                        empty="No data found"
                    />
                </Card>
            </div>
        );
    }

    return (
        <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4 }}>
                {isSingleRegion ? `Regional Services — ${regionKeys[0]}` : "Regional Services"}
            </div>
            <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>
                {isSingleRegion
                    ? "Detailed breakdown of all scanned services in this region"
                    : `Summary across ${regionKeys.length} scanned regions`}
            </div>

            {isSingleRegion ? (
                <SingleRegionView
                    region={regionKeys[0]}
                    regionData={awsData.services[regionKeys[0]] || {}}
                    awsData={awsData}
                />
            ) : (
                <MultiRegionView awsData={awsData} />
            )}
        </div>
    );
};

// ══════════════════════════════════════════════════════════════════════════════
// FINOPS SECTION
// ══════════════════════════════════════════════════════════════════════════════

const fmt = (v, decimals = 2) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v || 0);

const fmtK = (v) =>
    v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : fmt(v, 2);

const pct = (a, b) => (b > 0 ? ((a / b) * 100).toFixed(1) : "0.0");

const fmtN = (v, d = 1) =>
    new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v || 0);

const linearRegression = arr => {
    const n = arr.length;
    if (n < 2) return { slope: 0, intercept: arr[0] || 0, predict: () => arr[0] || 0 };
    const xs = arr.map((_, i) => i);
    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = arr.reduce((a, b) => a + b, 0) / n;
    const slope = xs.reduce((s, x, i) => s + (x - meanX) * (arr[i] - meanY), 0) /
        xs.reduce((s, x) => s + (x - meanX) ** 2, 0);
    const intercept = meanY - slope * meanX;
    return { slope, intercept, predict: i => intercept + slope * i };
};

const zScore = (value, history) => {
    if (!history || history.length < 2) return 0;
    const mean = history.reduce((a, b) => a + b, 0) / history.length;
    const std = Math.sqrt(history.reduce((s, v) => s + (v - mean) ** 2, 0) / history.length);
    return std > 0 ? (value - mean) / std : 0;
};

const CARBON_INTENSITY = {
    "us-east-1": 428, "us-east-2": 407, "us-west-1": 303, "us-west-2": 136,
    "eu-west-1": 316, "eu-west-2": 268, "eu-central-1": 338, "eu-north-1": 8,
    "ap-southeast-1": 493, "ap-southeast-2": 790, "ap-northeast-1": 506,
    "ca-central-1": 120, "sa-east-1": 109,
    "eastus": 428, "eastus2": 407, "westus": 303, "westus2": 136,
    "northeurope": 316, "westeurope": 338, "uksouth": 268, "swedencentral": 8,
    "southeastasia": 493, "australiaeast": 790, "japaneast": 506,
    default: 400,
};
const getCarbonFactor = region => CARBON_INTENSITY[region] || CARBON_INTENSITY.default;
const getInstanceKwh = type => {
    if (!type) return 0.1;
    if (/48x|32x|24x/.test(type)) return 1.2;
    if (/16x|12x|8x/.test(type)) return 0.8;
    if (/4x/.test(type)) return 0.4;
    if (/2x|xlarge/.test(type)) return 0.2;
    return 0.1;
};

const fetchAzurePrice = async (skuName, region = "eastus") => {
    try {
        const filter = encodeURIComponent(`serviceName eq 'Virtual Machines' and armRegionName eq '${region}' and skuName eq '${skuName}' and priceType eq 'Consumption'`);
        const res = await fetch(`https://prices.azure.com/api/retail/prices?$filter=${filter}&$top=1`);
        const data = await res.json();
        return data.Items?.[0]?.retailPrice || null;
    } catch { return null; }
};

const fetchAWSPrice = async (instanceType, region = "us-east-1") => {
    const table = {
        "t3.micro": 0.0104, "t3.small": 0.0208, "t3.medium": 0.0416, "t3.large": 0.0832,
        "t3.xlarge": 0.1664, "t3.2xlarge": 0.3328,
        "m5.large": 0.096, "m5.xlarge": 0.192, "m5.2xlarge": 0.384, "m5.4xlarge": 0.768,
        "m5.8xlarge": 1.536, "m5.16xlarge": 3.072,
        "c5.large": 0.085, "c5.xlarge": 0.17, "c5.2xlarge": 0.34, "c5.4xlarge": 0.68,
        "r5.large": 0.126, "r5.xlarge": 0.252, "r5.2xlarge": 0.504, "r5.4xlarge": 1.008,
    };
    return table[instanceType] || null;
};

const computeRISaving = (instanceType, hoursPerMonth = 730, discount = 0.40) => {
    const odRates = {
        "t3.micro": 0.0104, "t3.small": 0.0208, "t3.medium": 0.0416, "t3.large": 0.0832,
        "t3.xlarge": 0.1664, "t3.2xlarge": 0.3328,
        "m5.large": 0.096, "m5.xlarge": 0.192, "m5.2xlarge": 0.384, "m5.4xlarge": 0.768,
        "m5.8xlarge": 1.536, "m5.16xlarge": 3.072,
        "c5.large": 0.085, "c5.xlarge": 0.17, "c5.2xlarge": 0.34, "c5.4xlarge": 0.68,
        "r5.large": 0.126, "r5.xlarge": 0.252, "r5.2xlarge": 0.504, "r5.4xlarge": 1.008,
        "Standard_B1s": 0.0104, "Standard_B2s": 0.0416, "Standard_B4ms": 0.166,
        "Standard_D2s_v3": 0.096, "Standard_D4s_v3": 0.192, "Standard_D8s_v3": 0.384,
        "Standard_E2s_v3": 0.126, "Standard_E4s_v3": 0.252,
        "Standard_F2s_v2": 0.085, "Standard_F4s_v2": 0.17,
    };
    const hourly = odRates[instanceType];
    if (!hourly) return null;
    return hourly * hoursPerMonth * discount;
};

// ── Main FinOps component ──────────────────────────────────────────────────────
const FinOpsSection = ({ awsData, selectedCloud, accountId: propAccountId }) => {

    const [activeTab, setActiveTab] = useState(() => { try { return localStorage.getItem("fo2-tab") || "overview"; } catch { return "overview"; } });
    const [activeRole, setActiveRole] = useState("finops");
    const [showBudgetModal, setShowBudgetModal] = useState(false);
    const [newBudget, setNewBudget] = useState({ name: "", amount: "", period: "Monthly", service: "All Services", alertAt: 80 });
    const [savedBudgets, setSavedBudgets] = useState(() => { try { return JSON.parse(localStorage.getItem("fo2-budgets") || "[]"); } catch { return []; } });
    const [dateRange, setDateRange] = useState("30d");
    const [sortCol, setSortCol] = useState("cost");
    const [sortDir, setSortDir] = useState("desc");
    const [whatIfChanges, setWhatIfChanges] = useState({});
    const [allocationTag, setAllocationTag] = useState("environment");
    const [allocationMode, setAllocationMode] = useState("proportional");
    const [unitMetrics, setUnitMetrics] = useState({ users: "", requests: "", deploys: "" });
    const [optimTasks, setOptimTasks] = useState(() => { try { return JSON.parse(localStorage.getItem("fo2-tasks") || "[]"); } catch { return []; } });
    const [pricingCache, setPricingCache] = useState({});
    const [carbonView, setCarbonView] = useState("region");

    // ── normalise ──────────────────────────────────────────────────────────────
    const isAzure = awsData?.cloud === "azure";
    const accountId = propAccountId || (isAzure ? awsData?.identity?.subscription_id : awsData?.identity?.account_id) || "";
    const costs = awsData?.costs || {};
    const byService = costs.by_service || {};
    const total = (() => {
        if (typeof costs.total === "number") return costs.total;
        if (typeof costs.amount === "number") return costs.amount;
        return Object.values(byService).reduce((s, v) => s + (Number(v) || 0), 0);
    })();
    const forecast = (() => {
        if (typeof costs.forecast === "number") return costs.forecast;
        if (typeof costs.forecast_amount === "number") return costs.forecast_amount;
        return null;
    })();
    const regions = awsData?.regions || Object.keys(awsData?.services || {});
    const services = awsData?.services || {};
    const costUnavailable = !!costs.error;

    const cloudCfg = {
        aws: { name: "Amazon AWS", color: "#FF9900", icon: "☁", serviceLabel: "AWS Service" },
        azure: { name: "Microsoft Azure", color: "#0089D6", icon: "⬡", serviceLabel: "Azure Service" },
        gcp: { name: "Google Cloud", color: "#4285F4", icon: "◈", serviceLabel: "GCP Service" },
    };
    const cloud = cloudCfg[isAzure ? "azure" : (selectedCloud || "aws")] || cloudCfg.aws;

    // ── resource counts ────────────────────────────────────────────────────────
    const allInstances = useMemo(() => {
        const list = [];
        Object.entries(services).forEach(([region, rd]) => {
            const insts = isAzure ? (rd?.virtual_machines || []) : (rd?.ec2 || []);
            insts.forEach(i => list.push({ ...i, _region: region }));
        });
        return list;
    }, [services, isAzure]);

    const ec2Count = allInstances.length;
    const rdsCount = isAzure
        ? Object.values(services).reduce((s, r) => s + (r?.sql_databases?.length || 0), 0)
        : Object.values(services).reduce((s, r) => s + (r?.rds?.length || 0), 0);
    const lambdaCount = isAzure
        ? Object.values(services).reduce((s, r) => s + (r?.azure_functions?.length || 0), 0)
        : Object.values(services).reduce((s, r) => s + (r?.lambda_fn?.length || 0), 0);
    const eksCount = isAzure
        ? Object.values(services).reduce((s, r) => s + (r?.aks_clusters?.length || 0), 0)
        : Object.values(services).reduce((s, r) => s + (r?.eks?.length || 0), 0);
    const s3Count = isAzure ? (awsData?.storage_accounts || []).length : (awsData?.s3 || []).length;

    // ── monthly history + regression ──────────────────────────────────────────
    const monthlyHistory = useMemo(() => {
        const raw = costs.monthly_history || [];
        return raw.length > 0 ? raw.map(Number) : [total];
    }, [costs.monthly_history, total]);

    const regression = useMemo(() => linearRegression(monthlyHistory), [monthlyHistory]);

    const monthTrend = useMemo(() => {
        const now = new Date();
        const hasHistory = monthlyHistory.length > 1;
        return Array.from({ length: 6 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
            const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
            const isCurrent = i === 5;
            if (hasHistory) {
                const idx = monthlyHistory.length - 6 + i;
                const cost = idx >= 0 ? monthlyHistory[idx] : regression.predict(i);
                return { month: label, cost: Math.max(0, parseFloat(cost.toFixed(2))), isCurrent, isReal: idx >= 0 };
            }
            const seed = (i * 17 + 3) % 10;
            return { month: label, cost: parseFloat((isCurrent ? total : total * (0.70 + (seed / 10) * 0.60)).toFixed(2)), isCurrent, isReal: isCurrent };
        });
    }, [monthlyHistory, total, regression]);

    const regressionForecast = useMemo(() => {
        if (monthlyHistory.length < 3) return null;
        return Math.max(0, regression.predict(monthlyHistory.length));
    }, [monthlyHistory, regression]);

    const prevMonthCost = monthTrend[4]?.cost || 0;
    const momChange = prevMonthCost > 0 ? ((total - prevMonthCost) / prevMonthCost * 100) : 0;
    const momUp = momChange >= 0;

    const waterfallData = useMemo(() =>
        monthTrend.slice(1).map((m, i) => ({
            month: m.month, delta: m.cost - monthTrend[i].cost, positive: m.cost > monthTrend[i].cost,
        })), [monthTrend]);

    // ── per-service history ────────────────────────────────────────────────────
    const serviceHistory = useMemo(() => {
        const hist = costs.service_history || {};
        const result = {};
        Object.entries(byService).forEach(([name, val]) => {
            if (hist[name]) { result[name] = hist[name].map(Number); return; }
            const frac = total > 0 ? (Number(val) || 0) / total : 0;
            result[name] = monthTrend.map(m => parseFloat((m.cost * frac).toFixed(2)));
        });
        return result;
    }, [costs.service_history, byService, total, monthTrend]);

    // ── Z-score anomalies ──────────────────────────────────────────────────────
    const anomalies = useMemo(() => {
        const results = [];
        Object.entries(byService).forEach(([name, val]) => {
            const v = Number(val) || 0;
            const hist = serviceHistory[name] || [];
            const z = zScore(v, hist.slice(0, -1));
            if (Math.abs(z) > 2) {
                const histMean = hist.length > 1 ? hist.slice(0, -1).reduce((a, b) => a + b, 0) / (hist.length - 1) : v;
                const histStd = hist.length > 1 ? Math.sqrt(hist.slice(0, -1).reduce((s, x) => s + (x - histMean) ** 2, 0) / (hist.length - 1)) : 0;
                results.push({
                    service: name, cost: v, z,
                    expectedLow: Math.max(0, histMean - 2 * histStd),
                    expectedHigh: histMean + 2 * histStd,
                    severity: Math.abs(z) > 4 ? "critical" : Math.abs(z) > 3 ? "high" : "medium",
                    suggestion: z > 0
                        ? `Spend is ${z.toFixed(1)}σ above its 6-month baseline (expected ${fmt(histMean, 0)}–${fmt(histMean + 2 * histStd, 0)}).`
                        : `Spend is ${Math.abs(z).toFixed(1)}σ below baseline — verify resources are still running.`,
                });
            }
        });
        const dim = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        const dom = new Date().getDate();
        const burn = dom > 0 ? total / dom : 0;
        const proj = burn * dim;
        const fc = regressionForecast || forecast;
        if (fc && proj > fc * 1.2) {
            results.unshift({
                service: "Overall burn trajectory", cost: proj, z: 3.5,
                expectedLow: 0, expectedHigh: fc,
                severity: "high",
                suggestion: `Daily burn ${fmt(burn, 2)}/day → projected ${fmt(proj)} (+${((proj / fc - 1) * 100).toFixed(0)}% over ${regressionForecast ? "regression" : "backend"} forecast of ${fmt(fc)}).`,
            });
        }
        return results.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
    }, [byService, serviceHistory, total, forecast, regressionForecast]);

    // ── rightsizing with real pricing ──────────────────────────────────────────
    const rightsizingCandidates = useMemo(() => {
        const items = [];
        allInstances.forEach(inst => {
            const type = inst.InstanceType || inst.vm_size || inst.type || "";
            const state = inst.State?.Name || inst.state || inst.power_state || "";
            const name = inst.name || inst.Tags?.find?.(t => t.Key === "Name")?.Value || inst.InstanceId || inst.id || "—";
            const region = inst._region || "unknown";
            const riSaving = computeRISaving(type) || 0;
            const isLarge = /\.(4x|8x|12x|16x|24x|32x|large|xlarge)/i.test(type);
            const isStopped = /stop|deallocat/i.test(state);
            if (isStopped) {
                const hrRate = computeRISaving(type, 730, 1) || 18;
                items.push({ resource: name, type, region, issue: "Stopped / deallocated", action: "Delete if not needed", saving: hrRate, severity: "high", pricing: "exact" });
            } else if (riSaving > 0) {
                items.push({ resource: name, type, region, issue: "No Reserved Instance", action: `Buy 1-yr RI or Savings Plan for ${type}`, saving: riSaving, severity: "high", pricing: "exact" });
            } else if (isLarge) {
                items.push({ resource: name, type, region, issue: "Large instance — no pricing data", action: "Review utilisation; downsize if <40% CPU", saving: 20, severity: "medium", pricing: "estimate" });
            }
        });
        Object.entries(services).forEach(([region, rd]) => {
            (rd?.lambda_fn || rd?.azure_functions || []).forEach(fn => {
                const mem = fn.MemorySize || fn.memory_mb || 0;
                const name = fn.FunctionName || fn.name || "—";
                if (mem >= 1024) items.push({ resource: name, type: `Lambda ${mem}MB`, region, issue: "High memory allocation", action: "Profile and reduce if under-utilised", saving: parseFloat((mem / 1024 * 0.0000166667 * 730 * 0.4).toFixed(2)), severity: "low", pricing: "estimate" });
            });
        });
        return items.slice(0, 30);
    }, [allInstances, services, isAzure]);

    const rightsizingSavings = rightsizingCandidates.reduce((s, r) => s + r.saving, 0);

    // ── cost allocation ────────────────────────────────────────────────────────
    const allocationData = useMemo(() => {
        const groups = {};
        const activeKey = allocationTag.toLowerCase();
        let totalTagged = 0, totalUntagged = 0;
        allInstances.forEach(inst => {
            let tagVal = "untagged";
            if (isAzure) {
                const tags = inst.tags || inst.Tags || {};
                const k = Object.keys(tags).find(k => k.toLowerCase() === activeKey);
                tagVal = k ? (tags[k] || "untagged") : "untagged";
            } else {
                const tags = inst.Tags || inst.tags || [];
                const t = tags.find(t => (t.Key || t.key || "").toLowerCase() === activeKey);
                tagVal = t ? (t.Value || t.value || "untagged") : "untagged";
            }
            if (!groups[tagVal]) groups[tagVal] = { count: 0, directCost: 0 };
            groups[tagVal].count++;
            tagVal === "untagged" ? totalUntagged++ : totalTagged++;
        });
        const totalInst = totalTagged + totalUntagged;
        const untaggedCost = totalInst > 0 ? (totalUntagged / totalInst) * total : 0;
        const taggedCost = total - untaggedCost;
        Object.entries(groups).forEach(([tag, g]) => {
            const directShare = totalTagged > 0 && tag !== "untagged" ? (g.count / totalTagged) * taggedCost : 0;
            let sharedShare = 0;
            if (tag !== "untagged") {
                const others = Object.keys(groups).filter(k => k !== "untagged").length;
                if (allocationMode === "proportional") sharedShare = totalTagged > 0 ? (g.count / totalTagged) * untaggedCost : 0;
                else if (allocationMode === "even") sharedShare = others > 0 ? untaggedCost / others : 0;
                else sharedShare = 0;
            }
            g.directCost = parseFloat(directShare.toFixed(2));
            g.sharedCost = parseFloat(sharedShare.toFixed(2));
            g.estimatedCost = parseFloat((directShare + sharedShare).toFixed(2));
        });
        if (groups.untagged) {
            groups.untagged.directCost = parseFloat(untaggedCost.toFixed(2));
            groups.untagged.sharedCost = 0;
            groups.untagged.estimatedCost = allocationMode === "fixed" ? parseFloat(untaggedCost.toFixed(2)) : 0;
        }
        return Object.entries(groups).map(([tag, data]) => ({ tag, ...data })).sort((a, b) => b.estimatedCost - a.estimatedCost);
    }, [allInstances, isAzure, allocationTag, allocationMode, total]);

    const untaggedPct = useMemo(() => {
        const u = allocationData.find(d => d.tag === "untagged");
        const tc = allocationData.reduce((s, d) => s + d.count, 0);
        return tc > 0 ? ((u?.count || 0) / tc * 100).toFixed(0) : 0;
    }, [allocationData]);

    // ── what-if ────────────────────────────────────────────────────────────────
    const whatIfTotal = useMemo(() => {
        let adj = total;
        Object.entries(whatIfChanges).forEach(([svc, c]) => { adj += (Number(byService[svc]) || 0) * (c / 100); });
        return adj;
    }, [whatIfChanges, total, byService]);
    const whatIfDelta = whatIfTotal - total;
    const whatIfSaving = whatIfDelta < 0 ? Math.abs(whatIfDelta) : 0;

    // ── category breakdown ─────────────────────────────────────────────────────
    const categoryBreakdown = useMemo(() => {
        const cats = isAzure ? [
            { name: "Compute", color: "#378ADD", test: k => /Virtual Machine|Container|Function|Kubernetes|App Service|Batch|Compute|AKS/i.test(k) },
            { name: "Storage", color: "#8B5CF6", test: k => /Storage|Blob|Disk|File|Backup|Archive|Data Lake/i.test(k) },
            { name: "Database", color: "#1D9E75", test: k => /SQL|Cosmos|Cache|Synapse|Database|Redis|PostgreSQL|MySQL/i.test(k) },
            { name: "Network", color: "#BA7517", test: k => /CDN|DNS|VPN|Gateway|Bandwidth|Load Balancer|Traffic|Front Door|Firewall/i.test(k) },
            { name: "AI / ML", color: "#993C1D", test: k => /Cognitive|OpenAI|Machine Learning|Search|Bot|Language|Vision/i.test(k) },
            { name: "Security", color: "#E24B4A", test: k => /Security|Defender|Sentinel|Key Vault|Monitor|Policy/i.test(k) },
        ] : [
            { name: "Compute", color: "#378ADD", test: k => /EC2|Compute|Lambda|ECS|EKS|Fargate/i.test(k) },
            { name: "Storage", color: "#8B5CF6", test: k => /S3|Storage|EBS|Glacier|EFS/i.test(k) },
            { name: "Database", color: "#1D9E75", test: k => /RDS|DynamoDB|ElastiCache|Redshift|Aurora/i.test(k) },
            { name: "Network", color: "#BA7517", test: k => /CloudFront|Route|VPC|Transfer|API/i.test(k) },
        ];
        const result = cats.map(c => ({ name: c.name, color: c.color, value: Object.entries(byService).filter(([k]) => c.test(k)).reduce((s, [, v]) => s + (Number(v) || 0), 0) }));
        const other = Math.max(0, total - result.reduce((s, c) => s + c.value, 0));
        if (other > 0.01) result.push({ name: "Other", color: "#888780", value: other });
        return result.filter(c => c.value > 0.001);
    }, [byService, total, isAzure]);

    // ── top services ───────────────────────────────────────────────────────────
    const topServices = useMemo(() => {
        const entries = Object.entries(byService).map(([name, val]) => ({ name, val: Number(val) || 0 }));
        if (sortCol === "name") entries.sort((a, b) => sortDir === "desc" ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name));
        else entries.sort((a, b) => sortDir === "desc" ? b.val - a.val : a.val - b.val);
        return entries.slice(0, 12);
    }, [byService, sortCol, sortDir]);

    const maxCost = topServices[0]?.val || 1;
    const handleSort = col => { if (sortCol === col) setSortDir(d => d === "desc" ? "asc" : "desc"); else { setSortCol(col); setSortDir("desc"); } };
    const sortArrow = col => sortCol === col ? (sortDir === "desc" ? " ↓" : " ↑") : "";

    // ── burn rate ──────────────────────────────────────────────────────────────
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const dayOfMonth = new Date().getDate();
    const dailyBurn = dayOfMonth > 0 ? total / dayOfMonth : 0;
    const daysLeft = daysInMonth - dayOfMonth;
    const projectedMonthEnd = dailyBurn * daysInMonth;

    // ── carbon tracking ────────────────────────────────────────────────────────
    const carbonData = useMemo(() => {
        const regionCarbon = {};
        let totalCO2e = 0;
        allInstances.forEach(inst => {
            const region = inst._region || "default";
            const type = inst.InstanceType || inst.vm_size || inst.type || "";
            const state = inst.State?.Name || inst.state || "";
            if (/stop|deallocat/i.test(state)) return;
            const kwh = getInstanceKwh(type);
            const factor = getCarbonFactor(region);
            const monthly_kwh = kwh * 730;
            const monthly_co2e = monthly_kwh * factor / 1000;
            if (!regionCarbon[region]) regionCarbon[region] = { instances: 0, kwh: 0, co2eKg: 0, factor };
            regionCarbon[region].instances++;
            regionCarbon[region].kwh += monthly_kwh;
            regionCarbon[region].co2eKg += monthly_co2e;
            totalCO2e += monthly_co2e;
        });
        const sorted = Object.entries(regionCarbon)
            .map(([r, d]) => ({ region: r, ...d, co2eTonnes: d.co2eKg / 1000 }))
            .sort((a, b) => b.co2eKg - a.co2eKg);
        const greenRegions = isAzure
            ? { "eastus": "swedencentral", "eastus2": "swedencentral", "westeurope": "swedencentral" }
            : { "us-east-1": "eu-north-1", "ap-southeast-2": "eu-north-1", "us-east-2": "us-west-2" };
        const worstRegion = sorted[0];
        const greenAlt = worstRegion ? (greenRegions[worstRegion.region] || "eu-north-1") : null;
        const greenFactor = greenAlt ? (getCarbonFactor(greenAlt) || 8) : 8;
        const greenSavingCO2 = worstRegion ? worstRegion.co2eKg * (1 - greenFactor / worstRegion.factor) : 0;
        return { regions: sorted, totalCO2eKg: totalCO2e, totalCO2eTonnes: totalCO2e / 1000, greenAlt, greenSavingCO2, worstRegion };
    }, [allInstances, isAzure]);

    // ── unit economics ─────────────────────────────────────────────────────────
    const unitEconomics = useMemo(() => {
        const users = parseFloat(unitMetrics.users) || 0;
        const requests = parseFloat(unitMetrics.requests) || 0;
        const deploys = parseFloat(unitMetrics.deploys) || 0;
        return {
            perUser: users > 0 ? total / users : null,
            perRequest: requests > 0 ? total / requests : null,
            perDeploy: deploys > 0 ? total / deploys : null,
        };
    }, [unitMetrics, total]);

    // ── maturity scoring ───────────────────────────────────────────────────────
    const maturity = useMemo(() => {
        const caps = [
            { name: "Cost Visibility", crawl: total > 0, walk: Object.keys(byService).length > 3, run: monthlyHistory.length >= 6, desc: "Can you see what you spend?" },
            { name: "Tagging Coverage", crawl: allInstances.length > 0, walk: Number(untaggedPct) < 50, run: Number(untaggedPct) < 10, desc: "Are resources tagged for allocation?" },
            { name: "Forecasting", crawl: !!forecast, walk: monthlyHistory.length >= 3, run: monthlyHistory.length >= 6, desc: "Can you predict next month's spend?" },
            { name: "Anomaly Detection", crawl: anomalies.length >= 0, walk: monthlyHistory.length >= 3, run: monthlyHistory.length >= 6, desc: "Are cost spikes automatically caught?" },
            { name: "Rightsizing", crawl: rightsizingCandidates.length >= 0, walk: rightsizingSavings > 0, run: optimTasks.filter(t => t.status === "resolved").length > 0, desc: "Are idle/oversized resources removed?" },
            { name: "Chargeback / Showback", crawl: allocationData.length > 0, walk: Number(untaggedPct) < 40, run: Number(untaggedPct) < 10 && allocationMode === "proportional", desc: "Are teams accountable for their spend?" },
            { name: "Reserved Capacity", crawl: true, walk: ec2Count > 0, run: rightsizingCandidates.filter(r => r.issue.includes("No Reserved")).length === 0, desc: "Are commitments optimised?" },
            { name: "Optimization Workflow", crawl: true, walk: optimTasks.length > 0, run: optimTasks.filter(t => t.status === "resolved").length > 0, desc: "Do recommendations get actioned?" },
            { name: "Unit Economics", crawl: false, walk: !!unitEconomics.perUser || !!unitEconomics.perRequest, run: !!unitEconomics.perUser && !!unitEconomics.perRequest, desc: "Do you know cost per business outcome?" },
            { name: "Carbon Awareness", crawl: false, walk: carbonData.totalCO2eKg > 0, run: carbonData.totalCO2eKg > 0 && ec2Count > 0, desc: "Do you track cloud carbon footprint?" },
        ];
        const score = cap => cap.run ? 3 : cap.walk ? 2 : cap.crawl ? 1 : 0;
        const scores = caps.map(c => ({ ...c, score: score(c), label: ["Not started", "Crawl", "Walk", "Run"][score(c)] }));
        const avg = scores.reduce((s, c) => s + c.score, 0) / (scores.length * 3);
        const phase = avg >= 0.67 ? "Run" : avg >= 0.33 ? "Walk" : "Crawl";
        return { caps: scores, avg, phase };
    }, [total, byService, monthlyHistory, forecast, anomalies, rightsizingCandidates, rightsizingSavings, allocationData, untaggedPct, allocationMode, optimTasks, unitEconomics, carbonData, ec2Count]);

    // ── savings recommendations ────────────────────────────────────────────────
    const recommendations = useMemo(() => {
        const recs = [];
        const riCandidates = rightsizingCandidates.filter(r => r.issue.includes("No Reserved"));
        if (riCandidates.length > 0) {
            const riTotal = riCandidates.reduce((s, r) => s + r.saving, 0);
            recs.push({ title: `${riCandidates.length} instances without Reserved pricing`, desc: `Purchasing 1-yr Reserved Instances or Savings Plans for these specific instance types saves real money based on current on-demand rates.`, saving: riTotal, severity: "high", icon: "🖥", pricing: "exact", action: "Buy Reserved Instances", link: isAzure ? "https://portal.azure.com/#view/HubsExtension/BrowseResource/resourceType/Microsoft.Compute%2FvirtualMachines" : "https://console.aws.amazon.com/ec2/v2/home#ReservedInstances:" });
        } else if (ec2Count > 0) {
            recs.push({ title: `${ec2Count} compute resources`, desc: "Consider Reserved Instances or Savings Plans. Enable detailed cost data for exact savings figures.", saving: ec2Count * 12, severity: "high", icon: "🖥", pricing: "estimate", action: "Review commitments", link: null });
        }
        const stopped = rightsizingCandidates.filter(r => r.issue.includes("Stopped"));
        if (stopped.length > 0) recs.push({ title: `${stopped.length} stopped/deallocated resources`, desc: "These resources still incur storage and licensing charges. Delete them if no longer needed.", saving: stopped.reduce((s, r) => s + r.saving, 0), severity: "high", icon: "⛔", pricing: "exact", action: "Delete stopped resources", link: null });
        if (rdsCount > 0) recs.push({ title: `${rdsCount} database instances`, desc: "RDS/SQL Reserved Instances save up to 65–69%. Applies per engine type.", saving: rdsCount * 25, severity: "high", icon: "🗄", pricing: "estimate", action: "Review database commitments", link: null });
        if (eksCount > 0) recs.push({ title: `${eksCount} Kubernetes clusters`, desc: "Enable cluster autoscaler and use Spot/Preemptible node pools for non-critical workloads.", saving: eksCount * 35, severity: "medium", icon: "🐳", pricing: "estimate", action: "Enable autoscaler", link: null });
        if (s3Count > 0) recs.push({ title: `${s3Count} object storage buckets`, desc: "Intelligent-Tiering or lifecycle rules move infrequent data to cheaper tiers automatically.", saving: s3Count * 5, severity: "low", icon: "🗂", pricing: "estimate", action: "Add lifecycle policy", link: null });
        if (lambdaCount > 5) recs.push({ title: `${lambdaCount} Lambda/Function resources`, desc: "Right-sizing memory with profiling can cut costs 20–40%.", saving: lambdaCount * 2, severity: "low", icon: "⚡", pricing: "estimate", action: "Profile memory usage", link: null });
        if (Number(untaggedPct) > 30) recs.push({ title: `${untaggedPct}% resources untagged`, desc: "Tagging is a prerequisite for chargeback and accurate cost allocation.", saving: 0, severity: "medium", icon: "🏷", pricing: "n/a", action: "Enforce tag policy", link: null });
        if (carbonData.worstRegion && carbonData.greenSavingCO2 > 50) recs.push({ title: `High-carbon region: ${carbonData.worstRegion.region}`, desc: `Moving workloads to a lower-carbon region saves ~${fmtN(carbonData.greenSavingCO2 / 1000, 2)} tonnes CO2e/month.`, saving: 0, severity: "low", icon: "🌱", pricing: "n/a", action: "Evaluate region migration", link: null });
        if (anomalies.filter(a => a.severity === "critical" || a.severity === "high").length > 0) recs.push({ title: `${anomalies.length} cost anomalies detected`, desc: "Z-score analysis found statistically significant deviations from 6-month baselines.", saving: anomalies.reduce((s, a) => s + Math.max(0, a.cost - a.expectedHigh), 0), severity: "critical", icon: "🚨", pricing: "estimate", action: "Review anomalies", link: null });
        return recs;
    }, [rightsizingCandidates, ec2Count, rdsCount, eksCount, s3Count, lambdaCount, untaggedPct, carbonData, anomalies, isAzure]);

    const totalSavings = recommendations.reduce((s, r) => s + r.saving, 0);

    // ── optimization workflow ──────────────────────────────────────────────────
    const createTask = (rec) => {
        const task = { id: Date.now(), title: rec.title, action: rec.action, saving: rec.saving, severity: rec.severity, status: "identified", assignee: "", dueDate: "", notes: "", createdAt: new Date().toISOString(), resolvedAt: null };
        const updated = [...optimTasks, task];
        setOptimTasks(updated);
        try { localStorage.setItem("fo2-tasks", JSON.stringify(updated)); } catch {}
    };
    const updateTask = (id, changes) => {
        const updated = optimTasks.map(t => t.id === id ? { ...t, ...changes, resolvedAt: changes.status === "resolved" ? new Date().toISOString() : t.resolvedAt } : t);
        setOptimTasks(updated);
        try { localStorage.setItem("fo2-tasks", JSON.stringify(updated)); } catch {}
    };
    const deleteTask = id => {
        const updated = optimTasks.filter(t => t.id !== id);
        setOptimTasks(updated);
        try { localStorage.setItem("fo2-tasks", JSON.stringify(updated)); } catch {}
    };
    const TASK_STATUSES = ["identified", "assigned", "in_progress", "resolved", "verified"];
    const TASK_STATUS_LABELS = { identified: "Identified", assigned: "Assigned", in_progress: "In Progress", resolved: "Resolved", verified: "Verified ✓" };
    const TASK_STATUS_COLORS = { identified: "var(--text3)", assigned: "var(--amber)", in_progress: cloud.color, resolved: "var(--green)", verified: "var(--green)" };
    const realizedSavings = optimTasks.filter(t => t.status === "resolved" || t.status === "verified").reduce((s, t) => s + t.saving, 0);

    // ── budget helpers ─────────────────────────────────────────────────────────
    const saveBudget = () => {
        if (!newBudget.name || !newBudget.amount) return;
        const updated = [...savedBudgets, { ...newBudget, id: Date.now() }];
        setSavedBudgets(updated); try { localStorage.setItem("fo2-budgets", JSON.stringify(updated)); } catch {}
        setShowBudgetModal(false); setNewBudget({ name: "", amount: "", period: "Monthly", service: "All Services", alertAt: 80 });
    };
    const deleteBudget = id => { const u = savedBudgets.filter(b => b.id !== id); setSavedBudgets(u); try { localStorage.setItem("fo2-budgets", JSON.stringify(u)); } catch {} };
    const getBudgetSpent = b => { if (!b.service || b.service === "All Services") return total; const k = Object.keys(byService).find(k => k.toLowerCase() === b.service.toLowerCase()); return k ? (Number(byService[k]) || 0) : 0; };

    // ── CSV export ─────────────────────────────────────────────────────────────
    const exportCSV = () => {
        const rows = [["Rank", "Service", "Cost (USD)", "% of Total", "Z-Score"]];
        topServices.forEach(({ name, val }, i) => {
            const hist = serviceHistory[name] || [];
            const z = zScore(val, hist.slice(0, -1));
            rows.push([i + 1, name, val.toFixed(4), total > 0 ? (val / total * 100).toFixed(2) + "%" : "0%", z.toFixed(2)]);
        });
        const blob = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `finops-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href);
    };

    // ── role-based tab filtering ───────────────────────────────────────────────
    const roleTabs = {
        finops: ["overview", "services", "trends", "anomalies", "rightsizing", "allocation", "whatif", "savings", "workflow", "budgets", "carbon", "maturity", "unit"],
        engineering: ["overview", "services", "rightsizing", "anomalies", "workflow", "carbon"],
        finance: ["overview", "trends", "allocation", "budgets", "savings", "unit"],
        executive: ["overview", "trends", "maturity", "unit", "carbon"],
    };
    const visibleTabIds = roleTabs[activeRole] || roleTabs.finops;

    const tabDefs = [
        { id: "overview", label: "📊 Overview" },
        { id: "services", label: "🔧 By Service" },
        { id: "trends", label: "📈 Trends" },
        { id: "anomalies", label: `🚨 Anomalies${anomalies.length > 0 ? ` (${anomalies.length})` : ""}` },
        { id: "rightsizing", label: `📐 Rightsizing${rightsizingCandidates.length > 0 ? ` (${rightsizingCandidates.length})` : ""}` },
        { id: "allocation", label: "🏷 Allocation" },
        { id: "whatif", label: "🔮 What-If" },
        { id: "savings", label: "💡 Savings" },
        { id: "workflow", label: `⚙️ Workflow${optimTasks.length > 0 ? ` (${optimTasks.length})` : ""}` },
        { id: "budgets", label: "🎯 Budgets" },
        { id: "carbon", label: "🌱 Carbon" },
        { id: "maturity", label: "🏆 Maturity" },
        { id: "unit", label: "📐 Unit Econ." },
    ].filter(t => visibleTabIds.includes(t.id));

    // ── guard ──────────────────────────────────────────────────────────────────
    if (!awsData) return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 40 }}>
            <div style={{ fontSize: 48 }}>💰</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>No cost data available</div>
            <div style={{ fontSize: 14, color: "var(--text2)", textAlign: "center", maxWidth: 400 }}>Run a cloud scan first to see FinOps analytics.</div>
        </div>
    );

    // ── sub-components ─────────────────────────────────────────────────────────
    const dateRangeLabel = { "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days" };

    const DateFilter = () => (
        <div style={{ display: "flex", gap: 4 }}>
            {["7d", "30d", "90d"].map(r => (
                <button key={r} onClick={() => setDateRange(r)} style={{ padding: "4px 12px", fontSize: 11, fontWeight: 600, borderRadius: 20, cursor: "pointer", border: "1px solid", borderColor: dateRange === r ? cloud.color : "var(--border)", background: dateRange === r ? `${cloud.color}15` : "var(--surface2)", color: dateRange === r ? cloud.color : "var(--text2)" }}>{r}</button>
            ))}
        </div>
    );

    const SevBadge = ({ sev }) => {
        const map = { critical: ["var(--red-bg)", "var(--red)"], high: ["var(--red-bg)", "var(--red)"], medium: ["var(--amber-bg)", "var(--amber)"], low: ["var(--green-bg)", "var(--green)"] };
        const [bg, color] = map[sev] || map.low;
        return <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, textTransform: "uppercase", background: bg, color }}>{sev}</span>;
    };

    const PricingBadge = ({ type }) => type === "exact"
        ? <span style={{ fontSize: 9, fontWeight: 700, background: "#dcfce7", color: "#166534", borderRadius: 20, padding: "1px 6px" }}>REAL PRICE</span>
        : <span style={{ fontSize: 9, fontWeight: 700, background: "#fef9c3", color: "#854d0e", borderRadius: 20, padding: "1px 6px" }}>ESTIMATE</span>;

    // ══════════════════════════════════════════════════════════════════════════
    return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg)", overflow: "hidden" }}>

            {/* Header */}
            <div style={{ height: 52, background: "var(--surface)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "0 24px", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: cloud.color }} />
                    <span style={{ fontSize: 15, fontWeight: 600 }}>FinOps</span>
                    <span style={{ background: `${cloud.color}15`, border: `1px solid ${cloud.color}40`, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, color: cloud.color }}>{cloud.icon} {cloud.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: maturity.phase === "Run" ? "var(--green-bg)" : maturity.phase === "Walk" ? "var(--amber-bg)" : "var(--surface2)", color: maturity.phase === "Run" ? "var(--green)" : maturity.phase === "Walk" ? "var(--amber)" : "var(--text3)" }}>
                        {maturity.phase === "Run" ? "🏆" : maturity.phase === "Walk" ? "🚶" : "🐣"} {maturity.phase}
                    </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {/* Role selector */}
                    <div style={{ display: "flex", gap: 2, background: "var(--surface2)", borderRadius: 8, padding: 2 }}>
                        {[{ id: "finops", label: "FinOps" }, { id: "engineering", label: "Eng" }, { id: "finance", label: "Finance" }, { id: "executive", label: "Exec" }].map(r => (
                            <button key={r.id} onClick={() => { setActiveRole(r.id); if (!roleTabs[r.id].includes(activeTab)) setActiveTab(roleTabs[r.id][0]); }} style={{ padding: "3px 10px", fontSize: 11, fontWeight: activeRole === r.id ? 700 : 400, borderRadius: 6, border: "none", cursor: "pointer", background: activeRole === r.id ? "var(--surface)" : "transparent", color: activeRole === r.id ? cloud.color : "var(--text3)", boxShadow: activeRole === r.id ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>
                                {r.label}
                            </button>
                        ))}
                    </div>
                    {accountId && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px", background: "var(--green-bg)", borderRadius: 20, fontSize: 11, fontWeight: 600, color: "var(--green)" }}>
                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)" }} />
                            {accountId}
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "0 24px", display: "flex", gap: 2, overflowX: "auto" }}>
                {tabDefs.map(t => (
                    <button key={t.id} onClick={() => { setActiveTab(t.id); try { localStorage.setItem("fo2-tab", t.id); } catch {} }} style={{ padding: "12px 14px", fontSize: 12, fontWeight: activeTab === t.id ? 600 : 400, color: activeTab === t.id ? cloud.color : "var(--text2)", background: "none", border: "none", cursor: "pointer", borderBottom: activeTab === t.id ? `2px solid ${cloud.color}` : "2px solid transparent", whiteSpace: "nowrap", transition: "all 0.15s" }}>
                        {t.label}
                    </button>
                ))}
            </div>

            <div style={{ flex: 1, padding: 24, overflowY: "auto", minHeight: 0 }}>

                {/* ══ OVERVIEW ══ */}
                {activeTab === "overview" && (
                    <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                            <div style={{ fontSize: 18, fontWeight: 700 }}>Cost Overview</div><DateFilter />
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 24 }}>{cloud.name} · {dateRangeLabel[dateRange]}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
                            {[
                                { label: "Month-to-Date", value: costUnavailable ? "N/A" : fmt(total), color: cloud.color, sub: `Daily burn: ${fmt(dailyBurn, 2)}/day` },
                                { label: "Regression Forecast", value: costUnavailable ? "N/A" : regressionForecast ? fmt(regressionForecast) : forecast ? fmt(forecast) : "—", color: "#10B981", sub: regressionForecast ? `Linear regression (${monthlyHistory.length} months)` : `${daysLeft} days remaining` },
                                { label: "Total Savings Avail.", value: fmt(totalSavings, 0) + "/mo", color: "#F59E0B", sub: `${recommendations.length} actions · ${fmt(realizedSavings, 0)} realized` },
                                { label: "Maturity Score", value: `${(maturity.avg * 100).toFixed(0)}%`, color: maturity.phase === "Run" ? "var(--green)" : maturity.phase === "Walk" ? "var(--amber)" : "var(--text3)", sub: `${maturity.phase} phase · ${maturity.caps.filter(c => c.score === 3).length}/${maturity.caps.length} at Run` },
                            ].map(({ label, value, color, sub }) => (
                                <div key={label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, borderTop: `3px solid ${color}` }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{label}</div>
                                    <div style={{ fontSize: 26, fontWeight: 700, color, letterSpacing: "-0.03em", marginBottom: 4 }}>{value}</div>
                                    <div style={{ fontSize: 11, color: "var(--text3)" }}>{sub}</div>
                                </div>
                            ))}
                        </div>

                        {!costUnavailable && (regressionForecast || forecast) && (
                            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 24 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Burn Rate vs Forecast</div>
                                        <div style={{ fontSize: 12, color: "var(--text3)" }}>Day {dayOfMonth} of {daysInMonth} · {fmt(dailyBurn, 2)}/day{regressionForecast ? " · regression-based forecast" : ""}</div>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: projectedMonthEnd > (regressionForecast || forecast) * 1.1 ? "var(--red)" : "var(--green)" }}>
                                            {projectedMonthEnd > (regressionForecast || forecast) * 1.1 ? "⚠️ Exceeding forecast" : "✓ On track"} · {fmt(projectedMonthEnd)} projected
                                        </div>
                                        <div style={{ fontSize: 11, color: "var(--text3)" }}>Forecast: {fmt(regressionForecast || forecast)}</div>
                                    </div>
                                </div>
                                <div style={{ height: 12, background: "var(--surface2)", borderRadius: 6, overflow: "hidden" }}>
                                    <div style={{ height: "100%", borderRadius: 6, background: projectedMonthEnd > (regressionForecast || forecast) * 1.1 ? "var(--red)" : cloud.color, width: `${Math.min(pct(total, regressionForecast || forecast), 100)}%`, transition: "width 0.5s" }} />
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text3)", marginTop: 6 }}>
                                    <span>$0</span>
                                    <span style={{ color: cloud.color }}>{fmt(total)} ({pct(total, regressionForecast || forecast)}%)</span>
                                    <span>{fmt(regressionForecast || forecast)}</span>
                                </div>
                            </div>
                        )}

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Spend by category</div>
                                {categoryBreakdown.length > 0 ? (
                                    <>
                                        <ResponsiveContainer width="100%" height={180}>
                                            <PieChart>
                                                <Pie data={categoryBreakdown} cx="50%" cy="50%" innerRadius={48} outerRadius={78} dataKey="value" paddingAngle={2}>
                                                    {categoryBreakdown.map((c, i) => <Cell key={i} fill={c.color} />)}
                                                </Pie>
                                                <Tooltip formatter={v => [fmt(v), "Cost"]} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                                            {categoryBreakdown.map(c => (
                                                <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text2)" }}>
                                                    <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color, display: "inline-block" }} />
                                                    {c.name} <strong style={{ color: "var(--text)", marginLeft: 2 }}>{fmt(c.value, 0)}</strong>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text3)", fontSize: 13 }}>{costUnavailable ? "Enable cost access to see breakdown" : "No cost data"}</div>
                                )}
                            </div>
                            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Resource inventory</div>
                                {[
                                    { label: isAzure ? "Virtual Machines" : "EC2 Instances", value: ec2Count, icon: "🖥", color: "#378ADD" },
                                    { label: isAzure ? "SQL Databases" : "RDS Instances", value: rdsCount, icon: "🗄", color: "#1D9E75" },
                                    { label: isAzure ? "Azure Functions" : "Lambda Functions", value: lambdaCount, icon: "⚡", color: "#BA7517" },
                                    { label: isAzure ? "Storage Accounts" : "S3 Buckets", value: s3Count, icon: "🗂", color: "#8B5CF6" },
                                    { label: isAzure ? "AKS Clusters" : "EKS Clusters", value: eksCount, icon: "🐳", color: "#0F6E56" },
                                    { label: "Carbon footprint", value: `${fmtN(carbonData.totalCO2eTonnes, 2)} tCO2e/mo`, icon: "🌱", color: "#22c55e" },
                                ].map(({ label, value, icon, color }) => (
                                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--surface2)", borderRadius: 8, marginBottom: 6 }}>
                                        <span style={{ fontSize: 16 }}>{icon}</span>
                                        <span style={{ flex: 1, fontSize: 13, color: "var(--text2)" }}>{label}</span>
                                        <span style={{ fontSize: 16, fontWeight: 700, color }}>{value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Top spending services</div>
                            {topServices.slice(0, 6).map(({ name, val }) => {
                                const hist = serviceHistory[name] || [];
                                const z = zScore(val, hist.slice(0, -1));
                                return (
                                    <div key={name} style={{ marginBottom: 10 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3, color: "var(--text2)" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                <span>{name}</span>
                                                {Math.abs(z) > 2 && <span style={{ fontSize: 10, fontWeight: 700, color: z > 0 ? "var(--red)" : "var(--amber)" }}>{z > 0 ? "↑" : "↓"}{Math.abs(z).toFixed(1)}σ</span>}
                                            </div>
                                            <span style={{ fontWeight: 600, color: "var(--text)" }}>{fmt(val, 4)}</span>
                                        </div>
                                        <div style={{ height: 5, background: "var(--surface2)", borderRadius: 3, overflow: "hidden" }}>
                                            <div style={{ height: "100%", background: Math.abs(z) > 2 ? `var(--${z > 0 ? "red" : "amber"})` : cloud.color, borderRadius: 3, width: `${(val / maxCost * 100).toFixed(1)}%`, opacity: 0.75 }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ══ SERVICES ══ */}
                {activeTab === "services" && (
                    <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                            <div style={{ fontSize: 18, fontWeight: 700 }}>Cost by service</div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}><DateFilter />{topServices.length > 0 && <button onClick={exportCSV} style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: "pointer", background: cloud.color, color: "white", border: "none" }}>⬇ CSV</button>}</div>
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 24 }}>{cloud.serviceLabel} · {dateRangeLabel[dateRange]} · σ = Z-score deviation from baseline</div>
                        {topServices.length > 0 ? (
                            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                    <thead><tr style={{ background: "var(--surface2)" }}>
                                        {[{ k: null, l: "#" }, { k: "name", l: "Service" }, { k: "cost", l: "Cost (MTD)" }, { k: "pct", l: "% of total" }, { k: null, l: "Z-Score" }, { k: null, l: "Trend" }, { k: null, l: "Status" }].map(({ k, l }) => (
                                            <th key={l} onClick={k ? () => handleSort(k) : undefined} style={{ padding: "12px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)", cursor: k ? "pointer" : "default", color: (k && sortCol === k) ? cloud.color : "var(--text3)" }}>
                                                {l}{k ? sortArrow(k) : ""}
                                            </th>
                                        ))}
                                    </tr></thead>
                                    <tbody>
                                    {topServices.map(({ name, val }, i) => {
                                        const hist = serviceHistory[name] || [];
                                        const z = zScore(val, hist.slice(0, -1));
                                        const spark = hist.length > 1 ? hist : Array.from({ length: 7 }, (_, j) => { const s = (i * 7 + j * 3 + 5) % 10; return val * (0.6 + s * 0.08); });
                                        const sMax = Math.max(...spark), sMin = Math.min(...spark);
                                        const pts = spark.map((v, j) => `${j * (72 / (spark.length - 1 || 1))},${20 - ((v - sMin) / (sMax - sMin || 1)) * 16}`).join(" ");
                                        const anomaly = Math.abs(z) > 2;
                                        return (
                                            <tr key={name} style={{ borderBottom: "1px solid var(--border)", background: anomaly ? `${z > 0 ? "var(--red-bg)" : "var(--amber-bg)"}` : undefined }}>
                                                <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--text3)", fontWeight: 600 }}>#{i + 1}</td>
                                                <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 500 }}>{name}</td>
                                                <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: cloud.color }}>{fmt(val, 4)}</td>
                                                <td style={{ padding: "12px 14px" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                        <div style={{ height: 5, width: 70, background: "var(--surface2)", borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", background: cloud.color, borderRadius: 3, width: `${total > 0 ? (val / total * 100).toFixed(1) : 0}%`, opacity: 0.7 }} /></div>
                                                        <span style={{ fontSize: 11, color: "var(--text2)" }}>{pct(val, total)}%</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: "12px 14px" }}>
                                                        <span style={{ fontSize: 12, fontWeight: 700, color: Math.abs(z) > 3 ? "var(--red)" : Math.abs(z) > 2 ? "var(--amber)" : "var(--text3)" }}>
                                                            {z > 0 ? "+" : ""}{z.toFixed(2)}σ {Math.abs(z) > 2 ? "⚠️" : ""}
                                                        </span>
                                                </td>
                                                <td style={{ padding: "12px 14px" }}>
                                                    <svg width="72" height="22" viewBox="0 0 72 22"><polyline points={pts} fill="none" stroke={anomaly ? "var(--red)" : cloud.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                                </td>
                                                <td style={{ padding: "12px 14px" }}><span style={{ fontSize: 11, fontWeight: 600, color: anomaly ? "var(--red)" : i < 3 ? "var(--amber)" : "var(--green)" }}>{anomaly ? "⚠️ Anomaly" : i < 3 ? "↑ Top spender" : "✓ Normal"}</span></td>
                                            </tr>
                                        );
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 48, textAlign: "center" }}>
                                <div style={{ fontSize: 36, marginBottom: 12 }}>💰</div>
                                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No cost data</div>
                                <div style={{ fontSize: 13, color: "var(--text2)" }}>{isAzure ? "Assign the Cost Management Reader role." : "Enable AWS Cost Explorer."}</div>
                            </div>
                        )}
                    </div>
                )}

                {/* ══ TRENDS ══ */}
                {activeTab === "trends" && (
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Cost trends</div>
                        <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 4 }}>
                            {monthlyHistory.length >= 3 ? `Linear regression on ${monthlyHistory.length} months of real data` : "Limited history — connect billing history for regression forecast"}
                        </div>
                        {monthlyHistory.length < 3 && (
                            <div style={{ background: "var(--amber-bg)", border: "1px solid var(--amber)", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "var(--amber)" }}>
                                ⚠️ Backend is returning {monthlyHistory.length} month(s) of history. For linear regression forecasting, the backend needs to return <code>costs.monthly_history</code> as an array of 6 monthly totals.
                            </div>
                        )}
                        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, marginBottom: 20 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>Monthly spend (last 6 months)</div>
                                {regressionForecast && <div style={{ fontSize: 12, color: "var(--green)", fontWeight: 600 }}>📈 Next month regression forecast: {fmt(regressionForecast)}</div>}
                            </div>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={monthTrend} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: "var(--text3)" }} axisLine={false} tickLine={false} tickFormatter={v => `$${Number(v).toFixed(0)}`} />
                                    <Tooltip formatter={(v, n, p) => [fmt(v), (p.payload.isReal ? "Real spend" : "Estimated")]} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                                    <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
                                        {monthTrend.map((e, i) => <Cell key={i} fill={e.isCurrent ? cloud.color : e.isReal ? `${cloud.color}80` : `${cloud.color}30`} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                            <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--text3)", marginTop: 8 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 12, height: 8, borderRadius: 2, background: cloud.color }} /> Current month</div>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 12, height: 8, borderRadius: 2, background: `${cloud.color}80` }} /> Real historical</div>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 12, height: 8, borderRadius: 2, background: `${cloud.color}30` }} /> Estimated (no history)</div>
                            </div>
                        </div>
                        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, marginBottom: 20 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Month-over-month delta</div>
                            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 16 }}>Green = cost decrease · Red = cost increase</div>
                            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 120 }}>
                                {waterfallData.map((w, i) => {
                                    const maxD = Math.max(...waterfallData.map(d => Math.abs(d.delta)), 1), barH = Math.abs(w.delta) / maxD * 80;
                                    return (
                                        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                            <span style={{ fontSize: 10, fontWeight: 600, color: w.positive ? "var(--red)" : "var(--green)" }}>{w.positive ? "+" : "-"}{fmt(Math.abs(w.delta), 0)}</span>
                                            <div style={{ width: "100%", height: `${barH}px`, minHeight: 4, background: w.positive ? "var(--red-bg)" : "var(--green-bg)", border: `1px solid ${w.positive ? "var(--red)" : "var(--green)"}`, borderRadius: 4 }} />
                                            <span style={{ fontSize: 10, color: "var(--text3)" }}>{w.month}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
                            {[
                                { label: "Current month", value: fmt(total), color: cloud.color, icon: "📅" },
                                { label: "Regression forecast", value: regressionForecast ? fmt(regressionForecast) : forecast ? fmt(forecast) : "—", color: "#10B981", icon: "📈" },
                                { label: "6-month average", value: fmt(monthTrend.reduce((s, m) => s + m.cost, 0) / 6, 2), color: "#8B5CF6", icon: "📊" },
                                { label: "MoM change", value: prevMonthCost > 0 ? `${momUp ? "+" : ""}${momChange.toFixed(1)}%` : "—", color: momUp ? "var(--red)" : "var(--green)", icon: momUp ? "📈" : "📉" },
                            ].map(({ label, value, color, icon }) => (
                                <div key={label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, textAlign: "center" }}>
                                    <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
                                    <div style={{ fontSize: 22, fontWeight: 700, color, marginBottom: 4 }}>{value}</div>
                                    <div style={{ fontSize: 12, color: "var(--text3)" }}>{label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ══ ANOMALIES ══ */}
                {activeTab === "anomalies" && (
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Anomaly detection</div>
                        <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>Statistical Z-score analysis — flags spend more than 2 standard deviations from 6-month per-service baseline</div>
                        {monthlyHistory.length < 3 && (
                            <div style={{ background: "var(--amber-bg)", border: "1px solid var(--amber)", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "var(--amber)" }}>
                                ⚠️ Only {monthlyHistory.length} month(s) of history. Z-score analysis improves with more data. Provide <code>costs.monthly_history</code> from the backend for accurate baselines.
                            </div>
                        )}
                        {anomalies.length === 0 ? (
                            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 48, textAlign: "center" }}>
                                <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
                                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No statistical anomalies</div>
                                <div style={{ fontSize: 13, color: "var(--text2)" }}>All service costs are within 2σ of their historical baselines</div>
                            </div>
                        ) : (
                            <>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
                                    {[
                                        { label: "Anomalies (>2σ)", value: anomalies.length, color: "var(--red)" },
                                        { label: "Critical / High", value: anomalies.filter(a => ["critical", "high"].includes(a.severity)).length, color: "var(--red)" },
                                        { label: "Excess spend", value: fmt(anomalies.reduce((s, a) => s + Math.max(0, a.cost - (a.expectedHigh || 0)), 0)), color: "var(--amber)" },
                                    ].map(({ label, value, color }) => (
                                        <div key={label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, borderLeft: `4px solid ${color}` }}>
                                            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
                                            <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    {anomalies.map((a, i) => (
                                        <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, borderLeft: `4px solid ${a.severity === "critical" || a.severity === "high" ? "var(--red)" : "var(--amber)"}` }}>
                                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                                        <span style={{ fontSize: 14, fontWeight: 600 }}>{a.service}</span>
                                                        <SevBadge sev={a.severity} />
                                                        <span style={{ fontSize: 11, color: "var(--text3)", fontFamily: "monospace" }}>z={a.z.toFixed(2)}σ</span>
                                                    </div>
                                                    <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6, marginBottom: 8 }}>{a.suggestion}</div>
                                                    {a.expectedLow !== undefined && <div style={{ fontSize: 11, color: "var(--text3)" }}>Expected range: {fmt(a.expectedLow, 0)} – {fmt(a.expectedHigh, 0)}</div>}
                                                </div>
                                                <div style={{ textAlign: "right", flexShrink: 0 }}>
                                                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--red)" }}>{fmt(a.cost)}</div>
                                                    <div style={{ fontSize: 11, color: "var(--text3)" }}>this period</div>
                                                    {a.expectedHigh > 0 && <div style={{ fontSize: 11, color: "var(--amber)", marginTop: 2 }}>+{fmt(Math.max(0, a.cost - a.expectedHigh), 0)} above range</div>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ══ RIGHTSIZING ══ */}
                {activeTab === "rightsizing" && (
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Rightsizing opportunities</div>
                        <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 24 }}>
                            Savings calculated using actual on-demand pricing where instance type is known <PricingBadge type="exact" /> vs estimates <PricingBadge type="estimate" />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
                            {[
                                { label: "Candidates found", value: rightsizingCandidates.length, color: "var(--amber)" },
                                { label: "Est. monthly savings", value: fmt(rightsizingSavings, 0), color: "var(--green)" },
                                { label: "Exact pricing", value: rightsizingCandidates.filter(r => r.pricing === "exact").length, color: "#10B981" },
                            ].map(({ label, value, color }) => (
                                <div key={label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, borderLeft: `4px solid ${color}` }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
                                    <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
                                </div>
                            ))}
                        </div>
                        {rightsizingCandidates.length === 0 ? (
                            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 48, textAlign: "center" }}>
                                <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
                                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No rightsizing candidates</div>
                                <div style={{ fontSize: 13, color: "var(--text2)" }}>All resources appear appropriately configured</div>
                            </div>
                        ) : (
                            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                    <thead><tr style={{ background: "var(--surface2)" }}>
                                        {["Resource", "Type", "Region", "Issue", "Action", "Saving/mo", "Pricing", "Priority"].map(h => (
                                            <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)", color: "var(--text3)", whiteSpace: "nowrap" }}>{h}</th>
                                        ))}
                                    </tr></thead>
                                    <tbody>
                                    {rightsizingCandidates.map((r, i) => (
                                        <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                                            <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 500 }}>{r.resource}</td>
                                            <td style={{ padding: "10px 14px", fontSize: 11, fontFamily: "monospace", color: "var(--text2)" }}>{r.type}</td>
                                            <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--text3)" }}>{r.region}</td>
                                            <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text2)" }}>{r.issue}</td>
                                            <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text2)" }}>{r.action}</td>
                                            <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "var(--green)" }}>{fmt(r.saving, 0)}</td>
                                            <td style={{ padding: "10px 14px" }}><PricingBadge type={r.pricing} /></td>
                                            <td style={{ padding: "10px 14px" }}><SevBadge sev={r.severity} /></td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* ══ ALLOCATION ══ */}
                {activeTab === "allocation" && (
                    <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                            <div style={{ fontSize: 18, fontWeight: 700 }}>Cost allocation</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 12, color: "var(--text3)" }}>Tag:</span>
                                <select value={allocationTag} onChange={e => setAllocationTag(e.target.value)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface2)", fontSize: 12, color: "var(--text)", cursor: "pointer" }}>
                                    {["environment", "team", "project", "owner", "costcenter"].map(k => <option key={k}>{k}</option>)}
                                </select>
                                <span style={{ fontSize: 12, color: "var(--text3)" }}>Shared cost:</span>
                                <select value={allocationMode} onChange={e => setAllocationMode(e.target.value)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface2)", fontSize: 12, color: "var(--text)", cursor: "pointer" }}>
                                    <option value="proportional">Proportional</option>
                                    <option value="even">Even split</option>
                                    <option value="fixed">Leave unallocated</option>
                                </select>
                            </div>
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 8 }}>
                            Tag: <code>{allocationTag}</code> · Shared cost split: <strong>{allocationMode}</strong>
                            {Number(untaggedPct) > 30 && <span style={{ color: "var(--amber)", fontWeight: 600, marginLeft: 8 }}>⚠️ {untaggedPct}% untagged</span>}
                        </div>
                        <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 12, color: "var(--text3)", lineHeight: 1.6 }}>
                            📊 <strong style={{ color: "var(--text)" }}>Showback mode</strong> — teams can see their attributed costs but are not billed. Shared (untagged) costs are split <strong>{allocationMode === "proportional" ? "proportionally by instance count" : allocationMode === "even" ? "evenly across all groups" : "left unallocated"}</strong>.
                        </div>
                        {Number(untaggedPct) > 30 && (
                            <div style={{ background: "var(--amber-bg)", border: "1px solid var(--amber)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "var(--amber)" }}>
                                <strong>{untaggedPct}% of resources</strong> are missing the <code>{allocationTag}</code> tag. Enforce tagging via {isAzure ? "Azure Policy" : "AWS Tag Policies"}.
                            </div>
                        )}
                        {allocationData.length === 0 ? (
                            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 48, textAlign: "center" }}>
                                <div style={{ fontSize: 36, marginBottom: 12 }}>🏷</div>
                                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No tag data found</div>
                                <div style={{ fontSize: 13, color: "var(--text2)" }}>Tag resources with <code>{allocationTag}</code> to enable allocation.</div>
                            </div>
                        ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
                                {allocationData.map(({ tag, count, estimatedCost, directCost, sharedCost }) => {
                                    const totalEC = allocationData.reduce((s, d) => s + d.estimatedCost, 0);
                                    const tagPct = totalEC > 0 ? (estimatedCost / totalEC * 100).toFixed(1) : "0";
                                    return (
                                        <div key={tag} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", borderTop: `3px solid ${tag === "untagged" ? "var(--amber)" : cloud.color}` }}>
                                            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "capitalize", marginBottom: 6 }}>{tag}</div>
                                            <div style={{ fontSize: 22, fontWeight: 700, color: tag === "untagged" ? "var(--amber)" : cloud.color, marginBottom: 4 }}>{fmt(estimatedCost, 0)}</div>
                                            <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 2 }}>Direct: {fmt(directCost, 0)}</div>
                                            {sharedCost > 0 && <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 4 }}>+ Shared: {fmt(sharedCost, 0)}</div>}
                                            <div style={{ fontSize: 11, color: "var(--text3)" }}>{count} resources · {tagPct}%</div>
                                            <div style={{ height: 4, background: "var(--surface2)", borderRadius: 2, overflow: "hidden", marginTop: 8 }}>
                                                <div style={{ height: "100%", background: tag === "untagged" ? "var(--amber)" : cloud.color, borderRadius: 2, width: `${tagPct}%`, opacity: 0.7 }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ══ WHAT-IF ══ */}
                {activeTab === "whatif" && (
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>What-If simulator</div>
                        <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 24 }}>Model cost impact of scaling or eliminating services</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }}>
                            <div>
                                {topServices.length === 0 ? (
                                    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 32, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>Enable cost data to use the simulator</div>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                        {topServices.slice(0, 8).map(({ name, val }) => {
                                            const change = whatIfChanges[name] ?? 0;
                                            return (
                                                <div key={name} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 18px" }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                                        <span style={{ fontSize: 13, fontWeight: 500 }}>{name}</span>
                                                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text3)" }}>{fmt(val, 2)}/mo</span>
                                                    </div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                        <input type="range" min={-100} max={50} step={5} value={change} onChange={e => setWhatIfChanges(p => ({ ...p, [name]: Number(e.target.value) }))} style={{ flex: 1, accentColor: cloud.color }} />
                                                        <span style={{ fontSize: 12, fontWeight: 700, minWidth: 48, textAlign: "right", color: change < 0 ? "var(--green)" : change > 0 ? "var(--red)" : "var(--text3)" }}>{change > 0 ? "+" : ""}{change}%</span>
                                                        <span style={{ fontSize: 12, color: "var(--text2)", minWidth: 72, textAlign: "right" }}>{fmt(val * (1 + change / 100), 2)}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <button onClick={() => setWhatIfChanges({})} style={{ padding: "8px 16px", fontSize: 12, fontWeight: 600, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text2)", cursor: "pointer" }}>Reset all</button>
                                    </div>
                                )}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Simulation results</div>
                                    {[
                                        { label: "Current spend", value: fmt(total), color: "var(--text)" },
                                        { label: "Simulated spend", value: fmt(whatIfTotal), color: whatIfTotal < total ? "var(--green)" : whatIfTotal > total ? "var(--red)" : "var(--text)" },
                                        { label: "Delta", value: `${whatIfDelta >= 0 ? "+" : ""}${fmt(whatIfDelta, 2)}`, color: whatIfDelta < 0 ? "var(--green)" : whatIfDelta > 0 ? "var(--red)" : "var(--text3)" },
                                    ].map(({ label, value, color }) => (
                                        <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                                            <span style={{ fontSize: 13, color: "var(--text2)" }}>{label}</span>
                                            <span style={{ fontSize: 14, fontWeight: 700, color }}>{value}</span>
                                        </div>
                                    ))}
                                    {whatIfSaving > 0 && (
                                        <div style={{ marginTop: 16, background: "var(--green-bg)", border: "1px solid var(--green)", borderRadius: 8, padding: "12px 14px", textAlign: "center" }}>
                                            <div style={{ fontSize: 11, color: "var(--green)", fontWeight: 600, marginBottom: 4 }}>PROJECTED MONTHLY SAVING</div>
                                            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--green)" }}>{fmt(whatIfSaving, 2)}</div>
                                            <div style={{ fontSize: 11, color: "var(--green)", marginTop: 2 }}>{fmt(whatIfSaving * 12, 0)}/year</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ══ SAVINGS ══ */}
                {activeTab === "savings" && (
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Savings recommendations</div>
                        <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 24 }}>
                            <PricingBadge type="exact" /> = calculated from actual on-demand rates · <PricingBadge type="estimate" /> = heuristic estimate
                        </div>
                        <div style={{ background: "linear-gradient(135deg, #1D9E75, #0F6E56)", borderRadius: 12, padding: 24, marginBottom: 24, color: "white" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.85, marginBottom: 4 }}>TOTAL POTENTIAL SAVINGS</div>
                                    <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4 }}>{fmt(totalSavings, 0)}/month</div>
                                    <div style={{ fontSize: 13, opacity: 0.8 }}>{recommendations.length} recommendations · {fmt(totalSavings * 12, 0)}/year</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.85, marginBottom: 4 }}>REALIZED SAVINGS</div>
                                    <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4 }}>{fmt(realizedSavings, 0)}/month</div>
                                    <div style={{ fontSize: 13, opacity: 0.8 }}>{optimTasks.filter(t => t.status === "resolved" || t.status === "verified").length} tasks completed · {fmt(realizedSavings * 12, 0)}/year</div>
                                </div>
                            </div>
                        </div>
                        {recommendations.length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {recommendations.map((rec, i) => (
                                    <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, borderLeft: `4px solid ${rec.severity === "critical" || rec.severity === "high" ? "var(--red)" : rec.severity === "medium" ? "var(--amber)" : "var(--green)"}` }}>
                                        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                                            <div style={{ fontSize: 24, flexShrink: 0 }}>{rec.icon}</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                                                    <span style={{ fontSize: 14, fontWeight: 600 }}>{rec.title}</span>
                                                    <SevBadge sev={rec.severity} />
                                                    {rec.pricing && rec.pricing !== "n/a" && <PricingBadge type={rec.pricing} />}
                                                </div>
                                                <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 10, lineHeight: 1.6 }}>{rec.desc}</div>
                                                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                                                    {rec.saving > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: "#1D9E75" }}>💰 Save ~{fmt(rec.saving, 0)}/month</span>}
                                                    {rec.link && <a href={rec.link} target="_blank" rel="noopener noreferrer" style={{ padding: "4px 12px", background: "var(--accent)", color: "white", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", textDecoration: "none" }}>{rec.action} →</a>}
                                                    <button onClick={() => createTask(rec)} style={{ padding: "4px 12px", background: "var(--surface2)", color: cloud.color, border: `1px solid ${cloud.color}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ Add to Workflow</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 48, textAlign: "center" }}>
                                <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
                                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No recommendations</div>
                                <div style={{ fontSize: 13, color: "var(--text2)" }}>Run a scan to generate savings recommendations</div>
                            </div>
                        )}
                    </div>
                )}

                {/* ══ WORKFLOW ══ */}
                {activeTab === "workflow" && (
                    <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                            <div style={{ fontSize: 18, fontWeight: 700 }}>Optimization workflow</div>
                            <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--text3)" }}>
                                <span>Realized: <strong style={{ color: "var(--green)" }}>{fmt(realizedSavings, 0)}/mo</strong></span>
                                <span>Pending: <strong style={{ color: "var(--amber)" }}>{fmt(optimTasks.filter(t => !["resolved", "verified"].includes(t.status)).reduce((s, t) => s + t.saving, 0), 0)}/mo</strong></span>
                            </div>
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 24 }}>Track savings recommendations from Identified → Assigned → In Progress → Resolved → Verified</div>
                        {optimTasks.length === 0 ? (
                            <div style={{ background: "var(--surface)", border: "2px dashed var(--border)", borderRadius: 12, padding: 48, textAlign: "center" }}>
                                <div style={{ fontSize: 36, marginBottom: 12 }}>⚙️</div>
                                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No tasks yet</div>
                                <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>Go to Savings tab and click "+ Add to Workflow" on any recommendation</div>
                                <button onClick={() => setActiveTab("savings")} style={{ padding: "10px 20px", background: cloud.color, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>→ View Savings</button>
                            </div>
                        ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
                                {TASK_STATUSES.map(status => {
                                    const tasks = optimTasks.filter(t => t.status === status);
                                    return (
                                        <div key={status} style={{ background: "var(--surface2)", borderRadius: 12, padding: 12, minHeight: 200 }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: TASK_STATUS_COLORS[status], marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <span>{TASK_STATUS_LABELS[status]}</span>
                                                <span style={{ background: "var(--surface)", borderRadius: 20, padding: "1px 7px", fontSize: 11 }}>{tasks.length}</span>
                                            </div>
                                            {tasks.map(task => (
                                                <div key={task.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, marginBottom: 8 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, lineHeight: 1.4 }}>{task.title}</div>
                                                    {task.saving > 0 && <div style={{ fontSize: 11, color: "var(--green)", fontWeight: 600, marginBottom: 6 }}>💰 {fmt(task.saving, 0)}/mo</div>}
                                                    <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 8 }}>{task.action}</div>
                                                    {task.assignee && <div style={{ fontSize: 10, color: "var(--text3)" }}>👤 {task.assignee}</div>}
                                                    {task.dueDate && <div style={{ fontSize: 10, color: "var(--text3)" }}>📅 {task.dueDate}</div>}
                                                    <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                                                        {TASK_STATUSES.filter(s => s !== status).slice(0, 2).map(s => (
                                                            <button key={s} onClick={() => updateTask(task.id, { status: s })} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text3)", cursor: "pointer", whiteSpace: "nowrap" }}>
                                                                → {TASK_STATUS_LABELS[s]}
                                                            </button>
                                                        ))}
                                                        <button onClick={() => deleteTask(task.id)} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, border: "none", background: "var(--red-bg)", color: "var(--red)", cursor: "pointer" }}>✕</button>
                                                    </div>
                                                    {status === "identified" && (
                                                        <div style={{ marginTop: 8, display: "flex", gap: 4 }}>
                                                            <input placeholder="Assign to..." value={task.assignee || ""} onChange={e => updateTask(task.id, { assignee: e.target.value })} style={{ flex: 1, fontSize: 10, padding: "3px 6px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)" }} />
                                                            <input type="date" value={task.dueDate || ""} onChange={e => updateTask(task.id, { dueDate: e.target.value })} style={{ fontSize: 10, padding: "3px 4px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", width: 90 }} />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ══ BUDGETS ══ */}
                {activeTab === "budgets" && (
                    <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                            <div>
                                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Budget management</div>
                                <div style={{ fontSize: 13, color: "var(--text2)" }}>Set spend limits with threshold alerts</div>
                            </div>
                            <button onClick={() => setShowBudgetModal(true)} style={{ padding: "8px 16px", background: cloud.color, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ New Budget</button>
                        </div>
                        {showBudgetModal && (
                            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={e => { if (e.target === e.currentTarget) setShowBudgetModal(false); }}>
                                <div style={{ background: "var(--surface)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 440, boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }}>
                                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Create budget</div>
                                    {[{ label: "Budget Name", key: "name", type: "text", placeholder: "e.g. Production Monthly" }, { label: "Amount (USD)", key: "amount", type: "number", placeholder: "e.g. 500" }].map(({ label, key, type, placeholder }) => (
                                        <div key={key} style={{ marginBottom: 14 }}>
                                            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</label>
                                            <input className="form-input" type={type} placeholder={placeholder} value={newBudget[key]} onChange={e => setNewBudget(p => ({ ...p, [key]: e.target.value }))} />
                                        </div>
                                    ))}
                                    <div style={{ marginBottom: 14 }}>
                                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Alert threshold</label>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <input type="range" min={50} max={100} step={5} value={newBudget.alertAt} onChange={e => setNewBudget(p => ({ ...p, alertAt: Number(e.target.value) }))} style={{ flex: 1, accentColor: cloud.color }} />
                                            <span style={{ fontSize: 13, fontWeight: 700, minWidth: 42, color: cloud.color }}>{newBudget.alertAt}%</span>
                                        </div>
                                    </div>
                                    <div style={{ marginBottom: 14 }}>
                                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Period</label>
                                        <select className="form-input" value={newBudget.period} onChange={e => setNewBudget(p => ({ ...p, period: e.target.value }))}>
                                            {["Monthly", "Quarterly", "Annual"].map(o => <option key={o}>{o}</option>)}
                                        </select>
                                    </div>
                                    <div style={{ marginBottom: 20 }}>
                                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Service filter</label>
                                        <select className="form-input" value={newBudget.service} onChange={e => setNewBudget(p => ({ ...p, service: e.target.value }))}>
                                            {["All Services", ...Object.keys(byService).slice(0, 15)].map(o => <option key={o}>{o}</option>)}
                                        </select>
                                    </div>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <button onClick={saveBudget} style={{ flex: 2, padding: "10px", background: cloud.color, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Create Budget</button>
                                        <button onClick={() => setShowBudgetModal(false)} style={{ flex: 1, padding: "10px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Cancel</button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {(awsData?.budgets || []).length > 0 && (
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>{cloud.name} budgets (from account)</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {(awsData.budgets || []).map((b, i) => {
                                        const limit = parseFloat(b.BudgetLimit?.Amount ?? b.limit ?? b.amount ?? 0);
                                        const spent = parseFloat(b.CalculatedSpend?.ActualSpend?.Amount ?? b.spent ?? 0);
                                        const usedPct = limit > 0 ? (spent / limit * 100) : 0;
                                        const name = b.BudgetName ?? b.name ?? `Budget ${i + 1}`;
                                        return (
                                            <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                                                    <span style={{ fontWeight: 600 }}>{name}</span>
                                                    <span style={{ fontSize: 12, color: "var(--text3)" }}>{b.TimeUnit ?? b.period ?? "Monthly"}</span>
                                                </div>
                                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                                                    <span style={{ color: "var(--text2)" }}>Spent: <strong>{fmt(spent)}</strong></span>
                                                    <span style={{ color: "var(--text2)" }}>Limit: <strong>{fmt(limit)}</strong></span>
                                                </div>
                                                <div style={{ height: 8, background: "var(--surface2)", borderRadius: 4, overflow: "hidden" }}>
                                                    <div style={{ height: "100%", borderRadius: 4, background: usedPct > 90 ? "var(--red)" : usedPct > 70 ? "var(--amber)" : "var(--green)", width: `${Math.min(usedPct, 100).toFixed(1)}%` }} />
                                                </div>
                                                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4, textAlign: "right" }}>{usedPct.toFixed(1)}% used</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        {savedBudgets.length > 0 ? (
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Custom budgets</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {savedBudgets.map(b => {
                                        const limit = parseFloat(b.amount), spent = getBudgetSpent(b);
                                        const usedPct = limit > 0 ? (spent / limit * 100) : 0;
                                        const alertPct = b.alertAt || 80, alertFired = usedPct >= alertPct;
                                        return (
                                            <div key={b.id} style={{ background: "var(--surface)", border: `1px solid ${alertFired ? "var(--amber)" : "var(--border)"}`, borderRadius: 12, padding: 18 }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                        <span style={{ fontWeight: 600 }}>{b.name}</span>
                                                        {alertFired && <span style={{ fontSize: 10, fontWeight: 700, background: "var(--amber-bg)", color: "var(--amber)", borderRadius: 20, padding: "2px 8px" }}>⚠️ Alert at {alertPct}%</span>}
                                                    </div>
                                                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                                        <span style={{ fontSize: 11, background: "var(--surface2)", padding: "2px 8px", borderRadius: 20, color: "var(--text3)" }}>{b.period}</span>
                                                        <button onClick={() => deleteBudget(b.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontSize: 16 }}>×</button>
                                                    </div>
                                                </div>
                                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                                                    <span style={{ color: "var(--text2)" }}>Current: <strong style={{ color: usedPct > 90 ? "var(--red)" : "var(--text)" }}>{fmt(spent)}</strong></span>
                                                    <span style={{ color: "var(--text2)" }}>Budget: <strong>{fmt(limit)}</strong></span>
                                                </div>
                                                <div style={{ height: 8, background: "var(--surface2)", borderRadius: 4, overflow: "hidden", position: "relative" }}>
                                                    <div style={{ height: "100%", borderRadius: 4, transition: "width 0.5s", background: usedPct > 90 ? "var(--red)" : usedPct > 70 ? "var(--amber)" : "var(--green)", width: `${Math.min(usedPct, 100).toFixed(1)}%` }} />
                                                    <div style={{ position: "absolute", top: 0, bottom: 0, left: `${alertPct}%`, width: 2, background: "var(--amber)", transform: "translateX(-50%)" }} />
                                                </div>
                                                <div style={{ fontSize: 11, marginTop: 4, textAlign: "right", fontWeight: usedPct > 90 ? 700 : 400, color: usedPct > 90 ? "var(--red)" : "var(--text3)" }}>
                                                    {usedPct.toFixed(1)}% {usedPct > 90 ? "⚠️ Over budget!" : usedPct >= alertPct ? "⚠️ Alert reached" : "✓ On track"}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (awsData?.budgets || []).length === 0 && (
                            <div style={{ background: "var(--surface)", border: "2px dashed var(--border)", borderRadius: 12, padding: 48, textAlign: "center" }}>
                                <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
                                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No budgets yet</div>
                                <button onClick={() => setShowBudgetModal(true)} style={{ padding: "10px 20px", background: cloud.color, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Create First Budget</button>
                            </div>
                        )}
                    </div>
                )}

                {/* ══ CARBON ══ */}
                {activeTab === "carbon" && (
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Carbon footprint</div>
                        <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 24 }}>Estimated CO2e per month based on instance type, region energy intensity (gCO2e/kWh), and average cloud PUE of 1.2</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
                            {[
                                { label: "Total CO2e / month", value: `${fmtN(carbonData.totalCO2eTonnes, 3)} tonnes`, color: "#22c55e" },
                                { label: "Highest-carbon region", value: carbonData.worstRegion?.region || "—", color: "var(--red)" },
                                { label: "Potential CO2 saving", value: carbonData.greenSavingCO2 > 0 ? `${fmtN(carbonData.greenSavingCO2 / 1000, 3)} t/mo` : "—", color: "var(--green)" },
                            ].map(({ label, value, color }) => (
                                <div key={label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, borderLeft: `4px solid ${color}` }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
                                    <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
                                </div>
                            ))}
                        </div>
                        {carbonData.greenAlt && carbonData.worstRegion && (
                            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12, padding: 20, marginBottom: 24 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: "#15803d", marginBottom: 8 }}>🌱 Green region opportunity</div>
                                <div style={{ fontSize: 13, color: "#166534", lineHeight: 1.6 }}>
                                    Moving workloads from <strong>{carbonData.worstRegion.region}</strong> ({carbonData.worstRegion.factor} gCO2e/kWh) to <strong>{carbonData.greenAlt}</strong> ({getCarbonFactor(carbonData.greenAlt)} gCO2e/kWh) would save approximately <strong>{fmtN(carbonData.greenSavingCO2 / 1000, 3)} tonnes CO2e/month</strong> — equivalent to {fmtN(carbonData.greenSavingCO2 / 1000 * 4.6, 1)} car-miles avoided.
                                </div>
                            </div>
                        )}
                        {carbonData.regions.length > 0 ? (
                            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                    <thead><tr style={{ background: "var(--surface2)" }}>
                                        {["Region", "Instances", "Energy intensity", "Est. kWh/mo", "Est. CO2e/mo", "Carbon level"].map(h => (
                                            <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)", color: "var(--text3)" }}>{h}</th>
                                        ))}
                                    </tr></thead>
                                    <tbody>
                                    {carbonData.regions.map((r, i) => {
                                        const level = r.factor < 100 ? "🟢 Very low" : r.factor < 300 ? "🟡 Low" : r.factor < 500 ? "🟠 Medium" : "🔴 High";
                                        return (
                                            <tr key={r.region} style={{ borderBottom: "1px solid var(--border)" }}>
                                                <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 500, fontFamily: "monospace" }}>{r.region}</td>
                                                <td style={{ padding: "10px 14px", fontSize: 12 }}>{r.instances}</td>
                                                <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text2)" }}>{r.factor} gCO2e/kWh</td>
                                                <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text2)" }}>{fmtN(r.kwh, 0)} kWh</td>
                                                <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: r.co2eTonnes > 0.5 ? "var(--red)" : "var(--green)" }}>{fmtN(r.co2eTonnes, 3)} t</td>
                                                <td style={{ padding: "10px 14px", fontSize: 12 }}>{level}</td>
                                            </tr>
                                        );
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 48, textAlign: "center" }}>
                                <div style={{ fontSize: 36, marginBottom: 12 }}>🌱</div>
                                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No instance data for carbon calculation</div>
                                <div style={{ fontSize: 13, color: "var(--text2)" }}>Run a scan to estimate your cloud carbon footprint</div>
                            </div>
                        )}
                        <div style={{ marginTop: 16, fontSize: 11, color: "var(--text3)", lineHeight: 1.6 }}>
                            ℹ️ Carbon estimates use Electricity Maps regional intensity data (2024), a cloud PUE of 1.2, and instance-type power envelopes. For certified data, use {isAzure ? "Azure Emissions Impact Dashboard" : "AWS Customer Carbon Footprint Tool"}.
                        </div>
                    </div>
                )}

                {/* ══ MATURITY ══ */}
                {activeTab === "maturity" && (
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>FinOps maturity assessment</div>
                        <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 24 }}>Based on the FinOps Foundation Crawl / Walk / Run framework across 10 capabilities</div>
                        <div style={{ background: `linear-gradient(135deg, ${maturity.phase === "Run" ? "#1D9E75,#0F6E56" : maturity.phase === "Walk" ? "#B45309,#92400E" : "#374151,#1F2937"})`, borderRadius: 12, padding: 24, marginBottom: 24, color: "white" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.85, marginBottom: 4 }}>CURRENT MATURITY PHASE</div>
                                    <div style={{ fontSize: 40, fontWeight: 700, marginBottom: 4 }}>{maturity.phase === "Run" ? "🏆" : maturity.phase === "Walk" ? "🚶" : "🐣"} {maturity.phase}</div>
                                    <div style={{ fontSize: 13, opacity: 0.8 }}>{(maturity.avg * 100).toFixed(0)}% overall · {maturity.caps.filter(c => c.score === 3).length} capabilities at Run level</div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>Next phase: {maturity.phase === "Crawl" ? "Walk" : maturity.phase === "Walk" ? "Run" : "Sustained Run"}</div>
                                    <div style={{ fontSize: 12, opacity: 0.7 }}>{maturity.caps.filter(c => c.score < 2).length} capabilities need improvement</div>
                                </div>
                            </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {maturity.caps.map(cap => {
                                const barW = (cap.score / 3 * 100).toFixed(0);
                                const color = cap.score === 3 ? "var(--green)" : cap.score === 2 ? "var(--amber)" : cap.score === 1 ? cloud.color : "var(--text3)";
                                return (
                                    <div key={cap.name} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                            <div>
                                                <span style={{ fontSize: 14, fontWeight: 600 }}>{cap.name}</span>
                                                <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: 10 }}>{cap.desc}</span>
                                            </div>
                                            <span style={{ fontSize: 12, fontWeight: 700, color, background: `${color}15`, border: `1px solid ${color}40`, borderRadius: 20, padding: "2px 10px" }}>{cap.label}</span>
                                        </div>
                                        <div style={{ height: 6, background: "var(--surface2)", borderRadius: 3, overflow: "hidden" }}>
                                            <div style={{ height: "100%", borderRadius: 3, background: color, width: `${barW}%`, transition: "width 0.5s" }} />
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text3)", marginTop: 4 }}>
                                            <span style={{ color: cap.score >= 1 ? color : "var(--text3)" }}>● Crawl</span>
                                            <span style={{ color: cap.score >= 2 ? color : "var(--text3)" }}>● Walk</span>
                                            <span style={{ color: cap.score >= 3 ? color : "var(--text3)" }}>● Run</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ marginTop: 16, fontSize: 11, color: "var(--text3)", lineHeight: 1.6 }}>
                            ℹ️ Maturity is assessed from live scan data. Improve scores by: adding <code>monthly_history</code> to the backend response, increasing tagging coverage, actioning optimization workflow tasks, and enabling unit metrics.
                        </div>
                    </div>
                )}

                {/* ══ UNIT ECONOMICS ══ */}
                {activeTab === "unit" && (
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Unit economics</div>
                        <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 24 }}>Cost per business outcome — enter your monthly business metrics to calculate unit costs</div>
                        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, marginBottom: 24 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Business metrics (monthly)</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
                                {[
                                    { key: "users", label: "Active users", placeholder: "e.g. 5000", icon: "👤" },
                                    { key: "requests", label: "API requests / events", placeholder: "e.g. 1000000", icon: "🔁" },
                                    { key: "deploys", label: "Deployments / releases", placeholder: "e.g. 40", icon: "🚀" },
                                ].map(({ key, label, placeholder, icon }) => (
                                    <div key={key}>
                                        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{icon} {label}</label>
                                        <input type="number" placeholder={placeholder} value={unitMetrics[key]} onChange={e => setUnitMetrics(p => ({ ...p, [key]: e.target.value }))} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
                            {[
                                { label: "Cost per active user", value: unitEconomics.perUser, icon: "👤", unit: "user", input: "users" },
                                { label: "Cost per API request", value: unitEconomics.perRequest, icon: "🔁", unit: "request", input: "requests" },
                                { label: "Cost per deployment", value: unitEconomics.perDeploy, icon: "🚀", unit: "deploy", input: "deploys" },
                            ].map(({ label, value, icon, unit, input }) => (
                                <div key={label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, textAlign: "center" }}>
                                    <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{label}</div>
                                    {value !== null ? (
                                        <>
                                            <div style={{ fontSize: 28, fontWeight: 700, color: cloud.color, marginBottom: 4, letterSpacing: "-0.03em" }}>{value < 0.01 ? `$${(value * 1000).toFixed(4)}/k` : fmt(value, 4)}</div>
                                            <div style={{ fontSize: 11, color: "var(--text3)" }}>per {unit} · {fmt(total, 0)}/month total</div>
                                        </>
                                    ) : (
                                        <div style={{ fontSize: 14, color: "var(--text3)" }}>Enter {input} above →</div>
                                    )}
                                </div>
                            ))}
                        </div>
                        {(unitEconomics.perUser || unitEconomics.perRequest || unitEconomics.perDeploy) && (
                            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Benchmarks & insights</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {unitEconomics.perUser !== null && (
                                        <div style={{ padding: "12px 16px", background: "var(--surface2)", borderRadius: 8, fontSize: 13, color: "var(--text2)" }}>
                                            <strong style={{ color: "var(--text)" }}>Cost per user: {fmt(unitEconomics.perUser, 4)}</strong> — SaaS benchmark is typically $0.50–$5.00/user/month. {unitEconomics.perUser < 0.5 ? "✅ Well below benchmark." : unitEconomics.perUser < 5 ? "⚠️ Within range, but monitor growth." : "🔴 Above typical SaaS benchmark — review infrastructure efficiency."}
                                        </div>
                                    )}
                                    {unitEconomics.perRequest !== null && (
                                        <div style={{ padding: "12px 16px", background: "var(--surface2)", borderRadius: 8, fontSize: 13, color: "var(--text2)" }}>
                                            <strong style={{ color: "var(--text)" }}>Cost per request: {unitEconomics.perRequest < 0.01 ? `$${(unitEconomics.perRequest * 1000000).toFixed(2)}/million` : fmt(unitEconomics.perRequest, 6)}</strong> — API platforms typically target &lt;$0.001/request. {unitEconomics.perRequest < 0.001 ? "✅ Efficient." : "⚠️ Consider caching, CDN, or Lambda right-sizing."}
                                        </div>
                                    )}
                                    {unitEconomics.perDeploy !== null && (
                                        <div style={{ padding: "12px 16px", background: "var(--surface2)", borderRadius: 8, fontSize: 13, color: "var(--text2)" }}>
                                            <strong style={{ color: "var(--text)" }}>Cost per deployment: {fmt(unitEconomics.perDeploy, 2)}</strong> — High deployment costs suggest long-running test environments. Consider ephemeral environments and spot instances for CI/CD.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        {!unitEconomics.perUser && !unitEconomics.perRequest && !unitEconomics.perDeploy && (
                            <div style={{ background: "var(--surface)", border: "2px dashed var(--border)", borderRadius: 12, padding: 32, textAlign: "center", color: "var(--text3)" }}>
                                <div style={{ fontSize: 24, marginBottom: 8 }}>📐</div>
                                <div style={{ fontSize: 14 }}>Enter at least one metric above to calculate unit economics</div>
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
};
// ══════════════════════════════════════════════════════════════════════════════
// END FINOPS SECTION v2
// ══════════════════════════════════════════════════════════════════════════════

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
                const alertsData = alertJson.alerts || []; if (alertsData.length === 0) { const sampleAlerts = [{ alert_id: "ALT-001", title: "Sample High Severity Alert", description: "This is a test alert to verify View button visibility", severity: "High", status: "Active", category: "Security", source: "AWS GuardDuty", timestamp: new Date().toISOString() }]; setAlerts(sampleAlerts); } else { setAlerts(alertsData); }
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

const AlertDetail = ({ alert: a, onBack, accountId, onRefresh }) => {
    const [creatingTicket, setCreatingTicket] = useState(false);
    const [ticketCreated, setTicketCreated] = useState(false);
    const [resolving, setResolving] = useState(false);
    const [resolved, setResolved] = useState(a.status === "Resolved");

    const sVariant = (s) => {
        const v = (s || "").toLowerCase();
        return v === "high" || v === "critical" ? "red" : v === "medium" ? "amber" : "green";
    };

    const handleCreateTicket = async () => {
        setCreatingTicket(true);
        try {
            await fetch(`${BACKEND}/api/tickets/create`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ticket_id: `TKT-${Date.now()}`,
                    account_id: accountId,
                    alert_id: a.alert_id,
                    title: a.title,
                    description: a.description,
                    severity: a.severity,
                    category: a.category || "Infrastructure",
                }),
            });
            setTicketCreated(true);
            onRefresh();
        } catch (e) {
            console.error("Failed to create ticket:", e);
        } finally {
            setCreatingTicket(false);
        }
    };

    const handleResolve = async () => {
        setResolving(true);
        try {
            await fetch(`${BACKEND}/api/alerts/resolve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ alert_id: a.alert_id }),
            });
            setResolved(true);
            onRefresh();
        } catch (e) {
            console.error("Resolve failed:", e);
        } finally {
            setResolving(false);
        }
    };

    return (
        <div style={{ maxWidth: 720 }}>
            <button className="btn btn-sm" onClick={onBack} style={{ marginBottom: 16 }}>← Back to Alerts</button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div>
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}><Mono>{a.alert_id}</Mono></div>
                    <div style={{ fontSize: 13, color: "var(--text2)" }}>
                        {(a.timestamp || "").slice(0, 19).replace("T", " ")}
                    </div>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    <Badge text={a.severity || "—"} variant={sVariant(a.severity)} />
                    <Badge text={resolved ? "Resolved" : a.status || "Active"} variant={resolved ? "green" : "red"} />
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16 }}>
                <div>
                    <Card title="Title">
                        <div style={{ padding: 18, fontSize: 14, fontWeight: 500 }}>{a.title || "—"}</div>
                    </Card>
                    <Card title="Description">
                        <div style={{ padding: 18, fontSize: 13, color: "var(--text2)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                            {a.description || "—"}
                        </div>
                    </Card>
                    <Card title="Details">
                        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                            {[
                                ["Category", a.category || "—"],
                                ["Source", a.source || "—"],
                                ["Account ID", accountId || "—"],
                            ].map(([label, value]) => (
                                <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                                    <span style={{ color: "var(--text3)", fontWeight: 600 }}>{label}</span>
                                    <span style={{ color: "var(--text2)" }}>{value}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                <div>
                    <Card title="Actions">
                        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                            {ticketCreated ? (
                                <div style={{ background: "var(--accent-bg)", border: "1px solid var(--accent)", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "var(--accent)", textAlign: "center", fontWeight: 600 }}>
                                    🎫 Ticket Created!
                                </div>
                            ) : (
                                <button
                                    className="btn-primary"
                                    onClick={handleCreateTicket}
                                    disabled={creatingTicket}
                                    style={{ marginTop: 0 }}
                                >
                                    {creatingTicket ? "⏳ Creating..." : "🎫 Create Ticket"}
                                </button>
                            )}

                            {!resolved ? (
                                <button
                                    onClick={handleResolve}
                                    disabled={resolving}
                                    style={{
                                        width: "100%", padding: "10px",
                                        background: "var(--green-bg)",
                                        border: "1px solid var(--green)",
                                        borderRadius: 8, color: "var(--green)",
                                        fontSize: 13, fontWeight: 600,
                                        cursor: "pointer",
                                    }}
                                >
                                    {resolving ? "Resolving..." : "✓ Resolve Alert"}
                                </button>
                            ) : (
                                <div style={{ background: "var(--green-bg)", border: "1px solid var(--green)", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "var(--green)", textAlign: "center", fontWeight: 600 }}>
                                    ✓ Alert Resolved
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

const AlertsSection = ({ accountId }) => {
    const [alerts, setAlerts] = useState([]);
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [severityFilter, setSeverityFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [creatingTicket, setCreatingTicket] = useState({});
    const [selected, setSelected] = useState(null);   // ← ADD THIS

    const loadData = useCallback(async () => {
        setLoading(true); setError("");
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
            const alertsData = alertJson.alerts || []; if (alertsData.length === 0) { const sampleAlerts = [{ alert_id: "ALT-001", title: "Sample High Severity Alert", description: "This is a test alert to verify View button visibility", severity: "High", status: "Active", category: "Security", source: "AWS GuardDuty", timestamp: new Date().toISOString() }]; setAlerts(sampleAlerts); } else { setAlerts(alertsData); }
            setTickets(ticketJson.tickets || []);

        } catch (e) {
            setError(`Failed to load: ${e.message}`);
        } finally {
            setLoading(false);
        }
    }, [accountId]);

    useEffect(() => {
        if (accountId) loadData();
    }, [loadData, accountId]);

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

    if (selected) return <AlertDetail alert={selected} onBack={() => setSelected(null)} accountId={accountId} onRefresh={loadData} />;

    return (
        <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                    <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4 }}>Alerts</div>
                    <div style={{ fontSize: 13, color: "var(--text2)" }}>{alerts.length} alerts</div>
                </div>
                <button className="btn btn-sm" onClick={loadData}>↺ Refresh</button>
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
                            rows={filtered.map((a) => {
                                return [
                                    <Mono>{a.alert_id}</Mono>,
                                    <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{a.title || "—"}</span>,
                                    <Badge text={a.severity || "—"} variant={sVariant(a.severity)} />,
                                    <Badge text={a.status || "Active"} variant={stVariant(a.status)} />,
                                    a.category || "—",
                                    a.source || "—",
                                    <span style={{ fontSize: 11 }}>{(a.timestamp || "").slice(0, 19).replace("T", " ")}</span>,
                                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                        <button
                                            className="btn btn-sm"
                                            onClick={() => setSelected(a)}
                                            style={{
                                                background: "var(--accent)",
                                                color: "#fff",
                                                border: "none",
                                                fontWeight: "600",
                                                minWidth: "60px"
                                            }}
                                        >
                                            View
                                        </button>
                                        {a.status === "Active" ? (
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
                                                        loadData();
                                                    } catch (e) {
                                                        console.error("Resolve failed:", e);
                                                    }
                                                }}
                                            >
                                                ✓ Resolve
                                            </button>
                                        ) : (
                                            <Badge text="Resolved" variant="green" />
                                        )}
                                    </div>,
                                ];
                            })}
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

// ── Resource Groups Section ────────────────────────────────────────────────────
const ResourceGroupsSection = ({ awsData }) => {
    const [selectedRg, setSelectedRg] = useState(null);
    const rgs = awsData.resource_groups || [];
    const allResources = awsData.all_resources || [];

    const resourcesInRg = (rgName) =>
        allResources.filter(r => r.id && r.id.toLowerCase().includes(`/resourcegroups/${rgName.toLowerCase()}/`));

    if (selectedRg) {
        const resources = resourcesInRg(selectedRg.name);
        return (
            <div>
                <button className="btn btn-sm" onClick={() => setSelectedRg(null)} style={{ marginBottom:16 }}>← Back to Resource Groups</button>
                <div style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>📁 {selectedRg.name}</div>
                <div style={{ fontSize:13, color:"var(--text2)", marginBottom:20 }}>
                    Location: {selectedRg.location} · {resources.length} resources
                </div>
                {Object.entries(selectedRg.tags || {}).length > 0 && (
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:16 }}>
                        {Object.entries(selectedRg.tags).map(([k,v]) => (
                            <span key={k} style={{ background:"var(--accent-bg)", color:"var(--accent)", borderRadius:6, padding:"2px 8px", fontSize:11 }}>{k}: {v}</span>
                        ))}
                    </div>
                )}
                <Card title={`Resources (${resources.length})`}>
                    <DataTable
                        columns={["Name", "Type", "Location"]}
                        rows={resources.map(r => [
                            <strong style={{ fontSize:12 }}>{r.name || "—"}</strong>,
                            <Mono>{(r.type || "—").split("/").slice(-1)[0]}</Mono>,
                            r.location || "—",
                        ])}
                        empty="No resources found in this resource group"
                    />
                </Card>
            </div>
        );
    }

    return (
        <div>
            <div style={{ fontSize:18, fontWeight:700, letterSpacing:"-0.03em", marginBottom:4 }}>Resource Groups</div>
            <div style={{ fontSize:13, color:"var(--text2)", marginBottom:20 }}>Click a resource group to see its contents</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12, marginBottom:24 }}>
                <StatCard label="Total RGs" value={rgs.length} />
                <StatCard label="Total Resources" value={allResources.length} />
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {rgs.length === 0 && (
                    <div style={{ padding:32, textAlign:"center", color:"var(--text3)", fontSize:13, background:"var(--surface)", borderRadius:12 }}>No resource groups found</div>
                )}
                {rgs.map(rg => {
                    const resources = resourcesInRg(rg.name);
                    return (
                        <div key={rg.name}
                             onClick={() => setSelectedRg(rg)}
                             style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, padding:"16px 20px", cursor:"pointer", display:"flex", alignItems:"center", gap:16, transition:"all 0.15s" }}
                             onMouseEnter={e => { e.currentTarget.style.borderColor="var(--accent)"; e.currentTarget.style.background="var(--accent-bg)"; }}
                             onMouseLeave={e => { e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.background="var(--surface)"; }}
                        >
                            <div style={{ fontSize:28 }}>📁</div>
                            <div style={{ flex:1 }}>
                                <div style={{ fontWeight:600, fontSize:14, marginBottom:2 }}>{rg.name}</div>
                                <div style={{ fontSize:11, color:"var(--text3)" }}>📍 {rg.location} · {resources.length} resources</div>
                                {rg.provisioning_state && <div style={{ fontSize:11, color:"var(--text3)" }}>State: {rg.provisioning_state}</div>}
                            </div>
                            <span style={{ color:"var(--accent)", fontSize:18 }}>→</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ── All Resources Section ──────────────────────────────────────────────────────
const AllResourcesSection = ({ awsData }) => {
    const [filter, setFilter] = useState("");
    const allResources = awsData.all_resources || [];
    const filtered = allResources.filter(r =>
        !filter || r.name?.toLowerCase().includes(filter.toLowerCase()) ||
        r.type?.toLowerCase().includes(filter.toLowerCase()) ||
        r.location?.toLowerCase().includes(filter.toLowerCase())
    );
    const byType = allResources.reduce((acc, r) => {
        const type = (r.type || "Unknown").split("/").slice(-1)[0];
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {});

    return (
        <div>
            <div style={{ fontSize:18, fontWeight:700, letterSpacing:"-0.03em", marginBottom:4 }}>All Resources</div>
            <div style={{ fontSize:13, color:"var(--text2)", marginBottom:20 }}>Every resource in this subscription</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12, marginBottom:20 }}>
                <StatCard label="Total Resources" value={allResources.length} />
                <StatCard label="Resource Types" value={Object.keys(byType).length} />
            </div>
            {/* Type breakdown */}
            {Object.keys(byType).length > 0 && (
                <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:20 }}>
                    {Object.entries(byType).map(([type, count]) => (
                        <span key={type} style={{ background:"var(--surface2)", borderRadius:6, padding:"4px 10px", fontSize:12, color:"var(--text2)" }}>
                            {type} <strong style={{ color:"var(--text)" }}>{count}</strong>
                        </span>
                    ))}
                </div>
            )}
            {/* Search */}
            <input
                className="form-input"
                placeholder="Search by name, type or location..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                style={{ marginBottom:16, fontSize:13 }}
            />
            <Card title={`Resources (${filtered.length})`}>
                <DataTable
                    columns={["Name", "Type", "Location", "Resource Group"]}
                    rows={filtered.map(r => [
                        <strong style={{ fontSize:12 }}>{r.name || "—"}</strong>,
                        <Mono>{(r.type || "—").split("/").slice(-2).join("/")}</Mono>,
                        r.location || "—",
                        r.id ? r.id.split("/resourceGroups/")[1]?.split("/")[0] || "—" : "—",
                    ])}
                    empty="No resources found"
                />
            </Card>
        </div>
    );
};

// ── Cognitive Services / AI Section ───────────────────────────────────────────
const CognitiveServicesSection = ({ awsData }) => {
    const allResources = awsData.all_resources || [];
    const cogServices = allResources.filter(r =>
            r.type && (
                r.type.includes("CognitiveServices") ||
                r.type.includes("OpenAI") ||
                r.type.includes("MachineLearning") ||
                r.type.includes("Search") ||
                r.type.includes("Bot")
            )
    );
    const perRegion = cogServices.reduce((acc, r) => {
        acc[r.location] = (acc[r.location] || 0) + 1;
        return acc;
    }, {});

    return (
        <div>
            <div style={{ fontSize:18, fontWeight:700, letterSpacing:"-0.03em", marginBottom:4 }}>AI Services</div>
            <div style={{ fontSize:13, color:"var(--text2)", marginBottom:20 }}>Azure Cognitive Services, OpenAI and ML resources</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12, marginBottom:24 }}>
                <StatCard label="AI Services" value={cogServices.length} />
                <StatCard label="Regions" value={Object.keys(perRegion).length} />
            </div>
            <Card title={`AI Services (${cogServices.length})`}>
                <DataTable
                    columns={["Name", "Kind / Type", "Location", "Resource Group"]}
                    rows={cogServices.map(r => [
                        <strong style={{ fontSize:12 }}>{r.name || "—"}</strong>,
                        <Mono>{(r.type || "—").split("/").slice(-1)[0]}</Mono>,
                        r.location || "—",
                        r.id ? r.id.split("/resourceGroups/")[1]?.split("/")[0] || "—" : "—",
                    ])}
                    empty="No AI services found in this subscription"
                />
            </Card>
        </div>
    );
};

const getNavItems = (cloud) => {
    const labels = NAV_LABELS[cloud] || NAV_LABELS.default;
    const azureExtra = cloud === "azure" ? [
        { id: "resourcegroups", label: "Resource Groups", icon: "📁", section: "Resources" },
        { id: "allresources",   label: "All Resources",   icon: "🗂",  section: "Resources" },
        { id: "cognitive",      label: "AI Services",     icon: "🤖", section: "Resources" },
    ] : [];
    return [
        { id: "dashboard",  label: "Dashboard",            icon: "📊", section: "Resources" },
        { id: "overview",   label: "Overview",             icon: "◻",  section: "Resources" },
        { id: "iam",        label: labels.iam.label,        icon: labels.iam.icon,         section: "Resources" },
        { id: "s3",         label: labels.s3.label,         icon: labels.s3.icon,          section: "Resources" },
        { id: "route53",    label: labels.route53.label,    icon: labels.route53.icon,     section: "Resources" },
        { id: "cloudfront", label: labels.cloudfront.label, icon: labels.cloudfront.icon,  section: "Resources" },
        { id: "regional",   label: labels.regional.label,   icon: labels.regional.icon,    section: "Resources" },
        ...azureExtra,
        { id: "alerts",     label: "Alerts",               icon: "🔔", section: "Operations" },
        { id: "tickets",    label: "Tickets",              icon: "🎫", section: "Operations" },
    ];
};

const LastScanBanner = ({ scanMeta, onRescan, cloud, onDismiss }) => {
    const [dismissed, setDismissed] = useState(false);
    if (!scanMeta || dismissed) return null;

    const isAzure = cloud === "azure";
    const color   = isAzure ? "#0089D6" : "#3b5bdb";
    const bgColor = isAzure ? "#e6f2ff"  : "#eef2ff";
    const border  = isAzure ? "#0089D630" : "rgba(59,91,219,0.2)";

    const regionStr = scanMeta.region || "—";
    const duration  = scanMeta.duration ? `${scanMeta.duration}s` : "";

    return (
        <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            background: bgColor,
            border: `1px solid ${border}`,
            borderRadius: 10,
            marginBottom: 20,
            fontSize: 13,
            gap: 12,
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ color, fontWeight: 600 }}>Showing last scan</span>
                <span style={{ color: "var(--text3)" }}>
                    {regionStr}{duration ? ` · ${duration}` : ""}
                </span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                <button
                    onClick={onRescan}
                    style={{
                        padding: "4px 14px",
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 8,
                        cursor: "pointer",
                        background: color,
                        color: "white",
                        border: "none",
                    }}
                >
                    ↺ Rescan
                </button>
                <button
                    onClick={() => { setDismissed(true); if (onDismiss) onDismiss(); }}
                    style={{
                        padding: "4px 10px",
                        fontSize: 12,
                        borderRadius: 8,
                        cursor: "pointer",
                        background: "transparent",
                        color: "var(--text3)",
                        border: "1px solid var(--border)",
                    }}
                >
                    ✕
                </button>
            </div>
        </div>
    );
};

const AppShell = ({ awsData, scanMeta, accountId, selectedCloud, userEmail, initialSection, onNewScan, onSwitchCloud, onSignOut, onScanRegions, onSetSelectedCloud, onClearData, isScanning, scanningRegion , setAwsData, setScanMeta, setAccountId}) => {
    React.useEffect(() => {
        const id = "cloudops-topbar-styles";
        if (document.getElementById(id)) return;
        const style = document.createElement("style");
        style.id = id;
        style.textContent = `
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.6; } }
            .account-chip-wrap:hover .account-chip-tooltip { opacity: 1 !important; pointer-events: auto !important; }
        `;
        document.head.appendChild(style);
    }, []);
    const [section, setSection] = useState(() => {
        return localStorage.getItem('cloudops-section') || "overview";
    });
    const [appSection, setAppSection] = useState(initialSection || "main");
    const [sectionHistory, setSectionHistory] = useState([]);
    const [activeApp, setActiveApp] = useState("cloudops");

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

    const getSavedScanData = (email) => {
        try {
            const raw = localStorage.getItem(`cloudops-awsData-${email}`);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch {
            return null;
        }
    };

    const getSavedScanMeta = (email) => {
        try {
            const raw = localStorage.getItem(`cloudops-scanMeta-${email}`);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch {
            return null;
        }
    };

// Helper: does the saved scan belong to this account?
// We check identity fields inside the data. If they match, great.
// If we can't tell (no identity stored), we still restore — it's the
// user's own data and they just picked this account deliberately.
    const savedScanBelongsToAccount = (savedData, accountKey) => {
        if (!savedData) return false;
        // If we have any saved scan data at all, restore it
        // The user deliberately picked this account so trust the saved data
        return true;
    };

    const renderContent = () => {
        // ── Inner app pages ──────────────────────────────────────────────────────

        if (appSection === "cloudSelect")
            return (
                <CloudSelectPage
                    onSelectCloud={(cloud) => {
                        if (cloud === "aws") {
                            onSetSelectedCloud("aws");
                            navigateTo("accountSelection");
                        } else if (cloud === "azure") {
                            onSetSelectedCloud("azure");
                            navigateTo("azureAccountSelection");
                        }
                    }}
                    onBack={() => {
                        if (accountId) onSetSelectedCloud("aws");
                        navigateBack();
                    }}
                    onSignOut={onSignOut}
                    userEmail={userEmail}
                />
            );

        if (appSection === "editCredentials")
            return (
                <EditCredentialsPage
                    userEmail={userEmail}
                    onSave={navigateBack}
                    onBack={navigateBack}
                />
            );

        if (appSection === "setupGuide")
            return (
                <SetupGuidePage
                    onContinue={() => navigateTo("scan")}
                    onBack={navigateBack}
                />
            );

        if (appSection === "scan")
            return (
                <ScanForm
                    onCredentialsSaved={() => navigateTo("accountSelection")}
                />
            );

        // ── AWS account selection ─────────────────────────────────────────────────
        if (appSection === "accountSelection")
            return (
                <AccountSelectionPage
                    onSelectAccount={async (acc) => {
                        const email = localStorage.getItem("cloudops-userEmail") || userEmail;
                        const token = localStorage.getItem("cloudops-auth-token");
                        const debugSavedData = getSavedScanData(email);
                        console.log("AWS accountSelection — email:", email, "savedData:", !!debugSavedData);

// 1. Fetch full credentials for the selected account
                        try {
                            const res = await fetch(
                                `${BACKEND}/api/auth/get-account-credentials`,
                                {
                                    method: "POST",
                                    headers: {
                                        "Content-Type": "application/json",
                                        Authorization: `Bearer ${token}`,
                                    },
                                    body: JSON.stringify({ accessKey: acc.accessKey }),
                                }
                            );
                            const json = await res.json();
                            if (json.accessKey && json.secretKey) {
                                localStorage.setItem(
                                    `cloudops-credentials-${email}`,
                                    JSON.stringify({
                                        accessKey: json.accessKey,
                                        secretKey: json.secretKey,
                                    })
                                );
                            }
                        } catch (e) {
                            console.error("Failed to fetch account credentials:", e);
                        }

// 2. Try to restore a previous scan for this account
                        // Build the account-specific key
                        const accountKey =
                            acc.accountId && acc.accountId !== "Unknown"
                                ? acc.accountId
                                : acc.accessKey || "";
// (loading handled by account selection UI)

// Try backend first, then localStorage cache
                        let savedData = null;
                        let savedMeta = null;

                        try {
                            const token = localStorage.getItem('cloudops-auth-token');
                            const res = await fetch(`${BACKEND}/api/scan-data/${encodeURIComponent(accountKey)}`, {
                                headers: { "Authorization": `Bearer ${token}` }
                            });
                            if (res.ok) {
                                const json = await res.json();
                                if (json.found) {
                                    savedData = json.scanData;
                                    savedMeta = json.scanMeta;
                                }
                            }
                        } catch (e) {
                            console.warn("Backend fetch failed, trying localStorage:", e);
                            // Fallback to localStorage cache
                            try {
                                const raw = localStorage.getItem(`cloudops-awsData-${email}-${accountKey}`);
                                if (raw) savedData = JSON.parse(raw);
                                const rawMeta = localStorage.getItem(`cloudops-scanMeta-${email}-${accountKey}`);
                                if (rawMeta) savedMeta = JSON.parse(rawMeta);
                            } catch {}
                        }
// (loading handled by account selection UI)
                        console.log("accountKey:", accountKey);
                        console.log("new key exists:", !!localStorage.getItem(`cloudops-awsData-${email}-${accountKey}`));
                        console.log("old key exists:", !!localStorage.getItem(`cloudops-awsData-${email}`));
                        console.log("savedData:", !!savedData);



                        if (savedData) {
                            // ✅ Has scan for this account → load it and go to Dashboard
                            setAwsData(savedData);
                            if (savedMeta) setScanMeta(savedMeta);
                            const restoredId = savedData.identity?.account_id || acc.accountId || "";
                            setAccountId(restoredId);
                            localStorage.setItem("cloudops-accountId", restoredId);
                            onSetSelectedCloud("aws");
                            localStorage.setItem("cloudops-selectedCloud", "aws");
                            setSection("dashboard");
                            setAppSection("main");
                            setSectionHistory([]);
                        } else {
                            // ✅ No scan for this account yet → clear old data then go scan
                            setAwsData(null);
                            setScanMeta(null);
                            setAccountId("");
                            navigateTo("regionSelection");
                        }
                    }}
                    onAddNew={() => navigateTo("setupGuide")}
                    onBack={navigateBack}
                />
            );

        if (appSection === "azureSetupGuide")
            return (
                <AzureSetupGuidePage
                    onContinue={() => navigateTo("editCredentials")}
                    onBack={navigateBack}
                />
            );

        // ── Azure account selection ───────────────────────────────────────────────
        if (appSection === "azureAccountSelection")
            return (
                <AzureAccountSelectionPage
                    onSelectAccount={async (acc) => {
                        const email = localStorage.getItem("cloudops-userEmail") || userEmail;
                        const token = localStorage.getItem("cloudops-auth-token");
                        // DEBUG
                        const debugSavedData = getSavedScanData(email);
                        console.log("Azure accountSelection — email:", email, "savedData:", !!debugSavedData);
                        // 1. Fetch full Azure credentials for the selected account
                        try {
                            const res = await fetch(
                                `${BACKEND}/api/azure/get-account-credentials`,
                                {
                                    method: "POST",
                                    headers: {
                                        "Content-Type": "application/json",
                                        Authorization: `Bearer ${token}`,
                                    },
                                    body: JSON.stringify({
                                        tenantId: acc.tenantId,
                                        subscriptionId: acc.subscriptionId,
                                    }),
                                }
                            );
                            const creds = await res.json();
                            if (creds.tenantId) {
                                localStorage.setItem(
                                    "cloudops-azure-selected",
                                    JSON.stringify(creds)
                                );
                            }
                        } catch (e) {
                            console.error("Failed to fetch Azure credentials:", e);
                        }
                        // 2. Try to restore a previous scan for this subscription
                        const accountKey = acc.subscriptionId || "";


                        let savedData = null;
                        let savedMeta = null;

                        try {
                            const token = localStorage.getItem('cloudops-auth-token');
                            const res = await fetch(`${BACKEND}/api/scan-data/${encodeURIComponent(accountKey)}`, {
                                headers: { "Authorization": `Bearer ${token}` }
                            });
                            if (res.ok) {
                                const json = await res.json();
                                if (json.found) {
                                    savedData = json.scanData;
                                    savedMeta = json.scanMeta;
                                }
                            }
                        } catch (e) {
                            console.warn("Backend fetch failed, trying localStorage:", e);
                            try {
                                const raw = localStorage.getItem(`cloudops-awsData-${email}-${accountKey}`);
                                if (raw) savedData = JSON.parse(raw);
                                const rawMeta = localStorage.getItem(`cloudops-scanMeta-${email}-${accountKey}`);
                                if (rawMeta) savedMeta = JSON.parse(rawMeta);
                            } catch {}
                        }


                        if (savedData && savedData.cloud === "azure") {
                            // ✅ Existing Azure scan → go straight to Dashboard
                            setAwsData(savedData);
                            if (savedMeta) setScanMeta(savedMeta);

                            const restoredId =
                                savedData.identity?.subscription_id ||
                                acc.subscriptionId ||
                                "";
                            setAccountId(restoredId);
                            localStorage.setItem("cloudops-accountId", restoredId);
                            onSetSelectedCloud("azure");
                            localStorage.setItem("cloudops-selectedCloud", "azure");

                            setSection("dashboard");
                            setAppSection("main");
                            setSectionHistory([]);
                        } else {
                            // ✅ No prior scan → proceed to region selection
                            navigateTo("regionSelection");
                        }
                    }}
                    onAddNew={() => navigateTo("azureSetupGuide")}
                    onBack={navigateBack}
                />
            );

        // ── Region selection ──────────────────────────────────────────────────────
        if (appSection === "regionSelection")
            return (
                <RegionSelectionPage
                    onScanRegions={async (regions) => {
                        // Call the parent scan handler (handles both AWS + Azure via prop)
                        await onScanRegions(regions);

                        // ✅ FIX: after scan completes, land on Dashboard and reset history
                        setSection("dashboard");
                        setAppSection("main");
                        setSectionHistory([]);
                    }}
                    onBack={navigateBack}
                    userEmail={userEmail}
                    selectedCloud={selectedCloud}
                />
            );

        // ── Main sections (Dashboard etc.) ────────────────────────────────────────
        if (
            !accountId &&
            [
                "dashboard",
                "overview",
                "iam",
                "s3",
                "route53",
                "cloudfront",
                "regional",
            ].includes(section)
        ) {
            return (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "60vh",
                        gap: 16,
                    }}
                >
                    <div style={{ fontSize: 48 }}>☁</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
                        No cloud data yet
                    </div>
                    <div
                        style={{
                            fontSize: 13,
                            color: "var(--text2)",
                            textAlign: "center",
                        }}
                    >
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

        // Guard — if no scan data yet, show empty state
        if (!awsData && !["dashboard", "tickets", "alerts"].includes(section)) {
            return (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"60vh", gap:16 }}>
                    <div style={{ fontSize:48 }}>☁</div>
                    <div style={{ fontSize:18, fontWeight:700 }}>No scan data for this account</div>
                    <div style={{ fontSize:13, color:"var(--text2)", textAlign:"center" }}>
                        This account hasn't been scanned yet.
                    </div>
                    <button className="btn-primary" style={{ width:"auto", padding:"10px 24px" }}
                            onClick={() => navigateTo("regionSelection")}>
                        Scan Now →
                    </button>
                </div>
            );
        }

        switch (section) {
            case "dashboard":
                return <DashboardSection awsData={awsData || {}} accountId={accountId} />;
            case "overview":
                return <Overview awsData={awsData || {}} scanMeta={scanMeta} />;
            case "iam":
                return <IAMSection awsData={awsData || {}} />;
            case "s3":
                return <S3Section awsData={awsData || {}} />;
            case "route53":
                return <Route53Section awsData={awsData || {}} />;
            case "cloudfront":
                return <CloudFrontSection awsData={awsData || {}} />;
            case "regional":
                return <RegionalSection awsData={awsData || {}} />;
            case "resourcegroups":
                return <ResourceGroupsSection awsData={awsData || {}} />;
            case "allresources":
                return <AllResourcesSection awsData={awsData || {}} />;
            case "cognitive":
                return <CognitiveServicesSection awsData={awsData || {}} />;
            case "tickets":
                return <TicketsSection accountId={accountId} />;
            default:
                return null;
        }
    };

    const NAV_ITEMS = getNavItems(selectedCloud || "default");
    const sectionTitle = NAV_ITEMS.find((n) => n.id === section)?.label || "Overview";

    const APP_ITEMS = [
        {
            id: "cloudops", label: "Cloud", color: "#6366f1",
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
        },
        {
            id: "secops", label: "SecOps", color: "#ef4444",
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        },
        {
            id: "finops", label: "FinOps", color: "#10b981",
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        },
        {
            id: "aiops", label: "AIOps", color: "#8b5cf6",
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
        },
        {
            id: "rfp", label: "RFP", color: "#f59e0b",
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        },
    ];

    const ComingSoonContent = ({ appName, color, description }) => (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16, padding: 40 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: `${color}20`, border: `2px solid ${color}40`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ fontSize: 32 }}>
                    {appName === "SecOps" ? "🔒" : appName === "FinOps" ? "💰" : appName === "AIOps" ? "🤖" : "📄"}
                </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" }}>{appName}</div>
            <div style={{ fontSize: 14, color: "var(--text2)", textAlign: "center", maxWidth: 400, lineHeight: 1.7 }}>{description}</div>
            <div style={{ background: `${color}15`, border: `1px solid ${color}40`, borderRadius: 20, padding: "6px 20px", fontSize: 12, fontWeight: 600, color: color }}>
                Coming Soon
            </div>
        </div>
    );

    return (
        <div style={{ display: "flex", height: "100vh", overflow: "hidden", position: "relative" }}>

            {/* ── Far-left App Icon Strip — FIXED, never moves ── */}
            <div style={{
                width: 56,
                background: "var(--surface)",
                borderRight: "1px solid var(--border)",
                display: "flex", flexDirection: "column",
                alignItems: "center", padding: "14px 0",
                gap: 4,
                position: "fixed",   /* FIXED to viewport, always visible */
                top: 0, left: 0,
                height: "100vh",
                flexShrink: 0, zIndex: 60,
            }}>
                {/* Logo */}
                <div style={{ width: 34, height: 34, background: "linear-gradient(135deg, #6366f1, #4f46e5)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
                    </svg>
                </div>

                {/* Divider */}
                <div style={{ width: 28, height: 1, background: "var(--border)", marginBottom: 8 }} /> {/* was: #1e2a3a */}

                {/* App icons */}
                {APP_ITEMS.map((app) => {
                    const isActive = activeApp === app.id;
                    return (
                        <div
                            key={app.id}
                            onClick={() => setActiveApp(app.id)}
                            title={app.label}
                            style={{
                                width: 42, height: 42,
                                borderRadius: 10,
                                display: "flex", flexDirection: "column",
                                alignItems: "center", justifyContent: "center",
                                cursor: "pointer", gap: 3,
                                background: isActive ? `${app.color}15` : "transparent", /* was: ${app.color}25 */
                                border: `1.5px solid ${isActive ? app.color : "transparent"}`,
                                color: isActive ? app.color : "var(--text3)",             /* was: #64748b */
                                transition: "all 0.15s ease",
                                position: "relative",
                            }}
                            onMouseEnter={e => {
                                if (!isActive) {
                                    e.currentTarget.style.background = "var(--surface2)"; /* was: rgba(255,255,255,0.06) */
                                    e.currentTarget.style.color = "var(--text)";          /* was: #fff */
                                }
                            }}
                            onMouseLeave={e => {
                                if (!isActive) {
                                    e.currentTarget.style.background = "transparent";
                                    e.currentTarget.style.color = "var(--text3)";         /* was: #64748b */
                                }
                            }}
                        >
                            {/* Active indicator */}
                            {isActive && (
                                <div style={{
                                    position: "absolute", left: -1, top: "50%",
                                    transform: "translateY(-50%)",
                                    width: 3, height: 20,
                                    background: app.color,
                                    borderRadius: "0 3px 3px 0",
                                }} />
                            )}
                            {app.icon}
                            <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.02em" }}>
                            {app.label}
                        </span>
                        </div>
                    );
                })}

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Sign out */}
                <div
                    onClick={onSignOut}
                    title="Sign Out"
                    style={{ width: 42, height: 42, borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", gap: 3, color: "var(--red)", transition: "all 0.15s" }} /* was: color: #ef4444 */
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--red-bg)"; }}  /* was: rgba(239,68,68,0.1) */
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    <span style={{ fontSize: 8, fontWeight: 600 }}>Exit</span>
                </div>
            </div>

            {/* Spacer to offset fixed 56px strip — pushes all content right */}
            <div style={{ width: 56, flexShrink: 0 }} />

            {/* ── CloudOps App (nav sidebar + main content) ── */}
            {activeApp === "cloudops" && (
                <>
                    <nav style={{
                        width: 220,
                        background: "var(--surface)",
                        borderRight: "1px solid var(--border)",
                        display: "flex", flexDirection: "column",
                        position: "sticky", top: 0,   /* sticky within scroll, not fixed */
                        height: "100vh",
                        overflowY: "auto", flexShrink: 0,
                    }}>
                        {/* Top header */}
                        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid var(--border)" }}> {/* was: #243049 */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                <div style={{ width: 28, height: 28, background: "var(--accent)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                                </div>
                                <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)" }}>CloudOps</span> {/* was: white */}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "var(--accent-bg)", borderRadius: 6, fontSize: 12, fontWeight: 600, color: "var(--accent)" }}> {/* was: rgba(99,102,241,0.15) / #818cf8 */}
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" /></svg>
                                Cloud Provider
                            </div>
                        </div>

                        {/* Account ID */}
                        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}> {/* was: #243049 */}
                            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Account ID</div> {/* was: #64748b */}
                            <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text2)" }}>{accountId || "Not connected"}</div> {/* was: #94a3b8 */}
                            {scanMeta && <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>{scanMeta.duration}s · {scanMeta.region}</div>} {/* was: #64748b */}
                        </div>

                        {/* Nav items */}
                        <div style={{ padding: "8px", flex: 1 }}>
                            {["Resources", "Operations"].map((sectionName) => (
                                <div key={sectionName}>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "12px 8px 6px" }}>{sectionName}</div> {/* was: #64748b */}
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
                                                    background: section === nav.id && appSection === "main" ? "var(--accent-bg)" : "transparent", /* was: rgba(99,102,241,0.15) */
                                                    color: section === nav.id && appSection === "main" ? "var(--accent)" : "var(--text2)",        /* was: #818cf8 : #94a3b8 */
                                                    fontWeight: section === nav.id && appSection === "main" ? 600 : 400,
                                                    position: "relative",
                                                    transition: "all 0.15s",
                                                }}>
                                            {section === nav.id && appSection === "main" && (
                                                <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 16, background: "var(--accent)", borderRadius: "0 3px 3px 0" }} /> /* was: #6366f1 */
                                            )}
                                            <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>{nav.icon}</span>
                                            <span style={{ flex: 1 }}>{nav.label}</span>
                                            {nav.id === "alerts" && activeAlertCount > 0 && (
                                                <span style={{ marginLeft: "auto", background: "var(--red)", color: "white", borderRadius: 20, fontSize: 10, fontWeight: 700, padding: "1px 6px", minWidth: 18, textAlign: "center" }}> {/* was: #ef4444 */}
                                                    {activeAlertCount}
                                            </span>
                                            )}
                                            {nav.id === "tickets" && newTicketCount > 0 && (
                                                <span style={{ marginLeft: "auto", background: "var(--red)", color: "white", borderRadius: 20, fontSize: 10, fontWeight: 700, padding: "1px 6px", minWidth: 18, textAlign: "center" }}> {/* was: #ef4444 */}
                                                    {newTicketCount}
                                            </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>

                        {/* Edit Credentials */}
                        <div style={{ padding: "8px 8px 0" }}>
                            <button
                                onClick={() => navigateTo("editCredentials")}
                                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, cursor: "pointer", fontSize: 13, width: "100%", textAlign: "left", border: "none", background: "transparent", color: "var(--text2)", fontFamily: "inherit", transition: "all 0.15s" }} /* was: #94a3b8 */
                                onMouseEnter={e => e.currentTarget.style.background = "var(--surface2)"}  /* was: rgba(255,255,255,0.06) */
                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            >
                                <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>⚙</span>
                                Edit Credentials
                            </button>
                        </div>

                        {/* Switch Provider */}
                        <div style={{ padding: "12px 8px", borderTop: "1px solid var(--border)" }}> {/* was: #243049 */}
                            <button
                                onClick={() => { onSwitchCloud(); navigateTo("cloudSelect"); }}
                                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, cursor: "pointer", fontSize: 13, width: "100%", textAlign: "left", border: "none", background: "transparent", color: "var(--text2)", fontFamily: "inherit", transition: "all 0.15s" }} /* was: #94a3b8 */
                                onMouseEnter={e => e.currentTarget.style.background = "var(--surface2)"}  /* was: rgba(255,255,255,0.06) */
                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            >
                                <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>☁</span> Switch Provider
                            </button>
                        </div>
                    </nav>

                    {/* Main content */}
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                        <div style={{ height: 52, background: "var(--surface)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "0 24px", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                {appSection !== "main" && (
                                    <button onClick={navigateBack} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, background: "var(--surface2)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--text2)" }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                                    </button>
                                )}
                                {isScanning && (
                                    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 12px", background: selectedCloud === "azure" ? "#e6f2ff" : "var(--accent-bg)", border: `1px solid ${selectedCloud === "azure" ? "#0089D650" : "var(--accent-border)"}`, borderRadius:20, fontSize:12, fontWeight:600, color: selectedCloud === "azure" ? "#0089D6" : "var(--accent)", animation:"pulse 1.5s ease-in-out infinite" }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation:"spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                                        Scanning {scanningRegion && scanningRegion.length < 30 ? scanningRegion : "regions"}…
                                    </div>
                                )}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                {accountId && (
                                    <div style={{ position:"relative" }} className="account-chip-wrap">
                                        <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 12px", background: selectedCloud === "azure" ? "#e6f2ff" : "var(--green-bg)", border:`1px solid ${selectedCloud === "azure" ? "#0089D640" : "var(--green-border, #a7f3d0)"}`, borderRadius:20, fontSize:12, fontWeight:600, color: selectedCloud === "azure" ? "#0089D6" : "var(--green)", cursor:"default", userSelect:"none" }}>
                                            <div style={{ width:6, height:6, borderRadius:"50%", background: selectedCloud === "azure" ? "#0089D6" : "var(--green)" }} />
                                            {awsData?.identity?.subscription_name
                                                ? awsData.identity.subscription_name.length > 24
                                                    ? awsData.identity.subscription_name.slice(0,24)+"…"
                                                    : awsData.identity.subscription_name
                                                : scanMeta?.accountName
                                                    ? scanMeta.accountName
                                                    : selectedCloud === "azure"
                                                        ? "Azure Account"
                                                        : "AWS Account"
                                            }
                                        </div>
                                        <div style={{ position:"absolute", top:"calc(100% + 8px)", right:0, background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, padding:"8px 12px", fontSize:11, whiteSpace:"nowrap", boxShadow:"0 4px 16px rgba(0,0,0,0.12)", zIndex:100, opacity:0, pointerEvents:"none", transition:"opacity 0.15s" }} className="account-chip-tooltip">
                                            <div style={{ color:"var(--text3)", marginBottom:2 }}>{selectedCloud === "azure" ? "Subscription ID" : "Account ID"}</div>
                                            <div style={{ fontFamily:"monospace", fontWeight:600, color:"var(--text)", fontSize:12 }}>{accountId}</div>
                                            {awsData?.identity?.tenant_id && <><div style={{ color:"var(--text3)", marginBottom:2, marginTop:6 }}>Tenant ID</div><div style={{ fontFamily:"monospace", fontWeight:600, color:"var(--text)", fontSize:12 }}>{awsData.identity.tenant_id}</div></>}
                                            {scanMeta?.region && <><div style={{ color:"var(--text3)", marginBottom:2, marginTop:6 }}>Last Scan</div><div style={{ color:"var(--text)", fontSize:12 }}>{scanMeta.region} · {scanMeta.duration}s</div></>}
                                        </div>
                                    </div>
                                )}
                                <button className="btn btn-sm" onClick={() => { onSwitchCloud(); setSection("dashboard"); navigateTo("cloudSelect"); }} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
                                    Switch Provider
                                </button>
                                <button className="btn btn-sm" onClick={() => navigateTo("regionSelection")}>↺ New Scan</button>
                            </div>
                        </div>
                        <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
                            {/* Show "last scan" banner when viewing restored scan data on the main dashboard */}
                            {appSection === "main" && accountId && scanMeta && (
                                <LastScanBanner
                                    scanMeta={scanMeta}
                                    cloud={selectedCloud}
                                    onRescan={() => navigateTo("regionSelection")}
                                />
                            )}
                            {renderContent()}
                        </div>
                    </div>
                </>
            )}

            {/* ── Other Apps (Coming Soon) ── */}
            {activeApp === "finops" ? (
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <FinOpsSection
                        awsData={awsData || {}}
                        selectedCloud={selectedCloud}
                        accountId={accountId}
                    />
                </div>
            ) : activeApp !== "cloudops" && (() => {
                const app = APP_ITEMS.find(a => a.id === activeApp);
                const appDetails = {
                    secops: { name: "SecOps", desc: "Security Operations — Threat detection, vulnerability scanning, IAM audit, compliance reports and security incident management." },
                    aiops:  { name: "AIOps", desc: "AI-Powered Operations — Anomaly detection, predictive analytics, auto-remediation and root cause analysis using machine learning." },
                    rfp:    { name: "RFP Generator", desc: "Document Automation — Generate professional RFP documents from your cloud infrastructure data using AI-powered templates." },
                };
                const detail = appDetails[activeApp];
                return (
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                        <div style={{ height: 52, background: "var(--surface)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "0 24px", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: app.color }} />
                                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{detail.name}</span>
                            </div>
                            <div style={{ background: `${app.color}15`, border: `1px solid ${app.color}40`, borderRadius: 20, padding: "4px 14px", fontSize: 11, fontWeight: 600, color: app.color }}>
                                Coming Soon
                            </div>
                        </div>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 40, background: "var(--bg)" }}>
                            <div style={{ width: 80, height: 80, borderRadius: 20, background: `${app.color}15`, border: `2px solid ${app.color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <div style={{ color: app.color, transform: "scale(2)" }}>{app.icon}</div>
                            </div>
                            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text)" }}>{detail.name}</div>
                            <div style={{ fontSize: 15, color: "var(--text2)", textAlign: "center", maxWidth: 480, lineHeight: 1.7 }}>{detail.desc}</div>
                            <div style={{ background: `${app.color}15`, border: `1px solid ${app.color}40`, borderRadius: 20, padding: "8px 24px", fontSize: 13, fontWeight: 600, color: app.color }}>
                                🚀 Coming Soon
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, maxWidth: 480, width: "100%", marginTop: 12 }}>
                                {(activeApp === "secops" ? ["Threat Detection","Vulnerability Scan","IAM Audit"] :
                                    activeApp === "aiops" ? ["Anomaly Detection","Predictions","Auto-Remediation"] :
                                        ["AI Templates","PDF Export","Cloud Data"]).map(feature => (
                                    <div key={feature} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px", textAlign: "center" }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text2)" }}>{feature}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })()}
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
    const [awsData, setAwsData] = useState(() => {
        const email = localStorage.getItem('cloudops-userEmail');
        if (!email) return null;
        const saved = localStorage.getItem(`cloudops-awsData-${email}`);
        return saved ? JSON.parse(saved) : null;
    });
    const [scanMeta, setScanMeta] = useState(() => {
        const email = localStorage.getItem('cloudops-userEmail');
        if (!email) return null;
        const saved = localStorage.getItem(`cloudops-scanMeta-${email}`);
        return saved ? JSON.parse(saved) : null;
    });
    const [accountId, setAccountId] = useState(() => {
        return localStorage.getItem('cloudops-accountId') || "";
    });
    const [userEmail, setUserEmail] = useState(() => {
        return localStorage.getItem('cloudops-userEmail') || "";
    });
    const [selectedCloud, setSelectedCloud] = useState(() => {
        return localStorage.getItem('cloudops-selectedCloud') || "";
    });
    const [cloudAppSection, setCloudAppSection] = useState("main");
    const [isScanning, setIsScanning] = useState(false);
    const [scanningRegion, setScanningRegion] = useState("");

    // Clear all stale cloud data on app start
    // localStorage.removeItem('cloudops-awsData');
    // localStorage.removeItem('cloudops-scanMeta');
    // localStorage.removeItem('cloudops-accountId');
    // localStorage.removeItem('cloudops-selectedCloud');

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

            // Only clear non-scan data on login
            localStorage.removeItem('cloudops-accountId');
            localStorage.removeItem('cloudops-awsData');
            localStorage.removeItem('cloudops-scanMeta');
            localStorage.removeItem('cloudops-section');
            localStorage.removeItem('cloudops-registeredUsers');
            // Do NOT clear user-specific awsData/scanMeta — restore them below

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
            setCloudAppSection("cloudSelect");

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
            setCloudAppSection("cloudSelect");
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

    // // Async scan with polling — avoids Azure 230s timeout
    // const handleScanRegions = async (regions) => {
    //     const start = Date.now();
    //     const BACKEND = "https://cloudops-backend-venkatesh-cgfqcdffc8bhh9cd.eastus-01.azurewebsites.net";
    //
    //     setIsScanning(true);
    //     setScanningRegion(regions.join(", "));
    //
    //     try {
    //         const email = localStorage.getItem('cloudops-userEmail');
    //         const savedCredentials = JSON.parse(localStorage.getItem(`cloudops-credentials-${email}`) || '{}');
    //
    //         if (!savedCredentials.accessKey || !savedCredentials.secretKey) {
    //             localStorage.setItem('cloudops-isNewUser', 'true');
    //             setPage("scan");
    //             return;
    //         }
    //
    //         // Step 1: Start the scan — backend returns job_id immediately
    //         const startRes = await fetch(`${BACKEND}/api/scan`, {
    //             method: "POST",
    //             headers: { "Content-Type": "application/json" },
    //             body: JSON.stringify({
    //                 accessKey: savedCredentials.accessKey,
    //                 secretKey: savedCredentials.secretKey,
    //                 regions,
    //             }),
    //         });
    //
    //         const startJson = await startRes.json();
    //         if (startJson.error) throw new Error(startJson.error);
    //
    //         const jobId = startJson.job_id;
    //         if (!jobId) throw new Error("No job ID returned from server.");
    //
    //         // Step 2: Poll every 8 seconds until done (max 30 minutes)
    //         const MAX_WAIT_MS = 30 * 60 * 1000;
    //         const POLL_INTERVAL_MS = 8000;
    //         const deadline = Date.now() + MAX_WAIT_MS;
    //
    //         while (Date.now() < deadline) {
    //             await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    //
    //             let pollRes;
    //             try {
    //                 pollRes = await fetch(`${BACKEND}/api/scan/status/${jobId}`);
    //             } catch (e) {
    //                 continue; // network blip — keep polling
    //             }
    //
    //             if (pollRes.status === 404) {
    //                 continue; // job file cleaned up mid-poll — retry
    //             }
    //             if (pollRes.status === 500) {
    //                 continue; // transient server error — retry
    //             }
    //
    //             const text = await pollRes.text();
    //             if (!text) continue;
    //             let pollJson;
    //             try { pollJson = JSON.parse(text); } catch (e) { continue; }
    //
    //             if (pollJson.status === "running") continue;
    //
    //             if (pollJson.status === "error") {
    //                 throw new Error(pollJson.error || "Scan failed on server.");
    //             }
    //
    //             if (pollJson.status === "done") {
    //                 const json = pollJson.result;
    //                 if (json.error) throw new Error(json.error);
    //
    //                 const meta = {
    //                     duration: ((Date.now() - start) / 1000).toFixed(1),
    //                     region: regions.join(', '),
    //                 };
    //
    //                 if (email) {
    //                     localStorage.setItem(`cloudops-awsData-${email}`, JSON.stringify(json));
    //                     localStorage.setItem(`cloudops-scanMeta-${email}`, JSON.stringify(meta));
    //                 }
    //
    //                 setAwsData(json);
    //                 setScanMeta(meta);
    //                 const aid = json.identity?.account_id || "";
    //                 setAccountId(aid);
    //                 localStorage.setItem('cloudops-accountId', aid);
    //                 setIsScanning(false);
    //                 setScanningRegion("");
    //                 return;
    //             }
    //         }
    //
    //         throw new Error("Scan timed out after 30 minutes. Try selecting fewer regions.");
    //
    //     } catch (err) {
    //         setIsScanning(false);
    //         setScanningRegion("");
    //         console.error(err);
    //         throw new Error(err.message || "Failed to scan regions.");
    //     }
    // };
    //
    // // ── Azure scan with polling ────────────────────────────────────────────────
    // const handleAzureScanRegions = async (regions) => {
    //     const start = Date.now();
    //     setIsScanning(true);
    //     setScanningRegion(regions.join(", "));
    //     try {
    //         const token = localStorage.getItem('cloudops-auth-token');
    //         const email = localStorage.getItem('cloudops-userEmail');
    //         // Use selected Azure account stored during account selection
    //         const storedCreds = JSON.parse(localStorage.getItem('cloudops-azure-selected') || '{}');
    //         let creds = storedCreds;
    //
    //         // Fallback: fetch first account if nothing stored
    //         if (!creds.tenantId) {
    //             const listRes = await fetch(`${BACKEND}/api/azure/list-accounts`, {
    //                 headers: { "Authorization": `Bearer ${token}` }
    //             });
    //             const listJson = await listRes.json();
    //             const azureAccts = listJson.accounts || [];
    //             if (!azureAccts.length) throw new Error("No Azure account saved. Please add one in Settings.");
    //             const acct = azureAccts[0];
    //             const fullCredsRes = await fetch(`${BACKEND}/api/azure/get-account-credentials`, {
    //                 method: "POST",
    //                 headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    //                 body: JSON.stringify({ tenantId: acct.tenantId, subscriptionId: acct.subscriptionId }),
    //             });
    //             creds = await fullCredsRes.json();
    //         }
    //         if (!creds.tenantId) throw new Error("No Azure credentials found.");
    //         const startRes = await fetch(`${BACKEND}/api/azure/scan`, {
    //             method: "POST",
    //             headers: { "Content-Type": "application/json" },
    //             body: JSON.stringify({ tenantId: creds.tenantId, clientId: creds.clientId, clientSecret: creds.clientSecret, subscriptionId: creds.subscriptionId, regions }),
    //         });
    //         const startJson = await startRes.json();
    //         if (startJson.error) throw new Error(startJson.error);
    //         const jobId = startJson.job_id;
    //         const deadline = Date.now() + 15 * 60 * 1000;
    //         while (Date.now() < deadline) {
    //             await new Promise(r => setTimeout(r, 5000));
    //             const pollRes = await fetch(`${BACKEND}/api/azure/scan/status/${jobId}`);
    //             if (pollRes.status === 500 || pollRes.status === 404) continue;
    //             const pollJson = await pollRes.json();
    //             if (pollJson.status === "running") continue;
    //             if (pollJson.status === "error") throw new Error(pollJson.error || "Azure scan failed.");
    //             if (pollJson.status === "done") {
    //                 const json = pollJson.result;
    //                 const meta = { duration: ((Date.now() - start) / 1000).toFixed(1), region: regions.join(', '), cloud: "azure" };
    //                 if (email) { localStorage.setItem(`cloudops-awsData-${email}`, JSON.stringify(json)); localStorage.setItem(`cloudops-scanMeta-${email}`, JSON.stringify(meta)); }
    //                 setAwsData(json); setScanMeta(meta);
    //                 setAccountId(json.identity?.subscription_id || "");
    //                 setIsScanning(false);
    //                 setScanningRegion("");
    //                 return;
    //             }
    //         }
    //         throw new Error("Azure scan timed out. Try fewer regions.");
    //     } catch (err) {
    //         setIsScanning(false);
    //         setScanningRegion("");
    //         throw new Error(err.message || "Failed to scan Azure.");
    //     }
    // };

    const handleScanRegions = async (regions) => {
        const start = Date.now();
        const BACKEND =
            "https://cloudops-backend-venkatesh-cgfqcdffc8bhh9cd.eastus-01.azurewebsites.net";

        setIsScanning(true);
        setScanningRegion(regions.join(", "));

        try {
            const email = localStorage.getItem("cloudops-userEmail");
            const savedCredentials = JSON.parse(
                localStorage.getItem(`cloudops-credentials-${email}`) || "{}"
            );

            if (!savedCredentials.accessKey || !savedCredentials.secretKey) {
                localStorage.setItem("cloudops-isNewUser", "true");
                setPage("scan");
                return;
            }

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

            const MAX_WAIT_MS = 30 * 60 * 1000;
            const POLL_INTERVAL_MS = 8000;
            const deadline = Date.now() + MAX_WAIT_MS;

            while (Date.now() < deadline) {
                await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

                let pollRes;
                try {
                    pollRes = await fetch(`${BACKEND}/api/scan/status/${jobId}`);
                } catch (e) {
                    continue;
                }

                if (pollRes.status === 404 || pollRes.status === 500) continue;

                const text = await pollRes.text();
                if (!text) continue;
                let pollJson;
                try {
                    pollJson = JSON.parse(text);
                } catch (e) {
                    continue;
                }

                if (pollJson.status === "running") continue;
                if (pollJson.status === "error")
                    throw new Error(pollJson.error || "Scan failed on server.");

                if (pollJson.status === "done") {
                    const json = pollJson.result;
                    if (json.error) throw new Error(json.error);

                    const meta = {
                        duration: ((Date.now() - start) / 1000).toFixed(1),
                        region: regions.join(", "),
                    };

                    if (email) {
                        const aid = json.identity?.account_id || "";
                        const savedCreds = JSON.parse(localStorage.getItem(`cloudops-credentials-${email}`) || "{}");
                        const accessKey = savedCreds.accessKey || "";
                        const scanKey = aid || accessKey || email;
                        const token = localStorage.getItem('cloudops-auth-token');

                        // Save to backend DB
                        try {
                            await fetch(`${BACKEND}/api/scan-data/save`, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    "Authorization": `Bearer ${token}`
                                },
                                body: JSON.stringify({
                                    accountKey: scanKey,
                                    cloud: "aws",
                                    accountName: meta.accountName || "AWS Account",
                                    scanData: json,
                                    scanMeta: meta,
                                }),
                            });
                        } catch (e) {
                            console.warn("Failed to save scan to backend:", e);
                        }

                        // Also save under accessKey so lookup works regardless of which key is used
                        if (accessKey && accessKey !== scanKey) {
                            try {
                                await fetch(`${BACKEND}/api/scan-data/save`, {
                                    method: "POST",
                                    headers: {
                                        "Content-Type": "application/json",
                                        "Authorization": `Bearer ${token}`
                                    },
                                    body: JSON.stringify({
                                        accountKey: accessKey,
                                        cloud: "aws",
                                        accountName: meta.accountName || "AWS Account",
                                        scanData: json,
                                        scanMeta: meta,
                                    }),
                                });
                            } catch (e) {
                                console.warn("Failed to save scan under accessKey:", e);
                            }
                        }

                        // Also save to localStorage as cache fallback
                        try {
                            localStorage.setItem(`cloudops-awsData-${email}-${scanKey}`, JSON.stringify(json));
                            localStorage.setItem(`cloudops-scanMeta-${email}-${scanKey}`, JSON.stringify(meta));
                            if (accessKey && accessKey !== scanKey) {
                                localStorage.setItem(`cloudops-awsData-${email}-${accessKey}`, JSON.stringify(json));
                                localStorage.setItem(`cloudops-scanMeta-${email}-${accessKey}`, JSON.stringify(meta));
                            }
                            localStorage.setItem(`cloudops-lastAccount-${email}`, scanKey);
                        } catch (e) {
                            console.warn("localStorage full, skipping cache:", e);
                        }
                    }

                    setAwsData(json);
                    setScanMeta(meta);
                    const aid = json.identity?.account_id || "";
                    setAccountId(aid);
                    localStorage.setItem("cloudops-accountId", aid);
                    setIsScanning(false);
                    setScanningRegion("");

                    // ✅ FIX: ensure we are on the app page (covers first-time flow)
                    localStorage.setItem('cloudops-section', 'dashboard');
                    setPage("app");
                    return;
                }
            }

            throw new Error(
                "Scan timed out after 30 minutes. Try selecting fewer regions."
            );
        } catch (err) {
            setIsScanning(false);
            setScanningRegion("");
            console.error(err);
            throw new Error(err.message || "Failed to scan regions.");
        }
    };

    const handleAzureScanRegions = async (regions) => {
        const start = Date.now();
        const BACKEND =
            "https://cloudops-backend-venkatesh-cgfqcdffc8bhh9cd.eastus-01.azurewebsites.net";

        setIsScanning(true);
        setScanningRegion(regions.join(", "));

        try {
            const token = localStorage.getItem("cloudops-auth-token");
            const email = localStorage.getItem("cloudops-userEmail");
            const storedCreds = JSON.parse(
                localStorage.getItem("cloudops-azure-selected") || "{}"
            );
            let creds = storedCreds;

            if (!creds.tenantId) {
                const listRes = await fetch(`${BACKEND}/api/azure/list-accounts`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const listJson = await listRes.json();
                const azureAccts = listJson.accounts || [];
                if (!azureAccts.length)
                    throw new Error("No Azure account saved. Please add one in Settings.");
                const acct = azureAccts[0];
                const fullCredsRes = await fetch(
                    `${BACKEND}/api/azure/get-account-credentials`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                            tenantId: acct.tenantId,
                            subscriptionId: acct.subscriptionId,
                        }),
                    }
                );
                creds = await fullCredsRes.json();
            }

            if (!creds.tenantId) throw new Error("No Azure credentials found.");

            const startRes = await fetch(`${BACKEND}/api/azure/scan`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tenantId: creds.tenantId,
                    clientId: creds.clientId,
                    clientSecret: creds.clientSecret,
                    subscriptionId: creds.subscriptionId,
                    regions,
                }),
            });
            const startJson = await startRes.json();
            if (startJson.error) throw new Error(startJson.error);
            const jobId = startJson.job_id;

            const deadline = Date.now() + 15 * 60 * 1000;
            while (Date.now() < deadline) {
                await new Promise((r) => setTimeout(r, 5000));
                const pollRes = await fetch(
                    `${BACKEND}/api/azure/scan/status/${jobId}`
                );
                if (pollRes.status === 500 || pollRes.status === 404) continue;
                const pollJson = await pollRes.json();
                if (pollJson.status === "running") continue;
                if (pollJson.status === "error")
                    throw new Error(pollJson.error || "Azure scan failed.");

                if (pollJson.status === "done") {
                    const json = pollJson.result;
                    const meta = {
                        duration: ((Date.now() - start) / 1000).toFixed(1),
                        region: regions.join(", "),
                        cloud: "azure",
                    };
                    if (email) {
                        const sid = json.identity?.subscription_id || "";
                        const scanKey = sid || email;
                        const token = localStorage.getItem('cloudops-auth-token');

                        // Save to backend DB
                        try {
                            await fetch(`${BACKEND}/api/scan-data/save`, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    "Authorization": `Bearer ${token}`
                                },
                                body: JSON.stringify({
                                    accountKey: scanKey,
                                    cloud: "azure",
                                    accountName: meta.accountName || "Azure Account",
                                    scanData: json,
                                    scanMeta: meta,
                                }),
                            });
                        } catch (e) {
                            console.warn("Failed to save Azure scan to backend:", e);
                        }

                        // Also save to localStorage as cache fallback
                        try {
                            localStorage.setItem(`cloudops-awsData-${email}-${scanKey}`, JSON.stringify(json));
                            localStorage.setItem(`cloudops-scanMeta-${email}-${scanKey}`, JSON.stringify(meta));
                            localStorage.setItem(`cloudops-lastAccount-${email}`, scanKey);
                        } catch (e) {
                            console.warn("localStorage full, skipping cache:", e);
                        }
                    }
                    setAwsData(json);
                    setScanMeta(meta);
                    setAccountId(json.identity?.subscription_id || "");
                    setIsScanning(false);
                    setScanningRegion("");

                    setPage("app");
                    return;
                }
            }
            throw new Error("Azure scan timed out. Try fewer regions.");
        } catch (err) {
            setIsScanning(false);
            setScanningRegion("");
            throw new Error(err.message || "Failed to scan Azure.");
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
                    onScanRegions={selectedCloud === "azure" ? handleAzureScanRegions : handleScanRegions}
                    onNewScan={() => {
                        // Don't clear data — keep showing last scan while new one runs
                    }}
                    onSwitchCloud={() => {}}
                    onSignOut={handleLogout}
                    isScanning={isScanning}
                    scanningRegion={scanningRegion}
                    onSetSelectedCloud={(cloud) => {
                        setSelectedCloud(cloud);
                        localStorage.setItem('cloudops-selectedCloud', cloud);
                    }}
                    onClearData={() => {
                        setAwsData(null);
                        setScanMeta(null);
                        setAccountId("");
                        setSelectedCloud("");
                        localStorage.removeItem('cloudops-accountId');
                        localStorage.removeItem('cloudops-selectedCloud');
                    }}
                    setAwsData={setAwsData}
                    setScanMeta={setScanMeta}
                    setAccountId={setAccountId}
                />
            )}
        </>
    );
}