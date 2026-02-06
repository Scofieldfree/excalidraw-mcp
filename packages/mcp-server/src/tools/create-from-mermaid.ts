import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getSession } from '../state.js'
import { requestMermaidConversion } from '../websocket.js'

/**
 * Create Excalidraw scene elements from Mermaid definition (phase 1 skeleton).
 * Current phase only establishes the protocol and request lifecycle.
 */
export function registerCreateFromMermaid(server: McpServer): void {
  server.registerTool(
    'create_from_mermaid',
    {
      description:
        'Create diagram elements from Mermaid syntax.\n\n' +
        'Converts Mermaid text to Excalidraw elements through connected browser client.\n' +
        'If browser is not connected yet, request is queued and sent after websocket ready.\n' +
        'Returns clear errors for timeout and mermaid syntax problems.',
      inputSchema: z.object({
        sessionId: z
          .string()
          .optional()
          .describe('Session ID. If not provided, uses default session.'),
        mermaidDiagram: z
          .string()
          .min(1)
          .max(100000)
          .describe('Mermaid diagram text, e.g. "graph TD; A-->B; B-->C;"'),
        reset: z
          .boolean()
          .optional()
          .default(false)
          .describe('Whether to reset the current canvas before applying Mermaid result.'),
      }),
    },
    async ({ sessionId, mermaidDiagram, reset }) => {
      try {
        const session = getSession(sessionId)
        const result = await requestMermaidConversion({
          sessionId: session.id,
          mermaidDiagram,
          reset,
          timeoutMs: 30000,
        })

        return {
          content: [
            {
              type: 'text',
              text:
                `✅ Mermaid conversion request completed.\n\n` +
                `Session ID: ${result.sessionId}\n` +
                `Elements in scene: ${result.elementCount}\n` +
                `Reset mode: ${Boolean(reset)}`,
            },
          ],
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const userMessage = /timed out/i.test(message)
          ? `Mermaid conversion timeout: ${message}`
          : /syntax error|mermaid syntax|parse/i.test(message)
            ? `Mermaid syntax error: ${message}`
            : message
        return {
          content: [{ type: 'text', text: `Error: ${userMessage}` }],
          isError: true,
        }
      }
    },
  )
}
