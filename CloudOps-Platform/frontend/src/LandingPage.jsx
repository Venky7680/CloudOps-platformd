import { useState, useEffect, useRef } from "react";

// ─── useInView hook ───────────────────────────────────────────────────────────
function useInView(options = {}) {
    const ref = useRef(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { threshold: 0.15, ...options });
        obs.observe(el);
        return () => obs.disconnect();
    }, []);
    return [ref, inView];
}

// ─── Animated counter ────────────────────────────────────────────────────────
function Counter({ target, suffix = "", inView }) {
    const [val, setVal] = useState(0);
    useEffect(() => {
        if (!inView) return;
        const n = parseInt(target);
        if (isNaN(n)) { setVal(target); return; }
        let start = 0;
        const step = Math.ceil(n / 40);
        const t = setInterval(() => {
            start = Math.min(start + step, n);
            setVal(start);
            if (start >= n) clearInterval(t);
        }, 30);
        return () => clearInterval(t);
    }, [inView, target]);
    return <>{typeof val === "number" ? val + suffix : target}</>;
}

// ─── AuthOverlay ──────────────────────────────────────────────────────────────
const AuthOverlay = ({ authMode, setAuthMode,
                         loginEmail, setLoginEmail, loginPassword, setLoginPassword,
                         loginError, loginLoading, rememberMe, setRememberMe,
                         showLoginPass, setShowLoginPass,
                         regEmail, setRegEmail, regPassword, setRegPassword,
                         regConfirm, setRegConfirm, regError, regLoading,
                         showRegPass, setShowRegPass, showRegConfirm, setShowRegConfirm,
                         doLogin, doRegister }) => {

    const isLogin = authMode === "login";
    const inp = {
        width: "100%", padding: "11px 14px", borderRadius: 8,
        background: "#f8fafc", border: "1.5px solid #e2e8f0",
        color: "#0f172a", fontSize: 14, outline: "none",
        fontFamily: "'Inter',sans-serif", boxSizing: "border-box",
        transition: "border-color 0.2s, box-shadow 0.2s",
    };
    const lbl = { fontSize: 11.5, fontWeight: 600, color: "#64748b", marginBottom: 6, display: "block", letterSpacing: "0.05em", textTransform: "uppercase" };
    const btn = { width: "100%", padding: "12px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#1a6ff5,#1d4ed8)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif", boxShadow: "0 4px 16px rgba(26,111,245,0.35)" };

    return (
        <div onClick={() => setAuthMode(null)} style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 36, boxShadow: "0 32px 80px rgba(15,23,42,0.2)", animation: "slideUp 0.25s ease-out" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
                    <div style={{ width: 36, height: 36, background: "linear-gradient(135deg,#1a6ff5,#1d4ed8)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(26,111,245,0.35)", flexShrink: 0 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" /></svg>
                    </div>
                    <div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.02em" }}>{isLogin ? "Welcome back" : "Create account"}</div>
                        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{isLogin ? "Sign in to OmniOps" : "Get started for free"}</div>
                    </div>
                    <button onClick={() => setAuthMode(null)} style={{ marginLeft: "auto", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 7, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#94a3b8", fontSize: 16 }}>✕</button>
                </div>
                {isLogin ? (
                    <>
                        {loginError && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#ef4444", marginBottom: 16 }}>⚠ {loginError}</div>}
                        <div style={{ marginBottom: 16 }}><label style={lbl}>Email</label><input style={inp} type="email" placeholder="you@company.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && doLogin()} /></div>
                        <div style={{ marginBottom: 20 }}><label style={lbl}>Password</label>
                            <div style={{ position: "relative" }}>
                                <input style={{ ...inp, paddingRight: 44 }} type={showLoginPass ? "text" : "password"} placeholder="••••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && doLogin()} />
                                <button onClick={() => setShowLoginPass(!showLoginPass)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 12, fontWeight: 600 }}>{showLoginPass ? "hide" : "show"}</button>
                            </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22 }}>
                            <input type="checkbox" id="rem" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} style={{ accentColor: "#1a6ff5" }} />
                            <label htmlFor="rem" style={{ fontSize: 13, color: "#64748b", cursor: "pointer" }}>Remember me</label>
                        </div>
                        <button onClick={doLogin} disabled={loginLoading} style={{ ...btn, opacity: loginLoading ? 0.7 : 1 }}>{loginLoading ? "Signing in…" : "Sign In →"}</button>
                        <div style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: "#94a3b8" }}>No account? <span onClick={() => setAuthMode("register")} style={{ color: "#1a6ff5", cursor: "pointer", fontWeight: 600 }}>Create one</span></div>
                    </>
                ) : (
                    <>
                        {regError && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#ef4444", marginBottom: 16 }}>⚠ {regError}</div>}
                        <div style={{ marginBottom: 14 }}><label style={lbl}>Email</label><input style={inp} type="email" placeholder="you@company.com" value={regEmail} onChange={e => setRegEmail(e.target.value)} /></div>
                        <div style={{ marginBottom: 14 }}><label style={lbl}>Password</label><input style={{ ...inp, paddingRight: 44 }} type={showRegPass ? "text" : "password"} placeholder="Min. 6 characters" value={regPassword} onChange={e => setRegPassword(e.target.value)} /></div>
                        <div style={{ marginBottom: 22 }}><label style={lbl}>Confirm Password</label><input style={inp} type={showRegConfirm ? "text" : "password"} placeholder="Repeat password" value={regConfirm} onChange={e => setRegConfirm(e.target.value)} onKeyDown={e => e.key === "Enter" && doRegister()} /></div>
                        <button onClick={doRegister} disabled={regLoading} style={{ ...btn, opacity: regLoading ? 0.7 : 1 }}>{regLoading ? "Creating account…" : "Create Account →"}</button>
                        <div style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: "#94a3b8" }}>Already have an account? <span onClick={() => setAuthMode("login")} style={{ color: "#1a6ff5", cursor: "pointer", fontWeight: 600 }}>Sign in</span></div>
                    </>
                )}
            </div>
        </div>
    );
};

