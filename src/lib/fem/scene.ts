export type SimHit = {
  partId: string
  triangle: number
  point: [number, number, number]
  normal: [number, number, number]
}

export type SimArrow = {
  origin: [number, number, number]
  vector: [number, number, number]
  label: string
}

export type SimGuides = {
  partId: string
  fixed: number[]
  slide: number[]
  pressure: number[]
  arrows: SimArrow[]
}

export type SimResultView = {
  partId: string
  positions: Float32Array
  indices: Uint32Array
  displacement: Float32Array
  colors: Float32Array | null
  faceElement: Uint32Array
  elementVonMises: Float32Array
  minVonMises: number
  maxVonMises: number
  deformed: boolean
  scale: number
  opacity: number
  baseColor: [number, number, number]
}

export type SimScene = {
  guides: SimGuides | null
  result: SimResultView | null
}
