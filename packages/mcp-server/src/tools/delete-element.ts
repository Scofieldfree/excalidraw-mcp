import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getSession, updateSession } from '../state.js'
import { broadcastToSession } from '../websocket.js'

/**
 * 删除指定元素
 */
export function registerDeleteElement(server: McpServer): void {
  server.registerTool(
    'delete_element',
    {
      description:
        '从画布中删除指定元素。\n\n' +
        '使用场景:\n' +
        '- 移除不需要的元素\n' +
        '- 清理临时元素\n' +
        '- 删除错误添加的元素\n\n' +
        '多会话支持：通过 sessionId 指定要操作的会话。',
      inputSchema: z.object({
        sessionId: z.string().optional().describe('会话 ID，不指定则使用默认会话'),
        id: z.string().describe('要删除的元素 ID'),
      }),
    },
    async ({ sessionId, id }) => {
      try {
        const session = getSession(sessionId)
        const index = session.elements.findIndex((el) => el.id === id)

        if (index === -1) {
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

        // 标记为删除 (index 已确认为 >= 0)
        const deletedElement = session.elements[index]!
        deletedElement.isDeleted = true
        deletedElement.updated = Date.now()

        // 更新会话
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
                `✅ 元素已删除: ${id} (会话: ${session.id})\n\n` +
                `元素类型: ${deletedElement.type}`,
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
