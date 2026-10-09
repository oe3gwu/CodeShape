import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { DisplayPart, Planes, Projection, RenderMode, SavedView, Theme, ViewName } from '../types'
import { featureEdges } from './featureEdges'
import { CUBE_CAMERA_DISTANCE, createViewCube, regionFromHit, type CubeLabels, type ViewCubeParts } from './viewCube'

export type EngineHandlers = {
  onSelect: (id: string | null) => void
  onContextMenu: (x: number, y: number) => void
  onViewChange?: (view: SavedView) => void
}

type PartObject = {
  id: string
  group: THREE.Group
  mesh: THREE.Mesh | null
  lines: THREE.LineSegments
  baseOpacity: number
}

const VIEW_DIRECTION: Record<ViewName, THREE.Vector3> = {
  front: new THREE.Vector3(0, -1, 0),
  back: new THREE.Vector3(0, 1, 0),
  left: new THREE.Vector3(-1, 0, 0),
  right: new THREE.Vector3(1, 0, 0),
  top: new THREE.Vector3(0, -0.001, 1).normalize(),
  bottom: new THREE.Vector3(0, 0.001, -1).normalize(),
  iso: new THREE.Vector3(1, -1.15, 0.82).normalize(),
}

export class Engine {
  private readonly renderer: THREE.WebGLRenderer
  private readonly cubeRenderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly cubeScene = new THREE.Scene()
  private readonly persp: THREE.PerspectiveCamera
  private readonly ortho: THREE.OrthographicCamera
  private readonly controls: OrbitControls
  private readonly raycaster = new THREE.Raycaster()
  private readonly cubeRaycaster = new THREE.Raycaster()
  private readonly hemi: THREE.HemisphereLight
  private readonly planes: Record<keyof Planes, THREE.Object3D>
  private cube: ViewCubeParts
  private readonly cubeCamera: THREE.PerspectiveCamera
  private partObjects: PartObject[] = []
  private frame = 0
  private width = 1
  private height = 1
  private projection: Projection = 'perspective'
  private renderMode: RenderMode = 'shaded-edges'
  private selected: string | null = null
  private orthoHeight = 180
  private readonly edgeColor = new THREE.Color('#3a4048')
  private readonly observer: ResizeObserver
  private pointer = { x: 0, y: 0, button: -1 }
  private didFit = false
  private viewTimer = 0
  private theme: Theme = 'light'
  private cubeLabels: CubeLabels | undefined

  constructor(
    private readonly host: HTMLElement,
    private readonly canvas: HTMLCanvasElement,
    private readonly cubeCanvas: HTMLCanvasElement,
    private readonly handlers: EngineHandlers,
    initialProjection: Projection = 'perspective',
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.02

    this.cubeRenderer = new THREE.WebGLRenderer({ canvas: cubeCanvas, antialias: true, alpha: true })
    this.cubeRenderer.setClearColor(0x000000, 0)
    this.cubeRenderer.outputColorSpace = THREE.SRGBColorSpace

    this.persp = new THREE.PerspectiveCamera(32, 1, 0.1, 20000)
    this.persp.up.set(0, 0, 1)
    this.persp.position.set(140, -170, 110)
    this.ortho = new THREE.OrthographicCamera(-100, 100, 100, -100, 0.1, 20000)
    this.ortho.up.set(0, 0, 1)
    this.ortho.position.copy(this.persp.position)

    this.controls = new OrbitControls(this.persp, canvas)
    this.controls.target.set(0, 0, 16)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.12
    this.controls.rotateSpeed = 0.8
    this.controls.panSpeed = 0.75
    this.controls.zoomSpeed = 0.85
    this.controls.screenSpacePanning = true
    this.controls.mouseButtons = {
      LEFT: null,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE,
    }
    this.projection = initialProjection
    if (initialProjection === 'ortho') this.controls.object = this.ortho
    this.controls.update()
    this.controls.addEventListener('change', this.onControlsChange)
    window.addEventListener('pagehide', this.flushView)

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environmentIntensity = 0.82
    pmrem.dispose()

    this.hemi = new THREE.HemisphereLight(0xf7f9fc, 0xb7c0ca, 0.55)
    this.scene.add(this.hemi)
    const key = new THREE.DirectionalLight(0xffffff, 2.35)
    key.position.set(80, -110, 160)
    this.scene.add(key)
    this.scene.add(key.target)
    const fill = new THREE.DirectionalLight(0xe8eef8, 0.7)
    fill.position.set(-90, 40, 70)
    this.scene.add(fill)
    const rim = new THREE.DirectionalLight(0xffffff, 0.35)
    rim.position.set(10, 140, 40)
    this.scene.add(rim)

    this.planes = {
      origin: this.makeOrigin(),
      top: this.makePlane('#2f6fed', new THREE.Euler(0, 0, 0)),
      front: this.makePlane('#d4534e', new THREE.Euler(-Math.PI / 2, 0, 0)),
      right: this.makePlane('#2f9d5a', new THREE.Euler(0, Math.PI / 2, 0)),
    }
    for (const object of Object.values(this.planes)) {
      object.visible = false
      this.scene.add(object)
    }

    this.cubeCamera = new THREE.PerspectiveCamera(28, 1, 0.1, 30)
    this.cubeCamera.up.set(0, 0, 1)
    this.cube = createViewCube('light')
    this.cubeScene.add(this.cube.mesh, this.cube.highlight, this.cube.ring)
    const cubeLight = new THREE.AmbientLight(0xffffff, 1)
    this.cubeScene.add(cubeLight)

    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('contextmenu', this.onContextMenu)
    cubeCanvas.addEventListener('pointerdown', this.onCubePointer)
    cubeCanvas.addEventListener('pointermove', this.onCubeHover)
    cubeCanvas.addEventListener('pointerleave', this.onCubeLeave)

    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(host)
    this.resize()
    this.frame = requestAnimationFrame(this.loop)
  }