// ─── LandingPage ──────────────────────────────────────────────────────────────
// Props match the App.jsx usage:
//   onLogin, onRegister, activePage, handleLogin, handleRegister, setPage
const LandingPage = ({ onLogin, onRegister, handleLogin, handleRegister }) => {
    const [authMode, setAuthMode] = useState(null);
    const [heroVisible, setHeroVisible] = useState(false);

    const [loginEmail, setLoginEmail]         = useState(() => { try { return localStorage.getItem("cloudops-rememberedEmail") || ""; } catch { return ""; } });
    const [loginPassword, setLoginPassword]   = useState("");
    const [loginError, setLoginError]         = useState("");
    const [loginLoading, setLoginLoading]     = useState(false);
    const [rememberMe, setRememberMe]         = useState(() => { try { return localStorage.getItem("cloudops-rememberMe") === "true"; } catch { return false; } });
    const [showLoginPass, setShowLoginPass]   = useState(false);
    const [regEmail, setRegEmail]             = useState("");
    const [regPassword, setRegPassword]       = useState("");
    const [regConfirm, setRegConfirm]         = useState("");
    const [regError, setRegError]             = useState("");
    const [regLoading, setRegLoading]         = useState(false);
    const [showRegPass, setShowRegPass]       = useState(false);
    const [showRegConfirm, setShowRegConfirm] = useState(false);

    const [statsRef, statsInView] = useInView();
    const [productsRef, productsInView] = useInView();
    const [stepsRef, stepsInView] = useInView();

    useEffect(() => { const t = setTimeout(() => setHeroVisible(true), 80); return () => clearTimeout(t); }, []);

    const C = {
        bg: "#f0f4ff", bg2: "#ffffff", bg3: "#f1f5f9",
        border: "rgba(26,111,245,0.12)", borderFaint: "#e2e8f0",
        text: "#0f172a", textSub: "#475569", textFaint: "#94a3b8",
        blue: "#1a6ff5", blue2: "#3b82f6", blueGlow: "rgba(26,111,245,0.2)",
        grad: "linear-gradient(135deg,#1a6ff5,#1d4ed8)",
    };

    const clouds = [
        { name: "AWS", color: "#FF9900", bg: "rgba(255,153,0,0.08)", border: "rgba(255,153,0,0.2)", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg> },
        { name: "Azure", color: "#0078D4", bg: "rgba(0,120,212,0.08)", border: "rgba(0,120,212,0.2)", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><polygon points="12 2 2 19 22 19"/></svg> },
        { name: "Huawei", color: "#CF0A2C", bg: "rgba(207,10,44,0.08)", border: "rgba(207,10,44,0.2)", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg> },
    ];

    const products = [
        { id: "cloudops", color: "#1a6ff5", grad: "linear-gradient(135deg,#1a6ff5,#1d4ed8)", glow: "rgba(26,111,245,0.22)", bg: "rgba(26,111,245,0.07)", border: "rgba(26,111,245,0.15)", live: true,
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>,
            title: "CloudOps", tagline: "Infrastructure Management",
            desc: "Scan, visualise and manage AWS, Azure and Huawei Cloud resources across all regions with real-time inventory and change tracking.",
            features: ["Multi-cloud resource scanning", "Region-wise inventory dashboard", "IAM, S3, VPC, Route53, CloudFront"] },
        { id: "secops", color: "#ef4444", grad: "linear-gradient(135deg,#ef4444,#dc2626)", glow: "rgba(239,68,68,0.2)", bg: "rgba(239,68,68,0.07)", border: "rgba(239,68,68,0.15)", live: true,
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
            title: "SecOps", tagline: "Security Operations",
            desc: "Detect misconfigurations, scan for vulnerabilities and audit IAM policies across AWS, Azure and Huawei Cloud in real time.",
            features: ["Misconfiguration detection", "IAM policy auditing", "CIS benchmark compliance"] },
        { id: "finops", color: "#059669", grad: "linear-gradient(135deg,#10b981,#059669)", glow: "rgba(5,150,105,0.2)", bg: "rgba(5,150,105,0.07)", border: "rgba(5,150,105,0.15)", live: true,
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
            title: "FinOps", tagline: "Cost Management",
            desc: "Track and optimise cloud spending across AWS, Azure and Huawei with budget alerts, per-service cost breakdown and savings recommendations.",
            features: ["Cross-cloud cost analytics", "Budget alerts & forecasting", "Idle resource identification"] },
        { id: "aiops", color: "#7c3aed", grad: "linear-gradient(135deg,#8b5cf6,#7c3aed)", glow: "rgba(124,58,237,0.2)", bg: "rgba(124,58,237,0.07)", border: "rgba(124,58,237,0.15)", live: false,
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
            title: "AIOps", tagline: "AI-Powered Operations",
            desc: "Leverage machine learning to detect anomalies, predict incidents and auto-remediate issues before they impact your users.",
            features: ["Anomaly detection", "Predictive analytics", "Auto-remediation"] },
        { id: "rfp", color: "#d97706", grad: "linear-gradient(135deg,#f59e0b,#d97706)", glow: "rgba(217,119,6,0.2)", bg: "rgba(217,119,6,0.07)", border: "rgba(217,119,6,0.15)", live: false,
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
            title: "RFP Generator", tagline: "Document Automation",
            desc: "Generate professional RFP documents from live cloud infrastructure data using AI-powered templates with PDF export.",
            features: ["AI-powered templates", "PDF export", "Live cloud data"] },
    ];

    const stats = [
        { value: "20", suffix: "+", label: "Regions",       icon: "🌐", color: "#FF9900" },
        { value: "92", suffix: "+", label: "Services",    icon: "☁️", color: "#0078D4" },
        { value: "3",  suffix: "",  label: "Cloud Providers",   icon: "🔗", color: C.blue },
        { value: "5",  suffix: "",  label: "Integrated Tools",  icon: "🔧", color: "#7c3aed" },
    ];

    const steps = [
        { n: "01", emoji: "👤", title: "Create Account",  desc: "Register in seconds. No credit card required to get started." },
        { n: "02", emoji: "☁️", title: "Connect Cloud",   desc: "Link your AWS, Azure or Huawei Cloud account securely via IAM roles." },
        { n: "03", emoji: "📊", title: "Scan & Monitor",  desc: "Get instant resource visibility, cost analytics and security alerts." },
    ];

    const doLogin = async () => {
        if (!loginEmail || !loginPassword) { setLoginError("Please enter your email and password."); return; }
        setLoginLoading(true); setLoginError("");
        try {
            if (handleLogin) await handleLogin(loginEmail, loginPassword);
            else if (onLogin) await onLogin(loginEmail, loginPassword);
            try { if (rememberMe) { localStorage.setItem("cloudops-rememberedEmail", loginEmail); localStorage.setItem("cloudops-rememberMe", "true"); } else { localStorage.removeItem("cloudops-rememberedEmail"); localStorage.removeItem("cloudops-rememberMe"); } } catch {}
            setAuthMode(null);
        } catch (err) { setLoginError(err.message || "Invalid email or password."); }
        finally { setLoginLoading(false); }
    };

    const doRegister = async () => {
        if (!regEmail || !regPassword || !regConfirm) { setRegError("Please fill in all fields."); return; }
        if (regPassword.length < 6) { setRegError("Password must be at least 6 characters."); return; }
        if (regPassword !== regConfirm) { setRegError("Passwords do not match."); return; }
        setRegLoading(true); setRegError("");
        try {
            if (handleRegister) await handleRegister(regEmail, regPassword);
            else if (onRegister) await onRegister(regEmail, regPassword);
            setAuthMode(null);
        } catch (err) { setRegError(err.message || "Registration failed."); }
        finally { setRegLoading(false); }
    };

    const openLogin    = () => { setLoginError(""); setLoginPassword(""); setAuthMode("login"); };
    const openRegister = () => { setRegError(""); setRegEmail(""); setRegPassword(""); setRegConfirm(""); setAuthMode("register"); };

    const card = { background: C.bg2, border: `1px solid ${C.borderFaint}`, borderRadius: 14, boxShadow: "0 1px 4px rgba(15,23,42,0.06), 0 4px 24px rgba(15,23,42,0.04)" };

    const fadeUp = (delay = 0, inV = true) => ({
        opacity: inV ? 1 : 0,
        transform: inV ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
    });

    return (
        <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter','system-ui',sans-serif", color: C.text, overflowX: "hidden" }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
                html,body{margin:0;overflow-x:hidden;background:#f0f4ff}
                *{box-sizing:border-box}
                @keyframes slideUp{from{opacity:0;transform:translateY(20px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
                @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
                @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
                @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
                @keyframes spin{to{transform:rotate(360deg)}}
                @keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
                .pcard{transition:transform 0.3s ease,box-shadow 0.3s ease,border-color 0.3s ease}
                .pcard:hover{transform:translateY(-6px)!important;border-color:rgba(26,111,245,0.28)!important;box-shadow:0 12px 48px rgba(26,111,245,0.12),0 2px 8px rgba(15,23,42,0.08)!important}
                .navbtn:hover{background:#f1f5f9!important;color:#1a6ff5!important}
                input::placeholder{color:#cbd5e1}
                input:focus{border-color:#1a6ff5!important;box-shadow:0 0 0 3px rgba(26,111,245,0.1)!important}
                .cloud-pill{transition:transform 0.2s ease,box-shadow 0.2s ease}
                .cloud-pill:hover{transform:translateY(-2px);box-shadow:0 4px 16px rgba(0,0,0,0.1)!important}
                .cta-btn{transition:transform 0.15s ease,box-shadow 0.15s ease}
                .cta-btn:hover{transform:translateY(-2px);box-shadow:0 14px 40px rgba(26,111,245,0.38)!important}
            `}</style>

            {/* Dot-grid */}
            <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, backgroundImage: "radial-gradient(circle,rgba(26,111,245,0.07) 1px,transparent 1px)", backgroundSize: "32px 32px" }} />
            <div style={{ position: "fixed", width: 800, height: 600, background: "radial-gradient(ellipse,rgba(26,111,245,0.08) 0%,transparent 70%)", top: -200, left: -200, pointerEvents: "none", zIndex: 0 }} />
            <div style={{ position: "fixed", width: 500, height: 400, background: "radial-gradient(ellipse,rgba(124,58,237,0.05) 0%,transparent 70%)", bottom: -80, right: -80, pointerEvents: "none", zIndex: 0 }} />

            {authMode && (
                <AuthOverlay authMode={authMode} setAuthMode={setAuthMode}
                             loginEmail={loginEmail} setLoginEmail={setLoginEmail} loginPassword={loginPassword} setLoginPassword={setLoginPassword}
                             loginError={loginError} loginLoading={loginLoading} rememberMe={rememberMe} setRememberMe={setRememberMe}
                             showLoginPass={showLoginPass} setShowLoginPass={setShowLoginPass}
                             regEmail={regEmail} setRegEmail={setRegEmail} regPassword={regPassword} setRegPassword={setRegPassword}
                             regConfirm={regConfirm} setRegConfirm={setRegConfirm} regError={regError} regLoading={regLoading}
                             showRegPass={showRegPass} setShowRegPass={setShowRegPass} showRegConfirm={showRegConfirm} setShowRegConfirm={setShowRegConfirm}
                             doLogin={doLogin} doRegister={doRegister} />
            )}

            {/* ── NAVBAR ── */}
            <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(240,244,255,0.92)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${C.borderFaint}`, padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 0 rgba(15,23,42,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, background: C.grad, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 14px ${C.blueGlow}` }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
                    </div>
                    <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.03em", color: C.text }}>OmniOps</span>
                    <div style={{ width: 1, height: 18, background: C.borderFaint, margin: "0 6px" }} />
                    {clouds.map(cl => (
                        <div key={cl.name} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, color: cl.color, background: cl.bg, border: `1px solid ${cl.border}` }}>
                            <span style={{ color: cl.color }}>{cl.icon}</span>{cl.name}
                        </div>
                    ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button className="navbtn" onClick={openLogin} style={{ padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "transparent", color: C.textSub, border: `1px solid ${C.borderFaint}`, cursor: "pointer", fontFamily: "'Inter',sans-serif", transition: "all 0.15s" }}>Sign In</button>
                    <button onClick={openRegister} style={{ padding: "7px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, background: C.grad, color: "white", border: "none", cursor: "pointer", fontFamily: "'Inter',sans-serif", boxShadow: `0 4px 14px ${C.blueGlow}` }}>Get Started →</button>
                </div>
            </nav>

            {/* ── HERO ── */}
            <section style={{ textAlign: "center", padding: "80px 24px 70px", position: "relative", zIndex: 1 }}>
                <div style={{ ...fadeUp(0, heroVisible), display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(26,111,245,0.08)", border: "1px solid rgba(26,111,245,0.2)", borderRadius: 100, padding: "5px 16px", fontSize: 11, fontWeight: 700, color: "#1a6ff5", marginBottom: 28, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1a6ff5", boxShadow: "0 0 6px rgba(26,111,245,0.6)", display: "inline-block", animation: "pulse 2s ease-in-out infinite" }} />
                    Multi-Cloud Operations Platform · AWS · Azure · Huawei
                </div>

                <h1 style={{ ...fadeUp(0.1, heroVisible), fontSize: "clamp(40px,5.5vw,68px)", fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 1.04, margin: "0 auto 20px", maxWidth: 860, color: C.text }}>
                    One platform for<br />
                    <span style={{ background: "linear-gradient(135deg,#1a6ff5 0%,#3b82f6 60%,#60a5fa 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                        all your cloud ops
                    </span>
                </h1>

                <p style={{ ...fadeUp(0.2, heroVisible), fontSize: 17, color: C.textSub, maxWidth: 560, margin: "0 auto 16px", lineHeight: 1.8, fontWeight: 300 }}>
                    OmniOps unifies infrastructure management, security, cost and AI operations across <strong style={{ color: C.text, fontWeight: 600 }}>AWS, Microsoft Azure and Huawei Cloud</strong> — from a single dashboard.
                </p>

                <div style={{ ...fadeUp(0.3, heroVisible), display: "flex", gap: 10, justifyContent: "center", marginBottom: 32, flexWrap: "wrap" }}>
                    {clouds.map((cl, i) => (
                        <div key={cl.name} className="cloud-pill" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 20px", borderRadius: 10, background: C.bg2, border: `1.5px solid ${cl.border}`, boxShadow: `0 2px 12px ${cl.bg}`, animation: `float ${3 + i * 0.5}s ease-in-out infinite`, animationDelay: `${i * 0.3}s` }}>
                            <span style={{ color: cl.color, display: "flex" }}>{cl.icon}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: cl.color }}>{cl.name}</span>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px rgba(34,197,94,0.6)", animation: "pulse 2s ease-in-out infinite" }} />
                        </div>
                    ))}
                </div>

                <div style={{ ...fadeUp(0.35, heroVisible), display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 36, maxWidth: 700, margin: "0 auto 36px" }}>
                    {[
                        { label: "Resource Scanning", icon: "🔍" },
                        { label: "Security Auditing", icon: "🛡️" },
                        { label: "Cost Analytics", icon: "💰" },
                        { label: "AI Anomaly Detection", icon: "🤖" },
                        { label: "RFP Automation", icon: "📄" },
                    ].map(f => (
                        <div key={f.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 20, background: C.bg2, border: `1px solid ${C.borderFaint}`, fontSize: 12, fontWeight: 600, color: C.textSub, boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
                            {f.icon} {f.label}
                        </div>
                    ))}
                </div>

                <div style={{ ...fadeUp(0.4, heroVisible), display: "flex", gap: 12, justifyContent: "center", marginBottom: 64 }}>
                    <button className="cta-btn" onClick={openRegister} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 30px", borderRadius: 10, background: C.grad, color: "white", fontFamily: "'Inter',sans-serif", fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer", boxShadow: `0 8px 28px ${C.blueGlow}` }}>
                        Get Started Free <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                    <button onClick={openLogin} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 26px", borderRadius: 10, background: "#ffffff", color: C.textSub, fontFamily: "'Inter',sans-serif", fontSize: 15, fontWeight: 600, border: `1px solid ${C.borderFaint}`, cursor: "pointer", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>Sign In</button>
                </div>

                {/* Stats */}
                <div ref={statsRef} style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", maxWidth: 720, margin: "0 auto" }}>
                    {stats.map((s, i) => (
                        <div key={s.label} style={{ ...card, flex: "1", minWidth: 148, padding: "22px 18px", textAlign: "center", position: "relative", overflow: "hidden", ...fadeUp(i * 0.1, statsInView) }}>
                            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${s.color}55,transparent)` }} />
                            <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
                            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.04em", color: s.color, lineHeight: 1, marginBottom: 5 }}>
                                <Counter target={s.value} suffix={s.suffix} inView={statsInView} />
                            </div>
                            <div style={{ fontSize: 11.5, color: C.textFaint, fontWeight: 500 }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── PLATFORM OVERVIEW STRIP ── */}
            <section style={{ padding: "0 32px 60px", maxWidth: 1100, margin: "0 auto", position: "relative", zIndex: 1 }}>
                <div style={{ background: "linear-gradient(135deg,rgba(26,111,245,0.06),rgba(124,58,237,0.04))", border: `1px solid ${C.border}`, borderRadius: 18, padding: "36px 40px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, alignItems: "center" }}>
                    <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.textFaint, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 12 }}>What is OmniOps?</div>
                        <h3 style={{ fontSize: "clamp(22px,2.5vw,30px)", fontWeight: 800, letterSpacing: "-0.04em", marginBottom: 14, color: C.text, lineHeight: 1.2 }}>Your entire cloud, visible and controlled in one place</h3>
                        <p style={{ fontSize: 14, color: C.textSub, lineHeight: 1.8, fontWeight: 300, marginBottom: 20 }}>
                            OmniOps is a unified cloud operations dashboard that connects to your <strong style={{ color: C.text, fontWeight: 600 }}>AWS, Microsoft Azure, and Huawei Cloud</strong> accounts simultaneously. It gives your engineering and DevOps teams a single pane of glass to manage infrastructure, detect security threats, control costs, and automate operations — without switching between cloud consoles.
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {[
                                "Scan resources across all regions in real-time",
                                "Detect security misconfigurations and compliance gaps",
                                "Analyse and optimise cloud spend across providers",
                                "Generate RFP documents from live infrastructure data",
                            ].map(f => (
                                <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: C.textSub }}>
                                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(26,111,245,0.1)", border: "1px solid rgba(26,111,245,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1a6ff5" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    </div>
                                    {f}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {clouds.map((cl, i) => (
                            <div key={cl.name} style={{ ...card, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, animation: `fadeIn 0.5s ease-out ${i * 0.15}s both` }}>
                                <div style={{ width: 40, height: 40, borderRadius: 10, background: cl.bg, border: `1px solid ${cl.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: cl.color, flexShrink: 0 }}>{cl.icon}</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 2 }}>{cl.name} Cloud</div>
                                    <div style={{ fontSize: 12, color: C.textSub }}>{cl.name === "AWS" ? "EC2, S3, IAM, VPC, Route53, CloudFront & more" : cl.name === "Azure" ? "VMs, Blob Storage, AAD, VNet, DNS & more" : "ECS, OBS, IAM, VPC, DNS & cloud-native services"}</div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#22c55e", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 20, padding: "3px 10px" }}>
                                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s ease-in-out infinite" }} />
                                    Connected
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── PRODUCTS ── */}
            <section style={{ padding: "0 32px 80px", maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>
                <div style={{ textAlign: "center", marginBottom: 48 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.textFaint, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 12 }}>Platform Suite</div>
                    <h2 style={{ fontSize: "clamp(28px,3.5vw,40px)", fontWeight: 800, letterSpacing: "-0.04em", marginBottom: 12, lineHeight: 1.1, color: C.text }}>Five powerful tools.<br />One unified platform.</h2>
                    <p style={{ fontSize: 15, color: C.textSub, maxWidth: 420, margin: "0 auto", lineHeight: 1.8, fontWeight: 300 }}>Each tool covers a specific cloud operations use case — all accessible from a single login across AWS, Azure, and Huawei Cloud.</p>
                </div>

                <div ref={productsRef} style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 14 }}>
                    {products.slice(0, 3).map((p, i) => (
                        <div key={p.id} className="pcard" style={{ ...card, padding: 26, position: "relative", overflow: "hidden", ...fadeUp(i * 0.12, productsInView) }}>
                            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: p.grad }} />
                            <div style={{ width: 46, height: 46, borderRadius: 12, background: p.bg, border: `1px solid ${p.border}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18, color: p.color }}>{p.icon}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                                <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", color: C.text }}>{p.title}</div>
                                {p.live && <div style={{ fontSize: 9, fontWeight: 800, color: "#22c55e", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 20, padding: "2px 8px", letterSpacing: "0.05em" }}>LIVE</div>}
                            </div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: p.color, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>{p.tagline}</div>
                            <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.75, marginBottom: 18, fontWeight: 300 }}>{p.desc}</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                                {p.features.map(f => (
                                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12, color: C.textSub }}>
                                        <div style={{ width: 16, height: 16, borderRadius: "50%", background: p.bg, border: `1px solid ${p.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                            <div style={{ width: 5, height: 5, borderRadius: "50%", background: p.color }} />
                                        </div>
                                        {f}
                                    </div>
                                ))}
                            </div>
                            <button onClick={openRegister} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: p.grad, border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, color: "white", cursor: "pointer", boxShadow: `0 4px 14px ${p.glow}`, transition: "transform 0.15s ease,box-shadow 0.15s ease" }}
                                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 22px ${p.glow}`; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = `0 4px 14px ${p.glow}`; }}>
                                Get Started →
                            </button>
                        </div>
                    ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, maxWidth: 800, margin: "0 auto" }}>
                    {products.slice(3).map((p, i) => (
                        <div key={p.id} className="pcard" style={{ ...card, padding: 24, position: "relative", overflow: "hidden", ...fadeUp((i + 3) * 0.1, productsInView) }}>
                            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: p.grad }} />
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                                <div style={{ width: 46, height: 46, borderRadius: 12, background: p.bg, border: `1px solid ${p.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: p.color }}>{p.icon}</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 2, color: C.text }}>{p.title}</div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: p.color, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}>{p.tagline}</div>
                                    <div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.75, marginBottom: 12, fontWeight: 300 }}>{p.desc}</div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                                        {p.features.map(f => <div key={f} style={{ display: "inline-flex", alignItems: "center", background: p.bg, border: `1px solid ${p.border}`, borderRadius: 5, padding: "3px 9px", fontSize: 10.5, color: p.color, fontWeight: 600 }}>{f}</div>)}
                                    </div>
                                    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: p.bg, border: `1px solid ${p.border}`, borderRadius: 20, padding: "3px 11px", fontSize: 10.5, fontWeight: 700, color: p.color }}>🚀 Coming Soon</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── HOW IT WORKS ── */}
            <section style={{ padding: "80px 32px", borderTop: `1px solid ${C.borderFaint}`, borderBottom: `1px solid ${C.borderFaint}`, background: C.bg3, position: "relative", zIndex: 1 }}>
                <div ref={stepsRef} style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.textFaint, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 12 }}>How it works</div>
                    <h2 style={{ fontSize: "clamp(26px,3vw,36px)", fontWeight: 800, letterSpacing: "-0.04em", marginBottom: 48, color: C.text }}>Up and running in 3 steps</h2>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, position: "relative" }}>
                        <div style={{ position: "absolute", top: 40, left: "18%", right: "18%", height: 1, background: `linear-gradient(90deg,transparent,rgba(26,111,245,0.25),transparent)`, zIndex: 0 }} />
                        {steps.map((s, i) => (
                            <div key={s.n} style={{ ...card, padding: "28px 22px", textAlign: "center", position: "relative", zIndex: 1, ...fadeUp(i * 0.15, stepsInView) }}>
                                <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.grad, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 22, boxShadow: `0 8px 22px ${C.blueGlow}` }}>{s.emoji}</div>
                                <div style={{ fontSize: 10, fontWeight: 800, color: C.blue2, letterSpacing: "0.1em", marginBottom: 8, textTransform: "uppercase", fontFamily: "'JetBrains Mono',monospace" }}>{s.n}</div>
                                <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8, color: C.text }}>{s.title}</div>
                                <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.7, fontWeight: 300 }}>{s.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA ── */}
            <section style={{ textAlign: "center", padding: "100px 24px", position: "relative", zIndex: 1 }}>
                <div style={{ position: "absolute", width: 600, height: 300, background: "radial-gradient(ellipse,rgba(26,111,245,0.07) 0%,transparent 70%)", bottom: 0, left: "50%", transform: "translateX(-50%)", pointerEvents: "none" }} />
                <div style={{ position: "relative", zIndex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.textFaint, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 14 }}>Ready to go?</div>
                    <h2 style={{ fontSize: "clamp(32px,4.5vw,50px)", fontWeight: 800, letterSpacing: "-0.05em", marginBottom: 16, lineHeight: 1.08, color: C.text }}>
                        One login.<br />
                        <span style={{ background: "linear-gradient(135deg,#FF9900,#0078D4,#CF0A2C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                            Three clouds.
                        </span>
                    </h2>
                    <p style={{ fontSize: 16, color: C.textSub, fontWeight: 300, maxWidth: 420, margin: "0 auto 36px" }}>Connect your AWS, Azure and Huawei Cloud accounts and get complete visibility in minutes.</p>
                    <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                        <button className="cta-btn" onClick={openRegister} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 30px", borderRadius: 10, background: C.grad, color: "white", fontFamily: "'Inter',sans-serif", fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer", boxShadow: `0 10px 32px ${C.blueGlow}` }}>
                            Create Free Account <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                        <button onClick={openLogin} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 24px", borderRadius: 10, background: "#ffffff", color: C.textSub, fontFamily: "'Inter',sans-serif", fontSize: 15, fontWeight: 600, border: `1px solid ${C.borderFaint}`, cursor: "pointer", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>Sign In</button>
                    </div>
                </div>
            </section>

            {/* ── FOOTER ── */}
            <footer style={{ borderTop: `1px solid ${C.borderFaint}`, padding: "22px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", background: C.bg2 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 26, height: 26, background: C.grad, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 2px 8px ${C.blueGlow}` }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "-0.02em", color: C.text }}>OmniOps</span>
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                    {clouds.map(cl => <span key={cl.name} style={{ fontSize: 11.5, color: cl.color, fontWeight: 700, opacity: 0.7 }}>{cl.name}</span>)}
                    <div style={{ width: 1, height: 16, background: C.borderFaint, margin: "0 4px" }} />
                    {products.map(p => <span key={p.id} style={{ fontSize: 11.5, color: p.color, fontWeight: 600, opacity: 0.6 }}>{p.title}</span>)}
                </div>
                <div style={{ fontSize: 11.5, color: C.textFaint, fontFamily: "'JetBrains Mono',monospace" }}>© 2026 OmniOps Platform</div>
            </footer>
        </div>
    );
};

export default LandingPage;