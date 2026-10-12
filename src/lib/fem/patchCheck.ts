import { addGravity, addTriangleLoad, solveElasticity, type Vec3 } from './solver'

const young = 1000
const poisson = 0.3
const stress = 10
const length = 20
const width = 10

const positions = new Float64Array([
  0, 0, 0,
  width, 0, 0,
  width, width, 0,
  0, width, 0,
  0, 0, length,
  width, 0, length,
  width, width, length,
  0, width, length,
])

const tets = new Uint32Array([
  0, 1, 2, 6,
  0, 2, 3, 6,
  0, 3, 7, 6,
  0, 7, 4, 6,
  0, 4, 5, 6,
  0, 5, 1, 6,
])

const constraints: Vec3[][] = Array.from({ length: 8 }, () => [])
for (const node of [0, 1, 2, 3]) constraints[node].push([0, 0, 1])
constraints[0].push([1, 0, 0], [0, 1, 0])
constraints[1].push([0, 1, 0])

const forces = new Float64Array(24)
addTriangleLoad(positions, 4, 5, 6, [0, 0, stress], forces)
addTriangleLoad(positions, 4, 6, 7, [0, 0, stress], forces)

const result = solveElasticity({
  positions,
  tets,
  young,
  poisson,
  density: 0,
  gravity: false,
  constraints,
  forces,
})

const axial = stress * length / young
const lateral = -poisson * stress / young
for (let tet = 0; tet < 6; tet++) {
  const values = result.stress.slice(tet * 6, tet * 6 + 6)
  near(`σx[${tet}]`, values[0], 0)
  near(`σy[${tet}]`, values[1], 0)
  near(`σz[${tet}]`, values[2], stress)
  near(`τxy[${tet}]`, values[3], 0)
  near(`τyz[${tet}]`, values[4], 0)
  near(`τzx[${tet}]`, values[5], 0)
  near(`vm[${tet}]`, result.vonMises[tet], stress)
}

expectNode(4, 0, 0, axial)
expectNode(5, lateral * width, 0, axial)
expectNode(6, lateral * width, lateral * width, axial)
expectNode(7, 0, lateral * width, axial)
expectNode(0, 0, 0, 0)

const weight = new Float64Array(24)
addGravity(positions, tets, 7.85, weight)
let total = 0
for (let node = 0; node < 8; node++) total += weight[node * 3 + 2]
near('weight', total, -7.85 * width * width * length * 9.81e-6)

console.log('tensile patch ok')

function expectNode(node: number, x: number, y: number, z: number) {
  near(`u${node}x`, result.displacement[node * 3], x)
  near(`u${node}y`, result.displacement[node * 3 + 1], y)
  near(`u${node}z`, result.displacement[node * 3 + 2], z)
}

function near(name: string, actual: number, expected: number) {
  const tol = 1e-6 * Math.max(1, Math.abs(expected))
  if (Math.abs(actual - expected) > tol) {
    throw new Error(`${name}: got ${actual}, expected ${expected}`)
  }
}
