import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { createSession, updateSession } from '../state.js'
import { broadcast } from '../websocket.js'
import { log } from '../logger.js'

/**
 * 创建新图表
 * 清空当前画布，创建空白图表
 */
export function registerCreateDiagram(server: McpServer): void {
  server.registerTool(
    'create_diagram',
    {
      description:
        '创建新图表。\n\n' +
        '此操作将：\n' +
        '1. 清空当前画布的所有元素\n' +
        '2. 重置应用程序状态\n' +
        '3. 创建全新的空白图表\n\n' +
        '使用场景：\n' +
        '• 开始新项目时\n' +
        '• 需要清除现有图表时',
      inputSchema: z.object({
        viewBackgroundColor: z.string().optional().describe('画布背景颜色 (默认: #ffffff)'),
      }),
    },
    async ({ viewBackgroundColor }) => {
      try {
        // 创建新会话
        const session = createSession()

        // 如果指定了背景颜色，更新它
        if (viewBackgroundColor) {
          session.appState.viewBackgroundColor = viewBackgroundColor
          updateSession(session)
        }

        // 广播更新到所有客户端
        broadcast({
          type: 'update',
          elements: session.elements,
          appState: session.appState,
        })

        log.info(`Created new diagram, session: ${session.id}`)

        return {
          content: [
            {
              type: 'text',
              text:
                `✅ 新图表已创建！\n\n` +
                `Session ID: ${session.id}\n` +
                `背景颜色: ${session.appState.viewBackgroundColor}\n` +
                `元素数量: ${session.elements.length}\n\n` +
                `可以使用 add_elements 工具添加元素。`,
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
