const stops: Array<[number, [number, number, number]]> = [
  [0, [0.05, 0.16, 0.45]],
  [0.2, [0.4, 0.7, 0.95]],
  [0.45, [0.18, 0.72, 0.34]],
  [0.65, [0.95, 0.84, 0.16]],
  [0.82, [0.95, 0.48, 0.1]],
  [1, [0.82, 0.08, 0.08]],
]

export function stressRgb(t: number): [number, number, number] {
  const value = Math.min(1, Math.max(0, t))
  let upper = stops.length - 1
  for (let index = 1; index < stops.length; index++) {
    if (value <= stops[index][0]) {
      upper = index
      break
    }
  }
  const [leftT, left] = stops[upper - 1]
  const [rightT, right] = stops[upper]
  const span = rightT - leftT || 1
  const mix = (value - leftT) / span
  return [
    left[0] + (right[0] - left[0]) * mix,
    left[1] + (right[1] - left[1]) * mix,
    left[2] + (right[2] - left[2]) * mix,
  ]
}

export function stressColors(nodal: ArrayLike<number>, min: number, max: number) {
  const colors = new Float32Array(nodal.length * 3)
  const span = max - min
  for (let node = 0; node < nodal.length; node++) {
    const t = !(span > 1e-12) ? (max > 1e-9 ? 0.5 : 0) : (nodal[node] - min) / span
    const [red, green, blue] = stressRgb(t).map(srgbToLinear) as [number, number, number]
    colors[node * 3] = red
    colors[node * 3 + 1] = green
    colors[node * 3 + 2] = blue
  }
  return colors
}

function srgbToLinear(value: number) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}
