import axios from 'axios'

const N8N_BASE = 'https://venkateshvetcha.app.n8n.cloud/webhook'
const SHEET_ID = '140Ts-2p_RflitUY648RxKkvLsSXEhEEe1mQBVV-PxhQ'

// ✅ CSV URL (no proxy)
function getCSVUrl() {
  const cacheBuster = Date.now();
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0&t=${cacheBuster}`;
}

// ✅ CSV Parser
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').replace(/\r/g, ''))

  return lines.slice(1).map(line => {
    const values = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        inQuotes = !inQuotes
      } else if (line[i] === ',' && !inQuotes) {
        values.push(current.trim().replace(/"/g, '').replace(/\r/g, ''))
        current = ''
      } else {
        current += line[i]
      }
    }
    values.push(current.trim().replace(/"/g, '').replace(/\r/g, ''))

    const obj = {}
    headers.forEach((header, index) => {
      obj[header] = values[index] || ''
    })
    return obj
  })
}

// ✅ Map data
function mapRowToTicket(row) {
  return {
    id: row.ticket_id || row.id || '',
    title: row.title || 'No title',
    status: row.status || 'New',
    severity: row.severity || 'Medium',
    category: row.category || 'Infrastructure',
    description: row.description || '',
    timestamp: row.timestamp || new Date().toISOString(),
    updated_at: row.updated_at || row.timestamp || new Date().toISOString(),
    notes: row.notes || '',
    source: row.source || 'AWS CloudWatch',
  }
}

// ✅ THIS WAS MISSING (VERY IMPORTANT)
export async function fetchTickets() {
  const res = await fetch(getCSVUrl())
  const text = await res.text()
  const rows = parseCSV(text)
  const tickets = rows.map(mapRowToTicket)

// 🔥 Sort by latest modified
  tickets.sort((a, b) => {
    return new Date(b.updated_at) - new Date(a.updated_at)
  })

  return tickets
}

// ✅ Fetch by ID
export async function fetchTicketById(id) {
  const tickets = await fetchTickets()
  const ticket = tickets.find(t => t.id === id)
  if (!ticket) throw new Error('Ticket not found')
  return ticket
}

// ✅ Update using n8n (NO proxy)
export async function updateTicket(id, patch) {
  const res = await axios.post(`${N8N_BASE}/update-ticket`, {
    id,
    ...patch
  })
  return res.data
}

// ✅ Delete (optional later)
export async function deleteTicket(id) {
  const res = await axios.post(`${N8N_BASE}/delete-ticket`, {
    id
  })
  return res.data
}