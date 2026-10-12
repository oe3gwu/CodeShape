import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useI18n } from '../i18n'
import { inferenceErrorText, inferenceSystemPrompt, sameScript, streamInferenceChat, takeScriptProposal, visibleChatText, type ChatTurn, type InferenceConfig } from '../lib/inference'
import { Icon } from './icons'

type Props = {
  config: InferenceConfig
  script: string
  docName: string
  onPropose: (script: string) => void
  onClose: () => void
  onConfigure: () => void
}

export function InferenceWindow({ config, script, docName, onPropose, onClose, onConfigure }: Props) {
  const { lang, t } = useI18n()
  const [messages, setMessages] = useState<ChatTurn[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const scriptRef = useRef(script)
  const proposeRef = useRef(onPropose)
  scriptRef.current = script
  proposeRef.current = onPropose
  const ready = Boolean(config.baseUrl.trim() && config.model.trim())

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [messages, busy])

  useEffect(() => () => abortRef.current?.abort(), [])

  const send = async () => {
    const text = draft.trim()
    if (!text || busy || !ready) return
    const history = [...messages, { role: 'user' as const, content: text }]
    setMessages([...history, { role: 'assistant', content: '' }])
    setDraft('')
    setError(null)
    setBusy(true)
    const abort = new AbortController()
    abortRef.current = abort
    let full = ''
    try {
      await streamInferenceChat(config, history, inferenceSystemPrompt(docName, scriptRef.current, lang), (delta) => {
        full += delta
        const shown = visibleChatText(full)
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (!last || last.role !== 'assistant') return prev
          next[next.length - 1] = { role: 'assistant', content: shown }
          return next
        })
      }, abort.signal)
      const taken = takeScriptProposal(full)
      const explanation = taken.message || (taken.script ? t('proposalReady') : '')
      setMessages((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (!last || last.role !== 'assistant') return prev
        next[next.length - 1] = { role: 'assistant', content: explanation }
        return next
      })
      if (taken.script && !sameScript(taken.script, scriptRef.current)) proposeRef.current(taken.script)
    } catch (caught) {
      if (abort.signal.aborted) return
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant' && !last.content) return prev.slice(0, -1)
        return prev
      })
      setError(inferenceErrorText(caught instanceof Error ? caught.message : '', t))
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void send()
    }
  }

  return (
    <section className="cs-window cs-inference" aria-label={t('inference')}>
      <header className="cs-window-title">
        <Icon name="chat" size={14} />
        <span className="cs-window-name">{config.model ? `${t('inference')} — ${config.model}` : t('inference')}</span>
        <span className="cs-window-actions">
          <button className="cs-window-close" title={t('inferenceConfigure')} onClick={onConfigure}>
            <Icon name="settings" size={14} />
          </button>
          <button className="cs-window-close" title={t('closeWindow')} onClick={onClose}>
            <Icon name="close" size={14} />
          </button>
        </span>
      </header>
      <div className="cs-inference-body">
        <div className="cs-chat-log" ref={logRef}>
          {messages.length === 0 ? (
            <div className="cs-empty">
              {ready ? t('inferenceChatEmpty') : t('inferenceNeedConfig')}
              {ready ? null : <button type="button" onClick={onConfigure}>{t('inferenceConfigure')}</button>}
            </div>
          ) : messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`cs-chat-msg is-${message.role}`}>
              {message.content || (busy && index === messages.length - 1 ? '…' : '')}
            </div>
          ))}
          {error ? <div className="cs-form-error">{error}</div> : null}
        </div>
        <form
          className="cs-chat-form"
          onSubmit={(event) => {
            event.preventDefault()
            void send()
          }}
        >
          <textarea
            value={draft}
            rows={2}
            placeholder={t('inferenceChatPlaceholder')}
            aria-label={t('inferenceChatPlaceholder')}
            disabled={!ready}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKey}
          />
          {busy ? (
            <button type="button" onClick={() => abortRef.current?.abort()}>{t('inferenceStop')}</button>
          ) : (
            <button type="submit" disabled={!ready || !draft.trim()}>{t('inferenceSend')}</button>
          )}
        </form>
      </div>
    </section>
  )
}
