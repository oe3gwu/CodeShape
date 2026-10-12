export type Vec3 = [number, number, number]

export type ElasticInput = {
  positions: Float64Array
  tets: Uint32Array
  young: number
  poisson: number
  density: number
  gravity: boolean
  constraints: Vec3[][]
  forces: Float64Array
}

export type ElasticResult = {
  displacement: Float64Array
  stress: Float64Array
  vonMises: Float64Array
  nodalVonMises: Float64Array
}

// N per (g/cm³ · mm³): 1 g/cm³ = 1e-9 t/mm³ and g = 9810 mm/s².
const GRAVITY = 9.81e-6

export function solveElasticity(input: ElasticInput): ElasticResult {
  const nodeCount = input.positions.length / 3
  const tetCount = input.tets.length / 4
  if (!Number.isFinite(input.young) || input.young <= 0) throw new Error('femMaterial')
  if (!Number.isFinite(input.poisson) || input.poisson <= -0.99 || input.poisson >= 0.49) throw new Error('femMaterial')
  if (nodeCount < 4 || tetCount < 1) throw new Error('femMesh')
  if (input.constraints.length !== nodeCount) throw new Error('femMesh')
  if (input.forces.length !== nodeCount * 3) throw new Error('femMesh')

  const loads = input.forces.slice()
  if (input.gravity && input.density > 0) addGravity(input.positions, input.tets, input.density, loads)

  const material = stiffnessMatrix(input.young, input.poisson)
  const free = freeAxes(input.constraints)
  const offset = new Uint32Array(nodeCount)
  let unknown = 0
  for (let node = 0; node < nodeCount; node++) {
    offset[node] = unknown
    unknown += free[node].length
  }
  if (unknown === 0) throw new Error('femSingular')

  const matrix = new Sparse(unknown)
  const rhs = new Float64Array(unknown)
  const element = new Float64Array(12 * 12)
  for (let tet = 0; tet < tetCount; tet++) {
    const nodes = [input.tets[tet * 4], input.tets[tet * 4 + 1], input.tets[tet * 4 + 2], input.tets[tet * 4 + 3]]
    const shape = shapeGradients(corners(input.positions, nodes))
    if (!(shape.volume > 0)) throw new Error('femMesh')
    elementStiffness(shape.grad, shape.volume, material, element)
    scatter(matrix, nodes, free, offset, element)
  }
  for (let node = 0; node < nodeCount; node++) {
    const axes = free[node]
    const base = node * 3
    for (let axis = 0; axis < axes.length; axis++) {
      const direction = axes[axis]
      rhs[offset[node] + axis] += loads[base] * direction[0] + loads[base + 1] * direction[1] + loads[base + 2] * direction[2]
    }
  }

  const reduced = conjugateGradient(matrix, rhs)
  const displacement = new Float64Array(nodeCount * 3)
  for (let node = 0; node < nodeCount; node++) {
    const axes = free[node]
    for (let axis = 0; axis < axes.length; axis++) {
      const value = reduced[offset[node] + axis]
      displacement[node * 3] += value * axes[axis][0]
      displacement[node * 3 + 1] += value * axes[axis][1]
      displacement[node * 3 + 2] += value * axes[axis][2]
    }
  }

  const stress = new Float64Array(tetCount * 6)
  const vonMises = new Float64Array(tetCount)
  const weight = new Float64Array(nodeCount)
  const nodal = new Float64Array(nodeCount)
  for (let tet = 0; tet < tetCount; tet++) {
    const nodes = [input.tets[tet * 4], input.tets[tet * 4 + 1], input.tets[tet * 4 + 2], input.tets[tet * 4 + 3]]
    const shape = shapeGradients(corners(input.positions, nodes))
    const values = elementStress(shape.grad, material, nodes, displacement)
    stress.set(values, tet * 6)
    const mises = vonMisesOf(values)
    vonMises[tet] = mises
    for (const node of nodes) {
      weight[node] += shape.volume
      nodal[node] += mises * shape.volume
    }
  }
  for (let node = 0; node < nodeCount; node++) {
    nodal[node] = weight[node] > 0 ? nodal[node] / weight[node] : 0
  }
  return { displacement, stress, vonMises, nodalVonMises: nodal }
}

