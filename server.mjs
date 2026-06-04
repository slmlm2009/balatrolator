import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distPath = join(__dirname, 'dist')
const viteCli = join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js')

console.log('Starting Balatrolator server...')
console.log('Working directory:', __dirname)
console.log('Dist path:', distPath)
console.log('Vite CLI:', viteCli)

if (!existsSync(distPath)) {
  console.error('ERROR: dist folder not found. Please run `npm run build` first.')
  process.exit(1)
}

const child = spawn('node', [viteCli, 'preview', '--host', '0.0.0.0', '--port', '5173'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' }
})

child.on('error', (err) => {
  console.error('Failed to start server:', err)
})

child.on('close', (code) => {
  console.log(`Server exited with code ${code}`)
})