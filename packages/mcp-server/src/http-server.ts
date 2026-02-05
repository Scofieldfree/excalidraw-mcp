import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { startWebSocket } from './websocket.js'
import { log } from './logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
}

function safeFilePath(rootDir: string, requestPath: string): string {
  const decoded = decodeURIComponent(requestPath.split('?')[0] || '/')
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '')
  return path.join(rootDir, normalized)
}

const MAX_PORT_ATTEMPTS = 20

let currentServerPort: number | null = null

/**
 * 获取当前服务器端口
 */
export function getServerPort(): number | null {
  return currentServerPort
}

// HTTP 服务器
export async function startHttpServer(port: number): Promise<number> {
  const webRoot = path.resolve(__dirname, '..', 'web-dist')

  if (!fs.existsSync(webRoot)) {
    throw new Error(`web-dist not found at ${webRoot}. Run "pnpm build" first.`)
  }

  log.info(`Serving static files from ${webRoot}`)

  const tryListen = (tryPort: number): Promise<number> => {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        if (!req.url) {
          res.writeHead(400)
          res.end('Bad Request')
          return
        }

        const requestPath = req.url === '/' ? '/index.html' : req.url
        let filePath = safeFilePath(webRoot, requestPath)

        // 如果资源不存在，回退到 SPA 入口
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          filePath = path.join(webRoot, 'index.html')
        }

        const stat = fs.statSync(filePath)
        const etag = `W/"${stat.size}-${stat.mtimeMs}"`
        const isIndex = path.basename(filePath) === 'index.html'
        const isAsset = requestPath.startsWith('/assets/')

        if (req.headers['if-none-match'] === etag) {
          res.writeHead(304)
          res.end()
          return
        }

        fs.readFile(filePath, (err, data) => {
          if (err) {
            res.writeHead(500)
            res.end('Internal Server Error')
            return
          }

          const ext = path.extname(filePath)
          const contentType = MIME_TYPES[ext] || 'application/octet-stream'
          const cacheControl = isIndex
            ? 'no-cache'
            : isAsset
              ? 'public, max-age=31536000, immutable'
              : 'no-cache'
          res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': cacheControl,
            ETag: etag,
          })
          res.end(data)
        })
      })

      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          if (tryPort >= port + MAX_PORT_ATTEMPTS) {
            reject(new Error(`No available ports in range ${port}-${port + MAX_PORT_ATTEMPTS}`))
            return
          }
          log.info(`Port ${tryPort} in use, trying ${tryPort + 1}`)
          tryListen(tryPort + 1)
            .then(resolve)
            .catch(reject)
        } else {
          reject(err)
        }
      })

      server.listen(tryPort, () => {
        currentServerPort = tryPort
        startWebSocket(server)
        log.info(`HTTP server started on port ${tryPort}`)
        resolve(tryPort)
      })
    })
  }

  return tryListen(port)
}
