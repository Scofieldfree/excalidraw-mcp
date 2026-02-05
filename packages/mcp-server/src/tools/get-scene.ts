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
        '获取当前图表场景的完整信息。\n\n' +
        '返回内容:\n' +
        '- 所有元素列表\n' +
        '- 应用程序状态\n' +
        '- 版本号\n' +
        '- Session ID\n\n' +
        '使用场景:\n' +
        '- 查看当前图表内容\n' +
        '- 分析场景结构\n' +
        '- 获取元素 ID 进行更新/删除',
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const session = getSession()

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
                `📊 当前场景信息\n` +
                `═══════════════════\n\n` +
                `Session ID: ${session.id}\n` +
                `版本号: ${session.version}\n` +
                `活跃元素数: ${activeElements.length}\n` +
                `总元素数: ${session.elements.length}\n\n` +
                `元素类型统计:\n${Object.entries(elementTypes)
                  .map(([type, count]) => `  • ${type}: ${count}`)
                  .join('\n')}\n\n` +
                `画布背景: ${session.appState.viewBackgroundColor}\n\n` +
                `活跃元素列表:\n${activeElements
                  .map(
                    (el) =>
                      `  • [${el.id.slice(0, 8)}] ${el.type} @ (${Math.round(el.x)}, ${Math.round(el.y)})`,
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
