import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { SearchBar } from '../components/SearchBar'
import { FilterPanel } from '../components/FilterPanel'
import { TicketTable } from '../components/TicketTable'
import { Spinner } from '../components/Spinner'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'

import { useInterval } from '../hooks/useInterval'
import { fetchTickets } from '../services/ticketsApi'
import { toApiError } from '../services/apiClient'
import { toEpoch } from '../utils/date'
import { useToast } from '../context/ToastContext'

export function DashboardPage() {
  const navigate = useNavigate()
  const { pushToast } = useToast()

  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [q, setQ] = useState('')
  const [filters, setFilters] = useState({
    status: '',
    severity: '',
    category: '',
  })

  const seenIdsRef = useRef(new Set())
  const hydratedRef = useRef(false)

  const load = async ({ notifyOnNew } = { notifyOnNew: true }) => {
    setError(null)
    try {
      const data = await fetchTickets()
      const list = Array.isArray(data) ? data : data?.tickets ?? []
      setTickets(list)

      const ids = new Set(list.map((t) => t?.id).filter(Boolean))
      if (!hydratedRef.current) {
        seenIdsRef.current = ids
        hydratedRef.current = true
      } else if (notifyOnNew) {
        const prev = seenIdsRef.current
        const newOnes = []
        ids.forEach((id) => {
          if (!prev.has(id)) newOnes.push(id)
        })
        if (newOnes.length > 0) {
          pushToast({
            title: 'New ticket detected',
            message:
              newOnes.length === 1
                ? `Ticket ${newOnes[0]} just arrived.`
                : `${newOnes.length} new tickets just arrived.`,
            variant: 'warning',
          })
        }
        seenIdsRef.current = ids
      }
    } catch (e) {
      setError(toApiError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load({ notifyOnNew: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useInterval(() => {
    load({ notifyOnNew: true })
  }, 5000)

  const sorted = useMemo(() => {
    return [...tickets].sort((a, b) => toEpoch(b.timestamp) - toEpoch(a.timestamp))
  }, [tickets])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return sorted.filter((t) => {
      if (!t) return false
      if (filters.status && t.status !== filters.status) return false
      if (filters.severity && t.severity !== filters.severity) return false
      if (filters.category && t.category !== filters.category) return false

      if (!query) return true
      const hay = `${t.id ?? ''} ${t.description ?? ''}`.toLowerCase()
      return hay.includes(query)
    })
  }, [sorted, q, filters])

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Dashboard
          </div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Auto-refreshing every 5 seconds.
          </div>
        </div>
        <div className="w-full sm:w-96">
          <SearchBar
            value={q}
            onChange={setQ}
            placeholder="Search by Ticket ID or description…"
          />
        </div>
      </div>

      <FilterPanel
        status={filters.status}
        severity={filters.severity}
        category={filters.category}
        onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
        onReset={() => setFilters({ status: '', severity: '', category: '' })}
      />

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <Spinner label="Loading tickets…" />
        </div>
      ) : error ? (
        <ErrorState
          title="Failed to load tickets"
          message={error.message}
          onRetry={() => load({ notifyOnNew: false })}
        />
      ) : tickets.length === 0 ? (
        <EmptyState
          title="No tickets yet"
          description="When CloudWatch alarms trigger, new incident tickets will appear here."
          action={
            <button
              type="button"
              onClick={() => load({ notifyOnNew: false })}
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:scale-105 hover:bg-indigo-700 hover:shadow-lg active:scale-95"
            >
              Refresh
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No matching tickets"
          description="Try clearing the search term or filters."
          action={
            <button
              type="button"
              onClick={() => {
                setQ('')
                setFilters({ status: '', severity: '', category: '' })
              }}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-300 hover:scale-105 hover:bg-slate-50 active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Clear
            </button>
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Showing <span className="font-semibold">{filtered.length}</span>{' '}
              ticket{filtered.length === 1 ? '' : 's'}
            </div>
            <button
              type="button"
              onClick={() => load({ notifyOnNew: false })}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:scale-105 hover:bg-slate-50 active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Refresh
            </button>
          </div>

          <TicketTable
            tickets={filtered}
            onRowClick={(t) => navigate(`/tickets/${encodeURIComponent(t.id)}`)}
          />
        </>
      )}
    </div>
  )
}

