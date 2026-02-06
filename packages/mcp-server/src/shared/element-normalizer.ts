export type ElementRecord = Record<string, unknown>

export const LINEAR_ELEMENT_TYPES = new Set(['arrow', 'line', 'freedraw'])

const BR_TAG_RE = /<\s*br\s*\/?\s*>|<\s*\/\s*br\s*>/gi
const BLOCK_BREAK_TAG_RE = /<\s*\/?\s*(p|div|li|ul|ol|section|article)\b[^>]*>/gi
const INLINE_STRIP_TAG_RE = /<\s*\/?\s*(b|strong|i|em|code|span|small|mark)\b[^>]*>/gi
const GENERIC_TAG_RE = /<[^>]+>/g
const HTML_ENTITY_MAP: Record<string, string> = {
  nbsp: ' ',
  lt: '<',
  gt: '>',
  amp: '&',
  quot: '"',
  '#39': "'",
  apos: "'",
}

export function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function decodeHtmlEntities(text: string): string {
  return text.replace(/&([a-zA-Z0-9#]+);/g, (full: string, key: string): string => {
    const normalized = String(key).toLowerCase()
    if (Object.prototype.hasOwnProperty.call(HTML_ENTITY_MAP, normalized)) {
      return HTML_ENTITY_MAP[normalized] || full
    }
    return full
  })
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\u00A0/g, ' ')
    .trim()
}

export function sanitizeRichText(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const withLineBreaks = value.replace(/\\n/g, '\n').replace(BR_TAG_RE, '\n')
  const withBlockBreaks = withLineBreaks.replace(BLOCK_BREAK_TAG_RE, '\n')
  const withoutInlineTags = withBlockBreaks.replace(INLINE_STRIP_TAG_RE, '')
  const withoutGenericTags = withoutInlineTags.replace(GENERIC_TAG_RE, '')
  const decoded = decodeHtmlEntities(withoutGenericTags)
  return normalizeWhitespace(decoded)
}

export function sanitizeElementTextFields(element: ElementRecord): ElementRecord {
  const normalized: ElementRecord = { ...element }
  if (typeof normalized.text === 'string') {
    normalized.text = sanitizeRichText(normalized.text)
  }
  if (
    normalized.label &&
    typeof normalized.label === 'object' &&
    typeof (normalized.label as ElementRecord).text === 'string'
  ) {
    normalized.label = {
      ...(normalized.label as ElementRecord),
      text: sanitizeRichText((normalized.label as ElementRecord).text),
    }
  }
  return normalized
}

export function normalizeLinearElement(element: ElementRecord): ElementRecord {
  const type = typeof element.type === 'string' ? element.type : ''
  if (!LINEAR_ELEMENT_TYPES.has(type)) {
    return element
  }

  const rawPoints = Array.isArray(element.points) ? element.points : []
  const parsedPoints: Array<[number, number]> = rawPoints
    .map((point) => {
      if (!Array.isArray(point) || point.length < 2) return null
      const x = toFiniteNumber(point[0], 0)
      const y = toFiniteNumber(point[1], 0)
      return [x, y] as [number, number]
    })
    .filter((point): point is [number, number] => point !== null)

  const width = Math.max(toFiniteNumber(element.width, 100), 40)
  const height = toFiniteNumber(element.height, 0)
  const fallbackPoints: Array<[number, number]> = [
    [0, 0],
    [width, height],
  ]
  const points = parsedPoints.length >= 2 ? parsedPoints : fallbackPoints
  const first = points[0] || [0, 0]
  const firstX = toFiniteNumber(first[0], 0)
  const firstY = toFiniteNumber(first[1], 0)

  const normalizedPoints = points.map((point) => [
    toFiniteNumber(point[0], 0) - firstX,
    toFiniteNumber(point[1], 0) - firstY,
  ]) as Array<[number, number]>
  const hasNonZeroSegment = normalizedPoints.some(
    (point, index) => index > 0 && (Math.abs(point[0]) > 0 || Math.abs(point[1]) > 0),
  )
  const finalPoints = hasNonZeroSegment ? normalizedPoints : fallbackPoints

  const baseX = toFiniteNumber(element.x, 0)
  const baseY = toFiniteNumber(element.y, 0)
  const normalized: ElementRecord = {
    ...element,
    x: baseX + firstX,
    y: baseY + firstY,
    points: finalPoints,
  }

  if (type === 'freedraw') {
    const rawPressures = Array.isArray(element.pressures) ? element.pressures : []
    normalized.pressures =
      rawPressures.length === finalPoints.length
        ? rawPressures.map((v) => toFiniteNumber(v, 0.5))
        : Array(finalPoints.length).fill(0.5)
  }

  return normalized
}

export function normalizeElementsForStorage(elements: ElementRecord[]): ElementRecord[] {
  return elements.map((element) => normalizeLinearElement(element))
}
