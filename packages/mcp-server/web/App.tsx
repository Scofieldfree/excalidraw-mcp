import { Excalidraw, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw'
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

  useEffect(() => {
    const ws = new WebSocket(getWebSocketUrl())
    wsRef.current = ws

    ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data)
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

    return () => {
      ws.close()
    }
  }, [])

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <Excalidraw
        ref={(api) => {
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
