import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getSession } from '../state.js'

/**
 * 获取当前场景
 * 返回所有元素和应用程序状态
 */
export function registerGetScene(server: McpServer): void {
  server.registerTool(
    'get_scene',
    {
      description:
        'Retrieve complete information about the current diagram scene.\n\n' +
        'Returns:\n' +
        '- List of all elements\n' +
        '- Application state\n' +
        '- Version number\n' +
        '- Session ID\n\n' +
        'Usage scenarios:\n' +
        '- Viewing current diagram content\n' +
        '- Analyzing scene structure\n' +
        '- Obtaining element IDs for updates/deletion\n\n' +
        'Multi-session support: Specify sessionId to query a specific session.',
      inputSchema: z.object({
        sessionId: z
          .string()
          .optional()
          .describe('Session ID. If not provided, uses default session.'),
      }),
    },
    async ({ sessionId }) => {
      try {
        const session = getSession(sessionId)

        // 过滤掉已删除的元素
        const activeElements = session.elements.filter((el) => !el.isDeleted)

        // 统计元素类型
        const elementTypes = activeElements.reduce(
          (acc, el) => {
            acc[el.type] = (acc[el.type] || 0) + 1
            return acc
          },
          {} as Record<string, number>,
        )

        return {
          content: [
            {
              type: 'text',
              text:
                `📊 Current Scene Information\n` +
                `═══════════════════\n\n` +
                `Session ID: ${session.id}\n` +
                `Version: ${session.version}\n` +
                `Last Updated: ${session.lastUpdated.toISOString()}\n` +
                `Active Elements: ${activeElements.length}\n` +
                `Total Elements: ${session.elements.length}\n\n` +
                `Element Types:\n${Object.entries(elementTypes)
                  .map(([type, count]) => `  • ${type}: ${count}`)
                  .join('\n')}\n\n` +
                `Canvas Background: ${session.appState.viewBackgroundColor}\n\n` +
                `Active Elements List:\n${activeElements
                  .map(
                    (el) =>
                      `  • [${el.id}] ${el.type} @ (${Math.round(el.x ?? 0)}, ${Math.round(el.y ?? 0)})`,
                  )
                  .join('\n')}`,
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
