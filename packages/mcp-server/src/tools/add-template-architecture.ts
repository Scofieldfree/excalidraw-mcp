import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getSession, updateSession } from '../state.js'
import { enqueueSkeletonBatch } from '../websocket.js'

const TEMPLATE_ELEMENTS: Array<Record<string, unknown>> = [
  {
    id: 'g_agent',
    type: 'rectangle',
    x: 500,
    y: 40,
    width: 260,
    height: 90,
    strokeStyle: 'dashed',
    strokeColor: '#1d4ed8',
    backgroundColor: 'transparent',
    label: { text: 'AI Agent (Client)', verticalAlign: 'top' },
  },
  {
    id: 'agent',
    type: 'rectangle',
    x: 535,
    y: 80,
    width: 190,
    height: 40,
    strokeColor: '#1e40af',
    backgroundColor: '#dbeafe',
    label: { text: 'Claude / Cursor' },
  },
  {
    id: 'g_server',
    type: 'rectangle',
    x: 160,
    y: 180,
    width: 900,
    height: 700,
    strokeStyle: 'dashed',
    strokeColor: '#334155',
    backgroundColor: 'transparent',
    label: { text: 'Excalidraw MCP Server', verticalAlign: 'top' },
  },
  {
    id: 'entry',
    type: 'rectangle',
    x: 530,
    y: 240,
    width: 170,
    height: 60,
    strokeColor: '#334155',
    backgroundColor: '#ffffff',
    label: { text: 'Main Entry\nsrc/index.ts' },
  },
  {
    id: 'g_protocol',
    type: 'rectangle',
    x: 210,
    y: 320,
    width: 260,
    height: 150,
    strokeStyle: 'dotted',
    strokeColor: '#7c3aed',
    backgroundColor: '#f5f3ff',
    label: { text: 'Protocol Layer', verticalAlign: 'top' },
  },
  {
    id: 'mcp_trans',
    type: 'rectangle',
    x: 255,
    y: 370,
    width: 170,
    height: 55,
    strokeColor: '#7c3aed',
    backgroundColor: '#ede9fe',
    label: { text: 'Stdio Transport' },
  },
  {
    id: 'g_logic',
    type: 'rectangle',
    x: 510,
    y: 320,
    width: 390,
    height: 230,
    strokeStyle: 'dotted',
    strokeColor: '#2563eb',
    backgroundColor: '#eff6ff',
    label: { text: 'Logic Layer (Tools)', verticalAlign: 'top' },
  },
  {
    id: 'router',
    type: 'rectangle',
    x: 625,
    y: 370,
    width: 160,
    height: 55,
    strokeColor: '#2563eb',
    backgroundColor: '#dbeafe',
    label: { text: 'Tool Router' },
  },
  {
    id: 'tool_add',
    type: 'rectangle',
    x: 545,
    y: 450,
    width: 145,
    height: 55,
    strokeColor: '#2563eb',
    backgroundColor: '#dbeafe',
    label: { text: 'add-elements.ts' },
  },
  {
    id: 'tool_update',
    type: 'rectangle',
    x: 720,
    y: 450,
    width: 155,
    height: 55,
    strokeColor: '#2563eb',
    backgroundColor: '#dbeafe',
    label: { text: 'update-element.ts' },
  },
  {
    id: 'g_data',
    type: 'rectangle',
    x: 430,
    y: 580,
    width: 300,
    height: 130,
    strokeStyle: 'dotted',
    strokeColor: '#d97706',
    backgroundColor: '#fffbeb',
    label: { text: 'Data Layer', verticalAlign: 'top' },
  },
  {
    id: 'state_store',
    type: 'rectangle',
    x: 465,
    y: 630,
    width: 230,
    height: 60,
    strokeColor: '#d97706',
    backgroundColor: '#fef3c7',
    label: { text: 'In-Memory Session Store\nsrc/state.ts' },
  },
  {
    id: 'g_viz',
    type: 'rectangle',
    x: 370,
    y: 740,
    width: 430,
    height: 150,
    strokeStyle: 'dotted',
    strokeColor: '#059669',
    backgroundColor: '#ecfdf5',
    label: { text: 'Visualization Layer', verticalAlign: 'top' },
  },
  {
    id: 'ws',
    type: 'rectangle',
    x: 410,
    y: 790,
    width: 160,
    height: 60,
    strokeColor: '#059669',
    backgroundColor: '#d1fae5',
    label: { text: 'WebSocket Server' },
  },
  {
    id: 'http',
    type: 'rectangle',
    x: 610,
    y: 790,
    width: 160,
    height: 60,
    strokeColor: '#059669',
    backgroundColor: '#d1fae5',
    label: { text: 'HTTP Server\nsrc/http-server.ts' },
  },
  {
    id: 'g_browser',
    type: 'rectangle',
    x: 510,
    y: 930,
    width: 240,
    height: 100,
    strokeStyle: 'dashed',
    strokeColor: '#1d4ed8',
    backgroundColor: 'transparent',
    label: { text: 'User Browser', verticalAlign: 'top' },
  },
  {
    id: 'webui',
    type: 'rectangle',
    x: 545,
    y: 970,
    width: 170,
    height: 45,
    strokeColor: '#1d4ed8',
    backgroundColor: '#dbeafe',
    label: { text: 'Excalidraw Web UI' },
  },
  {
    type: 'arrow',
    id: 'a1',
    x: 0,
    y: 0,
    strokeColor: '#0f172a',
    strokeWidth: 3,
    roughness: 0,
    endArrowhead: 'arrow',
    start: { id: 'agent' },
    end: { id: 'mcp_trans' },
    label: { text: 'MCP Request (JSON-RPC)', fontSize: 18, strokeColor: '#0f172a' },
  },
  {
    type: 'arrow',
    id: 'a2',
    x: 0,
    y: 0,
    strokeColor: '#0f172a',
    strokeWidth: 3,
    roughness: 0,
    endArrowhead: 'arrow',
    start: { id: 'mcp_trans' },
    end: { id: 'entry' },
  },
  {
    type: 'arrow',
    id: 'a3',
    x: 0,
    y: 0,
    strokeColor: '#0f172a',
    strokeWidth: 3,
    roughness: 0,
    endArrowhead: 'arrow',
    start: { id: 'entry' },
    end: { id: 'router' },
  },
  {
    type: 'arrow',
    id: 'a4',
    x: 0,
    y: 0,
    strokeColor: '#0f172a',
    strokeWidth: 3,
    roughness: 0,
    endArrowhead: 'arrow',
    start: { id: 'router' },
    end: { id: 'tool_add' },
  },
  {
    type: 'arrow',
    id: 'a5',
    x: 0,
    y: 0,
    strokeColor: '#0f172a',
    strokeWidth: 3,
    roughness: 0,
    endArrowhead: 'arrow',
    start: { id: 'tool_add' },
    end: { id: 'state_store' },
    label: { text: 'Zod Validate', fontSize: 18, strokeColor: '#0f172a' },
  },
  {
    type: 'arrow',
    id: 'a6',
    x: 0,
    y: 0,
    strokeColor: '#0f172a',
    strokeWidth: 3,
    roughness: 0,
    endArrowhead: 'arrow',
    start: { id: 'state_store' },
    end: { id: 'ws' },
    label: { text: 'Updates', fontSize: 18, strokeColor: '#0f172a' },
  },
  {
    type: 'arrow',
    id: 'a7',
    x: 0,
    y: 0,
    strokeColor: '#0f172a',
    strokeWidth: 3,
    roughness: 0,
    endArrowhead: 'arrow',
    start: { id: 'ws' },
    end: { id: 'webui' },
    label: { text: 'WebSocket Push', fontSize: 18, strokeColor: '#0f172a' },
  },
  {
    type: 'arrow',
    id: 'a8',
    x: 0,
    y: 0,
    strokeColor: '#0f172a',
    strokeWidth: 3,
    roughness: 0,
    endArrowhead: 'arrow',
    start: { id: 'webui' },
    end: { id: 'http' },
    label: { text: 'Load Assets', fontSize: 18, strokeColor: '#0f172a' },
  },
]

