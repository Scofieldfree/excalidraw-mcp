/**
 * 多会话状态管理
 * 支持同时管理多个 Excalidraw 图表会话
 */

export interface Session {
  id: string
  elements: ExcalidrawElement[]
  appState: AppState
  version: number
  lastUpdated: Date
}

export interface ExcalidrawElement {
  id: string
  type: string
  x?: number
  y?: number
  width?: number
  height?: number
  angle?: number
  strokeColor?: string
  backgroundColor?: string
  fillStyle?: string
  strokeWidth?: number
  strokeStyle?: string
  roundness?: { type: number; value?: number } | null
  roughness?: number
  opacity?: number
  seed?: number
  version?: number
  versionNonce?: number
  index?: string | null
  isDeleted?: boolean
  groupIds?: string[]
  frameId?: string | null
  boundElements?: BoundElement[] | null
  updated?: number
  link?: string | null
  locked?: boolean
  customData?: Record<string, any>
  // skeleton / convert 相关属性
  label?: {
    text: string
    fontSize?: number
    fontFamily?: number
    strokeColor?: string
    textAlign?: 'left' | 'center' | 'right'
    verticalAlign?: 'top' | 'middle' | 'bottom'
  }
  start?:
    | { id: string }
    | {
        type: 'rectangle' | 'ellipse' | 'diamond' | 'text'
        id?: string
        text?: string
        width?: number
        height?: number
      }
  end?:
    | { id: string }
    | {
        type: 'rectangle' | 'ellipse' | 'diamond' | 'text'
        id?: string
        text?: string
        width?: number
        height?: number
      }
  // 文本特有属性
  text?: string
  fontSize?: number
  fontFamily?: number
  textAlign?: string
  verticalAlign?: string
  containerId?: string | null
  originalText?: string
  autoResize?: boolean
  lineHeight?: number
  // 线条/箭头
  points?: [number, number][]
  lastCommittedPoint?: [number, number] | null
  startBinding?: { elementId: string; focus: number; gap: number } | null
  endBinding?: { elementId: string; focus: number; gap: number } | null
  startArrowhead?: string | null
  endArrowhead?: string | null
  elbowed?: boolean
  // 自由绘制
  pressures?: number[]
  simulatePressure?: boolean
  // 图片
  fileId?: string | null
  status?: 'pending' | 'saved' | 'error'
  scale?: [number, number]
  crop?: {
    x: number
    y: number
    width: number
    height: number
    naturalWidth: number
    naturalHeight: number
  } | null
  // Frame / Magicframe
  name?: string | null
}

export interface BoundElement {
  id: string
  type: string
}

export interface AppState {
  viewBackgroundColor: string
  currentItemStrokeColor: string
  currentItemBackgroundColor: string
  currentItemFillStyle: string
  currentItemStrokeWidth: number
  currentItemRoughness: number
  zoom: { value: number }
  [key: string]: any
}

// 多会话存储
const sessions = new Map<string, Session>()

// 默认会话 ID（向后兼容）
const DEFAULT_SESSION_ID = 'default'

// 会话过期时间（1小时）
const SESSION_TTL = 60 * 60 * 1000

/**
 * 创建默认的 AppState
 */
function createDefaultAppState(): AppState {
  return {
    viewBackgroundColor: '#ffffff',
    currentItemStrokeColor: '#1e1e1e',
    currentItemBackgroundColor: 'transparent',
    currentItemFillStyle: 'solid',
    currentItemStrokeWidth: 2,
    currentItemRoughness: 1,
    zoom: { value: 1 },
  }
}

/**
 * 验证 sessionId 格式
 * 防止恶意输入
 */
function isValidSessionId(sessionId: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(sessionId)
}

/**
 * 创建新会话
 */
export function createSession(sessionId?: string): Session {
  const id = sessionId || `mcp-${crypto.randomUUID().slice(0, 8)}`

  if (!isValidSessionId(id)) {
    throw new Error(
      `Invalid session ID: ${id}. Must be alphanumeric with hyphens/underscores, max 64 chars.`,
    )
  }

  const session: Session = {
    id,
    elements: [],
    appState: createDefaultAppState(),
    version: 0,
    lastUpdated: new Date(),
  }

  sessions.set(id, session)
  return session
}

/**
 * 获取会话
 * 如果会话不存在且 autoCreate 为 true，则自动创建
 */
export function getSession(sessionId?: string, autoCreate = true): Session {
  const id = sessionId || DEFAULT_SESSION_ID

  let session = sessions.get(id)

  if (!session && autoCreate) {
    session = createSession(id)
  }

  if (!session) {
    throw new Error(`Session not found: ${id}`)
  }

  return session
}

/**
 * 检查会话是否存在
 */
export function hasSession(sessionId: string): boolean {
  return sessions.has(sessionId)
}

/**
 * 更新会话
 */
export function updateSession(session: Session): void {
  session.lastUpdated = new Date()
  sessions.set(session.id, session)
}

/**
 * 删除会话
 */
export function deleteSession(sessionId: string): boolean {
  return sessions.delete(sessionId)
}

/**
 * 清空所有会话
 */
export function clearAllSessions(): void {
  sessions.clear()
}

/**
 * 获取所有会话列表
 */
export function listSessions(): Array<{ id: string; elementCount: number; lastUpdated: Date }> {
  return Array.from(sessions.values()).map((s) => ({
    id: s.id,
    elementCount: s.elements.length,
    lastUpdated: s.lastUpdated,
  }))
}

/**
 * 清理过期会话
 */
export function cleanupExpiredSessions(): number {
  const now = Date.now()
  let cleaned = 0

  for (const [id, session] of sessions) {
    // 不清理默认会话
    if (id === DEFAULT_SESSION_ID) continue

    if (now - session.lastUpdated.getTime() > SESSION_TTL) {
      sessions.delete(id)
      cleaned++
    }
  }

  return cleaned
}

// 定期清理过期会话（每5分钟）
setInterval(cleanupExpiredSessions, 5 * 60 * 1000)

// ============================================================
// 向后兼容的旧 API（使用默认会话）
// ============================================================

/**
 * @deprecated 使用 getSession(sessionId) 代替
 */
export function getCurrentSession(): Session {
  return getSession(DEFAULT_SESSION_ID)
}

/**
 * @deprecated 使用 clearAllSessions() 或 deleteSession(id) 代替
 */
export function clearSession(): void {
  deleteSession(DEFAULT_SESSION_ID)
}
