import { diagonalOf, pointTriangleDistance, triangleNormal } from './surface'
import { addTriangleLoad, type Vec3 } from './solver'

export type MeshRegion = {
  kind: 'fixed' | 'slide' | 'pressure'
  triangles: number[]
  normal: Vec3
  pressure: number
}

export type MeshForce = {
  point: Vec3
  force: Vec3
}

export type BoundLoads = {
  constraints: Vec3[][]
  forces: Float64Array
}

type Boundary = {
  nodes: [number, number, number]
  tet: number
  normal: Vec3
  centroid: Vec3
}

export function bindLoads(
  surfacePositions: ArrayLike<number>,
  surfaceIndices: Uint32Array,
  tetPositions: Float64Array,
  tets: Uint32Array,
  regions: MeshRegion[],
  loads: MeshForce[],
  tolerance: number,
): BoundLoads {
  const nodeCount = tetPositions.length / 3
  const boundary = boundaryFaces(tetPositions, tets)
  if (boundary.length === 0) throw new Error('femMesh')
  const constraints: Vec3[][] = Array.from({ length: nodeCount }, () => [])
  const forces = new Float64Array(nodeCount * 3)
  const surface = surfaceTriangles(surfacePositions, surfaceIndices)

  for (const region of regions) {
    const normal = unit(region.normal)
    if (!normal) throw new Error('femUnbound')
    const selected = region.triangles.flatMap((index) => {
      const triangle = surface[index]
      return triangle ? [triangle] : []
    })
    if (selected.length === 0) throw new Error('femUnbound')
    const matched = boundary.filter((face) => dot(face.normal, normal) >= 0.85 && selected.some((triangle) => pointTriangleDistance(face.centroid, triangle.a, triangle.b, triangle.c) <= tolerance))
    if (matched.length === 0) throw new Error('femUnbound')
    if (region.kind === 'pressure') {
      for (const face of matched) {
        const traction: Vec3 = [-region.pressure * face.normal[0], -region.pressure * face.normal[1], -region.pressure * face.normal[2]]
        addTriangleLoad(tetPositions, face.nodes[0], face.nodes[1], face.nodes[2], traction, forces)
      }
    } else if (region.kind === 'fixed') {
      for (const face of matched) {
        for (const node of face.nodes) constraints[node] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
      }
    } else {
      for (const face of matched) {
        for (const node of face.nodes) {
          if (constraints[node].length >= 3) continue
          constraints[node].push(normal)
        }
      }
    }
  }

  const boundaryNodes = new Set<number>()
  for (const face of boundary) for (const node of face.nodes) boundaryNodes.add(node)
  for (const load of loads) {
    let best = -1
    let bestDistance = Infinity
    for (const node of boundaryNodes) {
      const distance = Math.hypot(tetPositions[node * 3] - load.point[0], tetPositions[node * 3 + 1] - load.point[1], tetPositions[node * 3 + 2] - load.point[2])
      if (distance < bestDistance) {
        best = node
        bestDistance = distance
      }
    }
    if (best < 0) throw new Error('femUnbound')
    forces[best * 3] += load.force[0]
    forces[best * 3 + 1] += load.force[1]
    forces[best * 3 + 2] += load.force[2]
  }
  return { constraints, forces }
}

export function boundaryMesh(positions: Float64Array, tets: Uint32Array) {
  const faces = boundaryFaces(positions, tets)
  const indices = new Uint32Array(faces.length * 3)
  const faceElement = new Uint32Array(faces.length)
  for (let index = 0; index < faces.length; index++) {
    indices[index * 3] = faces[index].nodes[0]
    indices[index * 3 + 1] = faces[index].nodes[1]
    indices[index * 3 + 2] = faces[index].nodes[2]
    faceElement[index] = faces[index].tet
  }
  return { indices, faceElement }
}

export function loadTolerance(positions: ArrayLike<number>, edgeLengthRel: number) {
  return Math.max(diagonalOf(positions) * Math.max(edgeLengthRel * 0.75, 0.01), 1e-4)
}

function boundaryFaces(positions: Float64Array, tets: Uint32Array) {
  const seen = new Map<string, { nodes: [number, number, number]; tet: number; count: number }>()
  const tetCount = tets.length / 4
  for (let tet = 0; tet < tetCount; tet++) {
    const nodes = [tets[tet * 4], tets[tet * 4 + 1], tets[tet * 4 + 2], tets[tet * 4 + 3]]
    const faces: Array<[number, number, number]> = [
      [nodes[0], nodes[1], nodes[2]],
      [nodes[0], nodes[3], nodes[1]],
      [nodes[0], nodes[2], nodes[3]],
      [nodes[1], nodes[3], nodes[2]],
    ]
    const opposite = [nodes[3], nodes[2], nodes[1], nodes[0]]
    for (let face = 0; face < 4; face++) {
      const ordered = outward(positions, faces[face], opposite[face])
      const key = faceKey(ordered[0], ordered[1], ordered[2])
      const existing = seen.get(key)
      if (existing) existing.count += 1
      else seen.set(key, { nodes: ordered, tet, count: 1 })
    }
  }
  const boundary: Boundary[] = []
  for (const face of seen.values()) {
    if (face.count !== 1) continue
    const normal = triangleNormal(positions, face.nodes[0], face.nodes[1], face.nodes[2])
    if (!normal) continue
    const centroid: Vec3 = [0, 0, 0]
    for (const node of face.nodes) {
      centroid[0] += positions[node * 3]
      centroid[1] += positions[node * 3 + 1]
      centroid[2] += positions[node * 3 + 2]
    }
    boundary.push({
      nodes: face.nodes,
      tet: face.tet,
      normal,
      centroid: [centroid[0] / 3, centroid[1] / 3, centroid[2] / 3],
    })
  }
  return boundary
}

function outward(positions: Float64Array, face: [number, number, number], opposite: number): [number, number, number] {
  const normal = triangleNormal(positions, face[0], face[1], face[2])
  if (!normal) return face
  const towards: Vec3 = [
    positions[opposite * 3] - positions[face[0] * 3],
    positions[opposite * 3 + 1] - positions[face[0] * 3 + 1],
    positions[opposite * 3 + 2] - positions[face[0] * 3 + 2],
  ]
  if (dot(normal, towards) > 0) return [face[0], face[2], face[1]]
  return face
}

function surfaceTriangles(positions: ArrayLike<number>, indices: Uint32Array) {
  const triangles: Array<{ a: Vec3; b: Vec3; c: Vec3 } | null> = []
  for (let triangle = 0; triangle < indices.length / 3; triangle++) {
    const a = indices[triangle * 3]
    const b = indices[triangle * 3 + 1]
    const c = indices[triangle * 3 + 2]
    triangles.push({
      a: [positions[a * 3], positions[a * 3 + 1], positions[a * 3 + 2]],
      b: [positions[b * 3], positions[b * 3 + 1], positions[b * 3 + 2]],
      c: [positions[c * 3], positions[c * 3 + 1], positions[c * 3 + 2]],
    })
  }
  return triangles
}

function faceKey(a: number, b: number, c: number) {
  const sorted = [a, b, c].sort((left, right) => left - right)
  return `${sorted[0]},${sorted[1]},${sorted[2]}`
}

function unit(vector: Vec3): Vec3 | null {
  const length = Math.hypot(vector[0], vector[1], vector[2])
  if (!(length > 0)) return null
  return [vector[0] / length, vector[1] / length, vector[2] / length]
}

function dot(a: Vec3, b: Vec3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
