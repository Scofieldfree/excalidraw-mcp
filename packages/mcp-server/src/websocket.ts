/**
 * WebSocket 服务
 * 实现浏览器与服务器之间的实时双向同步
 * 支持多会话：每个客户端关联一个 sessionId
 */

import { WebSocketServer, WebSocket } from 'ws'
import { getSession, updateSession, type AppState, type ExcalidrawElement } from './state.js'
import { log } from './logger.js'

let wss: WebSocketServer | null = null

// 客户端映射：WebSocket -> sessionId
const clientSessions = new Map<WebSocket, string>()

// 会话映射：sessionId -> 客户端集合
const sessionClients = new Map<string, Set<WebSocket>>()

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
 * 将客户端加入会话
 */
function joinSession(ws: WebSocket, sessionId: string): void {
  // 清理旧的会话关联
  const oldSessionId = clientSessions.get(ws)
  if (oldSessionId && oldSessionId !== sessionId) {
    const oldClients = sessionClients.get(oldSessionId)
    if (oldClients) {
      oldClients.delete(ws)
      if (oldClients.size === 0) {
        sessionClients.delete(oldSessionId)
      }
    }
  }

  // 建立新的会话关联
  clientSessions.set(ws, sessionId)

  if (!sessionClients.has(sessionId)) {
    sessionClients.set(sessionId, new Set())
  }
  sessionClients.get(sessionId)!.add(ws)

  log.info(`Client joined session: ${sessionId}`)
}

/**
 * 移除客户端
 */
function removeClient(ws: WebSocket): void {
  const sessionId = clientSessions.get(ws)
  if (sessionId) {
    const clients = sessionClients.get(sessionId)
    if (clients) {
      clients.delete(ws)
      if (clients.size === 0) {
        sessionClients.delete(sessionId)
      }
    }
  }
  clientSessions.delete(ws)
}

/**
 * 启动 WebSocket 服务器
 */
export function startWebSocket(server: any): void {
  wss = new WebSocketServer({ server })
  log.info('WebSocket server attached')

  wss.on('connection', (ws, req) => {
    log.info('WebSocket client connected')

    // 从 URL 查询参数获取 sessionId
    const url = new URL(req.url || '/', `http://localhost`)
    const sessionId = url.searchParams.get('sessionId') || 'default'

    // 加入会话
    joinSession(ws, sessionId)

    // 发送当前状态
    const session = getSession(sessionId)
    ws.send(
      JSON.stringify({
        type: 'init',
        sessionId: session.id,
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

        // 心跳
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }))
          return
        }

        // 切换会话
        if (msg.type === 'join_session') {
          const newSessionId = typeof msg.sessionId === 'string' ? msg.sessionId : 'default'
          joinSession(ws, newSessionId)

          const session = getSession(newSessionId)
          ws.send(
            JSON.stringify({
              type: 'init',
              sessionId: session.id,
              elements: session.elements,
              appState: session.appState,
              version: session.version,
            }),
          )
          return
        }

        // 导出结果
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

        // 前端完成 skeleton 补全后回传完整元素
        if (msg.type === 'elements_converted') {
          if (!isValidElementsPayload(msg.elements)) {
            return
          }

          const currentSessionId = clientSessions.get(ws) || 'default'
          const session = getSession(currentSessionId)

          session.elements = msg.elements as unknown as ExcalidrawElement[]
          session.version++
          updateSession(session)

          // 同步给同会话其他客户端，避免发送方回环
          broadcastToSession(
            currentSessionId,
            {
              type: 'update',
              sessionId: session.id,
              elements: session.elements,
              appState: session.appState,
              version: session.version,
            },
            ws,
          )
          return
        }

        // 更新画布
        if (msg.type === 'update') {
          if (!isValidElementsPayload(msg.elements)) {
            return
          }
          if (msg.appState && !isPlainObject(msg.appState)) {
            return
          }

          // 获取客户端所属的会话
          const currentSessionId = clientSessions.get(ws) || 'default'
          const session = getSession(currentSessionId)

          session.elements = msg.elements as unknown as ExcalidrawElement[]
          if (msg.appState) {
            // 防御性编程：移除可能导致客户端崩溃的 collaborators 属性
            const { collaborators: _collaborators, ...safeAppState } = msg.appState as any

            session.appState = {
              ...session.appState,
              ...(safeAppState as Partial<AppState>),
            }
          }
          session.version++
          updateSession(session)

          // 只广播给同一会话的其他客户端
          broadcastToSession(currentSessionId, msg, ws)
        }
      } catch (error) {
        log.error('WebSocket message error:', error)
      }
    })

    ws.on('close', () => {
      log.info('WebSocket client disconnected')
      removeClient(ws)
    })

    ws.on('error', (error) => {
      log.error('WebSocket error:', error)
    })
  })
}

/**
 * 广播消息给指定会话的所有客户端
 */
export function broadcastToSession(sessionId: string, msg: any, exclude?: WebSocket): void {
  const clients = sessionClients.get(sessionId)
  if (!clients) return

  const data = JSON.stringify(msg)
  clients.forEach((client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(data)
    }
  })
}

/**
 * 广播消息给所有客户端（向后兼容）
 */
export function broadcast(msg: any, exclude?: WebSocket): void {
  const data = JSON.stringify(msg)
  clientSessions.forEach((sessionId, client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(data)
    }
  })
}

/**
 * 获取当前连接的客户端数量
 */
export function getClientCount(): number {
  return clientSessions.size
}

/**
 * 获取指定会话的客户端数量
 */
export function getSessionClientCount(sessionId: string): number {
  return sessionClients.get(sessionId)?.size || 0
}

export async function waitForSessionClient(
  sessionId: string,
  timeoutMs = 5000,
  pollIntervalMs = 100,
): Promise<boolean> {
  if (getSessionClientCount(sessionId) > 0) {
    return true
  }

  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    if (getSessionClientCount(sessionId) > 0) {
      return true
    }
  }

  return false
}

export function requestExport(payload: {
  sessionId?: string
  format: 'png' | 'svg'
  elements: unknown
  appState: unknown
  timeoutMs?: number
}): Promise<string> {
  const sessionId = payload.sessionId || 'default'
  const clients = sessionClients.get(sessionId)

  if (!clients || clients.size === 0) {
    return Promise.reject(new Error(`No active browser session for: ${sessionId}`))
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
