import {
  TICKET_CATEGORY,
  TICKET_SEVERITY,
  TICKET_STATUS,
} from '../utils/ticketMeta'

function Select({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
      >
        <option value="">All</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  )
}

export function FilterPanel({
  status,
  severity,
  category,
  onChange,
  onReset,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Filters
        </div>
        <button
          type="button"
          onClick={onReset}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
        >
          Reset
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select
          label="Status"
          value={status}
          onChange={(v) => onChange({ status: v })}
          options={TICKET_STATUS}
        />
        <Select
          label="Severity"
          value={severity}
          onChange={(v) => onChange({ severity: v })}
          options={TICKET_SEVERITY}
        />
        <Select
          label="Category"
          value={category}
          onChange={(v) => onChange({ category: v })}
          options={TICKET_CATEGORY}
        />
      </div>
    </div>
  )
}

