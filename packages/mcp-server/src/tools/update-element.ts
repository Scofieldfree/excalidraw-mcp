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
            label: z
              .object({
                text: z.string(),
                fontSize: z.number().optional(),
                fontFamily: z.number().optional(),
                strokeColor: z.string().optional(),
                textAlign: z.enum(['left', 'center', 'right']).optional(),
                verticalAlign: z.enum(['top', 'middle', 'bottom']).optional(),
              })
              .optional(),
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

        // Normalize text updates on non-text elements to bound label for better alignment.
        const normalizedUpdates: Record<string, unknown> = { ...updates }
        if (element.type !== 'text') {
          const shapeText = typeof updates.text === 'string' ? updates.text : undefined
          const incomingLabel =
            updates.label && typeof updates.label === 'object'
              ? (updates.label as Record<string, unknown>)
              : undefined

          if (incomingLabel || shapeText) {
            const prevLabel =
              element.label && typeof element.label === 'object'
                ? (element.label as Record<string, unknown>)
                : {}
            const nextLabel: Record<string, unknown> = {
              ...prevLabel,
              ...(incomingLabel ?? {}),
            }

            if (shapeText) nextLabel.text = shapeText
            nextLabel.textAlign = (nextLabel.textAlign as string | undefined) ?? 'center'
            nextLabel.verticalAlign = (nextLabel.verticalAlign as string | undefined) ?? 'middle'

            normalizedUpdates.label = nextLabel
            delete normalizedUpdates.text
          }
        }

        // 更新元素属性
        Object.assign(element, normalizedUpdates)
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
                `Updated attributes: ${Object.keys(normalizedUpdates).join(', ')}`,
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
