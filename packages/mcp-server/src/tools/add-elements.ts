import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getSession, updateSession } from '../state.js'
import { broadcastToSession } from '../websocket.js'

// Excalidraw Element Schema
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
    .describe('Type of the element'),
  id: z.string().optional().describe('Element ID'),
  x: z.number().describe('X coordinate'),
  y: z.number().describe('Y coordinate'),
  width: z.number().optional().describe('Width'),
  height: z.number().optional().describe('Height'),
  strokeColor: z.string().optional().describe('Stroke color (e.g., #1e1e1e)'),
  backgroundColor: z.string().optional().describe('Background color (e.g., transparent)'),
  fillStyle: z
    .enum(['solid', 'hachure', 'cross-hatch', 'zigzag'])
    .optional()
    .describe('Fill style'),
  strokeWidth: z.number().optional().describe('Stroke width'),
  strokeStyle: z.enum(['solid', 'dashed', 'dotted']).optional().describe('Stroke style'),
  roughness: z.number().optional().describe('Roughness (0=architect, 1=artist, 2=cartoonist)'),
  text: z.string().optional().describe('Text content (only for text type)'),
  fontSize: z.number().optional().describe('Font size'),
  textAlign: z.enum(['left', 'center', 'right']).optional().describe('Text alignment'),
  verticalAlign: z.enum(['top', 'middle', 'bottom']).optional().describe('Vertical alignment'),
  points: z
    .array(z.array(z.number()))
    .optional()
    .describe('Points for line/freedraw, format: [[x1,y1], [x2,y2], ...]'),
  pressures: z.array(z.number()).optional().describe('Pressures for freedraw'),
  startArrowhead: z.string().optional().describe('Start arrowhead style'),
  endArrowhead: z.string().optional().describe('End arrowhead style'),
  startBinding: z
    .object({
      elementId: z.string(),
      focus: z.number().optional(),
      gap: z.number().optional(),
    })
    .optional()
    .describe('Start point binding info'),
  endBinding: z
    .object({
      elementId: z.string(),
      focus: z.number().optional(),
      gap: z.number().optional(),
    })
    .optional()
    .describe('End point binding info'),
  roundness: z
    .object({
      type: z.number(),
      value: z.number().optional(),
    })
    .optional()
    .describe('Roundness info'),
  link: z.string().optional().describe('Hyperlink'),
  locked: z.boolean().optional().describe('Is locked'),
  groupIds: z.array(z.string()).optional().describe('Group IDs'),
  containerId: z.string().nullable().optional().describe('Container ID (for text binding)'),
  frameId: z.string().nullable().optional().describe('Parent Frame ID'),
  fileId: z.string().nullable().optional().describe('Image file ID'),
  status: z.enum(['pending', 'saved', 'error']).optional().describe('Image status'),
  scale: z.array(z.number()).optional().describe('Image scale, format: [scaleX, scaleY]'),
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
    .describe('Image crop info'),
  name: z.string().nullable().optional().describe('Frame name'),
  customData: z.record(z.any()).optional().describe('Custom data'),
})

/**
 * Batch add Excalidraw elements to canvas
 */
export function registerAddElements(server: McpServer): void {
  server.registerTool(
    'add_elements',
    {
      description:
        'Add multiple Excalidraw elements to the canvas.\n\n' +
        'Supported element types:\n' +
        '- rectangle\n' +
        '- ellipse\n' +
        '- diamond\n' +
        '- arrow\n' +
        '- text\n' +
        '- line\n' +
        '- freedraw\n' +
        '- image\n' +
        '- frame/magicframe\n' +
        '- iframe/embeddable\n\n' +
        'Style options:\n' +
        '- strokeColor: e.g. #1e1e1e\n' +
        '- backgroundColor: e.g. #D97706\n' +
        '- fillStyle: solid/hachure/cross-hatch\n' +
        '- strokeWidth: 1-4\n' +
        '- roughness: 0=architect, 1=artist, 2=cartoonist\n\n' +
        'Multi-session support: Specify sessionId to target a specific session.',
      inputSchema: z.object({
        sessionId: z
          .string()
          .optional()
          .describe('Session ID. If not provided, uses default session.'),
        elements: z.array(ExcalidrawElementSchema).describe('Array of elements to add'),
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
                `✅ Successfully added ${elements.length} elements to session "${session.id}"!\n\n` +
                `Element IDs: ${newElements.map((e) => e.id).join(', ')}`,
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