  dispose() {
    cancelAnimationFrame(this.frame)
    window.clearTimeout(this.viewTimer)
    this.controls.removeEventListener('change', this.onControlsChange)
    window.removeEventListener('pagehide', this.flushView)
    this.observer.disconnect()
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointerup', this.onPointerUp)
    this.canvas.removeEventListener('contextmenu', this.onContextMenu)
    this.cubeCanvas.removeEventListener('pointerdown', this.onCubePointer)
    this.cubeCanvas.removeEventListener('pointermove', this.onCubeHover)
    this.cubeCanvas.removeEventListener('pointerleave', this.onCubeLeave)
    this.clearParts()
    this.controls.dispose()
    this.renderer.dispose()
    this.cubeRenderer.dispose()
    this.disposeCube()
  }

  setParts(parts: DisplayPart[]) {
    this.clearParts()
    for (const part of parts) {
      const object = this.createPart(part)
      this.partObjects.push(object)
      this.scene.add(object.group)
    }
    this.applySelection()
    if (!this.didFit && this.partObjects.length > 0) {
      this.fit()
      this.didFit = true
    }
  }

  setVisibility(hidden: Record<string, boolean>) {
    for (const part of this.partObjects) part.group.visible = !hidden[part.id]
  }

  setSelected(id: string | null) {
    this.selected = id
    this.applySelection()
  }

  setTheme(theme: Theme) {
    this.theme = theme
    this.edgeColor.set(theme === 'dark' ? '#d5dbe3' : '#3a4048')
    this.scene.environmentIntensity = theme === 'dark' ? 0.55 : 0.82
    this.hemi.intensity = theme === 'dark' ? 0.32 : 0.55
    this.renderer.toneMappingExposure = theme === 'dark' ? 0.92 : 1.02
    this.rebuildCube()
    this.applySelection()
  }

  setCubeLabels(labels: CubeLabels) {
    this.cubeLabels = labels
    this.rebuildCube()
  }

  private rebuildCube() {
    this.disposeCube()
    this.cube = createViewCube(this.theme, this.cubeLabels)
    this.cubeScene.add(this.cube.mesh, this.cube.highlight, this.cube.ring)
  }

  setRenderMode(mode: RenderMode) {
    this.renderMode = mode
    for (const part of this.partObjects) this.applyMode(part)
    this.applySelection()
  }

