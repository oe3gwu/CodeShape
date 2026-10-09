import { javascript } from '@codemirror/lang-javascript'
import { Compartment, EditorState, Prec } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView, keymap } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { useEffect, useRef } from 'react'
import { useI18n } from '../i18n'
import type { Theme } from '../types'
import { Icon } from './icons'

type Props = {
  code: string
  theme: Theme
  docName: string
  building: boolean
  onChange: (code: string) => void
  onRebuild: () => void
  onClose: () => void
}

export function EditorWindow({ code, theme, docName, building, onChange, onRebuild, onClose }: Props) {
  const { t } = useI18n()
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const themeCompartment = useRef(new Compartment())
  const onChangeRef = useRef(onChange)
  const onRebuildRef = useRef(onRebuild)
  const initialCode = useRef(code)
  onChangeRef.current = onChange
  onRebuildRef.current = onRebuild

  useEffect(() => {
    if (!hostRef.current) return
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: initialCode.current,
        extensions: [
          basicSetup,
          Prec.high(keymap.of([{
            key: 'Shift-Enter',
            preventDefault: true,
            run: () => {
              onRebuildRef.current()
              return true
            },
          }])),
          javascript(),
          EditorState.tabSize.of(2),
          themeCompartment.current.of(theme === 'dark' ? oneDark : []),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString())
          }),
          EditorView.theme({
            '&': { height: '100%', fontSize: '13px' },
            '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
            '.cm-content': { padding: '8px 0' },
          }),
        ],
      }),
    })
    viewRef.current = view
    return () => view.destroy()
  }, [themeCompartment])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: themeCompartment.current.reconfigure(theme === 'dark' ? oneDark : []),
    })
  }, [theme])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== code) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: code } })
    }
  }, [code])

  return (
    <section className="cs-window" aria-label={t('scriptWindow')}>
      <header className="cs-window-title">
        <span className={`cs-live ${building ? 'is-busy' : ''}`} />
        <Icon name="code" size={14} />
        <span className="cs-window-name">{t('script')} — {docName}.js</span>
        <button className="cs-window-close" title={t('closeWindow')} onClick={onClose}>
          <Icon name="close" size={14} />
        </button>
      </header>
      <div className="cs-editor" ref={hostRef} />
    </section>
  )
}
