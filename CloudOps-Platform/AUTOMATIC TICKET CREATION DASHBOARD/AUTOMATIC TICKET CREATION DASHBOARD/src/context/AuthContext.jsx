/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const AuthContext = createContext(null)

const STORAGE_KEY = 'imd_auth_v1'
const USERNAME = 'admin'
const PASSWORD = 'admin123'

function readStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { isAuthenticated: false, user: null }
    const parsed = JSON.parse(raw)
    if (parsed?.isAuthenticated && parsed?.user?.username) return parsed
    return { isAuthenticated: false, user: null }
  } catch {
    return { isAuthenticated: false, user: null }
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => readStoredAuth())
  const isAuthenticated = Boolean(auth?.isAuthenticated)
  const user = auth?.user ?? null

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ isAuthenticated, user }, null, 0),
    )
  }, [isAuthenticated, user])

  const value = useMemo(() => {
    return {
      isAuthenticated,
      user,
      login: async (username, password) => {
        const ok = username === USERNAME && password === PASSWORD
        if (!ok) return { ok: false, message: 'Invalid username or password.' }
        setAuth({ isAuthenticated: true, user: { username } })
        return { ok: true }
      },
      logout: () => {
        setAuth({ isAuthenticated: false, user: null })
      },
    }
  }, [isAuthenticated, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

