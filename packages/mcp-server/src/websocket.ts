/**
 * WebSocket 服务
 * 实现浏览器与服务器之间的实时双向同步
 * 支持多会话：每个客户端关联一个 sessionId
 */

import { WebSocketServer, WebSocket } from 'ws'
import { getSession, updateSession, type AppState, type ExcalidrawElement } from './state.js'
import { log } from './logger.js'
import { normalizeElementsForStorage } from './shared/element-normalizer.js'

let wss: WebSocketServer | null = null

// 客户端映射：WebSocket -> sessionId
const clientSessions = new Map<WebSocket, string>()

// 会话映射：sessionId -> 客户端集合
const sessionClients = new Map<string, Set<WebSocket>>()

const pendingExports = new Map<
  string,
  { resolve: (data: string) => void; reject: (error: Error) => void; timeout: NodeJS.Timeout }
>()
interface PendingMermaidConversion {
  requestId: string
  sessionId: string
  mermaidDiagram: string
  reset: boolean
  dispatched: boolean
  resolve: (result: { sessionId: string; elementCount: number }) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}
const pendingMermaidConversions = new Map<string, PendingMermaidConversion>()

interface PendingSkeletonBatch {
  batchId: string
  skeletons: Array<Record<string, unknown>>
  appState?: Record<string, unknown>
  synced: boolean
  createdAt: number
}

const pendingSkeletonBatches = new Map<string, PendingSkeletonBatch[]>()
const MAX_PENDING_SKELETON_BATCHES = 200

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

function sendSkeletonBatch(
  ws: WebSocket,
  batch: Pick<PendingSkeletonBatch, 'batchId' | 'skeletons' | 'appState'>,
): void {
  if (ws.readyState !== WebSocket.OPEN) {
    return
  }
  ws.send(
    JSON.stringify({
      type: 'add_elements',
      batchId: batch.batchId,
      skeletons: batch.skeletons,
      appState: batch.appState,
    }),
  )
}

function sendMermaidConversionRequest(
  ws: WebSocket,
  request: Pick<PendingMermaidConversion, 'requestId' | 'sessionId' | 'mermaidDiagram' | 'reset'>,
): boolean {
  if (ws.readyState !== WebSocket.OPEN) {
    return false
  }
  ws.send(
    JSON.stringify({
      type: 'mermaid_convert',
      requestId: request.requestId,
      sessionId: request.sessionId,
      mermaidDiagram: request.mermaidDiagram,
      reset: request.reset,
    }),
  )
  return true
}

function cleanupSkeletonBatches(sessionId: string): void {
  const batches = pendingSkeletonBatches.get(sessionId)
  if (!batches || batches.length <= MAX_PENDING_SKELETON_BATCHES) {
    return
  }
  const synced = batches.filter((batch) => batch.synced)
  const unsynced = batches.filter((batch) => !batch.synced)
  const keepSynced = Math.max(0, MAX_PENDING_SKELETON_BATCHES - unsynced.length)
  pendingSkeletonBatches.set(sessionId, [...synced.slice(-keepSynced), ...unsynced])
}

function markSkeletonBatchSynced(sessionId: string, batchId: string): void {
  const batches = pendingSkeletonBatches.get(sessionId)
  if (!batches) return
  const batch = batches.find((item) => item.batchId === batchId)
  if (!batch) return
  batch.synced = true
  cleanupSkeletonBatches(sessionId)
}

function replayPendingSkeletonBatches(sessionId: string, ws: WebSocket): void {
  const batches = pendingSkeletonBatches.get(sessionId)
  if (!batches?.length) return
  batches
    .filter((batch) => !batch.synced)
    .forEach((batch) => {
      sendSkeletonBatch(ws, batch)
    })
}

