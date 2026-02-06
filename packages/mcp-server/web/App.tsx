import {
  Excalidraw,
  exportToBlob,
  exportToSvg,
  convertToExcalidrawElements,
} from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { useEffect, useRef, useState } from 'react'

/**
 * 从 URL 参数获取 sessionId
 */
function getSessionId(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('sessionId') || 'default'
}

/**
 * 构建 WebSocket URL（包含 sessionId）
 */
function getWebSocketUrl(): string {
  const { protocol, host } = window.location
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:'
  const sessionId = getSessionId()
  return `${wsProtocol}//${host}?sessionId=${encodeURIComponent(sessionId)}`
}

export default function App() {
  const excalidrawRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const isRemoteUpdateRef = useRef(false)
  const processedBatchIdsRef = useRef<Set<string>>(new Set())
  const lastAckedBatchIdRef = useRef<string | null>(null)
  const reconnectDelayRef = useRef(2000)
  const reconnectTimerRef = useRef<number | null>(null)
  const heartbeatTimerRef = useRef<number | null>(null)
  const isMountedRef = useRef(true)

  // 当前会话 ID 状态（用于显示）
  const [currentSessionId, setCurrentSessionId] = useState(getSessionId())
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    isMountedRef.current = true

    const startHeartbeat = () => {
      if (heartbeatTimerRef.current) {
        window.clearInterval(heartbeatTimerRef.current)
      }
      heartbeatTimerRef.current = window.setInterval(() => {
        const ws = wsRef.current
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, 25000)
    }

    const stopHeartbeat = () => {
      if (heartbeatTimerRef.current) {
        window.clearInterval(heartbeatTimerRef.current)
        heartbeatTimerRef.current = null
      }
    }

    const scheduleReconnect = () => {
      if (!isMountedRef.current) {
        return
      }
      if (reconnectTimerRef.current) {
        return
      }
      const delay = reconnectDelayRef.current
      reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 60000)
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null
        connect()
      }, delay)
    }

    const blobToBase64 = (blob: Blob) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const result = reader.result
          if (typeof result !== 'string') {
            reject(new Error('Invalid blob result'))
            return
          }
          const base64 = result.split(',')[1]
          if (!base64) {
            reject(new Error('Invalid base64 data'))
            return
          }
          resolve(base64)
        }
        reader.onerror = () => reject(new Error('Failed to read blob'))
        reader.readAsDataURL(blob)
      })

    const textToBase64 = (text: string) => window.btoa(unescape(encodeURIComponent(text)))

    const handleExport = async (msg: {
      requestId?: string
      format?: string
      elements?: any[]
      appState?: Record<string, any>
    }) => {
      const requestId = msg.requestId
      const format = msg.format
      if (!requestId || (format !== 'png' && format !== 'svg')) {
        return
      }

      try {
        const rawElements = Array.isArray(msg.elements) ? msg.elements : []
        const elements = rawElements.filter((el) => !el?.isDeleted)
        const appState = msg.appState || {}
        const files = null

        if (format === 'png') {
          const blob = await exportToBlob({
            elements,
            appState,
            files,
            mimeType: 'image/png',
          })
          const data = await blobToBase64(blob)
          wsRef.current?.send(JSON.stringify({ type: 'export_result', requestId, data, format }))
          return
        }

        const svg = await exportToSvg({
          elements,
          appState,
          files,
        })
        const svgString = new XMLSerializer().serializeToString(svg)
        const data = textToBase64(svgString)
        wsRef.current?.send(JSON.stringify({ type: 'export_result', requestId, data, format }))
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Export failed'
        wsRef.current?.send(JSON.stringify({ type: 'export_result', requestId, error: message }))
      }
    }

    const connect = () => {
      const ws = new WebSocket(getWebSocketUrl())
      wsRef.current = ws

      ws.addEventListener('open', () => {
        reconnectDelayRef.current = 2000
        setIsConnected(true)
        startHeartbeat()
        ws.send(
          JSON.stringify({
            type: 'ready',
            lastAckedBatchId: lastAckedBatchIdRef.current,
          }),
        )
      })

      ws.addEventListener('close', () => {
        setIsConnected(false)
        stopHeartbeat()
        scheduleReconnect()
      })

      ws.addEventListener('error', () => {
        ws.close()
      })

      ws.addEventListener('message', (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'export') {
            handleExport(msg)
            return
          }

          // Handle skeleton elements from server
          if (msg.type === 'add_elements') {
            const batchId = typeof msg.batchId === 'string' ? msg.batchId : null
            const currentElements = excalidrawRef.current?.getSceneElements() || []
            if (batchId && processedBatchIdsRef.current.has(batchId)) {
              const ws = wsRef.current
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(
                  JSON.stringify({
                    type: 'elements_converted',
                    batchId,
                    elements: currentElements,
                  }),
                )
              }
              return
            }

            isRemoteUpdateRef.current = true

            // Convert skeleton data to complete Excalidraw elements
            const newElements = convertToExcalidrawElements(
              msg.skeletons || [],
              { regenerateIds: false }, // Preserve server-generated IDs
            )

            // Merge with existing elements and deduplicate by id to handle replayed batches
            const mergedById = new Map(currentElements.map((el) => [el.id, el]))
            newElements.forEach((el) => {
              mergedById.set(el.id, el)
            })
            const mergedElements = Array.from(mergedById.values())

            excalidrawRef.current?.updateScene({
              elements: mergedElements,
              appState: msg.appState ? { ...msg.appState, collaborators: new Map() } : undefined,
            })

            // Send converted elements back to server for session state update
            const ws = wsRef.current
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'elements_converted',
                  ...(batchId ? { batchId } : {}),
                  elements: mergedElements,
                }),
              )
            }
            if (batchId) {
              processedBatchIdsRef.current.add(batchId)
              lastAckedBatchIdRef.current = batchId
            }

            setTimeout(() => {
              isRemoteUpdateRef.current = false
            }, 0)
            return
          }

          if (msg.type === 'init' || msg.type === 'update') {
            // 更新当前会话 ID
            if (msg.sessionId) {
              setCurrentSessionId(msg.sessionId)
            }
            isRemoteUpdateRef.current = true
            excalidrawRef.current?.updateScene({
              elements: msg.elements || [],
              appState: msg.appState ? { ...msg.appState, collaborators: new Map() } : undefined,
            })
            setTimeout(() => {
              isRemoteUpdateRef.current = false
            }, 0)
          }
        } catch {
          // Ignore malformed messages
        }
      })
    }

    connect()

    return () => {
      isMountedRef.current = false
      stopHeartbeat()
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      wsRef.current?.close()
    }
  }, [])

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部状态栏 */}
      <div
        style={{
          padding: '8px 16px',
          background: isConnected ? '#10b981' : '#ef4444',
          color: 'white',
          fontSize: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>
          Session: <strong>{currentSessionId}</strong>
        </span>
        <span>{isConnected ? '🟢 Connected' : '🔴 Disconnected'}</span>
      </div>

      {/* Excalidraw 画布 */}
      <div style={{ flex: 1 }}>
        <Excalidraw
          excalidrawAPI={(api) => {
            excalidrawRef.current = api
          }}
          onChange={(elements, appState) => {
            if (isRemoteUpdateRef.current) {
              return
            }

            const ws = wsRef.current
            if (!ws || ws.readyState !== WebSocket.OPEN) {
              return
            }

            // 过滤掉不可序列化的属性
            const { collaborators: _collaborators, ...safeAppState } = appState as any

            ws.send(
              JSON.stringify({
                type: 'update',
                elements,
                appState: safeAppState,
              }),
            )
          }}
        />
      </div>
    </div>
  )
}
