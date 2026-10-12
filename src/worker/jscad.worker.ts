import * as modeling from '@jscad/modeling'
import { toCommonJs } from '../lib/jscadModule'
import { applyParamDefaults } from '../lib/params'
import type { BuildRequest, BuildResponse, DisplayPart, ParamDef, ParamValue } from '../types'

const host = globalThis as typeof globalThis & { process?: { env: Record<string, string> } }
if (!host.process) host.process = { env: {} }

const { geom3, geom2, path2 } = modeling.geometries

function withDefault(value: unknown) {
  if (value == null || (typeof value !== 'object' && typeof value !== 'function')) return value
  const record = value as { default?: unknown }
  if (record.default == null) record.default = value
  return value
}

function localRequire(id: string): unknown {
  if (id === '@jscad/modeling') return withDefault(modeling)
  if (id.startsWith('@jscad/modeling/')) {
    const parts = id.slice('@jscad/modeling/'.length).replace(/\.js$/, '').split('/').filter((part) => part && part !== 'src')
    let current: unknown = modeling
    for (const part of parts) {
      if (current == null || (typeof current !== 'object' && typeof current !== 'function')) {
        current = undefined
        break
      }
      current = (current as Record<string, unknown>)[part]
    }
    if (current != null) return withDefault(current)
  }
  throw new Error(`Modul nicht verfügbar: ${id}`)
}

function explain(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

type UserApi = {
  main?: (params: Record<string, ParamValue>) => unknown
  getParameterDefinitions?: () => ParamDef[]
}

function loadScript(code: string): UserApi {
  const module = { exports: {} as UserApi }
  const source = `${toCommonJs(code)}
;if (typeof main === 'function' && !module.exports.main) module.exports.main = main;
if (typeof getParameterDefinitions === 'function' && !module.exports.getParameterDefinitions) module.exports.getParameterDefinitions = getParameterDefinitions;
if (!module.exports.main && typeof module.exports.default === 'function') module.exports.main = module.exports.default;
return module.exports;`
  return new Function('require', 'module', 'exports', source)(localRequire, module, module.exports) as UserApi
}

function quantize(value: number) {
  return Math.round(value * 1e5)
}

function readColor(geometry: { color?: number[] }): [number, number, number, number] {
  const color = geometry.color
  if (!color || color.length < 3) return [0.62, 0.66, 0.72, 1]
  return [color[0], color[1], color[2], color.length > 3 ? color[3] : 1]
}

function meshFromPolygons(polygons: Array<{ vertices: number[][] }>, color: [number, number, number, number]): DisplayPart | null {
  const lookup = new Map<string, number>()
  const positions: number[] = []
  const indices: number[] = []
  const add = (vertex: number[]) => {
    const key = `${quantize(vertex[0])},${quantize(vertex[1])},${quantize(vertex[2] ?? 0)}`
    const existing = lookup.get(key)
    if (existing !== undefined) return existing
    const index = positions.length / 3
    positions.push(vertex[0], vertex[1], vertex[2] ?? 0)
    lookup.set(key, index)
    return index
  }
  for (const polygon of polygons) {
    const ids = polygon.vertices.map(add)
    for (let i = 2; i < ids.length; i++) indices.push(ids[0], ids[i - 1], ids[i])
  }
  if (indices.length === 0) return null
  return {
    id: '',
    name: '',
    kind: 'mesh',
    color,
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  }
}

function toPart(geometry: unknown): DisplayPart | null {
  if (geom3.isA(geometry)) {
    return meshFromPolygons(geom3.toPolygons(geometry), readColor(geometry))
  }
  if (geom2.isA(geometry)) {
    const solid = modeling.extrusions.extrudeLinear({ height: 0.4 }, geometry)
    return meshFromPolygons(geom3.toPolygons(solid), readColor(geometry))
  }
  if (path2.isA(geometry)) {
    const points = path2.toPoints(geometry)
    if (points.length < 2) return null
    const positions: number[] = []
    for (let i = 0; i < points.length - 1; i++) {
      positions.push(points[i][0], points[i][1], 0, points[i + 1][0], points[i + 1][1], 0)
    }
    return {
      id: '',
      name: '',
      kind: 'lines',
      color: readColor(geometry as { color?: number[] }),
      positions: new Float32Array(positions),
      indices: new Uint32Array(),
    }
  }
  return null
}

function collect(value: unknown, out: unknown[]) {
  if (value == null) return
  if (Array.isArray(value)) {
    for (const entry of value) collect(entry, out)
    return
  }
  out.push(value)
}

function isPromise(value: unknown): value is Promise<unknown> {
  return typeof value === 'object' && value !== null && typeof (value as Promise<unknown>).then === 'function'
}

async function build(request: BuildRequest): Promise<BuildResponse> {
  const started = performance.now()
  try {
    const api = loadScript(request.code)
    if (typeof api.main !== 'function') {
      return { id: request.id, ok: false, error: 'errNoMain' }
    }
    let definitions: ParamDef[] = []
    if (typeof api.getParameterDefinitions === 'function') {
      const defs = await Promise.resolve(api.getParameterDefinitions())
      if (Array.isArray(defs)) definitions = defs
    }
    const params = applyParamDefaults(definitions, request.params)
    const produced = api.main(params)
    const result = isPromise(produced) ? await produced : produced
    const geometries: unknown[] = []
    collect(result, geometries)
    const parts: DisplayPart[] = []
    geometries.forEach((geometry, index) => {
      const part = toPart(geometry)
      if (!part) return
      part.id = `part-${index}`
      part.name = `Teil ${parts.length + 1}`
      parts.push(part)
    })
    if (parts.length === 0) {
      return { id: request.id, ok: false, error: 'errNoGeometry' }
    }
    const triangles = parts.reduce((sum, part) => sum + part.indices.length / 3, 0)
    return {
      id: request.id,
      ok: true,
      parts,
      parameters: definitions,
      elapsed: Math.max(1, Math.round(performance.now() - started)),
      triangles,
    }
  } catch (error) {
    return { id: request.id, ok: false, error: explain(error) }
  }
}

self.onmessage = (event: MessageEvent<BuildRequest>) => {
  if (event.data?.type !== 'build') return
  void build(event.data).then((response) => {
  const transfer: Transferable[] = []
  if (response.ok) {
    for (const part of response.parts) {
      transfer.push(part.positions.buffer)
      if (part.indices.byteLength) transfer.push(part.indices.buffer)
    }
  }
  self.postMessage(response, { transfer })
  }).catch((error: unknown) => {
    self.postMessage({ id: event.data.id, ok: false, error: explain(error) })
  })
}
