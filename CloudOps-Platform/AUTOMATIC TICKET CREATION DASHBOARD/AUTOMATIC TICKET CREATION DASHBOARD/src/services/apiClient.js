import axios from 'axios'

const SHEET_ID = '140Ts-2p_RflitUY648RxKkvLsSXEhEEe1mQBVV-PxhQ'
const N8N_BASE_URL = 'https://venkateshvetcha.app.n8n.cloud/webhook'

export const API_BASE_URL = N8N_BASE_URL
export const GOOGLE_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

export function toApiError(err) {
  const status = err?.response?.status ?? null
  const code = err?.code ?? null
  const isOffline =
      code === 'ERR_NETWORK' ||
      code === 'ECONNABORTED' ||
      err?.message?.includes('Network Error') ||
      err?.message?.includes('ERR_CONNECTION_REFUSED')
  const message =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      (isOffline
          ? `Cannot reach Google Sheets. Make sure the sheet is public.`
          : err?.message) ||
      'Request failed.'
  return { status, code, isOffline, message, raw: err }
}