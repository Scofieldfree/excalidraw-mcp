import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getSession, updateSession } from '../state.js'
import { broadcastToSession } from '../websocket.js'

/**
 * 更新单个元素的属性
 */
export function registerUpdateElement(server: McpServer): void {
  server.registerTool(
    'update_element',
    {
      description:
        '更新已存在元素的属性。\n\n' +
        '可更新的属性:\n' +
        '- x, y: 位置坐标\n' +
        '- width, height: 尺寸\n' +
        '- strokeColor: 边框颜色\n' +
        '- backgroundColor: 背景颜色\n' +
        '- fillStyle: 填充样式\n' +
        '- strokeWidth: 线条宽度\n' +
        '- roughness: 粗糙度\n' +
        '- opacity: 透明度\n' +
        '- text: 文本内容 (仅 text 类型)\n\n' +
        '多会话支持：通过 sessionId 指定要操作的会话。',
      inputSchema: z.object({
        sessionId: z.string().optional().describe('会话 ID，不指定则使用默认会话'),
        id: z.string().describe('要更新的元素 ID'),
        updates: z
          .object({
            x: z.number().optional(),
            y: z.number().optional(),
            width: z.number().optional(),
            height: z.number().optional(),
            strokeColor: z.string().optional(),
            backgroundColor: z.string().optional(),
            fillStyle: z.enum(['solid', 'hachure', 'cross-hatch']).optional(),
            strokeWidth: z.number().optional(),
            strokeStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
            roughness: z.number().optional(),
            opacity: z.number().optional(),
            text: z.string().optional(),
            fontSize: z.number().optional(),
            roundness: z
              .object({
                type: z.number(),
                value: z.number().optional(),
              })
              .optional(),
            points: z.array(z.array(z.number())).optional(),
            startBinding: z
              .object({
                elementId: z.string(),
                focus: z.number(),
                gap: z.number(),
              })
              .optional(),
            endBinding: z
              .object({
                elementId: z.string(),
                focus: z.number(),
                gap: z.number(),
              })
              .optional(),
          })
          .describe('要更新的属性'),
      }),
    },
    async ({ sessionId, id, updates }) => {
      try {
        const session = getSession(sessionId)
        const element = session.elements.find((el) => el.id === id)

        if (!element) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ 未找到元素: ${id} (会话: ${session.id})`,
              },
            ],
            isError: true,
          }
        }

        // 更新元素属性
        Object.assign(element, updates)
        element.updated = Date.now()
        element.version++

        // 更新会话
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
                `✅ 元素已更新: ${id} (会话: ${session.id})\n\n` +
                `更新的属性: ${Object.keys(updates).join(', ')}`,
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
