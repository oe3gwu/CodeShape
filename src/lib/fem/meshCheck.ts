import { loadFloatTetwild } from 'float-tetwild-wasm'
import { runSimulation, type TetMesher } from './simulate'

const width = 10
const length = 20
const positions = new Float32Array([
  0, 0, 0,
  width, 0, 0,
  width, width, 0,
  0, width, 0,
  0, 0, length,
  width, 0, length,
  width, width, length,
  0, width, length,
])
const indices = new Uint32Array([
  0, 2, 1, 0, 3, 2,
  4, 5, 6, 4, 6, 7,
  0, 1, 5, 0, 5, 4,
  2, 7, 6, 2, 6, 3,
  0, 4, 7, 0, 7, 3,
  1, 2, 6, 1, 6, 5,
])
const hand: TetMesher = async () => ({
  status: 0,
  vertices: new Float64Array(positions),
  tets: new Uint32Array([
    0, 1, 2, 6,
    0, 2, 3, 6,
    0, 3, 7, 6,
    0, 7, 4, 6,
    0, 4, 5, 6,
    0, 5, 1, 6,
  ]),
})

const young = 1000
const stress = 10
const exact = await runSimulation({
  positions,
  indices,
  edgeLengthRel: 0.08,
  young,
  poisson: 0,
  density: 7.85,
  strength: 235,
  gravity: false,
  regions: [
    { kind: 'fixed', triangles: [0, 1], normal: [0, 0, -1], pressure: 0 },
    { kind: 'pressure', triangles: [2, 3], normal: [0, 0, 1], pressure: -stress },
  ],
  forces: [],
}, hand)

for (let tet = 0; tet < exact.elementVonMises.length; tet++) near(`hand vm ${tet}`, exact.elementVonMises[tet], stress)
for (let node = 0; node < 8; node++) {
  const z = exact.positions[node * 3 + 2]
  near(`hand uz ${node}`, exact.displacement[node * 3 + 2], stress / young * z)
}

const mesher = await loadFloatTetwild({ threads: false, moduleArgs: { print: () => {}, printErr: () => {} } })
const wild = await runSimulation({
  positions,
  indices,
  edgeLengthRel: 0.2,
  young,
  poisson: 0,
  density: 7.85,
  strength: 235,
  gravity: false,
  regions: [
    { kind: 'fixed', triangles: [0, 1], normal: [0, 0, -1], pressure: 0 },
    { kind: 'pressure', triangles: [2, 3], normal: [0, 0, 1], pressure: -stress },
  ],
  forces: [],
}, async (vertices, faces, edgeLengthRel) => mesher.tetrahedralizeTyped(vertices, faces, { idealEdgeLengthRel: edgeLengthRel, epsRel: 1e-3 }))

let top = 0
let topCount = 0
for (let node = 0; node < wild.positions.length / 3; node++) {
  if (wild.positions[node * 3 + 2] < length * 0.9) continue
  top += wild.displacement[node * 3 + 2]
  topCount += 1
}
if (topCount === 0) throw new Error('no top nodes')
const mean = top / topCount
const target = stress * length / young
if (wild.maxVonMises < stress * 0.5 || wild.maxVonMises > stress * 2) {
  throw new Error(`wild stress ${wild.minVonMises}..${wild.maxVonMises}`)
}
if (Math.abs(mean - target) > target * 0.25) throw new Error(`wild uz ${mean}, expected ${target}`)
console.log(`mesh check ok, tets ${wild.tetCount}, σ ${wild.minVonMises.toFixed(3)}..${wild.maxVonMises.toFixed(3)} MPa, uz ${mean.toFixed(4)} mm`)

function near(name: string, actual: number, expected: number) {
  const tol = 1e-5 * Math.max(1, Math.abs(expected))
  if (Math.abs(actual - expected) > tol) throw new Error(`${name}: got ${actual}, expected ${expected}`)
}
