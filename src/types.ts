export type Theme = 'light' | 'dark'

export type RenderMode = 'shaded-edges' | 'shaded' | 'translucent' | 'wire'

export type Projection = 'perspective' | 'ortho'

export type SavedView = {
  position: [number, number, number]
  target: [number, number, number]
  up: [number, number, number]
  orthoHeight: number
  orthoZoom: number
}

export type ViewName = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'iso'

export type PlaneKey = 'origin' | 'top' | 'front' | 'right'

export type Planes = Record<PlaneKey, boolean>

export type ParamValue = string | number | boolean

export type ParamDef = {
  name?: string
  type: string
  caption?: string
  initial?: ParamValue
  checked?: boolean
  min?: number
  max?: number
  step?: number
  values?: Array<string | number>
  captions?: string[]
}

export type DisplayPart = {
  id: string
  name: string
  kind: 'mesh' | 'lines'
  color: [number, number, number, number]
  positions: Float32Array
  indices: Uint32Array
}

export type BuildRequest = {
  id: number
  type: 'build'
  code: string
  params: Record<string, ParamValue>
}

export type BuildSuccess = {
  id: number
  ok: true
  parts: DisplayPart[]
  parameters: ParamDef[]
  elapsed: number
  triangles: number
}

export type BuildFailure = {
  id: number
  ok: false
  error: string
}

export type BuildResponse = BuildSuccess | BuildFailure
