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
        'Update attributes of an existing element.\n\n' +
        'Updatable attributes:\n' +
        '- x, y: Position coordinates\n' +
        '- width, height: Dimensions\n' +
        '- strokeColor: Stroke color\n' +
        '- backgroundColor: Background color\n' +
        '- fillStyle: Fill style\n' +
        '- strokeWidth: Stroke width\n' +
        '- roughness: Roughness\n' +
        '- opacity: Opacity\n' +
        '- text: Text content (only for text type)\n\n' +
        'Multi-session support: Specify sessionId to target a specific session.',
      inputSchema: z.object({
        sessionId: z
          .string()
          .optional()
          .describe('Session ID. If not provided, uses default session.'),
        id: z.string().describe('Element ID to update'),
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
          .describe('Attributes to update'),
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
                text: `❌ Element not found: ${id} (Session: ${session.id})`,
              },
            ],
            isError: true,
          }
        }

        // 更新元素属性
        Object.assign(element, updates)
        element.updated = Date.now()
        element.version = (element.version ?? 0) + 1

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
                `✅ Element updated: ${id} (Session: ${session.id})\n\n` +
                `Updated attributes: ${Object.keys(updates).join(', ')}`,
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
