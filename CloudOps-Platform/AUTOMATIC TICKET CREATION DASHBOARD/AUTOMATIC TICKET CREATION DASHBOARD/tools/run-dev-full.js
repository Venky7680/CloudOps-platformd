/* global process */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

function run(label, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    ...options,
  })

  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[${label}] exited with code ${code}`)
      process.exitCode = code
    }
  })

  return child
}

// Start mock API on :5000
const api = run('API', process.execPath, [path.join(root, 'mock-api', 'server.js')])

// Start Vite dev server (usually :5173)
const vite = run('WEB', process.execPath, [
  path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'),
])

function shutdown() {
  try {
    api.kill('SIGTERM')
  } catch {
    // ignore
  }
  try {
    vite.kill('SIGTERM')
  } catch {
    // ignore
  }
}

process.on('SIGINT', () => {
  shutdown()
  process.exit(0)
})
process.on('SIGTERM', () => {
  shutdown()
  process.exit(0)
})

