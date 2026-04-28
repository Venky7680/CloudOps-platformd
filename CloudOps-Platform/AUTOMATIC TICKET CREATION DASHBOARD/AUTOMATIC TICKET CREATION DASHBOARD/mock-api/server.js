/* global process */
import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

/**
 * In-memory ticket store to make the frontend work end-to-end.
 * This is a DEV helper only; your real backend should replace it.
 */
let tickets = seedTickets()

function seedTickets() {
  const now = Date.now()
  return [
    {
      id: 'INC-1007',
      status: 'New',
      severity: 'Critical',
      category: 'Infrastructure',
      description: 'CloudWatch alarm: CPUUtilization > 90% for 5 minutes on i-0abc123.',
      notes: '',
      timestamp: new Date(now - 2 * 60 * 1000).toISOString(),
    },
    {
      id: 'INC-1006',
      status: 'In Progress',
      severity: 'High',
      category: 'Database',
      description: 'RDS connection spikes detected; investigating slow queries.',
      notes: 'Investigating query performance on users table.',
      timestamp: new Date(now - 12 * 60 * 1000).toISOString(),
    },
    {
      id: 'INC-1005',
      status: 'Closed',
      severity: 'Medium',
      category: 'Network',
      description: 'Transient packet loss observed; auto-recovered.',
      notes: 'Monitored for 30 mins, no further impact. Closed.',
      timestamp: new Date(now - 55 * 60 * 1000).toISOString(),
    },
  ]
}

function validateEnum(value, allowed) {
  return allowed.includes(value)
}

const STATUS = ['New', 'In Progress', 'Closed']
const SEVERITY = ['Low', 'Medium', 'High', 'Critical']
const CATEGORY = ['Infrastructure', 'Network', 'Database', 'Other']

app.get('/api', (_req, res) => res.json({ ok: true, service: 'mock-api' }))

app.get('/api/tickets', (_req, res) => {
  res.json(tickets)
})

app.get('/api/tickets/:id', (req, res) => {
  const t = tickets.find((x) => x.id === req.params.id)
  if (!t) return res.status(404).json({ message: 'Ticket not found' })
  res.json(t)
})

app.put('/api/tickets/:id', (req, res) => {
  const idx = tickets.findIndex((x) => x.id === req.params.id)
  if (idx < 0) return res.status(404).json({ message: 'Ticket not found' })

  const patch = req.body ?? {}
  const current = tickets[idx]
  const next = { ...current }

  if (patch.status != null) {
    if (!validateEnum(patch.status, STATUS)) {
      return res.status(400).json({ message: 'Invalid status' })
    }
    next.status = patch.status
  }
  if (patch.severity != null) {
    if (!validateEnum(patch.severity, SEVERITY)) {
      return res.status(400).json({ message: 'Invalid severity' })
    }
    next.severity = patch.severity
  }
  if (patch.category != null) {
    if (!validateEnum(patch.category, CATEGORY)) {
      return res.status(400).json({ message: 'Invalid category' })
    }
    next.category = patch.category
  }
  if (patch.notes !== undefined) {
    next.notes = patch.notes
  }

  tickets[idx] = next
  res.json(next)
})

app.delete('/api/tickets/:id', (req, res) => {
  const idx = tickets.findIndex((x) => x.id === req.params.id)
  if (idx < 0) return res.status(404).json({ message: 'Ticket not found' })
  const [deleted] = tickets.splice(idx, 1)
  res.json({ ok: true, deleted })
})

const port = Number(process.env.PORT || 5001)
app.listen(port, () => {
  console.log(`Mock API listening on http://localhost:${port}/api`)
})

