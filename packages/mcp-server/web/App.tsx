import {
  Excalidraw,
  exportToBlob,
  exportToSvg,
  convertToExcalidrawElements,
} from '@excalidraw/excalidraw'
import { parseMermaidToExcalidraw } from '@excalidraw/mermaid-to-excalidraw'
import { Wifi, WifiOff } from 'lucide-react'
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

    const LINEAR_ELEMENT_TYPES = new Set(['arrow', 'line', 'freedraw'])
    const BR_TAG_RE = /<\s*br\s*\/?\s*>|<\s*\/\s*br\s*>/gi
    const BLOCK_BREAK_TAG_RE = /<\s*\/?\s*(p|div|li|ul|ol|section|article)\b[^>]*>/gi
    const INLINE_STRIP_TAG_RE = /<\s*\/?\s*(b|strong|i|em|code|span|small|mark)\b[^>]*>/gi
    const GENERIC_TAG_RE = /<[^>]+>/g
    const HTML_ENTITY_MAP: Record<string, string> = {
      nbsp: ' ',
      lt: '<',
      gt: '>',
      amp: '&',
      quot: '"',
      '#39': "'",
      apos: "'",
    }

    const getNumeric = (value: unknown, fallback: number) =>
      typeof value === 'number' && Number.isFinite(value) ? value : fallback

    const normalizeLineBreakText = (value: unknown) => {
      if (typeof value !== 'string') return value
      return value.replace(/\\n/g, '\n').replace(BR_TAG_RE, '\n')
    }

    const decodeHtmlEntities = (text: string): string =>
      text.replace(/&([a-zA-Z0-9#]+);/g, (full: string, key: string): string => {
        const normalized = String(key).toLowerCase()
        if (Object.prototype.hasOwnProperty.call(HTML_ENTITY_MAP, normalized)) {
          return HTML_ENTITY_MAP[normalized] || full
        }
        return full
      })

    const normalizeWhitespace = (text: string) =>
      text
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\u00A0/g, ' ')
        .trim()

    const sanitizeRichText = (value: unknown) => {
      if (typeof value !== 'string') return value
      const withLineBreaks = String(normalizeLineBreakText(value))
      const withBlockBreaks = withLineBreaks.replace(BLOCK_BREAK_TAG_RE, '\n')
      const withoutInlineTags = withBlockBreaks.replace(INLINE_STRIP_TAG_RE, '')
      const withoutGenericTags = withoutInlineTags.replace(GENERIC_TAG_RE, '')
      const decoded = decodeHtmlEntities(withoutGenericTags)
      return normalizeWhitespace(decoded)
    }

    const normalizeElementTextMarkup = (element: any) => {
      if (!element || typeof element !== 'object') return element
      const normalized = { ...element }
      if (typeof normalized.text === 'string') {
        normalized.text = sanitizeRichText(normalized.text)
      }
      if (
        normalized.label &&
        typeof normalized.label === 'object' &&
        typeof normalized.label.text === 'string'
      ) {
        normalized.label = {
          ...normalized.label,
          text: sanitizeRichText(normalized.label.text),
        }
      }
      return normalized
    }

    const getBounds = (element: any) => {
      const x = getNumeric(element?.x, 0)
      const y = getNumeric(element?.y, 0)
      const width = Math.max(getNumeric(element?.width, 100), 1)
      const height = Math.max(getNumeric(element?.height, 60), 1)
      return {
        x,
        y,
        width,
        height,
        cx: x + width / 2,
        cy: y + height / 2,
      }
    }

    const projectToRectEdge = (element: any, toward: { x: number; y: number }) => {
      const b = getBounds(element)
      const dx = toward.x - b.cx
      const dy = toward.y - b.cy
      if (dx === 0 && dy === 0) {
        return { x: b.cx, y: b.cy }
      }
      const halfW = b.width / 2
      const halfH = b.height / 2
      const scale = 1 / Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH, 1)
      return {
        x: b.cx + dx * scale,
        y: b.cy + dy * scale,
      }
    }

    const ensureLinearPoints = (element: any) => {
      if (!LINEAR_ELEMENT_TYPES.has(element?.type)) {
        return element
      }
      const rawPoints = Array.isArray(element.points) ? element.points : []
      const normalizedPoints = rawPoints.filter(
        (point: unknown) =>
          Array.isArray(point) &&
          point.length >= 2 &&
          typeof point[0] === 'number' &&
          typeof point[1] === 'number',
      )
      const safePoints =
        normalizedPoints.length >= 2
          ? normalizedPoints
          : [
              [0, 0],
              [Math.max(getNumeric(element.width, 100), 40), getNumeric(element.height, 0)],
            ]
      return {
        ...element,
        points: safePoints,
        ...(element.type === 'freedraw'
          ? {
              pressures:
                Array.isArray(element.pressures) && element.pressures.length === safePoints.length
                  ? element.pressures
                  : Array(safePoints.length).fill(0.5),
            }
          : {}),
      }
    }

    const resolveElementOverlaps = (elements: any[], minGap = 24) => {
      const output = elements.map((el) => ({ ...el }))
      const idToIndex = new Map<string, number>()
      output.forEach((el, idx) => {
        if (typeof el?.id === 'string') {
          idToIndex.set(el.id, idx)
        }
      })

      const linkedTextIdsByElementId = new Map<string, Set<string>>()
      const addLinkedText = (elementId: string, textId: string) => {
        if (!linkedTextIdsByElementId.has(elementId)) {
          linkedTextIdsByElementId.set(elementId, new Set())
        }
        linkedTextIdsByElementId.get(elementId)!.add(textId)
      }

      output.forEach((el) => {
        if (!el || typeof el.id !== 'string') return

        // Text element linked to container
        if (typeof el.containerId === 'string') {
          addLinkedText(el.containerId, el.id)
        }

        // Container element linked to bound text(s)
        if (Array.isArray(el.boundElements)) {
          el.boundElements.forEach((binding: any) => {
            if (binding?.type === 'text' && typeof binding?.id === 'string') {
              addLinkedText(el.id, binding.id)
            }
          })
        }
      })

      // Heuristic fallback: if text starts inside a non-linear container and has no explicit binding,
      // treat it as container-owned label so overlap adjustments won't desync text and box.
      const textElements = output.filter((el) => el?.type === 'text' && typeof el?.id === 'string')
      const containerElements = output.filter(
        (el) =>
          !LINEAR_ELEMENT_TYPES.has(el?.type) &&
          el?.type !== 'text' &&
          !el?.isDeleted &&
          typeof el?.id === 'string',
      )
      textElements.forEach((textEl) => {
        if (typeof textEl.containerId === 'string') {
          return
        }
        const tb = getBounds(textEl)
        const tx = tb.cx
        const ty = tb.cy
        const owner = containerElements.find((container) => {
          const cb = getBounds(container)
          const padding = 8
          return (
            tx >= cb.x + padding &&
            tx <= cb.x + cb.width - padding &&
            ty >= cb.y + padding &&
            ty <= cb.y + cb.height - padding
          )
        })
        if (owner && typeof owner.id === 'string') {
          addLinkedText(owner.id, textEl.id)
        }
      })

      const applyDelta = (index: number, dx: number, dy: number) => {
        const target = output[index]
        if (!target) return
        target.x = getNumeric(target.x, 0) + dx
        target.y = getNumeric(target.y, 0) + dy

        if (typeof target.id !== 'string') return
        const linkedTextIds = linkedTextIdsByElementId.get(target.id)
        if (!linkedTextIds || linkedTextIds.size === 0) return

        linkedTextIds.forEach((textId) => {
          const textIndex = idToIndex.get(textId)
          if (textIndex === undefined) return
          const textEl = output[textIndex]
          if (!textEl) return
          textEl.x = getNumeric(textEl.x, 0) + dx
          textEl.y = getNumeric(textEl.y, 0) + dy
        })
      }

      const movableIndices = output
        .map((el, index) => ({ el, index }))
        .filter(
          ({ el }) =>
            !LINEAR_ELEMENT_TYPES.has(el?.type) && !el?.isDeleted && typeof el?.id === 'string',
        )
        .map(({ index }) => index)

      for (let pass = 0; pass < 4; pass++) {
        for (let i = 0; i < movableIndices.length; i++) {
          for (let j = i + 1; j < movableIndices.length; j++) {
            const aIdx = movableIndices[i]
            const bIdx = movableIndices[j]
            if (aIdx === undefined || bIdx === undefined) {
              continue
            }
            const a = output[aIdx]
            const b = output[bIdx]
            const ba = getBounds(a)
            const bb = getBounds(b)

            const neededX = ba.width / 2 + bb.width / 2 + minGap
            const neededY = ba.height / 2 + bb.height / 2 + minGap
            const deltaX = bb.cx - ba.cx
            const deltaY = bb.cy - ba.cy

            if (Math.abs(deltaX) >= neededX || Math.abs(deltaY) >= neededY) {
              continue
            }

            const overlapX = neededX - Math.abs(deltaX)
            const overlapY = neededY - Math.abs(deltaY)

            if (overlapY <= overlapX) {
              applyDelta(bIdx, 0, deltaY >= 0 ? overlapY : -overlapY)
            } else {
              applyDelta(bIdx, deltaX >= 0 ? overlapX : -overlapX, 0)
            }
          }
        }
      }

      return output
    }

    const snapArrowEndpoints = (elements: any[]) => {
      const output = elements.map((el) => ({ ...el }))
      const map = new Map(output.map((el) => [el.id, el]))

      output.forEach((el) => {
        if (el?.type !== 'arrow') return

        const startId = el?.startBinding?.elementId
        const endId = el?.endBinding?.elementId
        if (!startId || !endId) return

        const startEl = map.get(startId)
        const endEl = map.get(endId)
        if (!startEl || !endEl) return

        const startCenter = getBounds(startEl)
        const endCenter = getBounds(endEl)
        const startPointAbs = projectToRectEdge(startEl, { x: endCenter.cx, y: endCenter.cy })
        const endPointAbs = projectToRectEdge(endEl, { x: startCenter.cx, y: startCenter.cy })

        const arrowX = getNumeric(el.x, 0)
        const arrowY = getNumeric(el.y, 0)
        const points = Array.isArray(el.points) ? [...el.points] : []
        const safePoints =
          points.length >= 2
            ? points
            : [
                [0, 0],
                [100, 0],
              ]

        safePoints[0] = [startPointAbs.x - arrowX, startPointAbs.y - arrowY]
        safePoints[safePoints.length - 1] = [endPointAbs.x - arrowX, endPointAbs.y - arrowY]
        el.points = safePoints
      })

      return output
    }

    const lineIntersectsRect = (
      start: { x: number; y: number },
      end: { x: number; y: number },
      rect: { x: number; y: number; width: number; height: number },
      padding = 8,
    ) => {
      const rx1 = rect.x - padding
      const ry1 = rect.y - padding
      const rx2 = rect.x + rect.width + padding
      const ry2 = rect.y + rect.height + padding

      const inRect = (p: { x: number; y: number }) =>
        p.x >= rx1 && p.x <= rx2 && p.y >= ry1 && p.y <= ry2

      if (inRect(start) || inRect(end)) {
        return true
      }

      const minX = Math.min(start.x, end.x)
      const maxX = Math.max(start.x, end.x)
      const minY = Math.min(start.y, end.y)
      const maxY = Math.max(start.y, end.y)
      if (maxX < rx1 || minX > rx2 || maxY < ry1 || minY > ry2) {
        return false
      }

      // 近似检测：线段中心落在扩展框附近也视为穿越（足够用于自动绕行）
      const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
      return inRect(mid)
    }

    const rerouteArrowsAroundBlocks = (elements: any[]) => {
      const output = elements.map((el) => ({ ...el }))
      const elementMap = new Map(output.map((el) => [el.id, el]))
      const blockers = output.filter(
        (el) =>
          !LINEAR_ELEMENT_TYPES.has(el?.type) &&
          !el?.isDeleted &&
          typeof el?.x === 'number' &&
          typeof el?.y === 'number',
      )

      output.forEach((arrow) => {
        if (arrow?.type !== 'arrow') return

        const startId = arrow?.startBinding?.elementId
        const endId = arrow?.endBinding?.elementId
        if (!startId || !endId) return

        const startEl = elementMap.get(startId)
        const endEl = elementMap.get(endId)
        if (!startEl || !endEl) return

        const points = Array.isArray(arrow.points) ? arrow.points : []
        if (points.length < 2) return

        const arrowX = getNumeric(arrow.x, 0)
        const arrowY = getNumeric(arrow.y, 0)
        const first = points[0]
        const last = points[points.length - 1]
        if (!Array.isArray(first) || !Array.isArray(last)) return

        const startAbs = {
          x: arrowX + getNumeric(first[0], 0),
          y: arrowY + getNumeric(first[1], 0),
        }
        const endAbs = { x: arrowX + getNumeric(last[0], 0), y: arrowY + getNumeric(last[1], 0) }

        const hitBlocks = blockers.filter((block) => {
          if (block.id === startId || block.id === endId) return false
          const b = getBounds(block)
          return lineIntersectsRect(startAbs, endAbs, b, 12)
        })

        if (hitBlocks.length === 0) return

        const topY = Math.min(...hitBlocks.map((b) => getBounds(b).y)) - 28
        const bottomY = Math.max(...hitBlocks.map((b) => getBounds(b).y + getBounds(b).height)) + 28
        const avgY = (startAbs.y + endAbs.y) / 2
        const bendY = Math.abs(avgY - topY) < Math.abs(avgY - bottomY) ? topY : bottomY

        arrow.points = [
          [startAbs.x - arrowX, startAbs.y - arrowY],
          [startAbs.x - arrowX, bendY - arrowY],
          [endAbs.x - arrowX, bendY - arrowY],
          [endAbs.x - arrowX, endAbs.y - arrowY],
        ]
      })

      return output
    }

    const placeArrowBoundTexts = (elements: any[]) => {
      const output = elements.map((el) => ({ ...el }))
      const idToIndex = new Map(output.map((el, idx) => [el.id, idx]))
      const arrowToTextIds = new Map<string, Set<string>>()
      const addArrowText = (arrowId: string, textId: string) => {
        if (!arrowToTextIds.has(arrowId)) {
          arrowToTextIds.set(arrowId, new Set())
        }
        arrowToTextIds.get(arrowId)!.add(textId)
      }

      output.forEach((el) => {
        if (!el || typeof el.id !== 'string') return
        if (typeof el.containerId === 'string') {
          const containerIndex = idToIndex.get(el.containerId)
          const container = containerIndex !== undefined ? output[containerIndex] : null
          if (container?.type === 'arrow') {
            addArrowText(container.id, el.id)
          }
        }
        if (el.type === 'arrow' && Array.isArray(el.boundElements)) {
          el.boundElements.forEach((binding: any) => {
            if (binding?.type === 'text' && typeof binding?.id === 'string') {
              addArrowText(el.id, binding.id)
            }
          })
        }
      })

      output.forEach((arrow) => {
        if (arrow?.type !== 'arrow' || typeof arrow.id !== 'string') return
        const points = Array.isArray(arrow.points) ? arrow.points : []
        if (points.length < 2) return
        const first = points[0]
        const last = points[points.length - 1]
        if (!Array.isArray(first) || !Array.isArray(last)) return

        const ax = getNumeric(arrow.x, 0)
        const ay = getNumeric(arrow.y, 0)
        const sx = ax + getNumeric(first[0], 0)
        const sy = ay + getNumeric(first[1], 0)
        const ex = ax + getNumeric(last[0], 0)
        const ey = ay + getNumeric(last[1], 0)

        const dx = ex - sx
        const dy = ey - sy
        const len = Math.hypot(dx, dy) || 1
        const nx = -dy / len
        const ny = dx / len
        const offset = 18
        const mx = (sx + ex) / 2 + nx * offset
        const my = (sy + ey) / 2 + ny * offset

        const textIds = arrowToTextIds.get(arrow.id)
        if (!textIds) return
        textIds.forEach((textId) => {
          const idx = idToIndex.get(textId)
          if (idx === undefined) return
          const textEl = output[idx]
          if (!textEl || textEl.type !== 'text') return
          const w = Math.max(getNumeric(textEl.width, 90), 30)
          const h = Math.max(getNumeric(textEl.height, 28), 16)
          textEl.x = mx - w / 2
          textEl.y = my - h / 2
        })
      })

      return output
    }

    const postProcessLayout = (elements: any[]) => {
      const withSafeLinear = elements.map((el) => ensureLinearPoints(el))
      const deoverlapped = resolveElementOverlaps(withSafeLinear, 24)
      const snapped = snapArrowEndpoints(deoverlapped)
      const rerouted = rerouteArrowsAroundBlocks(snapped)
      const textPlaced = placeArrowBoundTexts(rerouted)
      return textPlaced.map((el) => ensureLinearPoints(el))
    }

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

    const handleMermaidConvert = async (msg: {
      requestId?: string
      mermaidDiagram?: string
      reset?: boolean
    }) => {
      const normalizeLinearElement = (element: any) => {
        if (!element || typeof element !== 'object') {
          return element
        }

        if (!['arrow', 'line', 'freedraw'].includes(element.type)) {
          return element
        }

        const points = Array.isArray(element.points) ? element.points : []
        const normalizedPoints = points.filter(
          (point: unknown) =>
            Array.isArray(point) &&
            point.length >= 2 &&
            typeof point[0] === 'number' &&
            typeof point[1] === 'number',
        )
        const safePoints =
          normalizedPoints.length >= 2
            ? normalizedPoints
            : [
                [0, 0],
                [Math.max(Number(element.width) || 100, 40), Number(element.height) || 0],
              ]

        return {
          ...element,
          points: safePoints,
          ...(element.type === 'freedraw'
            ? {
                pressures:
                  Array.isArray(element.pressures) && element.pressures.length === safePoints.length
                    ? element.pressures
                    : Array(safePoints.length).fill(0.5),
              }
            : {}),
        }
      }

      const requestId = typeof msg.requestId === 'string' ? msg.requestId : null
      const mermaidDiagram = typeof msg.mermaidDiagram === 'string' ? msg.mermaidDiagram : null

      if (!requestId || !mermaidDiagram) {
        return
      }

      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return
      }

      try {
        const result = await parseMermaidToExcalidraw(mermaidDiagram, {})
        const parsedElements = Array.isArray(result.elements) ? result.elements : []
        const normalizedParsedElements = parsedElements.map((el) => normalizeElementTextMarkup(el))
        const convertedElements = convertToExcalidrawElements(normalizedParsedElements as any, {
          regenerateIds: false,
        }).map((el) => normalizeLinearElement(el))
        const isSequenceDiagram = /^\s*sequenceDiagram\b/m.test(mermaidDiagram)
        const optimizedElements = isSequenceDiagram
          ? convertedElements.map((el) => ensureLinearPoints(el as any))
          : postProcessLayout(convertedElements as any[])
        const currentElements = msg.reset ? [] : excalidrawRef.current?.getSceneElements() || []

        const mergedById = new Map(currentElements.map((el) => [el.id, el]))
        optimizedElements.forEach((el) => {
          if (!el || typeof el.id !== 'string') {
            return
          }
          mergedById.set(el.id, el)
        })
        const mergedElements = Array.from(mergedById.values())

        isRemoteUpdateRef.current = true
        excalidrawRef.current?.updateScene({
          elements: mergedElements,
          ...(result.files ? { files: result.files } : {}),
        })
        setTimeout(() => {
          isRemoteUpdateRef.current = false
        }, 0)

        ws.send(
          JSON.stringify({
            type: 'mermaid_converted',
            requestId,
            elements: mergedElements,
          }),
        )
      } catch (error) {
        const rawMessage = error instanceof Error ? error.message : String(error)
        const message = /parse|syntax|lexical|token|unexpected/i.test(rawMessage)
          ? `Mermaid syntax error: ${rawMessage}`
          : `Mermaid conversion failed: ${rawMessage || 'Unknown error'}`
        ws.send(
          JSON.stringify({
            type: 'mermaid_convert_error',
            requestId,
            error: message,
          }),
        )
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

          if (msg.type === 'mermaid_convert') {
            handleMermaidConvert(msg)
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
              (Array.isArray(msg.skeletons) ? msg.skeletons : []).map((el: any) =>
                normalizeElementTextMarkup(el),
              ),
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
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
