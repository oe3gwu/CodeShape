import type { Lang } from '../i18n'
import type { Planes, Projection, RenderMode, SavedView, Theme } from '../types'

export type Persisted = {
  code?: string
  theme?: Theme
  lang?: Lang
  docName?: string
  editorOpen?: boolean
  treeOpen?: boolean
  treeWidth?: number
  editorWidth?: number
  chatOpen?: boolean
  chatHeight?: number
  renderMode?: RenderMode
  projection?: Projection
  planes?: Planes
  view?: SavedView
}

const KEY = 'codeshape.v1'

export function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const data = JSON.parse(raw) as Persisted
    if (!data || typeof data !== 'object') return {}
    data.planes = readPlanes(data.planes)
    data.view = readView(data.view)
    return data
  } catch {
    return {}
  }
}

export function savePersisted(data: Partial<Persisted>) {
  const prev = loadPersisted()
  localStorage.setItem(KEY, JSON.stringify({ ...prev, ...data }))
}

function readPlanes(value: unknown): Planes | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  return {
    origin: record.origin === true,
    top: record.top === true,
    front: record.front === true,
    right: record.right === true,
  }
}

function readView(value: unknown): SavedView | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  const position = readVector(record.position)
  const target = readVector(record.target)
  const up = readVector(record.up)
  const orthoHeight = Number(record.orthoHeight)
  const orthoZoom = Number(record.orthoZoom)
  if (!position || !target || !up) return undefined
  if (!Number.isFinite(orthoHeight) || orthoHeight <= 0) return undefined
  if (!Number.isFinite(orthoZoom) || orthoZoom <= 0) return undefined
  return { position, target, up, orthoHeight, orthoZoom }
}

function readVector(value: unknown): [number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 3) return null
  const numbers = value.map(Number)
  if (numbers.some((entry) => !Number.isFinite(entry))) return null
  return [numbers[0], numbers[1], numbers[2]]
}
