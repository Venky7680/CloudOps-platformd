import { Badge } from './Badge'
import { formatTimestamp } from '../utils/date'
import { SEVERITY_BADGE, STATUS_BADGE } from '../utils/ticketMeta'

export function TicketTable({ tickets, onRowClick }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-900 dark:text-slate-300">
            <tr>
              <th className="px-4 py-3">Ticket ID</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {tickets.map((t, i) => (
              <tr
                key={t.id}
                className="group cursor-pointer transition-all duration-300 hover:z-10 hover:scale-[1.01] hover:bg-white hover:shadow-lg active:scale-[0.98] dark:hover:bg-slate-800 animate-slide-up relative"
                style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'both' }}
                onClick={() => onRowClick?.(t)}
              >
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-900 dark:text-slate-100">
                  {t.id}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <Badge className={STATUS_BADGE[t.status] ?? ''}>
                    {t.status}
                  </Badge>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <Badge className={SEVERITY_BADGE[t.severity] ?? ''}>
                    {t.severity}
                  </Badge>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-200">
                  {t.category}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                  {formatTimestamp(t.timestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

