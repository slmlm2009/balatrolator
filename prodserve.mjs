// Temporary static server to test the PRODUCTION build over Tailscale.
// Serves the single-file build at / and the sprite assets (and public/) by relative path.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const PORT = 5173

const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.json': 'application/json',
	'.zip': 'application/zip',
}

async function tryFiles (paths) {
	for (const p of paths) {
		try {
			return { data: await readFile(p), path: p }
		} catch {
			// next
		}
	}
	return null
}

const server = createServer(async (req, res) => {
	const pathname = decodeURIComponent((req.url ?? '/').split('?')[0])

	let candidates
	if (pathname === '/' || pathname === '/index.html') {
		candidates = [join(root, '.prodtest', 'index.html')]
	} else {
		// Serve assets/, favicon, icon, etc. from the project root, falling back to public/.
		const rel = pathname.replace(/^\/+/, '')
		candidates = [join(root, rel), join(root, 'public', rel)]
	}

	const found = await tryFiles(candidates)
	if (!found) {
		res.writeHead(404)
		res.end('Not found')
		return
	}

	res.writeHead(200, {
		'Content-Type': TYPES[extname(found.path).toLowerCase()] ?? 'application/octet-stream',
		'Cache-Control': 'no-cache',
	})
	res.end(found.data)
})

server.listen(PORT, '0.0.0.0', () => {
	console.log(`Production build serving on http://0.0.0.0:${PORT}/`)
})