export function addTriangleLoad(positions: Float64Array, a: number, b: number, c: number, traction: Vec3, forces: Float64Array) {
  const ab = edge(positions, a, b)
  const ac = edge(positions, a, c)
  const area = [
    0.5 * (ab[1] * ac[2] - ab[2] * ac[1]),
    0.5 * (ab[2] * ac[0] - ab[0] * ac[2]),
    0.5 * (ab[0] * ac[1] - ab[1] * ac[0]),
  ]
  const size = Math.hypot(area[0], area[1], area[2])
  if (!(size > 0)) return
  const total = [traction[0] * size, traction[1] * size, traction[2] * size]
  for (const node of [a, b, c]) {
    forces[node * 3] += total[0] / 3
    forces[node * 3 + 1] += total[1] / 3
    forces[node * 3 + 2] += total[2] / 3
  }
}

export function addGravity(positions: Float64Array, tets: Uint32Array, density: number, forces: Float64Array) {
  const tetCount = tets.length / 4
  for (let tet = 0; tet < tetCount; tet++) {
    const nodes = [tets[tet * 4], tets[tet * 4 + 1], tets[tet * 4 + 2], tets[tet * 4 + 3]]
    const volume = shapeGradients(corners(positions, nodes)).volume
    const share = density * volume * GRAVITY / 4
    for (const node of nodes) forces[node * 3 + 2] -= share
  }
}

function corners(positions: Float64Array, nodes: number[]): Vec3[] {
  return nodes.map((node) => [positions[node * 3], positions[node * 3 + 1], positions[node * 3 + 2]])
}

function edge(positions: Float64Array, from: number, to: number): Vec3 {
  return [
    positions[to * 3] - positions[from * 3],
    positions[to * 3 + 1] - positions[from * 3 + 1],
    positions[to * 3 + 2] - positions[from * 3 + 2],
  ]
}

function shapeGradients(nodes: Vec3[]) {
  const matrix = nodes.map((point) => [1, point[0], point[1], point[2]])
  const det = det4(matrix)
  if (!(Math.abs(det) > 0)) return { grad: [] as Vec3[], volume: 0 }
  const grad: Vec3[] = []
  for (let row = 0; row < 4; row++) {
    grad.push([
      cofactor(matrix, row, 1) / det,
      cofactor(matrix, row, 2) / det,
      cofactor(matrix, row, 3) / det,
    ])
  }
  return { grad, volume: Math.abs(det) / 6 }
}

function elementStiffness(grad: Vec3[], volume: number, material: number[][], out: Float64Array) {
  const strain = new Float64Array(6 * 12)
  for (let node = 0; node < 4; node++) {
    const [bx, by, bz] = grad[node]
    const column = node * 3
    setStrain(strain, column, [bx, 0, 0, by, 0, bz])
    setStrain(strain, column + 1, [0, by, 0, bx, bz, 0])
    setStrain(strain, column + 2, [0, 0, bz, 0, by, bx])
  }
  out.fill(0)
  const weighted = new Float64Array(6)
  for (let column = 0; column < 12; column++) {
    for (let row = 0; row < 6; row++) {
      let sum = 0
      for (let other = 0; other < 6; other++) sum += material[row][other] * strain[other * 12 + column]
      weighted[row] = sum
    }
    for (let row = 0; row < 12; row++) {
      let sum = 0
      for (let other = 0; other < 6; other++) sum += strain[other * 12 + row] * weighted[other]
      out[row * 12 + column] = volume * sum
    }
  }
}

function elementStress(grad: Vec3[], material: number[][], nodes: number[], displacement: Float64Array) {
  const strain = [0, 0, 0, 0, 0, 0]
  for (let node = 0; node < 4; node++) {
    const [bx, by, bz] = grad[node]
    const ux = displacement[nodes[node] * 3]
    const uy = displacement[nodes[node] * 3 + 1]
    const uz = displacement[nodes[node] * 3 + 2]
    strain[0] += bx * ux
    strain[1] += by * uy
    strain[2] += bz * uz
    strain[3] += by * ux + bx * uy
    strain[4] += bz * uy + by * uz
    strain[5] += bz * ux + bx * uz
  }
  const stress = [0, 0, 0, 0, 0, 0]
  for (let row = 0; row < 6; row++) {
    for (let column = 0; column < 6; column++) stress[row] += material[row][column] * strain[column]
  }
  return stress
}

