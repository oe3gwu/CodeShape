import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useDesign } from './hooks/useDesign'
import { EditorWindow } from './layout/EditorWindow'
import { FeaturePanel } from './layout/FeaturePanel'
import { InferenceWindow } from './layout/InferenceWindow'
import { ParameterDialog } from './layout/ParameterDialog'
import { TopBar } from './layout/TopBar'
import { displayError, useI18n, type MessageKey } from './i18n'
import { downloadBlob, meshesToObj, meshesToStl } from './lib/export'
import { loadPersisted, savePersisted } from './lib/storage'
import { SAMPLE, SAMPLE_NAME } from './sample'
import type { PlaneKey, Planes, Projection, RenderMode, SavedView, Theme } from './types'
import { Viewport, type ViewportHandle } from './viewer/Viewport'

const renderModes: RenderMode[] = ['shaded-edges', 'shaded', 'translucent', 'wire']

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.closest('.cm-editor')) return true
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

const modeKey: Record<RenderMode, MessageKey> = {
  'shaded-edges': 'modeShadedEdges',
  shaded: 'modeShaded',
  translucent: 'modeTranslucent',
  wire: 'modeWire',
}

export function App() {
  const { lang, t, toggle } = useI18n()
  const saved = useRef(loadPersisted()).current
  const [theme, setTheme] = useState<Theme>(saved.theme === 'dark' ? 'dark' : 'light')
  const [code, setCode] = useState(saved.code || SAMPLE)
  const [docName, setDocName] = useState(saved.docName || SAMPLE_NAME)
  const [editorOpen, setEditorOpen] = useState(saved.editorOpen !== false)
  const [treeOpen, setTreeOpen] = useState(saved.treeOpen !== false)
  const [treeWidth, setTreeWidth] = useState(clamp(saved.treeWidth ?? 286, 220, 460))
  const [editorWidth, setEditorWidth] = useState(clamp(saved.editorWidth ?? 440, 320, 760))
  const [chatOpen, setChatOpen] = useState(saved.chatOpen !== false)
  const [chatHeight, setChatHeight] = useState(clamp(saved.chatHeight ?? 196, 120, 420))
  const [renderMode, setRenderMode] = useState<RenderMode>(saved.renderMode && renderModes.includes(saved.renderMode) ? saved.renderMode : 'shaded-edges')
  const [projection, setProjection] = useState<Projection>(saved.projection === 'ortho' ? 'ortho' : 'perspective')
  const [planes, setPlanes] = useState<Planes>(saved.planes ?? { origin: false, top: false, front: false, right: false })
  const [view, setView] = useState<SavedView | null>(saved.view ?? null)
  const [hidden, setHidden] = useState<Record<string, boolean>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [help, setHelp] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const viewportRef = useRef<ViewportHandle>(null)
  const design = useDesign(code)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.lang = lang
    document.title = `${docName} — CodeShape`
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (icon) icon.href = theme === 'dark' ? '/branding/scch-weiss-icon.png' : '/branding/scch-schwarz-icon.png'
  }, [theme, docName, lang])

  useEffect(() => {
    savePersisted({ code, theme, lang, docName, editorOpen, treeOpen, treeWidth, editorWidth, chatOpen, chatHeight, renderMode, projection, planes, ...(view ? { view } : {}) })
  }, [code, theme, lang, docName, editorOpen, treeOpen, treeWidth, editorWidth, chatOpen, chatHeight, renderMode, projection, planes, view])

  const save = () => downloadBlob(new Blob([code], { type: 'text/javascript' }), `${docName || 'CodeShape'}.js`)

  const resetView = () => {
    setHidden({})
    setSelectedId(null)
    design.resetParams()
    window.setTimeout(() => viewportRef.current?.fit(), 400)
  }

  const onNew = () => {
    setCode(SAMPLE)
    setDocName(SAMPLE_NAME)
    resetView()
  }

  const onExport = (kind: 'stl' | 'obj') => {
    const visible = design.parts.filter((part) => !hidden[part.id] && part.kind === 'mesh')
    const blob = kind === 'stl' ? meshesToStl(visible) : meshesToObj(visible)
    downloadBlob(blob, `${docName || 'CodeShape'}.${kind}`)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setHelp(false)
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        save()
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        onNew()
        return
      }
      if (event.shiftKey && event.key === 'Enter' && !isTyping(event.target)) {
        event.preventDefault()
        design.rebuild()
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        design.rebuild()
        return
      }
      if (isTyping(event.target)) return
      if (event.key.toLowerCase() === 'f') {
        event.preventDefault()
        viewportRef.current?.fit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const startResize = (which: 'tree' | 'editor' | 'chat', event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const horizontal = which !== 'chat'
    const origin = horizontal ? event.clientX : event.clientY
    const start = which === 'tree' ? treeWidth : which === 'editor' ? editorWidth : chatHeight
    const move = (pointer: globalThis.PointerEvent) => {
      const delta = (horizontal ? pointer.clientX : pointer.clientY) - origin
      if (which === 'tree') setTreeWidth(clamp(start + delta, 220, 460))
      else if (which === 'editor') setEditorWidth(clamp(start - delta, 320, 760))
      else setChatHeight(clamp(start - delta, 120, 420))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.classList.remove('is-resizing', 'is-resizing-row')
    }
    document.body.classList.add(horizontal ? 'is-resizing' : 'is-resizing-row')
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const togglePlane = (key: PlaneKey) => {
    setPlanes((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      savePersisted({ planes: next })
      return next
    })
  }

  const onViewChange = (next: SavedView) => {
    setView(next)
    savePersisted({ view: next })
  }

  const shownError = design.error ? displayError(design.error, t) : null

  return (
    <div className="cs-app">
      <TopBar
        docName={docName}
        onDocName={setDocName}
        theme={theme}
        query={query}
        onQuery={setQuery}
        editorOpen={editorOpen}
        treeOpen={treeOpen}
        chatOpen={chatOpen}
        building={design.building}
        renderMode={renderMode}
        projection={projection}
        onNew={onNew}
        onOpen={() => fileRef.current?.click()}
        onSave={save}
        onExport={onExport}
        onRebuild={design.rebuild}
        onFit={() => viewportRef.current?.fit()}
        onIso={() => viewportRef.current?.setView('iso')}
        onToggleEditor={() => setEditorOpen((open) => !open)}
        onToggleTree={() => setTreeOpen((open) => !open)}
        onToggleChat={() => setChatOpen((open) => !open)}
        onRenderMode={setRenderMode}
        onProjection={setProjection}
        onTheme={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
        onToggleLang={toggle}
        onHelp={() => setHelp(true)}
      />
      <div className="cs-workspace">
        {treeOpen ? (
          <div className="cs-tree-wrap" style={{ width: treeWidth }}>
            <FeaturePanel
              docName={docName}
              query={query}
              onQuery={setQuery}
              planes={planes}
              onTogglePlane={togglePlane}
              parts={design.parts}
              hidden={hidden}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onTogglePart={(id) => setHidden((prev) => ({ ...prev, [id]: !prev[id] }))}
            />
          </div>
        ) : (
          <button className="cs-rail" title={t('featureList')} onClick={() => setTreeOpen(true)}>{t('features')}</button>
        )}
        {treeOpen ? <div className="cs-resizer" onPointerDown={(event) => startResize('tree', event)} /> : null}
        <div className="cs-stage">
          <div className="cs-stage-view">
            <Viewport
              ref={viewportRef}
              parts={design.parts}
              hidden={hidden}
              selectedId={selectedId}
              theme={theme}
              renderMode={renderMode}
              projection={projection}
              planes={planes}
              initialView={saved.view ?? null}
              onViewChange={onViewChange}
              error={shownError}
              building={design.building}
              onSelect={setSelectedId}
              onRenderMode={setRenderMode}
              onProjection={setProjection}
            />
            <ParameterDialog definitions={design.definitions} values={design.params} onChange={design.setParam} />
          </div>
          {chatOpen ? <div className="cs-resizer-row" onPointerDown={(event) => startResize('chat', event)} /> : null}
          {chatOpen ? (
            <div className="cs-inference-dock" style={{ height: chatHeight }}>
              <InferenceWindow onClose={() => setChatOpen(false)} />
            </div>
          ) : null}
        </div>
        {editorOpen ? <div className="cs-resizer" onPointerDown={(event) => startResize('editor', event)} /> : null}
        {editorOpen ? (
          <div className="cs-editor-dock" style={{ width: editorWidth }}>
            <EditorWindow
              code={code}
              theme={theme}
              docName={docName}
              building={design.building}
              onChange={setCode}
              onRebuild={design.rebuild}
              onClose={() => setEditorOpen(false)}
            />
          </div>
        ) : null}
      </div>
      <footer className="cs-status">
        <div className="cs-tab">
          <span className="cs-tab-mark" />
          {docName}
        </div>
        <div className={`cs-status-text ${shownError ? 'is-error' : ''}`} title={shownError ?? ''}>
          {design.building ? t('building') : shownError ? shownError : `${design.triangles.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US')} ${t('triangles')} · ${design.elapsed} ms`}
        </div>
        <div className="cs-status-meta">
          <span>{t(modeKey[renderMode])}</span>
          <span>{projection === 'ortho' ? t('ortho') : t('perspective')}</span>
        </div>
      </footer>
      {help ? (
        <div className="cs-modal-back" onPointerDown={() => setHelp(false)}>
          <div className="cs-modal" onPointerDown={(event) => event.stopPropagation()}>
            <header>
              <strong>{t('shortcuts')}</strong>
              <button onClick={() => setHelp(false)}>{t('helpClose')}</button>
            </header>
            <ul>
              <li><span>{t('save')}</span><kbd>{t('mod')}+S</kbd></li>
              <li><span>{t('new')}</span><kbd>{t('mod')}+N</kbd></li>
              <li><span>{t('rebuild')}</span><kbd>Shift+Enter</kbd></li>
              <li><span>{t('fit')}</span><kbd>F</kbd></li>
              <li><span>{t('helpOrbit')}</span><kbd>{t('mouseRight')}</kbd></li>
              <li><span>{t('helpPan')}</span><kbd>{t('mouseMiddle')}</kbd></li>
              <li><span>{t('helpZoom')}</span><kbd>{t('mouseWheel')}</kbd></li>
              <li><span>{t('helpSelect')}</span><kbd>{t('mouseLeft')}</kbd></li>
            </ul>
          </div>
        </div>
      ) : null}
      <input
        ref={fileRef}
        className="cs-file"
        type="file"
        accept=".js,.txt,.jscad"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          file.text().then((text) => {
            setCode(text)
            setDocName(file.name.replace(/\.(js|txt|jscad)$/i, '') || SAMPLE_NAME)
            resetView()
          })
        }}
      />
    </div>
  )
}
