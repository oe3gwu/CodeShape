import { useEffect, useMemo, useRef, useState } from 'react'
import type { DisplayPart } from '../types'
import { stressColors } from '../lib/fem/color'
import { materialPreset, materials, type Material } from '../lib/fem/materials'
import { runFem } from '../lib/fem/run'
import type { SimResultView, SimScene } from '../lib/fem/scene'
import { faceFrame, growFace, triangleNormal } from '../lib/fem/surface'
import type { SimSuccess } from '../lib/fem/simulate'
import type { Vec3 } from '../lib/fem/solver'

export type SimTool = 'none' | 'fixed' | 'slide' | 'force' | 'pressure'

export type SimCondition =
  | { id: number; kind: 'fixed' | 'slide'; triangles: number[]; normal: Vec3 }
  | { id: number; kind: 'pressure'; triangles: number[]; normal: Vec3; pressure: number }
  | { id: number; kind: 'force'; point: Vec3; force: Vec3 }

const preset = materialPreset('s235') ?? materials[0]

export function useSimulation(parts: DisplayPart[]) {
  const meshes = useMemo(() => parts.filter((part) => part.kind === 'mesh'), [parts])
  const [partId, setPartId] = useState('')
  const [material, setMaterial] = useState<Material>({ ...preset })
  const [tool, setTool] = useState<SimTool>('none')
  const [conditions, setConditions] = useState<SimCondition[]>([])
  const [gravity, setGravity] = useState(false)
  const [edge, setEdge] = useState(0.08)
  const [showStress, setShowStress] = useState(true)
  const [showDeformed, setShowDeformed] = useState(false)
  const [scale, setScale] = useState(1)
  const [opacity, setOpacity] = useState(1)
  const [result, setResult] = useState<SimSuccess | null>(null)
  const [stage, setStage] = useState<'mesh' | 'solve' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ids = useRef(1)
  const generation = useRef(0)
  const signature = useRef('')
  const part = meshes.find((item) => item.id === partId) ?? null

  useEffect(() => {
    if (part) return
    setPartId(meshes[0]?.id ?? '')
  }, [meshes, part])

  useEffect(() => {
    const next = part ? geometrySignature(part) : ''
    if (signature.current && signature.current !== next) {
      generation.current += 1
      setConditions([])
      setResult(null)
      setError(null)
      setTool('none')
      setStage(null)
    }
    signature.current = next
  }, [part])

  const choosePart = (id: string) => {
    generation.current += 1
    setPartId(id)
    setConditions([])
    setResult(null)
    setError(null)
    setTool('none')
    setStage(null)
  }

  const choosePreset = (id: string) => {
    if (id === 'custom') {
      setMaterial((prev) => ({ ...prev, id: 'custom' }))
      return
    }
    const next = materialPreset(id)
    if (!next) return
    setMaterial({ ...next })
    setResult(null)
  }

  const editMaterial = (patch: Partial<Material>) => {
    setMaterial((prev) => ({ ...prev, ...patch, id: 'custom' }))
    setResult(null)
  }

  const invalidate = (update: (prev: SimCondition[]) => SimCondition[]) => {
    generation.current += 1
    setConditions(update)
    setResult(null)
    setStage(null)
  }

  const pick = (hit: { partId: string; triangle: number; point: Vec3; normal: Vec3 }) => {
    if (!part || tool === 'none' || hit.partId !== part.id) return
    if (tool === 'force') {
      const normal = unit(hit.normal) ?? triangleNormal(part.positions, part.indices[hit.triangle * 3], part.indices[hit.triangle * 3 + 1], part.indices[hit.triangle * 3 + 2])
      if (!normal) return
      const force: Vec3 = [-normal[0] * 100, -normal[1] * 100, -normal[2] * 100]
      const id = ids.current++
      invalidate((prev) => [...prev, { id, kind: 'force', point: hit.point, force }])
      return
    }
    const grown = growFace(part.positions, part.indices, hit.triangle)
    const taken = new Set<number>()
    for (const condition of conditions) {
      if (condition.kind !== tool) continue
      for (const triangle of condition.triangles) taken.add(triangle)
    }
    const triangles = grown.filter((triangle) => !taken.has(triangle))
    const frame = faceFrame(part.positions, part.indices, triangles)
    if (!frame || triangles.length === 0) return
    const kind = tool
    const id = ids.current++
    if (kind === 'pressure') {
      invalidate((prev) => [...prev, { id, kind: 'pressure', triangles, normal: frame.normal, pressure: 1 }])
      return
    }
    invalidate((prev) => [...prev, { id, kind, triangles, normal: frame.normal }])
  }

  const start = () => {
    if (!part || stage) return
    if (!(material.young > 0) || !(material.poisson > -0.99) || !(material.poisson < 0.49) || !(material.strength > 0)) {
      setError('femMaterial')
      return
    }
    const gen = ++generation.current
    setError(null)
    setStage('mesh')
    setResult(null)
    const request = {
      positions: part.positions.slice(),
      indices: part.indices.slice(),
      edgeLengthRel: edge,
      young: material.young,
      poisson: material.poisson,
      density: material.density,
      strength: material.strength,
      gravity,
      regions: conditions.flatMap((condition) => condition.kind === 'force' ? [] : [{
        kind: condition.kind,
        triangles: condition.triangles,
        normal: condition.normal,
        pressure: condition.kind === 'pressure' ? condition.pressure : 0,
      }]),
      forces: conditions.flatMap((condition) => condition.kind === 'force' ? [{ point: condition.point, force: condition.force }] : []),
    }
    void runFem(request, (next) => {
      if (generation.current === gen) setStage(next)
    }).then((solved) => {
      if (generation.current !== gen) return
      setResult(solved)
      setShowStress(true)
      setTool('none')
      setStage(null)
    }).catch((caught: unknown) => {
      if (generation.current !== gen) return
      setError(caught instanceof Error ? caught.message : 'femFailed')
      setStage(null)
    })
  }

  const reset = () => {
    generation.current += 1
    setConditions([])
    setResult(null)
    setError(null)
    setTool('none')
    setGravity(false)
    setShowStress(true)
    setShowDeformed(false)
    setScale(1)
    setOpacity(1)
    setStage(null)
  }

  const scene: SimScene = useMemo(() => {
    if (!part || (conditions.length === 0 && !gravity)) {
      return { guides: null, result: showResult(part, result, tool, showStress, showDeformed, scale, opacity) }
    }
    const guides = {
      partId: part.id,
      fixed: uniqueTriangles(conditions.flatMap((condition) => condition.kind === 'fixed' ? condition.triangles : [])),
      slide: uniqueTriangles(conditions.flatMap((condition) => condition.kind === 'slide' ? condition.triangles : [])),
      pressure: uniqueTriangles(conditions.flatMap((condition) => condition.kind === 'pressure' ? condition.triangles : [])),
      arrows: arrowsOf(part, conditions),
    }
    return { guides, result: showResult(part, result, tool, showStress, showDeformed, scale, opacity) }
  }, [part, conditions, gravity, result, tool, showStress, showDeformed, scale, opacity])

  return {
    meshes,
    partId,
    material,
    tool,
    conditions,
    gravity,
    edge,
    showStress,
    showDeformed,
    scale,
    opacity,
    result,
    stage,
    error,
    scene,
    legend: result && showStress && tool === 'none' ? { min: result.minVonMises, max: result.maxVonMises } : null,
    choosePart,
    choosePreset,
    editMaterial,
    setTool,
    setGravity: (value: boolean) => { setGravity(value); setResult(null) },
    setEdge: (value: number) => { setEdge(value); setResult(null) },
    setShowStress,
    setShowDeformed,
    setScale,
    setOpacity,
    editCondition: (id: number, patch: Partial<SimCondition>) => invalidate((prev) => prev.map((condition) => condition.id === id ? { ...condition, ...patch } as SimCondition : condition)),
    removeCondition: (id: number) => invalidate((prev) => prev.filter((condition) => condition.id !== id)),
    pick,
    start,
    reset,
  }
}

