import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getSession, updateSession } from '../state.js'
import { broadcastToSession, waitForSessionClient } from '../websocket.js'

const ArrowEndpointCreateSchema = z.object({
  type: z.enum(['rectangle', 'ellipse', 'diamond', 'text']),
  id: z.string().optional(),
  text: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
})

const ArrowEndpointRefSchema = z.object({
  id: z.string(),
})

// Excalidraw Element Schema
const ExcalidrawElementSchema = z.object({
  type: z
    .enum([
      'rectangle',
      'ellipse',
      'diamond',
      'arrow',
      'text',
      'line',
      'freedraw',
      'image',
      'iframe',
      'embeddable',
      'frame',
      'magicframe',
    ])
    .describe('Type of the element'),
  id: z.string().optional().describe('Element ID'),
  x: z.number().describe('X coordinate'),
  y: z.number().describe('Y coordinate'),
  width: z.number().optional().describe('Width'),
  height: z.number().optional().describe('Height'),
  strokeColor: z.string().optional().describe('Stroke color (e.g., #1e1e1e)'),
  backgroundColor: z.string().optional().describe('Background color (e.g., transparent)'),
  fillStyle: z
    .enum(['solid', 'hachure', 'cross-hatch', 'zigzag'])
    .optional()
    .describe('Fill style'),
  strokeWidth: z.number().optional().describe('Stroke width'),
  strokeStyle: z.enum(['solid', 'dashed', 'dotted']).optional().describe('Stroke style'),
  roughness: z.number().optional().describe('Roughness (0=architect, 1=artist, 2=cartoonist)'),
  opacity: z.number().optional().describe('Opacity'),
  label: z
    .object({
      text: z.string().describe('Label text content'),
      fontSize: z.number().optional(),
      fontFamily: z.number().optional(),
      strokeColor: z.string().optional(),
      textAlign: z.enum(['left', 'center', 'right']).optional(),
      verticalAlign: z.enum(['top', 'middle', 'bottom']).optional(),
    })
    .optional()
    .describe(
      'Text label for shapes (rectangle/ellipse/diamond/arrow). Automatically creates a bound text element in Excalidraw.',
    ),
  text: z.string().optional().describe('Text content (only for text type)'),
  fontSize: z.number().optional().describe('Font size'),
  textAlign: z.enum(['left', 'center', 'right']).optional().describe('Text alignment'),
  verticalAlign: z.enum(['top', 'middle', 'bottom']).optional().describe('Vertical alignment'),
  points: z
    .array(z.array(z.number()))
    .optional()
    .describe('Points for line/freedraw, format: [[x1,y1], [x2,y2], ...]'),
  pressures: z.array(z.number()).optional().describe('Pressures for freedraw'),
  start: z
    .union([ArrowEndpointCreateSchema, ArrowEndpointRefSchema])
    .optional()
    .describe(
      'Start binding for arrows: either create a new shape endpoint or bind to an existing element by ID.',
    ),
  end: z
    .union([ArrowEndpointCreateSchema, ArrowEndpointRefSchema])
    .optional()
    .describe(
      'End binding for arrows: either create a new shape endpoint or bind to an existing element by ID.',
    ),
  startArrowhead: z.string().optional().describe('Start arrowhead style'),
  endArrowhead: z.string().optional().describe('End arrowhead style'),
  startBinding: z
    .object({
      elementId: z.string(),
      focus: z.number().optional(),
      gap: z.number().optional(),
    })
    .optional()
    .describe('Start point binding info'),
  endBinding: z
    .object({
      elementId: z.string(),
      focus: z.number().optional(),
      gap: z.number().optional(),
    })
    .optional()
    .describe('End point binding info'),
  roundness: z
    .object({
      type: z.number(),
      value: z.number().optional(),
    })
    .optional()
    .describe('Roundness info'),
  link: z.string().optional().describe('Hyperlink'),
  locked: z.boolean().optional().describe('Is locked'),
  groupIds: z.array(z.string()).optional().describe('Group IDs'),
  containerId: z
    .string()
    .nullable()
    .optional()
    .describe('DEPRECATED: Use "label" property instead. Container ID for text binding.'),
  frameId: z.string().nullable().optional().describe('Parent Frame ID'),
  fileId: z.string().nullable().optional().describe('Image file ID'),
  status: z.enum(['pending', 'saved', 'error']).optional().describe('Image status'),
  scale: z.array(z.number()).optional().describe('Image scale, format: [scaleX, scaleY]'),
  crop: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
      naturalWidth: z.number(),
      naturalHeight: z.number(),
    })
    .optional()
    .describe('Image crop info'),
  name: z.string().nullable().optional().describe('Frame name'),
  customData: z.record(z.any()).optional().describe('Custom data'),
})

/**
 * Batch add Excalidraw elements to canvas
 */
