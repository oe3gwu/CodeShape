import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useDesign } from './hooks/useDesign'
import { EditorWindow } from './layout/EditorWindow'
import { FeaturePanel } from './layout/FeaturePanel'
import { FileBrowser } from './layout/FileBrowser'
import { GithubBrowser } from './layout/GithubBrowser'
import { InferenceWindow } from './layout/InferenceWindow'
import { ParameterDialog } from './layout/ParameterDialog'
import { SideRail } from './layout/SideRail'
import { TopBar } from './layout/TopBar'
import { displayError, useI18n, type MessageKey } from './i18n'
import { downloadBlob, meshesToObj, meshesToStl } from './lib/export'
import { displayPath, expandLocalIncludes, writeFileText } from './lib/files'
import { IncludeMissingError } from './lib/github'
import { loadPersisted, savePersisted } from './lib/storage'
import { SAMPLE, SAMPLE_NAME } from './sample'
import type { PlaneKey, Planes, Projection, RenderMode, SavedView, Theme } from './types'
import { Viewport, type ViewportHandle } from './viewer/Viewport'

const renderModes: RenderMode[] = ['shaded-edges', 'shaded', 'translucent', 'wire']
const treeRatioDefault = 0.115
const editorRatioDefault = 0.295
const chatRatioDefault = 0.18

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
  const [modelCode, setModelCode] = useState(saved.code || SAMPLE)
  const [docName, setDocName] = useState(saved.docName || SAMPLE_NAME)
  const [editorOpen, setEditorOpen] = useState(saved.editorOpen !== false)
  const [treeOpen, setTreeOpen] = useState(saved.treeOpen !== false)
  const [sideMode, setSideMode] = useState<'local' | 'files' | 'github'>(saved.sideMode === 'github' || saved.sideMode === 'files' ? saved.sideMode : 'local')
  const [githubUrl, setGithubUrl] = useState(saved.githubUrl ?? '')
  const [filesPath, setFilesPath] = useState(saved.filesPath ?? '')
  const [sourcePath, setSourcePath] = useState(saved.sourcePath ?? '')
  const [includeError, setIncludeError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [treeRatio, setTreeRatio] = useState(saved.treeRatio ?? treeRatioDefault)
  const [editorRatio, setEditorRatio] = useState(saved.editorRatio ?? editorRatioDefault)
  const [chatRatio, setChatRatio] = useState(saved.chatRatio ?? chatRatioDefault)
  const [treeWidth, setTreeWidth] = useState(() => clamp(window.innerWidth * (saved.treeRatio ?? treeRatioDefault), 200, 720))
  const [editorWidth, setEditorWidth] = useState(() => clamp(window.innerWidth * (saved.editorRatio ?? editorRatioDefault), 320, 1600))
  const [chatOpen, setChatOpen] = useState(saved.chatOpen !== false)
  const [chatHeight, setChatHeight] = useState(() => clamp(window.innerHeight * (saved.chatRatio ?? chatRatioDefault), 96, 480))
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
  const workspaceRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<'tree' | 'editor' | 'chat' | null>(null)
  const layoutRef = useRef({ tree: treeWidth, editor: editorWidth, chat: chatHeight })
  const codeRef = useRef(code)
  const sourcePathRef = useRef(sourcePath)
  const expandGen = useRef(0)
  codeRef.current = code
  sourcePathRef.current = sourcePath
  const design = useDesign(modelCode)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.lang = lang
    document.title = `${docName} — CodeShape`
  }, [theme, docName, lang])

  useEffect(() => {
    savePersisted({ code, theme, lang, docName, editorOpen, treeOpen, sideMode, githubUrl, filesPath, sourcePath, treeRatio, editorRatio, chatRatio, chatOpen, renderMode, projection, planes, ...(view ? { view } : {}) })
  }, [code, theme, lang, docName, editorOpen, treeOpen, sideMode, githubUrl, filesPath, sourcePath, treeRatio, editorRatio, chatRatio, chatOpen, renderMode, projection, planes, view])

  useEffect(() => {
    const workspace = workspaceRef.current
    const stage = stageRef.current
    if (!workspace) return
    const apply = () => {
      if (dragging.current) return
      const width = workspace.clientWidth
      if (width > 0) {
        const tree = clamp(width * treeRatio, 200, Math.max(220, width * 0.28))
        const editor = clamp(width * editorRatio, 320, Math.max(360, width * 0.62))
        layoutRef.current.tree = tree
        layoutRef.current.editor = editor
        setTreeWidth(tree)
        setEditorWidth(editor)
      }
      const height = stage?.clientHeight ?? 0
      if (height > 0) {
        const chat = clamp(height * chatRatio, 96, Math.max(120, height * 0.5))
        layoutRef.current.chat = chat
        setChatHeight(chat)
      }
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(workspace)
    if (stage) observer.observe(stage)
    return () => observer.disconnect()
  }, [treeRatio, editorRatio, chatRatio])

  useEffect(() => {
    const gen = ++expandGen.current
    if (!sourcePath) {
      setModelCode(code)
      setIncludeError(null)
      return
    }
    const timer = window.setTimeout(() => {
      void expandLocalIncludes(code, sourcePath).then((expanded) => {
        if (expandGen.current !== gen) return
        setModelCode(expanded)
        setIncludeError(null)
      }).catch((caught: unknown) => {
        if (expandGen.current !== gen) return
        setIncludeError(caught instanceof IncludeMissingError ? `${t('includeMissing')}: ${caught.spec}` : t('filesReadFailed'))
      })
    }, 160)
    return () => window.clearTimeout(timer)
  }, [code, sourcePath, t])

  const save = () => {
    const text = codeRef.current
    const target = sourcePathRef.current
    if (target) {
      void writeFileText(target, text).then(
        () => setSaveError(null),
        () => setSaveError(t('filesSaveFailed')),
      )
      return
    }
    setSaveError(null)
    downloadBlob(new Blob([text], { type: 'text/javascript' }), `${docName || 'CodeShape'}.js`)
  }

  const resetView = () => {
    setHidden({})
    setSelectedId(null)
    design.resetParams()
    window.setTimeout(() => viewportRef.current?.fit(), 400)
  }

  const onNew = () => {
    codeRef.current = SAMPLE
    sourcePathRef.current = ''
    setCode(SAMPLE)
    setSourcePath('')
    setDocName(SAMPLE_NAME)
    setIncludeError(null)
    setSaveError(null)
    resetView()
  }

  const rebuildModel = () => {
    const source = codeRef.current
    const target = sourcePathRef.current
    const gen = ++expandGen.current
    const apply = (expanded: string) => {
      if (expandGen.current !== gen) return
      setIncludeError(null)
      setModelCode(expanded)
      design.rebuild()
    }
    if (!target) {
      apply(source)
      return
    }
    void expandLocalIncludes(source, target).then(apply, (caught: unknown) => {
      if (expandGen.current !== gen) return
      setIncludeError(caught instanceof IncludeMissingError ? `${t('includeMissing')}: ${caught.spec}` : t('filesReadFailed'))
    })
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
        rebuildModel()
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        rebuildModel()
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
    dragging.current = which
    const horizontal = which !== 'chat'
    const origin = horizontal ? event.clientX : event.clientY
    const start = which === 'tree' ? treeWidth : which === 'editor' ? editorWidth : chatHeight
    const move = (pointer: globalThis.PointerEvent) => {
      const delta = (horizontal ? pointer.clientX : pointer.clientY) - origin
      const width = workspaceRef.current?.clientWidth ?? window.innerWidth
      const height = stageRef.current?.clientHeight ?? window.innerHeight
      if (which === 'tree') {
        const next = clamp(start + delta, 200, Math.max(220, width * 0.28))
        layoutRef.current.tree = next
        setTreeWidth(next)
      } else if (which === 'editor') {
        const next = clamp(start - delta, 320, Math.max(360, width * 0.62))
        layoutRef.current.editor = next
        setEditorWidth(next)
      } else {
        const next = clamp(start - delta, 96, Math.max(120, height * 0.5))
        layoutRef.current.chat = next
        setChatHeight(next)
      }
    }
    const up = () => {
      const width = workspaceRef.current?.clientWidth ?? window.innerWidth
      const height = stageRef.current?.clientHeight ?? window.innerHeight
      dragging.current = null
      if (which === 'tree') setTreeRatio(clamp(layoutRef.current.tree / width, 0.08, 0.28))
      else if (which === 'editor') setEditorRatio(clamp(layoutRef.current.editor / width, 0.16, 0.62))
      else setChatRatio(clamp(layoutRef.current.chat / height, 0.1, 0.5))
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

  const selectSide = (next: 'local' | 'files' | 'github') => {
    if (treeOpen && sideMode === next) setTreeOpen(false)
    else {
      setSideMode(next)
      setTreeOpen(true)
    }
  }

  const openGithubModel = (nextCode: string, nextName: string) => {
    codeRef.current = nextCode
    sourcePathRef.current = ''
    setCode(nextCode)
    setSourcePath('')
    setDocName(nextName)
    setIncludeError(null)
    setSaveError(null)
    setEditorOpen(true)
    resetView()
  }

  const openLocalFile = (nextCode: string, nextName: string, path: string) => {
    codeRef.current = nextCode
    sourcePathRef.current = path
    setCode(nextCode)
    setSourcePath(path)
    setDocName(nextName)
    setIncludeError(null)
    setSaveError(null)
    setEditorOpen(true)
    resetView()
  }

  const shownError = includeError ?? (design.error ? displayError(design.error, t) : null) ?? saveError

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
        onRebuild={rebuildModel}
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
      <div className="cs-workspace" ref={workspaceRef}>
        <SideRail mode={sideMode} open={treeOpen} onSelect={selectSide} />
        {treeOpen ? (
          <div className="cs-tree-wrap" style={{ width: treeWidth }}>
            {sideMode === 'github' ? (
              <GithubBrowser url={githubUrl} onUrl={setGithubUrl} onOpen={openGithubModel} />
            ) : sideMode === 'files' ? (
              <FileBrowser path={filesPath} activePath={sourcePath} onPath={setFilesPath} onOpen={openLocalFile} />
            ) : (
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
            )}
          </div>
        ) : null}
        {treeOpen ? <div className="cs-resizer" onPointerDown={(event) => startResize('tree', event)} /> : null}
        <div className="cs-stage" ref={stageRef}>
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
              onChange={(next) => {
                codeRef.current = next
                setCode(next)
              }}
              onRebuild={rebuildModel}
              onSave={save}
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
          {sourcePath ? <span className="cs-status-path" title={displayPath(sourcePath)}>{displayPath(sourcePath)}</span> : null}
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
            codeRef.current = text
            sourcePathRef.current = ''
            setCode(text)
            setSourcePath('')
            setIncludeError(null)
            setSaveError(null)
            setDocName(file.name.replace(/\.(js|txt|jscad)$/i, '') || SAMPLE_NAME)
            resetView()
          })
        }}
      />
    </div>
  )
}
