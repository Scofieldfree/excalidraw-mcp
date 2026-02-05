/**
 * WebSocket 服务
 * 实现浏览器与服务器之间的实时双向同步
 */

import { WebSocketServer, WebSocket } from 'ws'
import { getSession, updateSession } from './state.js'
import { log } from './logger.js'

let wss: WebSocketServer | null = null
const clients = new Set<WebSocket>()

/**
 * 启动 WebSocket 服务器
 */
export function startWebSocket(server: any): void {
  wss = new WebSocketServer({ server })

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

        if (msg.type === 'update') {
          // 用户手动编辑，更新状态
          const session = getSession()
          session.elements = msg.elements
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
