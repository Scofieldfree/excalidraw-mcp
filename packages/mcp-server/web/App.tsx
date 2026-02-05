import { Excalidraw, exportToBlob, exportToSvg } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { useEffect, useRef } from 'react'

function getWebSocketUrl(): string {
  const { protocol, host } = window.location
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:'
  return `${wsProtocol}//${host}`
}

export default function App() {
  const excalidrawRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const isRemoteUpdateRef = useRef(false)
  const reconnectDelayRef = useRef(2000)
  const reconnectTimerRef = useRef<number | null>(null)
  const heartbeatTimerRef = useRef<number | null>(null)
  const isMountedRef = useRef(true)

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
        startHeartbeat()
      })

      ws.addEventListener('close', () => {
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
          if (msg.type === 'init' || msg.type === 'update') {
            isRemoteUpdateRef.current = true
            excalidrawRef.current?.updateScene({
              elements: msg.elements || [],
              appState: msg.appState,
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
    <div style={{ height: '100vh', width: '100vw' }}>
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

          ws.send(
            JSON.stringify({
              type: 'update',
              elements,
              appState,
            }),
          )
        }}
      />
    </div>
  )
}
