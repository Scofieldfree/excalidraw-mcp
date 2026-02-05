import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import { getSession } from '../state.js'
import { getClientCount, requestExport } from '../websocket.js'
import { log } from '../logger.js'

/**
 * 导出图表为文件
 */
export function registerExport(server: McpServer): void {
  server.registerTool(
    'export_diagram',
    {
      description:
        '将当前图表导出为 PNG 或 SVG 文件。\n\n' +
        '注意:\n' +
        '- JSON 格式由服务器直接保存\n' +
        '- PNG/SVG 由浏览器生成并回传到服务器保存\n' +
        '- 需要先启动 start_session 并保持浏览器连接',
      inputSchema: z.object({
        path: z.string().describe('保存路径 (包含文件名)'),
        format: z.enum(['png', 'svg', 'json']).default('json').describe('导出格式'),
      }),
    },
    async ({ path: filePath, format }) => {
      try {
        const session = getSession()

        // 确保路径有正确扩展名
        const ext = `.${format}`
        const finalPath = filePath.endsWith(ext) ? filePath : `${filePath}${ext}`

        // 准备导出数据
        const exportData = {
          elements: session.elements,
          appState: session.appState,
          version: session.version,
        }

        // 保存为 JSON (服务器端保存)
        if (format === 'json') {
          // 确保目录存在
          const dir = path.dirname(finalPath)
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
          }

          fs.writeFileSync(finalPath, JSON.stringify(exportData, null, 2))

          log.info(`Exported diagram to ${finalPath}`)

          return {
            content: [
              {
                type: 'text',
                text:
                  `✅ 图表已导出!\n\n` +
                  `路径: ${finalPath}\n` +
                  `格式: ${format.toUpperCase()}\n` +
                  `元素数: ${session.elements.length}`,
              },
            ],
          }
        }

        if (getClientCount() === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ 未检测到浏览器会话，请先调用 start_session。`,
              },
            ],
            isError: true,
          }
        }

        const exportFormat = format === 'png' ? 'png' : 'svg'
        const data = await requestExport({
          format: exportFormat,
          elements: session.elements,
          appState: session.appState,
        })

        const dir = path.dirname(finalPath)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }

        const buffer = Buffer.from(data, 'base64')
        fs.writeFileSync(finalPath, buffer)

        log.info(`Exported diagram to ${finalPath}`)

        return {
          content: [
            {
              type: 'text',
              text:
                `✅ 图表已导出!\n\n` +
                `路径: ${finalPath}\n` +
                `格式: ${format.toUpperCase()}\n` +
                `元素数: ${session.elements.length}`,
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