  setProjection(projection: Projection) {
    if (projection === this.projection) return
    const target = this.controls.target
    if (projection === 'ortho') {
      const dist = Math.max(1, this.persp.position.distanceTo(target))
      this.orthoHeight = 2 * Math.tan(THREE.MathUtils.degToRad(this.persp.fov) / 2) * dist
      this.ortho.zoom = 1
      this.ortho.position.copy(this.persp.position)
      this.ortho.up.copy(this.persp.up)
      this.ortho.lookAt(target)
      this.applyOrthoFrustum()
      this.controls.object = this.ortho
    } else {
      const visible = this.orthoHeight / this.ortho.zoom
      const dist = visible / (2 * Math.tan(THREE.MathUtils.degToRad(this.persp.fov) / 2))
      const dir = this.ortho.position.clone().sub(target).normalize()
      this.persp.position.copy(target).addScaledVector(dir, dist)
      this.persp.up.copy(this.ortho.up)
      this.persp.lookAt(target)
      this.controls.object = this.persp
    }
    this.projection = projection
    this.controls.update()
  }

  setPlanes(planes: Planes) {
    for (const key of Object.keys(planes) as Array<keyof Planes>) {
      this.planes[key].visible = planes[key]
    }
  }

  fit() {
    const box = new THREE.Box3()
    let found = false
    for (const part of this.partObjects) {
      if (!part.group.visible || !part.mesh) continue
      box.expandByObject(part.mesh)
      found = true
    }
    if (!found) box.set(new THREE.Vector3(-40, -40, 0), new THREE.Vector3(40, 40, 40))
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const radius = Math.max(size.length() * 0.5, 10)
    const dist = (radius / Math.sin(THREE.MathUtils.degToRad(this.persp.fov) / 2)) * 1.2
    const dir = this.active.position.clone().sub(this.controls.target)
    if (dir.lengthSq() < 1e-8) dir.copy(VIEW_DIRECTION.iso)
    this.place(dir.normalize(), center, dist, radius)
  }

  captureView(): SavedView {
    const camera = this.active
    const position = camera.position.toArray()
    const target = this.controls.target.toArray()
    const up = camera.up.toArray()
    return {
      position: [position[0], position[1], position[2]],
      target: [target[0], target[1], target[2]],
      up: [up[0], up[1], up[2]],
      orthoHeight: this.orthoHeight,
      orthoZoom: this.ortho.zoom,
    }
  }

  restoreView(view: SavedView) {
    this.persp.position.fromArray(view.position)
    this.ortho.position.fromArray(view.position)
    this.persp.up.fromArray(view.up)
    this.ortho.up.fromArray(view.up)
    this.controls.target.fromArray(view.target)
    this.orthoHeight = view.orthoHeight
    this.ortho.zoom = view.orthoZoom
    const dist = Math.max(1, this.persp.position.distanceTo(this.controls.target))
    this.persp.near = Math.max(0.05, dist / 300)
    this.persp.far = dist * 400
    this.persp.lookAt(this.controls.target)
    this.ortho.lookAt(this.controls.target)
    this.persp.updateProjectionMatrix()
    this.applyOrthoFrustum()
    this.controls.update()
    this.didFit = true
    const radius = dist * Math.sin(THREE.MathUtils.degToRad(this.persp.fov) / 2)
    this.scalePlanes(Math.max(radius, 10))
  }

  setView(view: ViewName) {
    this.setDirection(VIEW_DIRECTION[view])
  }

  setDirection(dir: THREE.Vector3) {
    const box = new THREE.Box3()
    let found = false
    for (const part of this.partObjects) {
      if (!part.group.visible || !part.mesh) continue
      box.expandByObject(part.mesh)
      found = true
    }
    const center = found ? box.getCenter(new THREE.Vector3()) : new THREE.Vector3()
    const radius = found ? Math.max(box.getSize(new THREE.Vector3()).length() * 0.5, 10) : 40
    const dist = (radius / Math.sin(THREE.MathUtils.degToRad(this.persp.fov) / 2)) * 1.25
    const direction = dir.clone().normalize()
    if (Math.abs(direction.z) > 0.995) {
      direction.y += direction.z > 0 ? -0.02 : 0.02
      direction.normalize()
    }
    this.place(direction, center, dist, radius)
  }

  private get active() {
    return this.projection === 'ortho' ? this.ortho : this.persp
  }

