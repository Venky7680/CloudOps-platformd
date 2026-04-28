export function EmptyState({
  title = 'No results',
  description = 'Try adjusting your search or filters.',
  action,
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </div>
      <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        {description}
      </div>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}

