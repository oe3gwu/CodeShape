import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useI18n, type MessageKey } from '../i18n'
import type { DisplayPart, Planes, Projection, RenderMode, SavedView, Theme, ViewName } from '../types'
import { Engine } from './engine'
import { Icon } from '../layout/icons'
import type { CubeLabels } from './viewCube'

export type ViewportHandle = {
  fit: () => void
  setView: (view: ViewName) => void
  captureView: () => SavedView | null
}

const modes: RenderMode[] = ['shaded-edges', 'shaded', 'translucent', 'wire']

const modeKey: Record<RenderMode, MessageKey> = {
  'shaded-edges': 'modeShadedEdges',
  shaded: 'modeShaded',
  translucent: 'modeTranslucent',
  wire: 'modeWire',
}

type Props = {
  parts: DisplayPart[]
  hidden: Record<string, boolean>
  selectedId: string | null
  theme: Theme
  renderMode: RenderMode
  projection: Projection
  planes: Planes
  initialView: SavedView | null
  onViewChange: (view: SavedView) => void
  error: string | null
  building: boolean
  onSelect: (id: string | null) => void
  onRenderMode: (mode: RenderMode) => void
  onProjection: (projection: Projection) => void
}

export const Viewport = forwardRef<ViewportHandle, Props>(function Viewport(props, ref) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cubeRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const handlers = useRef({
    onSelect: props.onSelect,
    onContext: (_x: number, _y: number) => {},
    onViewChange: props.onViewChange,
  })
  const { t } = useI18n()
  const initialView = useRef(props.initialView)
  const initialProjection = useRef(props.projection)
  const cubeLabels: CubeLabels = {
    px: t('right'),
    nx: t('left'),
    py: t('back'),
    ny: t('front'),
    pz: t('top'),
    nz: t('bottom'),
  }
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  handlers.current.onSelect = props.onSelect
  handlers.current.onContext = (x, y) => setMenu({ x, y })
  handlers.current.onViewChange = props.onViewChange

  useImperativeHandle(ref, () => ({
    fit: () => engineRef.current?.fit(),
    setView: (view) => engineRef.current?.setView(view),
    captureView: () => engineRef.current?.captureView() ?? null,
  }))

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    const cube = cubeRef.current
    if (!host || !canvas || !cube) return
    const engine = new Engine(host, canvas, cube, {
      onSelect: (id) => handlers.current.onSelect(id),
      onContextMenu: (x, y) => handlers.current.onContext(x, y),
      onViewChange: (view) => handlers.current.onViewChange(view),
    }, initialProjection.current)
    if (initialView.current) engine.restoreView(initialView.current)
    engineRef.current = engine
    return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  useEffect(() => { engineRef.current?.setParts(props.parts) }, [props.parts])
  useEffect(() => { engineRef.current?.setVisibility(props.hidden) }, [props.hidden, props.parts])
  useEffect(() => { engineRef.current?.setSelected(props.selectedId) }, [props.selectedId, props.parts])
  useEffect(() => { engineRef.current?.setTheme(props.theme) }, [props.theme])
  useEffect(() => { engineRef.current?.setRenderMode(props.renderMode) }, [props.renderMode, props.parts])
  useEffect(() => { engineRef.current?.setProjection(props.projection) }, [props.projection])
  useEffect(() => { engineRef.current?.setPlanes(props.planes) }, [props.planes])
  useEffect(() => { engineRef.current?.setCubeLabels(cubeLabels) }, [t])

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [menu])

  const cycleMode = () => {
    const index = modes.indexOf(props.renderMode)
    props.onRenderMode(modes[(index + 1) % modes.length])
  }

  return (
    <div className={`cs-viewport ${props.theme === 'dark' ? 'is-dark' : 'is-light'}`} ref={hostRef}>
      <canvas ref={canvasRef} className="cs-canvas" />
      <canvas ref={cubeRef} className="cs-cube" title={t('viewCube')} />
      <div className="cs-viewtools">
        <button title={`${t('fit')} (F)`} onClick={() => engineRef.current?.fit()}><Icon name="fit" /></button>
        <button title={t('iso')} onClick={() => engineRef.current?.setView('iso')}><Icon name="iso" /></button>
        <button title={t(modeKey[props.renderMode])} onClick={cycleMode}><Icon name="cube" /></button>
        <button
          title={props.projection === 'ortho' ? t('ortho') : t('perspective')}
          onClick={() => props.onProjection(props.projection === 'ortho' ? 'perspective' : 'ortho')}
        >
          <Icon name="camera" />
        </button>
      </div>
      {props.building && props.parts.length === 0 ? <div className="cs-busy">{t('building')}</div> : null}
      {props.error ? <div className="cs-banner">{props.error}</div> : null}
      {menu ? (
        <div
          className="cs-context"
          style={{ left: menu.x, top: menu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button onClick={() => { engineRef.current?.fit(); setMenu(null) }}>{t('fit')}</button>
          <button onClick={() => { engineRef.current?.setView('iso'); setMenu(null) }}>{t('iso')}</button>
          <button onClick={() => { engineRef.current?.setView('front'); setMenu(null) }}>{t('front')}</button>
          <button onClick={() => { engineRef.current?.setView('top'); setMenu(null) }}>{t('top')}</button>
          <button onClick={() => { engineRef.current?.setView('right'); setMenu(null) }}>{t('right')}</button>
          <hr />
          {modes.map((mode) => (
            <button
              key={mode}
              className={mode === props.renderMode ? 'is-active' : ''}
              onClick={() => { props.onRenderMode(mode); setMenu(null) }}
            >
              {t(modeKey[mode])}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
})
