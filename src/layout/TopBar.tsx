import { useEffect, useState } from 'react'
import { useI18n, type MessageKey } from '../i18n'
import type { Projection, RenderMode, Theme } from '../types'
import { Icon } from './icons'

type MenuId = 'datei' | 'ansicht' | 'optionen' | 'hilfe'

type Props = {
  docName: string
  onDocName: (value: string) => void
  theme: Theme
  query: string
  onQuery: (value: string) => void
  editorOpen: boolean
  treeOpen: boolean
  chatOpen: boolean
  building: boolean
  renderMode: RenderMode
  projection: Projection
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onExport: (kind: 'stl' | 'obj') => void
  onRebuild: () => void
  onFit: () => void
  onIso: () => void
  onToggleEditor: () => void
  onToggleTree: () => void
  onToggleChat: () => void
  onRenderMode: (mode: RenderMode) => void
  onProjection: (projection: Projection) => void
  onTheme: () => void
  onToggleLang: () => void
  onHelp: () => void
  onConfigureInference: () => void
}

const modeKey: Record<RenderMode, MessageKey> = {
  'shaded-edges': 'modeShadedEdges',
  shaded: 'modeShaded',
  translucent: 'modeTranslucent',
  wire: 'modeWire',
}

export function TopBar(props: Props) {
  const { lang, t } = useI18n()
  const [menu, setMenu] = useState<MenuId | null>(null)
  const [exportOpen, setExportOpen] = useState(false)

  useEffect(() => {
    if (!menu && !exportOpen) return
    const close = () => {
      setMenu(null)
      setExportOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [menu, exportOpen])

  const run = (action: () => void) => {
    setMenu(null)
    setExportOpen(false)
    action()
  }

  return (
    <div className="cs-chrome" onPointerDown={(event) => event.stopPropagation()}>
      <nav className="cs-menubar" aria-label={t('menu')}>
        <div className="cs-menu-item">
          <button className={menu === 'datei' ? 'is-open' : ''} onClick={() => setMenu(menu === 'datei' ? null : 'datei')}>{t('file')}</button>
          {menu === 'datei' ? (
            <div className="cs-dropdown">
              <button onClick={() => run(props.onNew)}>{t('new')} <kbd>{t('mod')}+N</kbd></button>
              <button onClick={() => run(props.onOpen)}>{t('openEllipsis')}</button>
              <button onClick={() => run(props.onSave)}>{t('save')} <kbd>{t('mod')}+S</kbd></button>
              <hr />
              <button onClick={() => run(() => props.onExport('stl'))}>{t('exportStl')}</button>
              <button onClick={() => run(() => props.onExport('obj'))}>{t('exportObj')}</button>
            </div>
          ) : null}
        </div>
        <div className="cs-menu-item">
          <button className={menu === 'ansicht' ? 'is-open' : ''} onClick={() => setMenu(menu === 'ansicht' ? null : 'ansicht')}>{t('view')}</button>
          {menu === 'ansicht' ? (
            <div className="cs-dropdown">
              <button onClick={() => run(props.onToggleTree)}>{t('featureList')} {props.treeOpen ? t('hide') : t('show')}</button>
              <button onClick={() => run(props.onToggleEditor)}>{t('scriptWindow')} {props.editorOpen ? t('hide') : t('show')}</button>
              <button onClick={() => run(props.onToggleChat)}>{t('inference')} {props.chatOpen ? t('hide') : t('show')}</button>
              <hr />
              <button onClick={() => run(props.onFit)}>{t('fit')} <kbd>F</kbd></button>
              <button onClick={() => run(props.onIso)}>{t('iso')}</button>
              <button onClick={() => run(() => props.onProjection(props.projection === 'ortho' ? 'perspective' : 'ortho'))}>
                {props.projection === 'ortho' ? t('perspective') : t('ortho')}
              </button>
              <hr />
              {(Object.keys(modeKey) as RenderMode[]).map((mode) => (
                <button key={mode} className={mode === props.renderMode ? 'is-active' : ''} onClick={() => run(() => props.onRenderMode(mode))}>
                  {t(modeKey[mode])}
                </button>
              ))}
              <hr />
              <button onClick={() => run(props.onTheme)}>{props.theme === 'dark' ? t('lightTheme') : t('darkTheme')}</button>
              <button onClick={() => run(props.onToggleLang)}>{t('language')}: {lang === 'de' ? 'Deutsch' : 'English'}</button>
            </div>
          ) : null}
        </div>
        <div className="cs-menu-item">
          <button className={menu === 'optionen' ? 'is-open' : ''} onClick={() => setMenu(menu === 'optionen' ? null : 'optionen')}>{t('options')}</button>
          {menu === 'optionen' ? (
            <div className="cs-dropdown">
              <button onClick={() => run(props.onConfigureInference)}>{t('inference')}</button>
            </div>
          ) : null}
        </div>
        <div className="cs-menu-item">
          <button className={menu === 'hilfe' ? 'is-open' : ''} onClick={() => setMenu(menu === 'hilfe' ? null : 'hilfe')}>{t('help')}</button>
          {menu === 'hilfe' ? (
            <div className="cs-dropdown">
              <button onClick={() => run(props.onHelp)}>{t('shortcuts')}</button>
            </div>
          ) : null}
        </div>
      </nav>
      <div className="cs-toolbar">
        <div className="cs-brand" title="CodeShape">
          <img
            src={props.theme === 'dark' ? '/branding/scch-weiss.png' : '/branding/scch-schwarz.png'}
            alt="SCCH"
            width={1024}
            height={297}
          />
          <div className="cs-brand-text">
            <strong>CodeShape</strong>
            <span>{t('partStudio')}</span>
          </div>
        </div>
        <div className="cs-doc">
          <Icon name="file" size={15} />
          <input
            className="cs-docname"
            aria-label={t('documentName')}
            value={props.docName}
            onChange={(event) => props.onDocName(event.target.value)}
          />
          <span className="cs-workspace-name">{t('workspace')}</span>
        </div>
        <div className="cs-toolgroup">
          <button title={t('new')} onClick={props.onNew}><Icon name="file" /></button>
          <button title={t('open')} onClick={props.onOpen}><Icon name="folder" /></button>
          <button title={t('save')} onClick={props.onSave}><Icon name="save" /></button>
          <span className="cs-sep" />
          <button title={t('rebuild')} onClick={props.onRebuild} className={props.building ? 'is-busy' : ''}>
            <Icon name="refresh" />
          </button>
          <span className="cs-sep" />
          <button title={t('fit')} onClick={props.onFit}><Icon name="fit" /></button>
          <button title={t('iso')} onClick={props.onIso}><Icon name="iso" /></button>
          <button title={t(modeKey[props.renderMode])} onClick={() => props.onRenderMode(props.renderMode === 'shaded-edges' ? 'shaded' : props.renderMode === 'shaded' ? 'translucent' : props.renderMode === 'translucent' ? 'wire' : 'shaded-edges')}>
            <Icon name="cube" />
          </button>
          <button title={props.projection === 'ortho' ? t('ortho') : t('perspective')} onClick={() => props.onProjection(props.projection === 'ortho' ? 'perspective' : 'ortho')}>
            <Icon name="camera" />
          </button>
          <span className="cs-sep" />
          <button title={t('featureList')} className={props.treeOpen ? 'is-on' : ''} onClick={props.onToggleTree}><Icon name="tree" /></button>
          <button title={t('scriptWindow')} className={props.editorOpen ? 'is-on' : ''} onClick={props.onToggleEditor}><Icon name="editor" /></button>
          <button title={t('inference')} className={props.chatOpen ? 'is-on' : ''} onClick={props.onToggleChat}><Icon name="chat" /></button>
        </div>
        <div className="cs-toolbar-right">
          <label className="cs-topsearch">
            <Icon name="search" size={14} />
            <input value={props.query} onChange={(event) => props.onQuery(event.target.value)} placeholder={t('search')} />
          </label>
          <button
            className="cs-icon-quiet cs-lang"
            title={lang === 'de' ? 'Switch to English' : 'Auf Deutsch umschalten'}
            onClick={props.onToggleLang}
          >
            {lang === 'de' ? 'DE' : 'EN'}
          </button>
          <button className="cs-icon-quiet" title={props.theme === 'dark' ? t('lightTheme') : t('darkTheme')} onClick={props.onTheme}>
            <Icon name={props.theme === 'dark' ? 'sun' : 'moon'} />
          </button>
          <button className="cs-icon-quiet" title={t('shortcuts')} onClick={props.onHelp}><Icon name="help" /></button>
          <div className="cs-export">
            <button className="cs-primary" onClick={() => props.onExport('stl')}>STL</button>
            <button className="cs-primary-caret" title={t('moreExports')} onClick={() => setExportOpen((open) => !open)}>
              <Icon name="chevron" size={12} />
            </button>
            {exportOpen ? (
              <div className="cs-dropdown cs-dropdown-right">
                <button onClick={() => run(() => props.onExport('stl'))}>STL</button>
                <button onClick={() => run(() => props.onExport('obj'))}>OBJ</button>
              </div>
            ) : null}
          </div>
          <div className="cs-avatar" title="CodeShape">CS</div>
        </div>
      </div>
    </div>
  )
}
