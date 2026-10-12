import type { Vec3 } from './solver'

export function triangleNormal(positions: ArrayLike<number>, a: number, b: number, c: number): Vec3 | null {
  const ab: Vec3 = [positions[b * 3] - positions[a * 3], positions[b * 3 + 1] - positions[a * 3 + 1], positions[b * 3 + 2] - positions[a * 3 + 2]]
  const ac: Vec3 = [positions[c * 3] - positions[a * 3], positions[c * 3 + 1] - positions[a * 3 + 1], positions[c * 3 + 2] - positions[a * 3 + 2]]
  const normal = cross(ab, ac)
  const length = Math.hypot(normal[0], normal[1], normal[2])
  if (!(length > 0)) return null
  return [normal[0] / length, normal[1] / length, normal[2] / length]
}

export function growFace(positions: ArrayLike<number>, indices: Uint32Array, seed: number, minDot = 0.94) {
  const count = indices.length / 3
  if (seed < 0 || seed >= count) return []
  const seedNormal = triangleNormal(positions, indices[seed * 3], indices[seed * 3 + 1], indices[seed * 3 + 2])
  if (!seedNormal) return [seed]
  const neighbors = faceNeighbors(indices)
  const seen = new Set<number>([seed])
  const queue = [seed]
  while (queue.length > 0) {
    const current = queue.pop() ?? seed
    for (const next of neighbors[current] ?? []) {
      if (seen.has(next)) continue
      const normal = triangleNormal(positions, indices[next * 3], indices[next * 3 + 1], indices[next * 3 + 2])
      if (!normal || dot(normal, seedNormal) < minDot) continue
      seen.add(next)
      queue.push(next)
    }
  }
  return [...seen]
}

export function faceFrame(positions: ArrayLike<number>, indices: Uint32Array, triangles: number[]) {
  const normal: Vec3 = [0, 0, 0]
  const centroid: Vec3 = [0, 0, 0]
  let area = 0
  for (const triangle of triangles) {
    const a = indices[triangle * 3]
    const b = indices[triangle * 3 + 1]
    const c = indices[triangle * 3 + 2]
    const ab: Vec3 = [positions[b * 3] - positions[a * 3], positions[b * 3 + 1] - positions[a * 3 + 1], positions[b * 3 + 2] - positions[a * 3 + 2]]
    const ac: Vec3 = [positions[c * 3] - positions[a * 3], positions[c * 3 + 1] - positions[a * 3 + 1], positions[c * 3 + 2] - positions[a * 3 + 2]]
    const wide = cross(ab, ac)
    const size = Math.hypot(wide[0], wide[1], wide[2])
    if (!(size > 0)) continue
    area += size
    normal[0] += wide[0]
    normal[1] += wide[1]
    normal[2] += wide[2]
    centroid[0] += (positions[a * 3] + positions[b * 3] + positions[c * 3]) * size
    centroid[1] += (positions[a * 3 + 1] + positions[b * 3 + 1] + positions[c * 3 + 1]) * size
    centroid[2] += (positions[a * 3 + 2] + positions[b * 3 + 2] + positions[c * 3 + 2]) * size
  }
  const length = Math.hypot(normal[0], normal[1], normal[2])
  if (!(length > 0) || !(area > 0)) return null
  return {
    normal: [normal[0] / length, normal[1] / length, normal[2] / length] as Vec3,
    centroid: [centroid[0] / (3 * area), centroid[1] / (3 * area), centroid[2] / (3 * area)] as Vec3,
  }
}

export function diagonalOf(positions: ArrayLike<number>) {
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  for (let index = 0; index < positions.length; index += 3) {
    const x = positions[index]
    const y = positions[index + 1]
    const z = positions[index + 2]
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    minZ = Math.min(minZ, z)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
    maxZ = Math.max(maxZ, z)
  }
  return Math.hypot(maxX - minX, maxY - minY, maxZ - minZ)
}

export function pointTriangleDistance(point: Vec3, a: Vec3, b: Vec3, c: Vec3) {
  const closest = closestOnTriangle(point, a, b, c)
  return Math.hypot(point[0] - closest[0], point[1] - closest[1], point[2] - closest[2])
}

function faceNeighbors(indices: Uint32Array) {
  const edges = new Map<string, number[]>()
  const count = indices.length / 3
  const neighbors: number[][] = Array.from({ length: count }, () => [])
  for (let triangle = 0; triangle < count; triangle++) {
    const a = indices[triangle * 3]
    const b = indices[triangle * 3 + 1]
    const c = indices[triangle * 3 + 2]
    for (const edge of [edgeKey(a, b), edgeKey(b, c), edgeKey(c, a)]) {
      const list = edges.get(edge)
      if (list) list.push(triangle)
      else edges.set(edge, [triangle])
    }
  }
  for (const list of edges.values()) {
    if (list.length < 2) continue
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        neighbors[list[i]].push(list[j])
        neighbors[list[j]].push(list[i])
      }
    }
  }
  return neighbors
}

function edgeKey(a: number, b: number) {
  return a < b ? `${a},${b}` : `${b},${a}`
}

function closestOnTriangle(point: Vec3, a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const ab = sub(b, a)
  const ac = sub(c, a)
  const ap = sub(point, a)
  const d1 = dot(ab, ap)
  const d2 = dot(ac, ap)
  if (d1 <= 0 && d2 <= 0) return a
  const bp = sub(point, b)
  const d3 = dot(ab, bp)
  const d4 = dot(ac, bp)
  if (d3 >= 0 && d4 <= d3) return b
  const vc = d1 * d4 - d3 * d2
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return add(a, scale(ab, d1 / (d1 - d3)))
  const cp = sub(point, c)
  const d5 = dot(ab, cp)
  const d6 = dot(ac, cp)
  if (d6 >= 0 && d5 <= d6) return c
  const vb = d5 * d2 - d1 * d6
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return add(a, scale(ac, d2 / (d2 - d6)))
  const va = d3 * d6 - d5 * d4
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return add(b, scale(sub(c, b), (d4 - d3) / (d4 - d3 + (d5 - d6))))
  const denom = 1 / (va + vb + vc)
  return add(a, add(scale(ab, vb * denom), scale(ac, vc * denom)))
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

function scale(a: Vec3, factor: number): Vec3 {
  return [a[0] * factor, a[1] * factor, a[2] * factor]
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function dot(a: Vec3, b: Vec3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
