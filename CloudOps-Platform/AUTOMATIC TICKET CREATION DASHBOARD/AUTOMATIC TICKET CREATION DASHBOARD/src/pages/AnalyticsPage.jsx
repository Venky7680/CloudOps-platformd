import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Spinner } from '../components/Spinner'
import { ErrorState } from '../components/ErrorState'
import { EmptyState } from '../components/EmptyState'
import { fetchTickets } from '../services/ticketsApi'
import { toApiError } from '../services/apiClient'
import { TICKET_SEVERITY, TICKET_STATUS } from '../utils/ticketMeta'

function countBy(list, key, allValues) {
  const map = new Map(allValues.map((v) => [v, 0]))
  list.forEach((t) => {
    const v = t?.[key]
    if (map.has(v)) map.set(v, map.get(v) + 1)
  })
  return [...map.entries()].map(([name, value]) => ({ name, value }))
}

export function AnalyticsPage() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await fetchTickets()
      const list = Array.isArray(data) ? data : data?.tickets ?? []
      setTickets(list)
    } catch (e) {
      setError(toApiError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const severityData = useMemo(
    () => countBy(tickets, 'severity', TICKET_SEVERITY),
    [tickets],
  )
  const statusData = useMemo(() => countBy(tickets, 'status', TICKET_STATUS), [tickets])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Analytics
          </div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Aggregate view across all tickets.
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <Spinner label="Loading analytics…" />
        </div>
      ) : error ? (
        <ErrorState
          title="Failed to load analytics"
          message={error.message}
          onRetry={load}
        />
      ) : tickets.length === 0 ? (
        <EmptyState
          title="No data yet"
          description="Once tickets exist, charts will appear here."
          action={
            <button
              type="button"
              onClick={load}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              Refresh
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Tickets by severity
            </div>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={severityData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" name="Tickets" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Tickets by status
            </div>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" name="Tickets" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