function setStrain(target: Float64Array, column: number, values: number[]) {
  for (let row = 0; row < 6; row++) target[row * 12 + column] = values[row]
}

function stiffnessMatrix(young: number, poisson: number) {
  const lambda = (young * poisson) / ((1 + poisson) * (1 - 2 * poisson))
  const shear = young / (2 * (1 + poisson))
  const direct = lambda + 2 * shear
  const matrix = Array.from({ length: 6 }, () => Array<number>(6).fill(0))
  matrix[0][0] = matrix[1][1] = matrix[2][2] = direct
  matrix[0][1] = matrix[1][0] = matrix[0][2] = matrix[2][0] = matrix[1][2] = matrix[2][1] = lambda
  matrix[3][3] = matrix[4][4] = matrix[5][5] = shear
  return matrix
}

function vonMisesOf(stress: number[]) {
  const [sx, sy, sz, txy, tyz, tzx] = stress
  const normal = (sx - sy) ** 2 + (sy - sz) ** 2 + (sz - sx) ** 2
  return Math.sqrt(0.5 * normal + 3 * (txy ** 2 + tyz ** 2 + tzx ** 2))
}

function freeAxes(constraints: Vec3[][]) {
  return constraints.map((blocked) => complement(orthonormal(blocked)))
}

function complement(blocked: Vec3[]): Vec3[] {
  if (blocked.length === 0) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
  if (blocked.length >= 3) return []
  if (blocked.length === 1) return tangent(blocked[0])
  const direction = cross(blocked[0], blocked[1])
  const length = Math.hypot(direction[0], direction[1], direction[2])
  if (length < 1e-8) return tangent(blocked[0])
  return [[direction[0] / length, direction[1] / length, direction[2] / length]]
}

function tangent(normal: Vec3): Vec3[] {
  const hint: Vec3 = Math.abs(normal[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]
  const first = cross(hint, normal)
  const firstLength = Math.hypot(first[0], first[1], first[2])
  const t1: Vec3 = [first[0] / firstLength, first[1] / firstLength, first[2] / firstLength]
  return [t1, cross(normal, t1)]
}

function orthonormal(vectors: Vec3[]) {
  const axes: Vec3[] = []
  for (const vector of vectors) {
    let next: Vec3 = [vector[0], vector[1], vector[2]]
    for (const axis of axes) {
      const scale = next[0] * axis[0] + next[1] * axis[1] + next[2] * axis[2]
      next = [next[0] - scale * axis[0], next[1] - scale * axis[1], next[2] - scale * axis[2]]
    }
    const length = Math.hypot(next[0], next[1], next[2])
    if (length > 1e-8) axes.push([next[0] / length, next[1] / length, next[2] / length])
  }
  return axes
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function scatter(matrix: Sparse, nodes: number[], free: Vec3[][], offset: Uint32Array, stiffness: Float64Array) {
  const local: number[] = []
  for (const node of nodes) {
    for (let axis = 0; axis < free[node].length; axis++) local.push(offset[node] + axis)
  }
  const width = local.length
  const columns: Vec3[] = []
  for (const node of nodes) columns.push(...free[node])
  const reduced = new Float64Array(width * width)
  for (let row = 0; row < width; row++) {
    const rowNode = nodeOf(row, free, nodes)
    const rowAxis = columns[row]
    for (let column = 0; column < width; column++) {
      const columnNode = nodeOf(column, free, nodes)
      const columnAxis = columns[column]
      let sum = 0
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          sum += rowAxis[i] * stiffness[(rowNode * 3 + i) * 12 + columnNode * 3 + j] * columnAxis[j]
        }
      }
      reduced[row * width + column] = sum
    }
  }
  for (let row = 0; row < width; row++) {
    for (let column = 0; column < width; column++) matrix.add(local[row], local[column], reduced[row * width + column])
  }
}

