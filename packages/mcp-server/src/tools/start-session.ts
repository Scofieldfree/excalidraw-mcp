import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import open from 'open'
import { getSession, listSessions } from '../state.js'
import { getServerPort } from '../http-server.js'
import { log } from '../logger.js'

/**
 * 启动浏览器预览会话
 * 打开 Excalidraw 界面并建立 WebSocket 连接
 * 支持多会话：可以指定 sessionId 或自动创建
 */
export function registerStartSession(server: McpServer): void {
  server.registerTool(
    'start_session',
    {
      description:
        '启动浏览器预览，打开 Excalidraw 图表编辑界面。\n\n' +
        '支持多会话模式：\n' +
        '- 不指定 sessionId：使用默认会话 (default)\n' +
        '- 指定 sessionId：打开/创建指定会话\n' +
        '- 可同时打开多个会话绘制不同的图\n\n' +
        '调用此工具后：\n' +
        '1. 浏览器窗口将自动打开\n' +
        '2. 加载 Excalidraw 编辑器\n' +
        '3. 建立 WebSocket 实时同步连接\n\n' +
        '后续使用 add_elements、update_element 等工具时，请传入相同的 sessionId。',
      inputSchema: z.object({
        sessionId: z
          .string()
          .optional()
          .describe('会话 ID。不指定则使用默认会话。支持同时打开多个会话。'),
      }),
    },
    async ({ sessionId }) => {
      try {
        // 获取或创建会话
        const session = getSession(sessionId)
        const port = getServerPort() || parseInt(process.env.PORT || '3100', 10)
        const hostEnv = process.env.HOST || process.env.BIND || 'localhost'
        const host = hostEnv === '0.0.0.0' || hostEnv === '::' ? 'localhost' : hostEnv

        // URL 中携带 sessionId 参数
        const url = `http://${host}:${port}?sessionId=${encodeURIComponent(session.id)}`

        log.info(`Opening browser at ${url}`)

        // 打开浏览器
        await open(url, { wait: false })

        // 获取当前所有会话
        const allSessions = listSessions()
        const sessionList = allSessions
          .map((s) => `  - ${s.id} (${s.elementCount} elements)`)
          .join('\n')

        return {
          content: [
            {
              type: 'text',
              text:
                `✅ Session started!\n\n` +
                `浏览器已打开: ${url}\n` +
                `Session ID: ${session.id}\n\n` +
                `当前活跃会话:\n${sessionList}\n\n` +
                `现在可以使用以下工具来操作图表（记得传入 sessionId）：\n` +
                `• add_elements - 添加元素\n` +
                `• update_element - 更新元素\n` +
                `• delete_element - 删除元素\n` +
                `• get_scene - 获取当前场景\n` +
                `• export_diagram - 导出图表`,
            },
          ],
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text', text: `Error opening browser: ${message}` }],
          isError: true,
        }
      }
    },
  )

  // 注册列出会话的工具
  server.registerTool(
    'list_sessions',
    {
      description: '列出当前所有活跃的 Excalidraw 会话。',
      inputSchema: z.object({}),
    },
    async () => {
      const sessions = listSessions()

      if (sessions.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: '当前没有活跃的会话。使用 start_session 创建一个新会话。',
            },
          ],
        }
      }

      const list = sessions
        .map(
          (s) =>
            `- **${s.id}**: ${s.elementCount} elements (last updated: ${s.lastUpdated.toISOString()})`,
        )
        .join('\n')

      return {
        content: [
          {
            type: 'text',
            text: `当前活跃会话 (${sessions.length} 个):\n\n${list}`,
          },
        ],
      }
    },
  )
}
