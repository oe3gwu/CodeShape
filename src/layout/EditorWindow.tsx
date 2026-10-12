import { javascript } from '@codemirror/lang-javascript'
import { Compartment, EditorState, Prec, RangeSetBuilder, StateEffect, StateField } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { Decoration, EditorView, keymap, WidgetType, type DecorationSet } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { useEffect, useRef } from 'react'
import { useI18n } from '../i18n'
import { scriptMarks, type ScriptMarks } from '../lib/scriptDiff'
import type { Theme } from '../types'
import { Icon } from './icons'

class DeletedLines extends WidgetType {
  constructor(readonly text: string) { super() }

  eq(other: DeletedLines) {
    return other.text === this.text
  }

  toDOM() {
    const element = document.createElement('div')
    element.className = 'cm-proposal-del'
    element.textContent = this.text === '' ? '\u00a0' : this.text
    return element
  }

  ignoreEvent() {
    return true
  }
}

const proposalEffect = StateEffect.define<ScriptMarks | null>()

function proposalDecorations(length: number, marks: ScriptMarks) {
  const grouped = new Map<number, { text: string[]; add: boolean }>()
  const touch = (at: number) => {
    const current = grouped.get(at) ?? { text: [], add: false }
    grouped.set(at, current)
    return current
  }
  for (const at of marks.adds) {
    if (at < 0 || at > length) continue
    touch(at).add = true
  }
  for (const removed of marks.deletes) {
    if (removed.at < 0 || removed.at > length) continue
    touch(removed.at).text.push(removed.text)
  }
  const builder = new RangeSetBuilder<Decoration>()
  for (const at of [...grouped.keys()].sort((left, right) => left - right)) {
    const entry = grouped.get(at)
    if (!entry) continue
    if (entry.text.length > 0) {
      builder.add(at, at, Decoration.widget({ widget: new DeletedLines(entry.text.join('\n')), block: true, side: -1 }))
    }
    if (entry.add) builder.add(at, at, Decoration.line({ class: 'cm-proposal-add' }))
  }
  return builder.finish()
}

const proposalField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(decorations, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(proposalEffect)) {
        return effect.value ? proposalDecorations(transaction.state.doc.length, effect.value) : Decoration.none
      }
    }
    return decorations.map(transaction.changes)
  },
  provide: (field) => EditorView.decorations.from(field),
})

const lockedExt = [EditorState.readOnly.of(true), EditorView.editable.of(false)]
const unlockedExt = [EditorState.readOnly.of(false), EditorView.editable.of(true)]

type Props = {
  code: string
  base: string | null
  theme: Theme
  docName: string
  building: boolean
  onChange: (code: string) => void
  onRebuild: () => void
  onSave: () => void
  onAccept: () => void
  onReject: () => void
  onClose: () => void
}

export function EditorWindow({ code, base, theme, docName, building, onChange, onRebuild, onSave, onAccept, onReject, onClose }: Props) {
  const { t } = useI18n()
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const themeCompartment = useRef(new Compartment())
  const lockCompartment = useRef(new Compartment())
  const onChangeRef = useRef(onChange)
  const onRebuildRef = useRef(onRebuild)
  const onSaveRef = useRef(onSave)
  const initialCode = useRef(code)
  onChangeRef.current = onChange
  onRebuildRef.current = onRebuild
  onSaveRef.current = onSave

  useEffect(() => {
    if (!hostRef.current) return
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: initialCode.current,
        extensions: [
          basicSetup,
          Prec.high(keymap.of([
            {
              key: 'Shift-Enter',
              preventDefault: true,
              run: () => {
                onRebuildRef.current()
                return true
              },
            },
            {
              key: 'Mod-s',
              preventDefault: true,
              run: () => {
                onSaveRef.current()
                return true
              },
            },
          ])),
          javascript(),
          EditorState.tabSize.of(2),
          themeCompartment.current.of(theme === 'dark' ? oneDark : []),
          lockCompartment.current.of(unlockedExt),
          proposalField,
          EditorView.updateListener.of((update) => {
            const userEdit = update.docChanged && update.transactions.some((transaction) => (
              transaction.isUserEvent('input')
              || transaction.isUserEvent('delete')
              || transaction.isUserEvent('undo')
              || transaction.isUserEvent('redo')
              || transaction.isUserEvent('move')
            ))
            if (userEdit) onChangeRef.current(update.state.doc.toString())
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
    const effects = [
      lockCompartment.current.reconfigure(base === null ? unlockedExt : lockedExt),
      proposalEffect.of(base === null ? null : scriptMarks(base, code)),
    ]
    if (current !== code) view.dispatch({ changes: { from: 0, to: current.length, insert: code }, effects })
    else view.dispatch({ effects })
  }, [code, base])

  return (
    <section className="cs-window" aria-label={t('scriptWindow')}>
      <header className="cs-window-title">
        <span className={`cs-live ${building ? 'is-busy' : ''}`} />
        <Icon name="code" size={14} />
        <span className="cs-window-name">{t('script')} — {docName}.js</span>
        {base !== null ? (
          <span className="cs-proposal-actions">
            <button type="button" className="cs-proposal-accept" onClick={onAccept}>{t('proposalAccept')}</button>
            <button type="button" className="cs-proposal-reject" onClick={onReject}>{t('proposalReject')}</button>
          </span>
        ) : null}
        <button className="cs-window-close" title={t('closeWindow')} onClick={onClose}>
          <Icon name="close" size={14} />
        </button>
      </header>
      <div className="cs-editor" ref={hostRef} />
    </section>
  )
}