export function registerAddTemplateArchitecture(server: McpServer): void {
  server.registerTool(
    'add_template_architecture',
    {
      description:
        'Add a built-in architecture diagram template to the canvas.\n\n' +
        'This template visualizes the MCP server architecture with grouped layers and connected arrows.\n' +
        'By default it resets the current session before adding template elements.',
      inputSchema: z.object({
        sessionId: z
          .string()
          .optional()
          .describe('Session ID. If not provided, uses default session.'),
        reset: z
          .boolean()
          .optional()
          .default(true)
          .describe('Whether to clear existing elements before adding the template. Default: true'),
      }),
    },
    async ({ sessionId, reset = true }) => {
      try {
        const session = getSession(sessionId)
        const skeletons = structuredClone(TEMPLATE_ELEMENTS)

        if (reset) {
          session.elements = []
        }

        session.elements.push(...(skeletons as any))
        session.version++
        updateSession(session)

        const batchId = enqueueSkeletonBatch(session.id, skeletons, session.appState)
        const ids = skeletons
          .map((el) => (typeof el.id === 'string' ? el.id : null))
          .filter((id): id is string => Boolean(id))

        return {
          content: [
            {
              type: 'text',
              text:
                `✅ Architecture template added to session "${session.id}".\n\n` +
                `Elements: ${ids.length}\n` +
                `Batch ID: ${batchId}\n` +
                `Reset Existing: ${reset ? 'Yes' : 'No'}`,
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
