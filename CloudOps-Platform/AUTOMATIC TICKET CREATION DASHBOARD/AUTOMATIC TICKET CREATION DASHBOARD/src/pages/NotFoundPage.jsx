import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-3 text-center">
      <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        Page not found
      </div>
      <div className="text-sm text-slate-600 dark:text-slate-300">
        The page you’re looking for doesn’t exist.
      </div>
      <Link
        to="/dashboard"
        className="mt-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
      >
        Go to Dashboard
      </Link>
    </div>
  )
}

