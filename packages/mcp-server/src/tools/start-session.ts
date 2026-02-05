import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import open from 'open'
import { getSession } from '../state.js'
import { log } from '../logger.js'

/**
 * 启动浏览器预览会话
 * 打开 Excalidraw 界面并建立 WebSocket 连接
 */
export function registerStartSession(server: McpServer): void {
  server.registerTool(
    'start_session',
    {
      description:
        '启动浏览器预览，打开 Excalidraw 图表编辑界面。\n\n' +
        '调用此工具后：\n' +
        '1. 浏览器窗口将自动打开\n' +
        '2. 加载 Excalidraw 编辑器\n' +
        '3. 建立 WebSocket 实时同步连接\n\n' +
        '后续可以使用 add_elements、update_element 等工具来操作图表。',
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const session = getSession()
        const port = process.env.PORT || '3100'
        const url = `http://localhost:${port}`

        log.info(`Opening browser at ${url}`)

        // 打开浏览器
        await open(url, { wait: false })

        return {
          content: [
            {
              type: 'text',
              text:
                `✅ Session started!\n\n` +
                `浏览器已打开: ${url}\n` +
                `Session ID: ${session.id}\n\n` +
                `现在可以使用以下工具来操作图表：\n` +
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
}