function showResult(part: DisplayPart | null, result: SimSuccess | null, tool: SimTool, showStress: boolean, showDeformed: boolean, scale: number, opacity: number): SimResultView | null {
  if (!part || !result || tool !== 'none' || (!showStress && !showDeformed)) return null
  return {
    partId: part.id,
    positions: result.positions,
    indices: result.indices,
    displacement: result.displacement,
    colors: showStress ? stressColors(result.nodalVonMises, result.minVonMises, result.maxVonMises) : null,
    faceElement: result.faceElement,
    elementVonMises: result.elementVonMises,
    minVonMises: result.minVonMises,
    maxVonMises: result.maxVonMises,
    deformed: showDeformed,
    scale,
    opacity,
    baseColor: [part.color[0], part.color[1], part.color[2]],
  }
}

function arrowsOf(part: DisplayPart, conditions: SimCondition[]) {
  const arrows: Array<{ origin: Vec3; vector: Vec3; label: string }> = []
  for (const condition of conditions) {
    if (condition.kind === 'force') {
      arrows.push({ origin: condition.point, vector: condition.force, label: `${formatLoad(Math.hypot(condition.force[0], condition.force[1], condition.force[2]))} N` })
      continue
    }
    if (condition.kind !== 'pressure' || condition.pressure === 0) continue
    const frame = faceFrame(part.positions, part.indices, condition.triangles)
    if (!frame) continue
    const vector: Vec3 = [-frame.normal[0] * condition.pressure, -frame.normal[1] * condition.pressure, -frame.normal[2] * condition.pressure]
    arrows.push({
      origin: frame.centroid,
      vector,
      label: `${formatLoad(condition.pressure)} N/mm²`,
    })
  }
  return arrows
}

function geometrySignature(part: DisplayPart) {
  const values = part.positions
  let hash = values.length * 17 + part.indices.length
  const step = Math.max(1, Math.floor(values.length / 48))
  for (let index = 0; index < values.length; index += step) hash = Math.imul(hash, 31) + Math.round(values[index] * 1000)
  return `${part.id}:${hash}`
}

function uniqueTriangles(values: number[]) {
  return [...new Set(values)]
}

function unit(vector: Vec3): Vec3 | null {
  const length = Math.hypot(vector[0], vector[1], vector[2])
  if (!(length > 0)) return null
  return [vector[0] / length, vector[1] / length, vector[2] / length]
}

function formatLoad(value: number) {
  const abs = Math.abs(value)
  if (abs >= 100) return value.toFixed(0)
  if (abs >= 1) return value.toFixed(2)
  return value.toFixed(3)
}
