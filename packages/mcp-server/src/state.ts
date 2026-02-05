/**
 * 会话状态管理
 * 管理 Excalidraw 图表的 session、elements 和 appState
 */

export interface Session {
  id: string
  elements: ExcalidrawElement[]
  appState: AppState
  version: number
}

export interface ExcalidrawElement {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  angle: number
  strokeColor: string
  backgroundColor: string
  fillStyle: string
  strokeWidth: number
  strokeStyle: string
  roughness: number
  opacity: number
  seed: number
  version: number
  versionNonce: number
  isDeleted: boolean
  groupIds: string[]
  boundElements: BoundElement[] | null
  updated: number
  link: string | null
  locked: boolean
  // 文本特有属性
  text?: string
  fontSize?: number
  fontFamily?: number
  textAlign?: string
  verticalAlign?: string
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
}

let currentSession: Session | null = null

/**
 * 创建新会话
 */
export function createSession(): Session {
  currentSession = {
    id: crypto.randomUUID(),
    elements: [],
    appState: {
      viewBackgroundColor: '#ffffff',
      currentItemStrokeColor: '#1e1e1e',
      currentItemBackgroundColor: 'transparent',
      currentItemFillStyle: 'solid',
      currentItemStrokeWidth: 2,
      currentItemRoughness: 1,
      zoom: { value: 1 },
    },
    version: 0,
  }
  return currentSession
}

/**
 * 获取当前会话
 * 如果没有会话，自动创建一个
 */
export function getSession(): Session {
  if (!currentSession) {
    return createSession()
  }
  return currentSession
}

/**
 * 更新会话
 */
export function updateSession(session: Session): void {
  currentSession = session
}

/**
 * 清空会话
 */
export function clearSession(): void {
  currentSession = null
}
