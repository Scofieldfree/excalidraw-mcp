import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getSession, updateSession } from '../state.js'
import { broadcastToSession } from '../websocket.js'

// Excalidraw 元素 Schema
const ExcalidrawElementSchema = z.object({
  type: z
    .enum([
      'rectangle',
      'ellipse',
      'diamond',
      'arrow',
      'text',
      'line',
      'freedraw',
      'image',
      'iframe',
      'embeddable',
      'frame',
      'magicframe',
    ])
    .describe('元素类型'),
  id: z.string().optional().describe('元素 ID'),
  x: z.number().describe('X 坐标'),
  y: z.number().describe('Y 坐标'),
  width: z.number().optional().describe('宽度'),
  height: z.number().optional().describe('高度'),
  strokeColor: z.string().optional().describe('边框颜色'),
  backgroundColor: z.string().optional().describe('背景颜色'),
  fillStyle: z.enum(['solid', 'hachure', 'cross-hatch', 'zigzag']).optional().describe('填充样式'),
  strokeWidth: z.number().optional().describe('线条宽度'),
  strokeStyle: z.enum(['solid', 'dashed', 'dotted']).optional().describe('线条样式'),
  roughness: z.number().optional().describe('粗糙度 (0=平滑, 1=轻微手绘, 2=强手绘)'),
  text: z.string().optional().describe('文本内容 (仅 text 类型)'),
  fontSize: z.number().optional().describe('字体大小'),
  textAlign: z.enum(['left', 'center', 'right']).optional().describe('文本对齐'),
  verticalAlign: z.enum(['top', 'middle', 'bottom']).optional().describe('垂直对齐'),
  points: z
    .array(z.array(z.number()))
    .optional()
    .describe('线条/自由绘制点，格式: [[x1,y1], [x2,y2], ...]'),
  pressures: z.array(z.number()).optional().describe('自由绘制压力数组'),
  startArrowhead: z.string().optional().describe('起始箭头样式'),
  endArrowhead: z.string().optional().describe('结束箭头样式'),
  startBinding: z
    .object({
      elementId: z.string(),
      focus: z.number().optional(),
      gap: z.number().optional(),
    })
    .optional()
    .describe('起始点绑定信息'),
  endBinding: z
    .object({
      elementId: z.string(),
      focus: z.number().optional(),
      gap: z.number().optional(),
    })
    .optional()
    .describe('结束点绑定信息'),
  roundness: z
    .object({
      type: z.number(),
      value: z.number().optional(),
    })
    .optional()
    .describe('圆角信息'),
  link: z.string().optional().describe('超链接'),
  locked: z.boolean().optional().describe('是否锁定'),
  groupIds: z.array(z.string()).optional().describe('分组 ID 列表'),
  containerId: z.string().nullable().optional().describe('所属容器 ID (用于文本绑定)'),
  frameId: z.string().nullable().optional().describe('所属 frameId'),
  fileId: z.string().nullable().optional().describe('图片文件 ID'),
  status: z.enum(['pending', 'saved', 'error']).optional().describe('图片状态'),
  scale: z.array(z.number()).optional().describe('图片缩放，格式: [scaleX, scaleY]'),
  crop: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
      naturalWidth: z.number(),
      naturalHeight: z.number(),
    })
    .optional()
    .describe('图片裁剪信息'),
  name: z.string().nullable().optional().describe('frame 名称'),
  customData: z.record(z.any()).optional().describe('自定义数据'),
})

/**
 * 批量添加 Excalidraw 元素到画布
 */
export function registerAddElements(server: McpServer): void {
  server.registerTool(
    'add_elements',
    {
      description:
        '批量添加 Excalidraw 元素到画布。\n\n' +
        '支持的元素类型:\n' +
        '- rectangle: 矩形\n' +
        '- ellipse: 椭圆\n' +
        '- diamond: 菱形\n' +
        '- arrow: 箭头\n' +
        '- text: 文本\n' +
        '- line: 线条\n' +
        '- freedraw: 自由绘制\n' +
        '- image: 图片\n' +
        '- frame/magicframe: 框架\n' +
        '- iframe/embeddable: 嵌入内容\n\n' +
        '样式选项:\n' +
        '- strokeColor: 边框颜色 (如 #1e1e1e)\n' +
        '- backgroundColor: 背景颜色 (如 #D97706)\n' +
        '- fillStyle: 填充样式 (solid/hachure/cross-hatch)\n' +
        '- strokeWidth: 线条宽度 (1-4)\n' +
        '- roughness: 粗糙度 (0=平滑, 1=轻微手绘, 2=强手绘)\n\n' +
        '多会话支持：通过 sessionId 指定要操作的会话。',
      inputSchema: z.object({
        sessionId: z.string().optional().describe('会话 ID，不指定则使用默认会话'),
        elements: z.array(ExcalidrawElementSchema).describe('要添加的元素数组'),
      }),
    },
    async ({ sessionId, elements }) => {
      try {
        const session = getSession(sessionId)

        // 转换为完整的 Excalidraw 元素格式
        const newElements = elements.map((el) => createExcalidrawElement(el))

        // 自动处理双向绑定：如果 text 元素有 containerId，则将其 ID 添加到容器的 boundElements 中
        newElements.forEach((el) => {
          if (el.type === 'text' && (el as any).containerId) {
            const containerId = (el as any).containerId
            const container = newElements.find((e) => e.id === containerId)
            if (container) {
              const bound = (container.boundElements || []) as any[]
              bound.push({ type: 'text', id: el.id })
              container.boundElements = bound as any
            }
          }
        })

        // 更新状态
        session.elements.push(...newElements)
        session.version++
        updateSession(session)

        // 广播到同一会话的浏览器
        broadcastToSession(session.id, {
          type: 'update',
          elements: session.elements,
          appState: session.appState,
        })

        return {
          content: [
            {
              type: 'text',
              text:
                `✅ 成功添加 ${elements.length} 个元素到会话 "${session.id}"！\n\n` +
                `元素 IDs: ${newElements.map((e) => e.id).join(', ')}`,
            },
          ],
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text', text: `Error: ${message}` }],
          isError: true,
        }
      }
    },
  )
}

