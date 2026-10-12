import type { Lang } from '../i18n'
import { isInferenceProvider, type InferenceConfig } from './inference'
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
  treeRatio?: number
  editorRatio?: number
  chatRatio?: number
  renderMode?: RenderMode
  projection?: Projection
  planes?: Planes
  view?: SavedView
  sideMode?: 'local' | 'files' | 'github' | 'sim'
  githubUrl?: string
  filesPath?: string
  sourcePath?: string
  inference?: InferenceConfig
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
    if (data.sideMode !== 'local' && data.sideMode !== 'files' && data.sideMode !== 'github' && data.sideMode !== 'sim') delete data.sideMode
    if (typeof data.githubUrl !== 'string') delete data.githubUrl
    if (!isSafeRel(data.filesPath)) delete data.filesPath
    if (!isSafeRel(data.sourcePath)) delete data.sourcePath
    if (!isLayoutRatio(data.treeRatio)) delete data.treeRatio
    if (!isLayoutRatio(data.editorRatio)) delete data.editorRatio
    if (!isLayoutRatio(data.chatRatio)) delete data.chatRatio
    data.inference = readInference(data.inference)
    return data
  } catch {
    return {}
  }
}

export function savePersisted(data: Partial<Persisted>) {
  const prev = loadPersisted()
  localStorage.setItem(KEY, JSON.stringify({ ...prev, ...data }))
}

function readInference(value: unknown): InferenceConfig | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  if (!isInferenceProvider(record.provider)) return undefined
  if (typeof record.baseUrl !== 'string' || record.baseUrl.length > 500) return undefined
  if (typeof record.apiKey !== 'string' || record.apiKey.length > 500) return undefined
  if (typeof record.model !== 'string' || record.model.length > 200) return undefined
  return {
    provider: record.provider,
    baseUrl: record.baseUrl,
    apiKey: record.apiKey,
    model: record.model,
  }
}

function isLayoutRatio(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0.08 && value <= 0.7
}

function isSafeRel(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 4096) return false
  if (value.includes('\0') || value.includes('\\') || value.startsWith('/')) return false
  return value.split('/').every((part) => part !== '..' && part !== '.')
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
