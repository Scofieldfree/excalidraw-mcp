import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerStartSession } from './start-session.js'
import { registerCreateDiagram } from './create-diagram.js'
import { registerAddElements } from './add-elements.js'
import { registerUpdateElement } from './update-element.js'
import { registerDeleteElement } from './delete-element.js'
import { registerGetScene } from './get-scene.js'
import { registerExport } from './export.js'
import { registerAddTemplateArchitecture } from './add-template-architecture.js'

/**
 * 注册所有 Excalidraw MCP 工具
 * @param server - MCP Server 实例
 */
export function registerTools(server: McpServer): void {
  registerStartSession(server)
  registerCreateDiagram(server)
  registerAddElements(server)
  registerAddTemplateArchitecture(server)
  registerUpdateElement(server)
  registerDeleteElement(server)
  registerGetScene(server)
  registerExport(server)
}
