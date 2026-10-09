import * as THREE from 'three'

/**
 * Kanten wie in einem CAD-Viewer: nur dort, wo zwei Flächen einen echten Knick bilden.
 * T-Verbindungen (eine lange Kante gegen mehrere kurze) werden vorher geteilt,
 * damit koplanare Nähte nicht als Strich erscheinen.
 */
export function featureEdges(geometry: THREE.BufferGeometry, thresholdDegrees: number): THREE.BufferGeometry {
  const position = geometry.getAttribute('position')
  const index = geometry.getIndex()
  const empty = new THREE.BufferGeometry()
  if (!position || !index) return empty

  const vertexCount = position.count
  const coordinates = position.array as ArrayLike<number>
  const ids = index.array
  const at = (vertex: number) => [coordinates[vertex * 3], coordinates[vertex * 3 + 1], coordinates[vertex * 3 + 2]]

  type Segment = { a: number; b: number; normal: number[] }
  const segments: Segment[] = []
  for (let i = 0; i < ids.length; i += 3) {
    const a = ids[i]
    const b = ids[i + 1]
    const c = ids[i + 2]
    const ab = [at(b)[0] - at(a)[0], at(b)[1] - at(a)[1], at(b)[2] - at(a)[2]]
    const ac = [at(c)[0] - at(a)[0], at(c)[1] - at(a)[1], at(c)[2] - at(a)[2]]
    const cross = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ]
    const length = Math.hypot(cross[0], cross[1], cross[2])
    if (length < 1e-12) continue
    const normal = [cross[0] / length, cross[1] / length, cross[2] / length]
    const face = [a, b, c]
    for (let edge = 0; edge < 3; edge++) segments.push({ a: face[edge], b: face[(edge + 1) % 3], normal })
  }

  const epsilon = 1e-4
  const cell = 1
  const grid = new Map<string, number[]>()
  const cellKey = (x: number, y: number, z: number) => `${x},${y},${z}`
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    const point = at(vertex)
    const key = cellKey(Math.floor(point[0] / cell), Math.floor(point[1] / cell), Math.floor(point[2] / cell))
    const bucket = grid.get(key)
    if (bucket) bucket.push(vertex)
    else grid.set(key, [vertex])
  }

  const pointOnSegment = (start: number, end: number, vertex: number) => {
    const a = at(start)
    const b = at(end)
    const p = at(vertex)
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const ab2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2]
    if (ab2 < 1e-18) return null
    const t = ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / ab2
    if (t <= 1e-5 || t >= 1 - 1e-5) return null
    const dx = a[0] + ab[0] * t - p[0]
    const dy = a[1] + ab[1] * t - p[1]
    const dz = a[2] + ab[2] * t - p[2]
    if (dx * dx + dy * dy + dz * dz > epsilon * epsilon) return null
    return t
  }

  const split: Segment[] = []
  for (const segment of segments) {
    const a = at(segment.a)
    const b = at(segment.b)
    const minX = Math.floor(Math.min(a[0], b[0]) / cell) - 1
    const maxX = Math.floor(Math.max(a[0], b[0]) / cell) + 1
    const minY = Math.floor(Math.min(a[1], b[1]) / cell) - 1
    const maxY = Math.floor(Math.max(a[1], b[1]) / cell) + 1
    const minZ = Math.floor(Math.min(a[2], b[2]) / cell) - 1
    const maxZ = Math.floor(Math.max(a[2], b[2]) / cell) + 1
    const hits: { vertex: number; t: number }[] = []
    const seen = new Set<number>()
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const bucket = grid.get(cellKey(x, y, z))
          if (!bucket) continue
          for (const vertex of bucket) {
            if (vertex === segment.a || vertex === segment.b || seen.has(vertex)) continue
            const t = pointOnSegment(segment.a, segment.b, vertex)
            if (t == null) continue
            seen.add(vertex)
            hits.push({ vertex, t })
          }
        }
      }
    }
    if (hits.length === 0) {
      split.push(segment)
      continue
    }
    hits.sort((left, right) => left.t - right.t)
    let previous = segment.a
    for (const hit of hits) {
      split.push({ a: previous, b: hit.vertex, normal: segment.normal })
      previous = hit.vertex
    }
    split.push({ a: previous, b: segment.b, normal: segment.normal })
  }

  const paired = new Map<string, number[][]>()
  for (const segment of split) {
    const key = segment.a < segment.b ? `${segment.a}|${segment.b}` : `${segment.b}|${segment.a}`
    const list = paired.get(key)
    if (list) list.push(segment.normal)
    else paired.set(key, [segment.normal])
  }

  const limit = Math.cos(THREE.MathUtils.degToRad(thresholdDegrees))
  const linePositions: number[] = []
  for (const [key, normals] of paired) {
    if (normals.length >= 2) {
      const agreement = normals[0][0] * normals[1][0] + normals[0][1] * normals[1][1] + normals[0][2] * normals[1][2]
      if (agreement > limit) continue
    }
    const [start, end] = key.split('|').map(Number)
    const a = at(start)
    const b = at(end)
    linePositions.push(a[0], a[1], a[2], b[0], b[1], b[2])
  }

  const lines = new THREE.BufferGeometry()
  lines.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3))
  return lines
}
