/**
 * WebSocket 服务
 * 实现浏览器与服务器之间的实时双向同步
 */

import { WebSocketServer, WebSocket } from 'ws'
import { getSession, updateSession } from './state.js'
import type { AppState, ExcalidrawElement } from './state.js'
import { log } from './logger.js'

let wss: WebSocketServer | null = null
const clients = new Set<WebSocket>()
const pendingExports = new Map<
  string,
  { resolve: (data: string) => void; reject: (error: Error) => void; timeout: NodeJS.Timeout }
>()

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isValidElementsPayload(elements: unknown): elements is Array<Record<string, unknown>> {
  if (!Array.isArray(elements) || elements.length > 10000) {
    return false
  }
  return elements.every(
    (el) =>
      el &&
      typeof el === 'object' &&
      typeof (el as { id?: unknown }).id === 'string' &&
      typeof (el as { type?: unknown }).type === 'string',
  )
}

/**
 * 启动 WebSocket 服务器
 */
export function startWebSocket(server: any): void {
  wss = new WebSocketServer({ server })
  log.info('WebSocket server attached')

  wss.on('connection', (ws) => {
    log.info('WebSocket client connected')
    clients.add(ws)

    // 发送当前状态
    const session = getSession()
    ws.send(
      JSON.stringify({
        type: 'init',
        elements: session.elements,
        appState: session.appState,
        version: session.version,
      }),
    )

    // 接收浏览器编辑
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString())

        if (!isPlainObject(msg)) {
          return
        }

        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }))
          return
        }

        if (msg.type === 'export_result') {
          const requestId = msg.requestId
          const dataPayload = msg.data
          const error = msg.error
          if (typeof requestId !== 'string') {
            return
          }
          const pending = pendingExports.get(requestId)
          if (!pending) {
            return
          }
          clearTimeout(pending.timeout)
          pendingExports.delete(requestId)
          if (typeof error === 'string') {
            pending.reject(new Error(error))
            return
          }
          if (typeof dataPayload !== 'string') {
            pending.reject(new Error('Invalid export payload'))
            return
          }
          pending.resolve(dataPayload)
          return
        }

        if (msg.type === 'update') {
          if (!isValidElementsPayload(msg.elements)) {
            return
          }
          if (msg.appState && !isPlainObject(msg.appState)) {
            return
          }

          // 用户手动编辑，更新状态
          const session = getSession()
          session.elements = msg.elements as unknown as ExcalidrawElement[]
          if (msg.appState) {
            session.appState = {
              ...session.appState,
              ...(msg.appState as Partial<AppState>),
            }
          }
          session.version++
          updateSession(session)

          // 广播给其他客户端
          broadcast(msg, ws)
        }
      } catch (error) {
        log.error('WebSocket message error:', error)
      }
    })

    ws.on('close', () => {
      log.info('WebSocket client disconnected')
      clients.delete(ws)
    })

    ws.on('error', (error) => {
      log.error('WebSocket error:', error)
    })
  })
}

/**
 * 广播消息给所有客户端
 */
export function broadcast(msg: any, exclude?: WebSocket): void {
  const data = JSON.stringify(msg)
  clients.forEach((client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(data)
    }
  })
}

/**
 * 获取当前连接的客户端数量
 */
export function getClientCount(): number {
  return clients.size
}

export function requestExport(payload: {
  format: 'png' | 'svg'
  elements: unknown
  appState: unknown
  timeoutMs?: number
}): Promise<string> {
  if (clients.size === 0) {
    return Promise.reject(new Error('No active browser session'))
  }

  const requestId = crypto.randomUUID()
  const timeoutMs = payload.timeoutMs ?? 30000

  const message = JSON.stringify({
    type: 'export',
    requestId,
    format: payload.format,
    elements: payload.elements,
    appState: payload.appState,
  })

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
    }
  })

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingExports.delete(requestId)
      reject(new Error('Export timed out'))
    }, timeoutMs)
    pendingExports.set(requestId, { resolve, reject, timeout })
  })
}
