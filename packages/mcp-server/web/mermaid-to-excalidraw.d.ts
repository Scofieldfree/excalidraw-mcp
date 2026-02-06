declare module '@excalidraw/mermaid-to-excalidraw' {
  export interface MermaidToExcalidrawResult {
    elements: Array<Record<string, any>>
    files?: Record<string, any>
  }

  export function parseMermaidToExcalidraw(
    definition: string,
    config?: Record<string, any>,
  ): Promise<MermaidToExcalidrawResult>
}
