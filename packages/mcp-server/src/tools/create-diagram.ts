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
        'Create a new diagram or clear an existing session.\n\n' +
        'This action will:\n' +
        '1. If a sessionId is specified, clear all elements in that session.\n' +
        '2. If no sessionId is specified, create a new session.\n' +
        '3. Reset the application state.\n\n' +
        'Usage scenarios:\n' +
        '• Starting a new project (no sessionId specified)\n' +
        '• Clearing an existing diagram (sessionId specified)\n' +
        '• Creating multiple independent diagrams (specify different sessionIds each time)',
      inputSchema: z.object({
        sessionId: z
          .string()
          .optional()
          .describe(
            'Session ID. If not specified, a new session is automatically generated. If an existing ID is specified, that session is cleared.',
          ),
        viewBackgroundColor: z
          .string()
          .optional()
          .describe('Canvas background color (default: #ffffff)'),
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
                `✅ Diagram created/reset!\n\n` +
                `Session ID: ${session.id}\n` +
                `Background Color: ${session.appState.viewBackgroundColor}\n` +
                `Element Count: ${session.elements.length}\n\n` +
                `You can use the add_elements tool to add elements (remember to pass sessionId: "${session.id}").`,
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
        'Delete the specified diagram session.\n\n' +
        'Note: This will completely delete the session and all its elements, and cannot be undone.\n' +
        'If you only want to clear elements but keep the session, use create_diagram and specify the sessionId.',
      inputSchema: z.object({
        sessionId: z.string().describe('The Session ID to delete'),
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
                text: `❌ Session not found: ${sessionId}`,
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
              text: `✅ Session deleted: ${sessionId}`,
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
