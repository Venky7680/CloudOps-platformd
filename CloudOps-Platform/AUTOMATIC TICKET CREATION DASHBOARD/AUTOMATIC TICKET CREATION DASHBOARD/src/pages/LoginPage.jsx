import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { ThemeToggle } from '../components/ThemeToggle'

export function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const { pushToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const redirectTo = useMemo(() => {
    const from = location.state?.from?.pathname
    return typeof from === 'string' ? from : '/dashboard'
  }, [location.state])

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, navigate])

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await login(username.trim(), password)
      if (!res.ok) {
        setError(res.message || 'Login failed.')
        return
      }
      pushToast({ title: 'Welcome', message: 'Signed in successfully.', variant: 'success' })
      navigate(redirectTo, { replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 flex items-center justify-center transition-colors duration-500">
      {/* Decorative Blob Background */}
      <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-purple-300/30 blur-3xl mix-blend-multiply dark:bg-purple-900/20 dark:mix-blend-lighten animate-blob" />
      <div className="absolute top-40 -right-20 h-[500px] w-[500px] rounded-full bg-indigo-300/30 blur-3xl mix-blend-multiply dark:bg-indigo-900/20 dark:mix-blend-lighten animate-blob animation-delay-2000" />
      <div className="absolute -bottom-40 left-20 h-[600px] w-[600px] rounded-full bg-pink-300/30 blur-3xl mix-blend-multiply dark:bg-pink-900/20 dark:mix-blend-lighten animate-blob animation-delay-4000" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-col items-center justify-between gap-4 sm:flex-row sm:items-end">
          <div className="text-center sm:text-left animate-slide-up">
            <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Incident Hub
            </div>
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Sign in to manage and triage incident tickets.
            </div>
          </div>
          <ThemeToggle className="shadow-lg backdrop-blur-md bg-white/50 dark:bg-slate-900/50" />
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/40 bg-white/60 p-8 shadow-2xl backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/60 animate-fade-in transition-all duration-300 hover:shadow-indigo-500/10 dark:hover:shadow-indigo-500/5 hover:border-white/60 dark:hover:border-slate-700/60">
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <label className="flex flex-col gap-1.5 group">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 transition-colors group-focus-within:text-indigo-600 dark:text-slate-400 dark:group-focus-within:text-indigo-400">
                Username
              </span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="rounded-xl border border-white/50 bg-white/50 px-4 py-3 text-sm text-slate-900 shadow-inner transition-all hover:bg-white focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/20 dark:border-slate-800/50 dark:bg-slate-950/50 dark:text-slate-100 dark:hover:bg-slate-950 dark:focus:border-indigo-500 dark:focus:bg-slate-950"
                autoComplete="username"
              />
            </label>

            <label className="flex flex-col gap-1.5 group">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 transition-colors group-focus-within:text-indigo-600 dark:text-slate-400 dark:group-focus-within:text-indigo-400">
                Password
              </span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl border border-white/50 bg-white/50 px-4 py-3 text-sm text-slate-900 shadow-inner transition-all hover:bg-white focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/20 dark:border-slate-800/50 dark:bg-slate-950/50 dark:text-slate-100 dark:hover:bg-slate-950 dark:focus:border-indigo-500 dark:focus:bg-slate-950"
                type="password"
                autoComplete="current-password"
              />
            </label>

            {error ? (
              <div className="animate-fade-in rounded-xl border border-rose-200/60 bg-rose-50/80 p-3 text-sm text-rose-800 shadow-sm backdrop-blur-sm dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="group relative mt-2 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-indigo-500/25 active:scale-95 disabled:opacity-70 disabled:hover:scale-100"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {busy ? (
                  <>
                    <svg className="h-4 w-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in…
                  </>
                ) : (
                  'Sign In'
                )}
              </span>
              <div className="absolute inset-0 z-0 h-full w-full bg-white/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </button>
          </form>

          <div className="mt-8 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
            Demo credentials: <span className="rounded bg-indigo-50 px-2 py-1 font-mono text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">admin / admin123</span>
          </div>
        </div>
      </div>
    </div>
  )
}

