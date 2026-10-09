import * as THREE from 'three'
import type { Theme } from '../types'

export type CubeLabels = Record<'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz', string>

const germanLabels: CubeLabels = {
  px: 'Rechts',
  nx: 'Links',
  py: 'Hinten',
  ny: 'Vorne',
  pz: 'Oben',
  nz: 'Unten',
}

/** Abstand der Würfelkamera. Hält den Würfel mit Rand in der Zeichenfläche. */
export const CUBE_CAMERA_DISTANCE = 6.2

const HALF = 0.5
const EDGE = 0.56

function faceTexture(text: string, fill: string, ink: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas nicht verfügbar')
  context.fillStyle = fill
  context.fillRect(0, 0, 256, 256)
  context.fillStyle = ink
  context.font = '600 46px Segoe UI, Noto Sans, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text, 128, 132)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

export type ViewCubeParts = {
  mesh: THREE.Mesh
  highlight: THREE.Mesh
  ring: THREE.Mesh
}

export function createViewCube(theme: Theme, labels: CubeLabels = germanLabels): ViewCubeParts {
  const fill = theme === 'dark' ? '#e6ebf2' : '#fbfcfe'
  const top = theme === 'dark' ? '#f4f7fb' : '#ffffff'
  const ink = '#2c3440'
  const order = [
    ['px', fill],
    ['nx', fill],
    ['py', fill],
    ['ny', fill],
    ['pz', top],
    ['nz', theme === 'dark' ? '#d5dbe3' : '#e7edf3'],
  ] as const
  const materials = order.map(([key, color]) => new THREE.MeshBasicMaterial({
    map: faceTexture(labels[key], color, ink),
  }))
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materials)
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color: theme === 'dark' ? 0x8b93a0 : 0x9aa3af }),
  )
  mesh.add(edges)

  const highlight = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({
      color: 0x1c6ce5,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    }),
  )
  highlight.visible = false
  highlight.renderOrder = 2

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.92, 0.98, 72),
    new THREE.MeshBasicMaterial({
      color: theme === 'dark' ? 0x9aa3af : 0xb7c0cb,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    }),
  )
  ring.renderOrder = 1

  return { mesh, highlight, ring }
}

export type CubeRegion = {
  direction: THREE.Vector3
  position: THREE.Vector3
  scale: THREE.Vector3
}

export function regionFromHit(point: THREE.Vector3, normal: THREE.Vector3): CubeRegion {
  const n = normal.clone()
  const faceAxis = Math.abs(n.x) > 0.5 ? 0 : Math.abs(n.y) > 0.5 ? 1 : 2
  const uAxis = (faceAxis + 1) % 3
  const vAxis = (faceAxis + 2) % 3
  const u = point.getComponent(uAxis) / HALF
  const v = point.getComponent(vAxis) / HALF
  const uHot = Math.abs(u) >= EDGE
  const vHot = Math.abs(v) >= EDGE
  const faceSign = Math.sign(n.getComponent(faceAxis)) || 1
  const uSign = Math.sign(u) || 1
  const vSign = Math.sign(v) || 1

  const direction = new THREE.Vector3()
  direction.setComponent(faceAxis, faceSign)
  if (uHot) direction.setComponent(uAxis, uSign)
  if (vHot) direction.setComponent(vAxis, vSign)
  direction.normalize()

  const position = new THREE.Vector3()
  const scale = new THREE.Vector3(1, 1, 1)
  position.setComponent(faceAxis, faceSign * 0.5)

  if (!uHot && !vHot) {
    scale.setComponent(faceAxis, 0.06)
    scale.setComponent(uAxis, 0.5)
    scale.setComponent(vAxis, 0.5)
    position.setComponent(faceAxis, faceSign * 0.53)
  } else if (uHot && vHot) {
    scale.set(0.32, 0.32, 0.32)
    position.setComponent(faceAxis, faceSign * 0.46)
    position.setComponent(uAxis, uSign * 0.46)
    position.setComponent(vAxis, vSign * 0.46)
  } else if (uHot) {
    scale.setComponent(faceAxis, 0.1)
    scale.setComponent(uAxis, 0.28)
    scale.setComponent(vAxis, 0.42)
    position.setComponent(faceAxis, faceSign * 0.52)
    position.setComponent(uAxis, uSign * 0.46)
  } else {
    scale.setComponent(faceAxis, 0.1)
    scale.setComponent(vAxis, 0.28)
    scale.setComponent(uAxis, 0.42)
    position.setComponent(faceAxis, faceSign * 0.52)
    position.setComponent(vAxis, vSign * 0.46)
  }

  return { direction, position, scale }
}
