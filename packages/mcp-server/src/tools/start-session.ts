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
        'Start browser preview and open Excalidraw editor interface.\n\n' +
        'Multi-session support:\n' +
        '- No sessionId: Uses default session (default)\n' +
        '- sessionId specified: Open/Create specific session\n' +
        '- Multiple sessions can be opened simultaneously for different diagrams\n\n' +
        'After calling this tool:\n' +
        '1. Browser window opens automatically\n' +
        '2. Excalidraw editor loads\n' +
        '3. WebSocket realtime connection is established\n\n' +
        'Please pass the same sessionId when using tools like add_elements, update_element subsequently.',
      inputSchema: z.object({
        sessionId: z
          .string()
          .optional()
          .describe(
            'Session ID. If not provided, uses default session. Supports opening multiple sessions.',
          ),
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
                `Browser opened at: ${url}\n` +
                `Session ID: ${session.id}\n\n` +
                `Active Sessions:\n${sessionList}\n\n` +
                `You can now use the following tools (remember to pass sessionId):\n` +
                `• add_elements - Add elements\n` +
                `• update_element - Update elements\n` +
                `• delete_element - Delete elements\n` +
                `• get_scene - Get current scene\n` +
                `• export_diagram - Export diagram`,
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
      description: 'List all currently active Excalidraw sessions.',
      inputSchema: z.object({}),
    },
    async () => {
      const sessions = listSessions()

      if (sessions.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No active sessions. Use start_session to create a new session.',
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
            text: `Active Sessions (${sessions.length}):\n\n${list}`,
          },
        ],
      }
    },
  )
}
