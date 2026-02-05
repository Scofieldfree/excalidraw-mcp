import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { createSession, getSession, updateSession, deleteSession } from '../state.js'
import { broadcastToSession } from '../websocket.js'
import { log } from '../logger.js'

/**
 * 创建新图表
 * 支持创建新会话或清空现有会话
 */
export function registerCreateDiagram(server: McpServer): void {
  server.registerTool(
    'create_diagram',
    {
      description:
        '创建新图表或清空现有会话。\n\n' +
        '此操作将：\n' +
        '1. 如果指定 sessionId，清空该会话的所有元素\n' +
        '2. 如果不指定 sessionId，创建一个新会话\n' +
        '3. 重置应用程序状态\n\n' +
        '使用场景：\n' +
        '• 开始新项目时（不指定 sessionId）\n' +
        '• 需要清除现有图表时（指定 sessionId）\n' +
        '• 创建多个独立图表时（每次指定不同的 sessionId）',
      inputSchema: z.object({
        sessionId: z
          .string()
          .optional()
          .describe('会话 ID。不指定则自动生成新会话。指定现有 ID 则清空该会话。'),
        viewBackgroundColor: z.string().optional().describe('画布背景颜色 (默认: #ffffff)'),
      }),
    },
    async ({ sessionId, viewBackgroundColor }) => {
      try {
        let session

        // 如果指定了 sessionId，尝试获取或创建
        if (sessionId) {
          // 先尝试获取现有会话，如果存在则清空
          try {
            session = getSession(sessionId, false) // 不自动创建
            // 清空元素
            session.elements = []
            session.version++
          } catch {
            // 不存在，创建新的
            session = createSession(sessionId)
          }
        } else {
          // 创建全新会话
          session = createSession()
        }

        // 设置背景颜色
        if (viewBackgroundColor) {
          session.appState.viewBackgroundColor = viewBackgroundColor
        }

        updateSession(session)

        // 广播更新到同一会话的客户端
        broadcastToSession(session.id, {
          type: 'update',
          elements: session.elements,
          appState: session.appState,
        })

        log.info(`Created/reset diagram, session: ${session.id}`)

        return {
          content: [
            {
              type: 'text',
              text:
                `✅ 图表已创建/重置！\n\n` +
                `Session ID: ${session.id}\n` +
                `背景颜色: ${session.appState.viewBackgroundColor}\n` +
                `元素数量: ${session.elements.length}\n\n` +
                `可以使用 add_elements 工具添加元素（记得传入 sessionId: "${session.id}"）。`,
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

  // 注册删除会话的工具
  server.registerTool(
    'delete_diagram',
    {
      description:
        '删除指定的图表会话。\n\n' +
        '注意：这会完全删除会话及其所有元素，不可恢复。\n' +
        '如果只是想清空元素而保留会话，请使用 create_diagram 并指定 sessionId。',
      inputSchema: z.object({
        sessionId: z.string().describe('要删除的会话 ID'),
      }),
    },
    async ({ sessionId }) => {
      try {
        const deleted = deleteSession(sessionId)

        if (!deleted) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ 未找到会话: ${sessionId}`,
              },
            ],
            isError: true,
          }
        }

        log.info(`Deleted session: ${sessionId}`)

        return {
          content: [
            {
              type: 'text',
              text: `✅ 会话已删除: ${sessionId}`,
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
