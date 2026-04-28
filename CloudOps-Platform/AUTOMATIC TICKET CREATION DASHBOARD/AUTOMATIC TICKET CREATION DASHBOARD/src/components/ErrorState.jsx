export function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-900/40 dark:bg-rose-950/40">
      <div className="text-sm font-semibold text-rose-900 dark:text-rose-100">
        {title}
      </div>
      {message ? (
        <div className="mt-1 text-sm text-rose-800/90 dark:text-rose-100/80">
          {message}
        </div>
      ) : null}
      {onRetry ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      ) : null}
    </div>
  )
}