  private place(dir: THREE.Vector3, center: THREE.Vector3, distance: number, radius: number) {
    const up = new THREE.Vector3(0, 0, 1)
    this.controls.target.copy(center)
    const position = center.clone().addScaledVector(dir, distance)
    this.persp.up.copy(up)
    this.ortho.up.copy(up)
    this.persp.position.copy(position)
    this.ortho.position.copy(position)
    this.persp.near = Math.max(0.05, distance / 300)
    this.persp.far = distance * 400
    this.persp.lookAt(center)
    this.ortho.lookAt(center)
    this.ortho.zoom = 1
    this.orthoHeight = 2 * Math.tan(THREE.MathUtils.degToRad(this.persp.fov) / 2) * distance
    this.persp.updateProjectionMatrix()
    this.applyOrthoFrustum()
    this.controls.update()
    this.scalePlanes(radius)
  }

  private scalePlanes(radius: number) {
    const scale = Math.max(radius * 2.4, 80)
    for (const key of ['top', 'front', 'right'] as const) this.planes[key].scale.setScalar(scale)
    this.planes.origin.scale.setScalar(Math.max(radius * 0.45, 18))
  }

  private readonly onControlsChange = () => {
    window.clearTimeout(this.viewTimer)
    this.viewTimer = window.setTimeout(() => this.emitView(), 150)
  }

  private readonly flushView = () => {
    window.clearTimeout(this.viewTimer)
    this.emitView()
  }

  private emitView() {
    this.handlers.onViewChange?.(this.captureView())
  }

  private applyOrthoFrustum() {
    const aspect = this.width / Math.max(1, this.height)
    const height = this.orthoHeight
    this.ortho.left = (-height * aspect) / 2
    this.ortho.right = (height * aspect) / 2
    this.ortho.top = height / 2
    this.ortho.bottom = -height / 2
    this.ortho.near = 0.05
    this.ortho.far = 50000
    this.ortho.updateProjectionMatrix()
  }

