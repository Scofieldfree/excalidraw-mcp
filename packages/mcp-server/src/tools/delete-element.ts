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
        'Delete a specific element from the canvas.\n\n' +
        'Usage scenarios:\n' +
        '- Remove unwanted elements\n' +
        '- Clean up temporary elements\n' +
        '- Delete erroneously added elements\n\n' +
        'Multi-session support: Specify sessionId to target a specific session.',
      inputSchema: z.object({
        sessionId: z
          .string()
          .optional()
          .describe('Session ID. If not provided, uses default session.'),
        id: z.string().describe('Element ID to delete'),
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
                text: `❌ Element not found: ${id} (Session: ${session.id})`,
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
                `✅ Element deleted: ${id} (Session: ${session.id})\n\n` +
                `Element Type: ${deletedElement.type}`,
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
