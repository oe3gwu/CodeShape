import wasmUrl from '../../node_modules/float-tetwild-wasm/dist/floattetwild.serial.wasm?url'
import { loadSerialMesher } from '../lib/fem/tetwild'
import { runSimulation, type SimRequest, type SimSuccess } from '../lib/fem/simulate'

type Inbound = { id: number; request: SimRequest }
type Progress = { id: number; type: 'progress'; stage: 'mesh' | 'solve' }
type Done = { id: number; type: 'done'; ok: true; result: SimSuccess } | { id: number; type: 'done'; ok: false; error: string }

let mesher: ReturnType<typeof loadSerialMesher> | null = null

function engine() {
  mesher ??= loadSerialMesher(wasmUrl)
  return mesher
}

self.onmessage = (event: MessageEvent<Inbound>) => {
  const { id, request } = event.data
  void run(id, request)
}

async function run(id: number, request: SimRequest) {
  try {
    const loaded = await engine()
    const result = await runSimulation(request, async (vertices, faces, edgeLengthRel) => {
      return loaded.tetrahedralizeTyped(vertices, faces, edgeLengthRel)
    }, (stage) => {
      const progress: Progress = { id, type: 'progress', stage }
      self.postMessage(progress)
    })
    const done: Done = { id, type: 'done', ok: true, result }
    const transfer = [result.positions.buffer, result.indices.buffer, result.displacement.buffer, result.nodalVonMises.buffer, result.faceElement.buffer, result.elementVonMises.buffer]
    self.postMessage(done, { transfer })
  } catch (error) {
    const done: Done = { id, type: 'done', ok: false, error: error instanceof Error ? error.message : 'femFailed' }
    self.postMessage(done)
  }
}