export function registerAddElements(server: McpServer): void {
  server.registerTool(
    'add_elements',
    {
      description:
        'Add multiple Excalidraw elements to the canvas.\n\n' +
        'Supported element types:\n' +
        '- rectangle\n' +
        '- ellipse\n' +
        '- diamond\n' +
        '- arrow\n' +
        '- text\n' +
        '- line\n' +
        '- freedraw\n' +
        '- image\n' +
        '- frame/magicframe\n' +
        '- iframe/embeddable\n\n' +
        'Style options:\n' +
        '- strokeColor: e.g. #1e1e1e\n' +
        '- backgroundColor: e.g. #D97706\n' +
        '- fillStyle: solid/hachure/cross-hatch\n' +
        '- strokeWidth: 1-4\n' +
        '- roughness: 0=architect, 1=artist, 2=cartoonist\n\n' +
        'Advanced options:\n' +
        '- label: Auto-create bound text inside shape/arrow containers\n' +
        '- start/end: Arrow endpoint binding to new or existing elements\n' +
        '- containerId: DEPRECATED (use label instead)\n\n' +
        'Multi-session support: Specify sessionId to target a specific session.',
      inputSchema: z.object({
        sessionId: z
          .string()
          .optional()
          .describe('Session ID. If not provided, uses default session.'),
        elements: z.array(ExcalidrawElementSchema).describe('Array of elements to add'),
      }),
    },
    async ({ sessionId, elements }) => {
      try {
        const session = getSession(sessionId)
        const elementsWithId = elements.map((el) => ({
          ...el,
          id: el.id || crypto.randomUUID(),
        }))
        const elementIds = elementsWithId.map((el) => el.id)
        const hasActiveClients = await waitForSessionClient(session.id, 10000)
        if (!hasActiveClients) {
          return {
            content: [
              {
                type: 'text',
                text:
                  `❌ No browser client connected for session "${session.id}" after waiting 10 seconds.\n\n` +
                  `Please open the Excalidraw UI with ?sessionId=${session.id} and retry add_elements.`,
              },
            ],
            isError: true,
          }
        }

        const skeletons = elementsWithId.map((el) => createElementSkeleton(el))

        // 暂存骨架，等待前端回传完整元素后覆盖
        session.elements.push(...(skeletons as any))
        session.version++
        updateSession(session)

        broadcastToSession(session.id, {
          type: 'add_elements',
          skeletons,
          appState: session.appState,
        })

        return {
          content: [
            {
              type: 'text',
              text:
                `✅ Successfully added ${elements.length} elements to session "${session.id}"!\n\n` +
                `Element IDs: ${elementIds.join(', ')}`,
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

function createElementSkeleton(
  input: z.infer<typeof ExcalidrawElementSchema> & { id: string },
): Record<string, unknown> {
  const skeleton: Record<string, unknown> = {
    id: input.id,
    type: input.type,
    x: input.x,
    y: input.y,
  }

  if (input.width !== undefined) skeleton.width = input.width
  if (input.height !== undefined) skeleton.height = input.height
  if (input.strokeColor) skeleton.strokeColor = input.strokeColor
  if (input.backgroundColor) skeleton.backgroundColor = input.backgroundColor
  if (input.fillStyle) skeleton.fillStyle = input.fillStyle
  if (input.strokeWidth !== undefined) skeleton.strokeWidth = input.strokeWidth
  if (input.strokeStyle) skeleton.strokeStyle = input.strokeStyle
  if (input.roughness !== undefined) skeleton.roughness = input.roughness
  if (input.opacity !== undefined) skeleton.opacity = input.opacity
  if (input.roundness) skeleton.roundness = input.roundness
  if (input.groupIds?.length) skeleton.groupIds = input.groupIds
  if (input.frameId !== undefined) skeleton.frameId = input.frameId
  if (input.locked !== undefined) skeleton.locked = input.locked
  if (input.link) skeleton.link = input.link
  if (input.customData) skeleton.customData = input.customData
  if (input.label) skeleton.label = input.label

  if (input.type === 'text') {
    if (input.text !== undefined) skeleton.text = input.text
    if (input.fontSize !== undefined) skeleton.fontSize = input.fontSize
    if (input.textAlign !== undefined) skeleton.textAlign = input.textAlign
    if (input.verticalAlign !== undefined) skeleton.verticalAlign = input.verticalAlign
    if (input.containerId !== undefined) skeleton.containerId = input.containerId
  }

  if (input.type === 'line' || input.type === 'arrow') {
    if (input.points) skeleton.points = input.points
    if (input.startArrowhead !== undefined) skeleton.startArrowhead = input.startArrowhead
    if (input.endArrowhead !== undefined) skeleton.endArrowhead = input.endArrowhead
    if (input.startBinding) skeleton.startBinding = input.startBinding
    if (input.endBinding) skeleton.endBinding = input.endBinding
    if (input.start) skeleton.start = input.start
    if (input.end) skeleton.end = input.end
  }

  if (input.type === 'freedraw') {
    if (input.points) skeleton.points = input.points
    if (input.pressures) skeleton.pressures = input.pressures
  }

  if (input.type === 'image') {
    if (input.fileId !== undefined) skeleton.fileId = input.fileId
    if (input.status !== undefined) skeleton.status = input.status
    if (input.scale) skeleton.scale = input.scale
    if (input.crop) skeleton.crop = input.crop
  }

  if (input.type === 'frame' || input.type === 'magicframe') {
    if (input.name !== undefined) skeleton.name = input.name
  }

  if (input.containerId !== undefined && input.type !== 'text') {
    skeleton.containerId = input.containerId
  }

  return skeleton
}
