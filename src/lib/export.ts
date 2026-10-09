import type { DisplayPart } from '../types'

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function meshesToStl(parts: DisplayPart[]): Blob {
  let count = 0
  for (const part of parts) {
    if (part.kind !== 'mesh') continue
    count += part.indices.length / 3
  }
  const buffer = new ArrayBuffer(84 + count * 50)
  const view = new DataView(buffer)
  const header = 'CodeShape'
  for (let i = 0; i < header.length; i++) view.setUint8(i, header.charCodeAt(i))
  view.setUint32(80, count, true)
  let offset = 84
  for (const part of parts) {
    if (part.kind !== 'mesh') continue
    const pos = part.positions
    const idx = part.indices
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 3
      const b = idx[i + 1] * 3
      const c = idx[i + 2] * 3
      const ax = pos[a]
      const ay = pos[a + 1]
      const az = pos[a + 2]
      const bx = pos[b]
      const by = pos[b + 1]
      const bz = pos[b + 2]
      const cx = pos[c]
      const cy = pos[c + 1]
      const cz = pos[c + 2]
      const ux = bx - ax
      const uy = by - ay
      const uz = bz - az
      const vx = cx - ax
      const vy = cy - ay
      const vz = cz - az
      let nx = uy * vz - uz * vy
      let ny = uz * vx - ux * vz
      let nz = ux * vy - uy * vx
      const len = Math.hypot(nx, ny, nz) || 1
      nx /= len
      ny /= len
      nz /= len
      view.setFloat32(offset, nx, true)
      view.setFloat32(offset + 4, ny, true)
      view.setFloat32(offset + 8, nz, true)
      offset += 12
      const verts = [ax, ay, az, bx, by, bz, cx, cy, cz]
      for (const value of verts) {
        view.setFloat32(offset, value, true)
        offset += 4
      }
      view.setUint16(offset, 0, true)
      offset += 2
    }
  }
  return new Blob([buffer], { type: 'model/stl' })
}

export function meshesToObj(parts: DisplayPart[]): Blob {
  let text = '# CodeShape\n'
  let base = 1
  for (const part of parts) {
    if (part.kind !== 'mesh') continue
    text += `o ${part.name.replace(/\s+/g, '_')}\n`
    const pos = part.positions
    for (let i = 0; i < pos.length; i += 3) {
      text += `v ${pos[i]} ${pos[i + 1]} ${pos[i + 2]}\n`
    }
    const idx = part.indices
    for (let i = 0; i < idx.length; i += 3) {
      text += `f ${idx[i] + base} ${idx[i + 1] + base} ${idx[i + 2] + base}\n`
    }
    base += pos.length / 3
  }
  return new Blob([text], { type: 'text/plain' })
}
