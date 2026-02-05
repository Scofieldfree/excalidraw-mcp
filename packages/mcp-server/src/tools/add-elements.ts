import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getSession, updateSession } from '../state.js'
import { broadcast } from '../websocket.js'

// Excalidraw 元素 Schema
const ExcalidrawElementSchema = z.object({
  type: z
    .enum(['rectangle', 'ellipse', 'diamond', 'arrow', 'text', 'line', 'freedraw'])
    .describe('元素类型'),
  x: z.number().describe('X 坐标'),
  y: z.number().describe('Y 坐标'),
  width: z.number().optional().describe('宽度'),
  height: z.number().optional().describe('高度'),
  strokeColor: z.string().optional().describe('边框颜色'),
  backgroundColor: z.string().optional().describe('背景颜色'),
  fillStyle: z.enum(['solid', 'hachure', 'cross-hatch']).optional().describe('填充样式'),
  strokeWidth: z.number().optional().describe('线条宽度'),
  roughness: z.number().optional().describe('粗糙度 (0=平滑, 1=轻微手绘, 2=强手绘)'),
  text: z.string().optional().describe('文本内容 (仅 text 类型)'),
  fontSize: z.number().optional().describe('字体大小'),
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
        '- freedraw: 自由绘制\n\n' +
        '样式选项:\n' +
        '- strokeColor: 边框颜色 (如 #1e1e1e)\n' +
        '- backgroundColor: 背景颜色 (如 #D97706)\n' +
        '- fillStyle: 填充样式 (solid/hachure/cross-hatch)\n' +
        '- strokeWidth: 线条宽度 (1-4)\n' +
        '- roughness: 粗糙度 (0=平滑, 1=轻微手绘, 2=强手绘)',
      inputSchema: z.object({
        elements: z.array(ExcalidrawElementSchema).describe('要添加的元素数组'),
      }),
    },
    async ({ elements }) => {
      try {
        const session = getSession()

        // 转换为完整的 Excalidraw 元素格式
        const newElements = elements.map((el) => createExcalidrawElement(el))

        // 更新状态
        session.elements.push(...newElements)
        session.version++
        updateSession(session)

        // 广播到浏览器
        broadcast({
          type: 'update',
          elements: session.elements,
          appState: session.appState,
        })

        return {
          content: [
            {
              type: 'text',
              text:
                `✅ 成功添加 ${elements.length} 个元素！\n\n` +
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

// 创建完整的 Excalidraw 元素
function createExcalidrawElement(input: z.infer<typeof ExcalidrawElementSchema>) {
  const id = crypto.randomUUID()
  const now = Date.now()

  return {
    id,
    type: input.type,
    x: input.x,
    y: input.y,
    width: input.width || 100,
    height: input.height || 100,
    angle: 0,
    strokeColor: input.strokeColor || '#1e1e1e',
    backgroundColor: input.backgroundColor || 'transparent',
    fillStyle: input.fillStyle || 'solid',
    strokeWidth: input.strokeWidth || 2,
    strokeStyle: 'solid',
    roughness: input.roughness ?? 1,
    opacity: 100,
    seed: Math.floor(Math.random() * 100000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 100000),
    isDeleted: false,
    groupIds: [],
    boundElements: null,
    updated: now,
    link: null,
    locked: false,
    // 文本特有属性
    ...(input.type === 'text' && {
      text: input.text || '',
      fontSize: input.fontSize || 20,
      fontFamily: 1,
      textAlign: 'center',
      verticalAlign: 'middle',
    }),
  }
}