function replayPendingMermaidConversions(sessionId: string, ws: WebSocket): void {
  pendingMermaidConversions.forEach((pending) => {
    if (pending.sessionId !== sessionId || pending.dispatched) {
      return
    }
    const sent = sendMermaidConversionRequest(ws, pending)
    if (sent) {
      pending.dispatched = true
    }
  })
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
        // 当前会话无在线客户端时，允许待处理 mermaid 请求在下次 ready 时重放
        pendingMermaidConversions.forEach((pending) => {
          if (pending.sessionId === sessionId) {
            pending.dispatched = false
          }
        })
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
    const normalizedInitElements = normalizeElementsForStorage(
      session.elements as unknown as Array<Record<string, unknown>>,
    )
    session.elements = normalizedInitElements as unknown as ExcalidrawElement[]
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
          const normalizedInitElements = normalizeElementsForStorage(
            session.elements as unknown as Array<Record<string, unknown>>,
          )
          session.elements = normalizedInitElements as unknown as ExcalidrawElement[]
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

        // 客户端就绪：重放该会话未同步的 skeleton batch
        if (msg.type === 'ready') {
          const currentSessionId = clientSessions.get(ws) || 'default'
          if (typeof msg.lastAckedBatchId === 'string') {
            markSkeletonBatchSynced(currentSessionId, msg.lastAckedBatchId)
          }
          replayPendingSkeletonBatches(currentSessionId, ws)
          replayPendingMermaidConversions(currentSessionId, ws)
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

          if (typeof msg.batchId === 'string') {
            markSkeletonBatchSynced(currentSessionId, msg.batchId)
          }

          const normalizedElements = normalizeElementsForStorage(msg.elements)
          session.elements = normalizedElements as unknown as ExcalidrawElement[]
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

        // 前端完成 Mermaid 转换后回传完整元素
        if (msg.type === 'mermaid_converted') {
          const requestId = msg.requestId
          if (typeof requestId !== 'string' || !isValidElementsPayload(msg.elements)) {
            return
          }

          const pending = pendingMermaidConversions.get(requestId)
          if (!pending) {
            return
          }

          const currentSessionId = clientSessions.get(ws) || 'default'
          if (pending.sessionId !== currentSessionId) {
            return
          }

          const session = getSession(currentSessionId)
          const normalizedElements = normalizeElementsForStorage(msg.elements)
          session.elements = normalizedElements as unknown as ExcalidrawElement[]
          if (msg.appState && isPlainObject(msg.appState)) {
            const { collaborators: _collaborators, ...safeAppState } = msg.appState as any
            session.appState = {
              ...session.appState,
              ...(safeAppState as Partial<AppState>),
            }
          }
          session.version++
          updateSession(session)

          clearTimeout(pending.timeout)
          pendingMermaidConversions.delete(requestId)
          pending.resolve({ sessionId: currentSessionId, elementCount: session.elements.length })

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

        if (msg.type === 'mermaid_convert_error') {
          const requestId = msg.requestId
          if (typeof requestId !== 'string') {
            return
          }
          const pending = pendingMermaidConversions.get(requestId)
          if (!pending) {
            return
          }
          clearTimeout(pending.timeout)
          pendingMermaidConversions.delete(requestId)
          const errorMsg =
            typeof msg.error === 'string' ? msg.error : 'Mermaid conversion failed on client'
          pending.reject(new Error(errorMsg))
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

          const normalizedElements = normalizeElementsForStorage(msg.elements)
          session.elements = normalizedElements as unknown as ExcalidrawElement[]
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
          broadcastToSession(
            currentSessionId,
            {
              ...msg,
              elements: session.elements,
              appState: session.appState,
              sessionId: session.id,
              version: session.version,
            },
            ws,
          )
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

export function enqueueSkeletonBatch(
  sessionId: string,
  skeletons: Array<Record<string, unknown>>,
  appState?: Record<string, unknown>,
): string {
  const batchId = crypto.randomUUID()
  const batch: PendingSkeletonBatch = {
    batchId,
    skeletons,
    appState,
    synced: false,
    createdAt: Date.now(),
  }
  const batches = pendingSkeletonBatches.get(sessionId) || []
  batches.push(batch)
  pendingSkeletonBatches.set(sessionId, batches)
  cleanupSkeletonBatches(sessionId)

  const clients = sessionClients.get(sessionId)
  if (clients?.size) {
    clients.forEach((client) => {
      sendSkeletonBatch(client, batch)
    })
  }

  return batchId
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

export function requestMermaidConversion(payload: {
  sessionId?: string
  mermaidDiagram: string
  reset?: boolean
  timeoutMs?: number
}): Promise<{ sessionId: string; elementCount: number }> {
  const sessionId = payload.sessionId || 'default'
  const requestId = crypto.randomUUID()
  const timeoutMs = payload.timeoutMs ?? 30000
  const reset = Boolean(payload.reset)

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingMermaidConversions.delete(requestId)
      reject(
        new Error(
          `Mermaid conversion timed out after ${timeoutMs}ms. ` +
            `Please call start_session, keep the UI tab open, and retry.`,
        ),
      )
    }, timeoutMs)

    const pending = {
      requestId,
      sessionId,
      mermaidDiagram: payload.mermaidDiagram,
      reset,
      dispatched: false,
      resolve,
      reject,
      timeout,
    }
    pendingMermaidConversions.set(requestId, pending)

    const clients = sessionClients.get(sessionId)
    if (!clients || clients.size === 0) {
      return
    }
    clients.forEach((client) => {
      const sent = sendMermaidConversionRequest(client, pending)
      if (sent) {
        pending.dispatched = true
      }
    })
  })
}
