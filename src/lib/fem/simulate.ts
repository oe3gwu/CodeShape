import { bindLoads, boundaryMesh, loadTolerance, type MeshForce, type MeshRegion } from './bind'
import { solveElasticity } from './solver'

export const MAX_TETS = 40_000

export type SimRequest = {
  positions: Float32Array
  indices: Uint32Array
  edgeLengthRel: number
  young: number
  poisson: number
  density: number
  strength: number
  gravity: boolean
  regions: MeshRegion[]
  forces: MeshForce[]
}

export type SimSuccess = {
  positions: Float32Array
  indices: Uint32Array
  displacement: Float32Array
  nodalVonMises: Float32Array
  faceElement: Uint32Array
  elementVonMises: Float32Array
  minVonMises: number
  maxVonMises: number
  safetyFactor: number | null
  tetCount: number
}

export type TetMesher = (
  vertices: Float64Array,
  faces: Uint32Array,
  edgeLengthRel: number,
) => Promise<{ status: number; vertices: Float64Array; tets: Uint32Array }>

export async function runSimulation(request: SimRequest, mesh: TetMesher, onStage?: (stage: 'mesh' | 'solve') => void): Promise<SimSuccess> {
  if (request.indices.length < 12 || request.positions.length < 12) throw new Error('femMesh')
  const hasSupport = request.regions.some((region) => region.kind === 'fixed' || region.kind === 'slide')
  const hasLoad = request.gravity || request.forces.length > 0 || request.regions.some((region) => region.kind === 'pressure' && region.pressure !== 0)
  if (!hasSupport || !hasLoad) throw new Error('femSetup')
  const edge = Math.min(0.25, Math.max(0.02, request.edgeLengthRel))
  onStage?.('mesh')
  const vertices = new Float64Array(request.positions)
  const meshed = await mesh(vertices, request.indices, edge)
  if (meshed.status !== 0 || meshed.tets.length < 4 || meshed.vertices.length < 12) throw new Error('femMesh')
  const tetCount = meshed.tets.length / 4
  if (tetCount > MAX_TETS) throw new Error('femTooFine')
  onStage?.('solve')
  const bound = bindLoads(request.positions, request.indices, meshed.vertices, meshed.tets, request.regions, request.forces, loadTolerance(request.positions, edge))
  const solved = solveElasticity({
    positions: meshed.vertices,
    tets: meshed.tets,
    young: request.young,
    poisson: request.poisson,
    density: request.density,
    gravity: request.gravity,
    constraints: bound.constraints,
    forces: bound.forces,
  })
  const surface = boundaryMesh(meshed.vertices, meshed.tets)
  let minVonMises = Infinity
  let maxVonMises = -Infinity
  for (const value of solved.vonMises) {
    minVonMises = Math.min(minVonMises, value)
    maxVonMises = Math.max(maxVonMises, value)
  }
  const positions = new Float32Array(meshed.vertices.length)
  const displacement = new Float32Array(solved.displacement.length)
  const nodal = new Float32Array(solved.nodalVonMises.length)
  for (let index = 0; index < positions.length; index++) positions[index] = meshed.vertices[index]
  for (let index = 0; index < displacement.length; index++) displacement[index] = solved.displacement[index]
  for (let index = 0; index < nodal.length; index++) nodal[index] = solved.nodalVonMises[index]
  return {
    positions,
    indices: surface.indices,
    displacement,
    nodalVonMises: nodal,
    faceElement: surface.faceElement,
    elementVonMises: Float32Array.from(solved.vonMises),
    minVonMises,
    maxVonMises,
    safetyFactor: maxVonMises > 1e-9 ? request.strength / maxVonMises : null,
    tetCount,
  }
}