  private createPart(part: DisplayPart): PartObject {
    const group = new THREE.Group()
    group.userData.partId = part.id
    const color = new THREE.Color().setRGB(part.color[0], part.color[1], part.color[2], THREE.SRGBColorSpace)
    if (part.kind === 'lines') {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(part.positions, 3))
      const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color }))
      group.add(lines)
      return { id: part.id, group, mesh: null, lines, baseOpacity: part.color[3] }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(part.positions, 3))
    geometry.setIndex(new THREE.BufferAttribute(part.indices, 1))
    geometry.computeVertexNormals()
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.42,
      metalness: 0.14,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.userData.partId = part.id
    const lines = new THREE.LineSegments(
      featureEdges(geometry, 28),
      new THREE.LineBasicMaterial({ color: this.edgeColor }),
    )
    group.add(mesh, lines)
    const object = { id: part.id, group, mesh, lines, baseOpacity: part.color[3] }
    this.applyMode(object)
    return object
  }

  private applyMode(part: PartObject) {
    if (!part.mesh) {
      part.lines.visible = true
      return
    }
    const material = part.mesh.material as THREE.MeshStandardMaterial
    const wire = this.renderMode === 'wire'
    const translucent = this.renderMode === 'translucent'
    material.wireframe = wire
    material.transparent = translucent || part.baseOpacity < 0.999
    material.opacity = translucent ? Math.min(part.baseOpacity, 0.42) : part.baseOpacity
    material.depthWrite = !translucent
    material.needsUpdate = true
    part.lines.visible = this.renderMode === 'shaded-edges'
  }

  private applySelection() {
    for (const part of this.partObjects) {
      const selected = part.id === this.selected
      if (part.mesh) {
        const material = part.mesh.material as THREE.MeshStandardMaterial
        material.emissive.set(selected ? 0x1a56d6 : 0x000000)
        material.emissiveIntensity = selected ? 0.38 : 0
      }
      const lineMaterial = part.lines.material as THREE.LineBasicMaterial
      lineMaterial.color.set(selected ? 0x1a56d6 : this.edgeColor)
    }
  }

  private clearParts() {
    for (const part of this.partObjects) {
      part.group.removeFromParent()
      part.mesh?.geometry.dispose()
      ;(part.mesh?.material as THREE.Material | undefined)?.dispose()
      part.lines.geometry.dispose()
      ;(part.lines.material as THREE.Material).dispose()
    }
    this.partObjects = []
  }

  private makePlane(color: string, rotation: THREE.Euler) {
    const group = new THREE.Group()
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material)
    const border = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1)),
      new THREE.LineBasicMaterial({ color }),
    )
    group.add(mesh, border)
    group.rotation.copy(rotation)
    return group
  }

  private makeOrigin() {
    return new THREE.AxesHelper(1)
  }

  private resize() {
    const rect = this.host.getBoundingClientRect()
    this.width = Math.max(1, rect.width)
    this.height = Math.max(1, rect.height)
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    this.renderer.setPixelRatio(ratio)
    this.renderer.setSize(this.width, this.height, false)
    this.persp.aspect = this.width / this.height
    this.persp.updateProjectionMatrix()
    this.applyOrthoFrustum()
    this.cubeRenderer.setPixelRatio(ratio)
    this.cubeRenderer.setSize(this.cubeCanvas.clientWidth, this.cubeCanvas.clientHeight, false)
  }

  private pick(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.active)
    const meshes = this.partObjects.flatMap((part) => (part.mesh && part.group.visible ? [part.mesh] : []))
    const hit = this.raycaster.intersectObjects(meshes, false)[0]
    const id = hit ? String(hit.object.userData.partId) : null
    this.handlers.onSelect(id)
  }

  private readonly onPointerDown = (event: PointerEvent) => {
    this.pointer = { x: event.clientX, y: event.clientY, button: event.button }
  }

  private readonly onPointerUp = (event: PointerEvent) => {
    const distance = Math.hypot(event.clientX - this.pointer.x, event.clientY - this.pointer.y)
    if (distance > 4 || this.pointer.button !== event.button) return
    if (event.button === 0) this.pick(event)
    if (event.button === 2) this.handlers.onContextMenu(event.clientX, event.clientY)
  }

  private readonly onContextMenu = (event: Event) => {
    event.preventDefault()
  }

  private readonly onCubePointer = (event: PointerEvent) => {
    event.stopPropagation()
    const region = this.cubeRegion(event)
    if (!region) return
    this.setDirection(region.direction)
  }

  private readonly onCubeHover = (event: PointerEvent) => {
    const region = this.cubeRegion(event)
    if (!region) {
      this.cube.highlight.visible = false
      return
    }
    this.cube.highlight.visible = true
    this.cube.highlight.position.copy(region.position)
    this.cube.highlight.scale.copy(region.scale)
    this.cube.highlight.quaternion.identity()
  }

  private readonly onCubeLeave = () => {
    this.cube.highlight.visible = false
  }

  private cubeRegion(event: PointerEvent) {
    const rect = this.cubeCanvas.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.cubeRaycaster.setFromCamera(new THREE.Vector2(x, y), this.cubeCamera)
    const hit = this.cubeRaycaster.intersectObject(this.cube.mesh, false)[0]
    if (!hit?.face) return null
    return regionFromHit(hit.point, hit.face.normal)
  }

  private readonly loop = () => {
    this.frame = requestAnimationFrame(this.loop)
    this.controls.update()
    this.renderer.render(this.scene, this.active)
    const offset = this.active.position.clone().sub(this.controls.target)
    if (offset.lengthSq() < 1e-8) offset.set(1, -1, 1)
    offset.normalize().multiplyScalar(CUBE_CAMERA_DISTANCE)
    this.cubeCamera.position.copy(offset)
    this.cubeCamera.up.copy(this.active.up)
    this.cubeCamera.lookAt(0, 0, 0)
    this.cube.ring.lookAt(this.cubeCamera.position)
    this.cubeRenderer.render(this.cubeScene, this.cubeCamera)
  }

  private disposeCube() {
    const { mesh, highlight, ring } = this.cube
    mesh.removeFromParent()
    highlight.removeFromParent()
    ring.removeFromParent()
    mesh.geometry.dispose()
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) {
      const mapped = material as THREE.MeshBasicMaterial
      mapped.map?.dispose()
      mapped.dispose()
    }
    const edges = mesh.children[0] as THREE.LineSegments | undefined
    edges?.geometry.dispose()
    ;(edges?.material as THREE.Material | undefined)?.dispose()
    highlight.geometry.dispose()
    ;(highlight.material as THREE.Material).dispose()
    ring.geometry.dispose()
    ;(ring.material as THREE.Material).dispose()
  }
}
