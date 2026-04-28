import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Spinner } from '../components/Spinner'
import { ErrorState } from '../components/ErrorState'
import { Badge } from '../components/Badge'
import { ConfirmDialog } from '../components/ConfirmDialog'

import { deleteTicket, fetchTicketById, updateTicket } from '../services/ticketsApi'
import { toApiError } from '../services/apiClient'
import {
  SEVERITY_BADGE,
  STATUS_BADGE,
  TICKET_CATEGORY,
  TICKET_SEVERITY,
  TICKET_STATUS,
} from '../utils/ticketMeta'
import { formatTimestamp } from '../utils/date'
import { useToast } from '../context/ToastContext'

function Select({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  )
}

export function TicketDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { pushToast } = useToast()

  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const [status, setStatus] = useState('New')
  const [severity, setSeverity] = useState('Low')
  const [category, setCategory] = useState('Other')
  const [notes, setNotes] = useState('')

  const dirty = useMemo(() => {
    if (!ticket) return false
    return (
      status !== ticket.status ||
      severity !== ticket.severity ||
      category !== ticket.category ||
      notes !== (ticket.notes || '')
    )
  }, [ticket, status, severity, category, notes])

  const load = async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await fetchTicketById(id)
      const t = data?.ticket ?? data
      setTicket(t)
      setStatus(t?.status ?? 'New')
      setSeverity(t?.severity ?? 'Low')
      setCategory(t?.category ?? 'Other')
      setNotes(t?.notes ?? '')
    } catch (e) {
      setError(toApiError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const onSave = async () => {
    if (!ticket) return
    setSaving(true)
    try {
      const payload = { status, severity, category, notes }
      await updateTicket(ticket.id, payload)

      // Update local state immediately
      setTicket(prev => ({
        ...prev,
        status,
        severity,
        category,
        notes
      }))

      pushToast({
        title: 'Ticket updated',
        message: `Saved changes for ${ticket.id}.`,
        variant: 'success',
      })

      // Wait 2 seconds then reload from Google Sheets to confirm
      setTimeout(async () => {
        try {
          const fresh = await fetchTicketById(ticket.id)
          const t = fresh?.ticket ?? fresh
          if (t) {
            setTicket(t)
            setStatus(t.status ?? 'New')
            setSeverity(t.severity ?? 'Low')
            setCategory(t.category ?? 'Other')
            setNotes(t.notes ?? '')
          }
        } catch {
          // silently ignore reload errors
        }
      }, 2000)

    } catch (e) {
      const apiErr = toApiError(e)
      pushToast({ title: 'Update failed', message: apiErr.message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!ticket) return
    setDeleting(true)
    try {
      await deleteTicket(ticket.id)
      pushToast({
        title: 'Ticket deleted',
        message: `Deleted ${ticket.id}.`,
        variant: 'success',
      })
      navigate('/dashboard', { replace: true })
    } catch (e) {
      const apiErr = toApiError(e)
      pushToast({ title: 'Delete failed', message: apiErr.message, variant: 'error' })
    } finally {
      setDeleting(false)
      setConfirmOpen(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <Spinner label="Loading ticket…" />
      </div>
    )
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load ticket"
        message={error.message}
        onRetry={load}
      />
    )
  }

  if (!ticket) {
    return (
      <ErrorState
        title="Ticket not found"
        message="This ticket may have been deleted."
        onRetry={load}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
            >
              ← Back
            </Link>
            <div className="truncate font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
              {ticket.id}
            </div>
          </div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Created: {formatTimestamp(ticket.timestamp)}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge className={STATUS_BADGE[ticket.status] ?? ''}>{ticket.status}</Badge>
          <Badge className={SEVERITY_BADGE[ticket.severity] ?? ''}>
            {ticket.severity}
          </Badge>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 shadow-sm hover:bg-rose-50 dark:border-rose-900/40 dark:bg-slate-900 dark:text-rose-200 dark:hover:bg-rose-950/30"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Description
            </div>
            <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
              {ticket.description || '—'}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Resolution Notes
            </div>
            <textarea
              className="w-full min-h-[200px] rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 shadow-inner transition-colors focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:bg-slate-900"
              rows={8}
              placeholder="Add details on how this ticket was resolved..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Actions
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <Select
                label="Status"
                value={status}
                onChange={setStatus}
                options={TICKET_STATUS}
              />
              <Select
                label="Severity"
                value={severity}
                onChange={setSeverity}
                options={TICKET_SEVERITY}
              />
              <Select
                label="Category"
                value={category}
                onChange={setCategory}
                options={TICKET_CATEGORY}
              />

              <button
                type="button"
                onClick={onSave}
                disabled={!dirty || saving}
                className="mt-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this ticket?"
        description="This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        tone="danger"
        busy={deleting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={onDelete}
      />
    </div>
  )
}

