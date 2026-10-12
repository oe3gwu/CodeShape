type TetModule = {
  allocBuffer: (bytes: number) => number
  freeBuffer: (pointer: number) => void
  HEAPF64: Float64Array
  HEAP32: Int32Array
  tetrahedralize: (
    vertices: number,
    vertexCount: number,
    faces: number,
    faceCount: number,
    params: Record<string, number | boolean>,
  ) => { status: number; verticesView: () => Float64Array; tetsView: () => Uint32Array; delete: () => void }
}

type Factory = (args?: Record<string, unknown>) => Promise<TetModule>

export async function loadSerialMesher(wasmUrl: string) {
  // The serial build is JavaScript without types. The threaded build is not loaded.
  // @ts-expect-error serial fTetWild build has no type declarations
  const imported = await import('../../../node_modules/float-tetwild-wasm/dist/floattetwild.serial.mjs')
  const create = imported.default as Factory
  const module = await create({
    locateFile: (path: string) => (path.endsWith('.wasm') ? wasmUrl : path),
    print: () => {},
    printErr: () => {},
  })
  return {
    tetrahedralizeTyped(vertices: ArrayLike<number>, faces: ArrayLike<number>, edgeLengthRel: number) {
      const vertexBuffer = writeHeap(module, vertices, Float64Array, 'HEAPF64')
      const faceBuffer = writeHeap(module, faces, Int32Array, 'HEAP32')
      let result: ReturnType<TetModule['tetrahedralize']> | null = null
      try {
        result = module.tetrahedralize(vertexBuffer.pointer, vertexBuffer.length, faceBuffer.pointer, faceBuffer.length, {
          epsRel: 1e-3,
          idealEdgeLengthRel: edgeLengthRel,
          stopEnergy: 10,
          maxIts: 80,
          disableFiltering: false,
          coarsen: false,
          manifoldSurface: false,
          numThreads: 0,
        })
        return { status: result.status, vertices: result.verticesView().slice(), tets: result.tetsView().slice() }
      } finally {
        vertexBuffer.free()
        faceBuffer.free()
        result?.delete()
      }
    },
  }
}

function writeHeap<T extends Float64Array | Int32Array>(module: TetModule, data: ArrayLike<number>, Ctor: { new (length: number): T; new (values: ArrayLike<number>): T; BYTES_PER_ELEMENT: number }, heap: 'HEAPF64' | 'HEAP32') {
  const typed = data instanceof Ctor ? data : new Ctor(data)
  const pointer = module.allocBuffer(typed.byteLength)
  const view = module[heap] as T
  view.set(typed, pointer / Ctor.BYTES_PER_ELEMENT)
  return { pointer, length: typed.length, free: () => module.freeBuffer(pointer) }
}