// 将 number[][] 转换为 [number, number][] 元组格式
function toPointTuples(points: number[][] | undefined): [number, number][] {
  if (!points) return []
  return points.map((p) => [p[0] ?? 0, p[1] ?? 0] as [number, number])
}

// 将 number[] 转换为 [number, number] 元组格式
function toScaleTuple(scale: number[] | undefined): [number, number] {
  if (!scale) return [1, 1]
  return [scale[0] ?? 1, scale[1] ?? 1]
}

// 创建完整的 Excalidraw 元素
function createExcalidrawElement(input: z.infer<typeof ExcalidrawElementSchema>) {
  const id = input.id || crypto.randomUUID()
  const now = Date.now()
  // 默认尺寸逻辑：文本元素根据内容估算，其他元素默认为 100
  let defaultWidth = 100
  let defaultHeight = 100

  if (input.type === 'text' && input.text) {
    const fontSize = input.fontSize || 20
    // 估算公式：字符数 * 字号 * 0.6 (平均宽高比) + 10px buffer
    defaultWidth = input.text.length * fontSize * 0.6 + 10
    defaultHeight = fontSize * 1.25
  }

  const width = input.width || defaultWidth
  const height = input.height || defaultHeight

  const base = {
    id,
    type: input.type,
    x: input.x,
    y: input.y,
    width,
    height,
    angle: 0,
    strokeColor: input.strokeColor || '#1e1e1e',
    backgroundColor: input.backgroundColor || 'transparent',
    fillStyle: input.fillStyle || 'solid',
    strokeWidth: input.strokeWidth || 2,
    strokeStyle: input.strokeStyle || 'solid',
    roundness: input.roundness || null,
    roughness: input.roughness ?? 1,
    opacity: 100,
    seed: Math.floor(Math.random() * 100000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 100000),
    index: null,
    isDeleted: false,
    groupIds: input.groupIds || [],
    frameId: input.frameId ?? null,
    boundElements: null,
    updated: now,
    link: input.link ?? null,
    locked: input.locked ?? false,
    customData: input.customData,
  }

  if (input.type === 'text') {
    const text = input.text || ''
    return {
      ...base,
      text,
      fontSize: input.fontSize || 20,
      fontFamily: 1,
      textAlign: input.textAlign || 'center',
      verticalAlign: input.verticalAlign || 'middle',
      containerId: input.containerId ?? null,
      originalText: text,
      autoResize: true,
      lineHeight: 1.25,
    }
  }

  if (input.type === 'line' || input.type === 'arrow') {
    const points: [number, number][] = input.points
      ? toPointTuples(input.points)
      : [
          [0, 0],
          [width, height],
        ]
    const linear = {
      ...base,
      points,
      lastCommittedPoint: null,
      startBinding: input.startBinding
        ? {
            elementId: input.startBinding.elementId,
            focus: input.startBinding.focus || 0,
            gap: input.startBinding.gap || 1,
          }
        : null,
      endBinding: input.endBinding
        ? {
            elementId: input.endBinding.elementId,
            focus: input.endBinding.focus || 0,
            gap: input.endBinding.gap || 1,
          }
        : null,
      startArrowhead: input.startArrowhead ?? null,
      endArrowhead: input.endArrowhead ?? null,
    }
    if (input.type === 'arrow') {
      return {
        ...linear,
        elbowed: false,
      }
    }
    return linear
  }

  if (input.type === 'freedraw') {
    const points: [number, number][] = input.points
      ? toPointTuples(input.points)
      : [
          [0, 0],
          [width, height],
        ]
    return {
      ...base,
      points,
      pressures: input.pressures || points.map(() => 1),
      simulatePressure: true,
      lastCommittedPoint: null,
    }
  }

  if (input.type === 'image') {
    return {
      ...base,
      fileId: input.fileId ?? null,
      status: input.status || 'pending',
      scale: toScaleTuple(input.scale),
      crop: input.crop || null,
    }
  }

  if (input.type === 'frame' || input.type === 'magicframe') {
    return {
      ...base,
      name: input.name ?? null,
    }
  }

  return base
}