function nodeOf(index: number, free: Vec3[][], nodes: number[]) {
  let cursor = 0
  for (let node = 0; node < 4; node++) {
    const count = free[nodes[node]].length
    if (index < cursor + count) return node
    cursor += count
  }
  return 0
}

class Sparse {
  private readonly rows: Map<number, number>[]
  constructor(private readonly size: number) {
    this.rows = Array.from({ length: size }, () => new Map())
  }

  add(row: number, column: number, value: number) {
    if (value === 0) return
    const entries = this.rows[row]
    entries.set(column, (entries.get(column) ?? 0) + value)
  }

  diagonal() {
    const diag = new Float64Array(this.size)
    for (let row = 0; row < this.size; row++) diag[row] = this.rows[row].get(row) ?? 0
    return diag
  }

  multiply(vector: Float64Array) {
    const out = new Float64Array(this.size)
    for (let row = 0; row < this.size; row++) {
      let sum = 0
      for (const [column, value] of this.rows[row]) sum += value * vector[column]
      out[row] = sum
    }
    return out
  }
}

function conjugateGradient(matrix: Sparse, rhs: Float64Array) {
  const size = rhs.length
  const solution = new Float64Array(size)
  const residual = rhs.slice()
  const diagonal = matrix.diagonal()
  let scale = 0
  for (let index = 0; index < size; index++) scale = Math.max(scale, Math.abs(diagonal[index]))
  const preconditioned = new Float64Array(size)
  const direction = new Float64Array(size)
  const apply = (source: Float64Array, target: Float64Array) => {
    for (let index = 0; index < size; index++) {
      const entry = diagonal[index]
      if (!(Math.abs(entry) > scale * 1e-14)) throw new Error('femSingular')
      target[index] = source[index] / entry
    }
  }
  apply(residual, preconditioned)
  direction.set(preconditioned)
  let product = dot(residual, preconditioned)
  const norm = Math.sqrt(dot(rhs, rhs)) || 1
  const limit = Math.max(size * 4, 200)
  for (let iteration = 0; iteration < limit; iteration++) {
    if (Math.sqrt(dot(residual, residual)) / norm < 1e-10) return solution
    const projected = matrix.multiply(direction)
    const denominator = dot(direction, projected)
    if (!(denominator > 0)) throw new Error('femSingular')
    const alpha = product / denominator
    for (let index = 0; index < size; index++) {
      solution[index] += alpha * direction[index]
      residual[index] -= alpha * projected[index]
    }
    apply(residual, preconditioned)
    const next = dot(residual, preconditioned)
    const beta = next / product
    product = next
    for (let index = 0; index < size; index++) direction[index] = preconditioned[index] + beta * direction[index]
  }
  if (Math.sqrt(dot(residual, residual)) / norm < 1e-8) return solution
  throw new Error('femNotConverged')
}

function dot(left: ArrayLike<number>, right: ArrayLike<number>) {
  let sum = 0
  for (let index = 0; index < left.length; index++) sum += left[index] * right[index]
  return sum
}

function det4(matrix: number[][]) {
  let sum = 0
  for (let column = 0; column < 4; column++) {
    sum += (column % 2 === 0 ? 1 : -1) * matrix[0][column] * minorDet(matrix, 0, column)
  }
  return sum
}

function cofactor(matrix: number[][], row: number, column: number) {
  const sign = (row + column) % 2 === 0 ? 1 : -1
  return sign * minorDet(matrix, row, column)
}

function minorDet(matrix: number[][], skipRow: number, skipColumn: number) {
  const values: number[] = []
  for (let row = 0; row < 4; row++) {
    if (row === skipRow) continue
    for (let column = 0; column < 4; column++) {
      if (column === skipColumn) continue
      values.push(matrix[row][column])
    }
  }
  return det3(values)
}

function det3(values: number[]) {
  return values[0] * (values[4] * values[8] - values[5] * values[7])
    - values[1] * (values[3] * values[8] - values[5] * values[6])
    + values[2] * (values[3] * values[7] - values[4] * values[6])
}
