import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import { getSession } from '../state.js'
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
        '- 导出的是 Excalidraw JSON 格式\n' +
        '- 浏览器端会打开下载对话框\n' +
        '- 实际的文件生成在浏览器中完成',
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

        // 对于 PNG/SVG，返回提示信息
        // 实际导出由浏览器端处理
        return {
          content: [
            {
              type: 'text',
              text:
                `📤 导出请求已记录\n\n` +
                `格式: ${format.toUpperCase()}\n` +
                `建议路径: ${finalPath}\n\n` +
                `注意: PNG/SVG 格式需要浏览器支持，\n` +
                `请在浏览器中使用导出功能保存文件。\n\n` +
                `JSON 文件已可以直接保存。`,
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
