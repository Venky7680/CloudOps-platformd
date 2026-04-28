import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function linkClass({ isActive }) {
  return [
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-300 hover:scale-[1.02] active:scale-95',
    isActive
      ? 'bg-indigo-600 text-white shadow-md'
      : 'text-slate-700 hover:bg-indigo-50/50 dark:text-slate-200 dark:hover:bg-slate-800',
  ].join(' ')
}

export function Sidebar({ onNavigate }) {
  const { logout, user } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            Incident Dashboard
          </div>
          <div className="truncate text-xs text-slate-500 dark:text-slate-400">
            Signed in as {user?.username ?? '—'}
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        <NavLink to="/dashboard" className={linkClass} onClick={onNavigate}>
          <span className="text-base" aria-hidden="true">
            ▦
          </span>
          Dashboard
        </NavLink>
        <NavLink to="/analytics" className={linkClass} onClick={onNavigate}>
          <span className="text-base" aria-hidden="true">
            ◔
          </span>
          Analytics
        </NavLink>
      </nav>

      <div className="mt-auto pt-2">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:bg-rose-50 hover:text-rose-600 active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-rose-400"
        >
          <span aria-hidden="true">⎋</span>
          Logout
        </button>
      </div>
    </div>
  )
}

