import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useI18n } from '../i18n'
import { inferenceErrorText, inferenceSystemPrompt, sameScript, streamInferenceChat, takeScriptProposal, visibleChatText, type ChatTurn, type InferenceConfig } from '../lib/inference'
import { Icon } from './icons'

const repairLimit = 3

type Props = {
  config: InferenceConfig
  script: string
  docName: string
  buildError: string | null
  building: boolean
  buildRevision: number
  proposalActive: boolean
  onPropose: (script: string) => void
  onClose: () => void
  onConfigure: () => void
}

export function InferenceWindow({ config, script, docName, buildError, building, buildRevision, proposalActive, onPropose, onClose, onConfigure }: Props) {
  const { lang, t } = useI18n()
  const [messages, setMessages] = useState<ChatTurn[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const scriptRef = useRef(script)
  const proposeRef = useRef(onPropose)
  const messagesRef = useRef(messages)
  const busyRef = useRef(busy)
  const buildRevisionRef = useRef(buildRevision)
  const buildErrorRef = useRef(buildError)
  const proposalActiveRef = useRef(proposalActive)
  const repairPending = useRef(false)
  const sawBuilding = useRef(false)
  const armedRevision = useRef(0)
  const armedError = useRef<string | null>(null)
  const repairCount = useRef(0)
  const repairGen = useRef(0)
  const sendTextRef = useRef<(text: string, repair: boolean) => Promise<void>>(async () => {})
  scriptRef.current = script
  proposeRef.current = onPropose
  messagesRef.current = messages
  busyRef.current = busy
  buildRevisionRef.current = buildRevision
  buildErrorRef.current = buildError
  proposalActiveRef.current = proposalActive
  const ready = Boolean(config.baseUrl.trim() && config.model.trim())

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [messages, busy])

  useEffect(() => () => abortRef.current?.abort(), [])

  const armRepair = () => {
    repairPending.current = true
    sawBuilding.current = false
    armedRevision.current = buildRevisionRef.current
    armedError.current = buildErrorRef.current
  }

  const sendText = async (text: string, repair: boolean) => {
    if (!text || busyRef.current || !ready) return
    const gen = repair ? repairGen.current : ++repairGen.current
    if (!repair) {
      repairCount.current = 0
      repairPending.current = false
    }
    const history = [...messagesRef.current, { role: 'user' as const, content: text }]
    messagesRef.current = [...history, { role: 'assistant', content: '' }]
    setMessages(messagesRef.current)
    if (!repair) setDraft('')
    setError(null)
    busyRef.current = true
    setBusy(true)
    const abort = new AbortController()
    abortRef.current = abort
    let full = ''
    try {
      await streamInferenceChat(config, history, inferenceSystemPrompt(docName, scriptRef.current, lang), (delta) => {
        if (gen !== repairGen.current) return
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
      if (gen !== repairGen.current) return
      const taken = takeScriptProposal(full)
      const proposed = Boolean(taken.script && !sameScript(taken.script, scriptRef.current))
      const explanation = taken.message || (proposed ? t('proposalReady') : '')
      const finished = [...history, { role: 'assistant' as const, content: explanation }]
      messagesRef.current = finished
      setMessages(finished)
      if (proposed && taken.script) {
        armRepair()
        proposeRef.current(taken.script)
      } else if (repair && proposalActiveRef.current && buildErrorRef.current) {
        if (repairCount.current >= repairLimit) {
          const note = `${t('proposalRepairGaveUp')} ${buildErrorRef.current}`
          messagesRef.current = [...finished, { role: 'assistant', content: note }]
          setMessages(messagesRef.current)
        } else {
          repairCount.current += 1
          queueMicrotask(() => {
            void sendTextRef.current(`${t('proposalBuildFailed')}: ${buildErrorRef.current}\n${t('proposalRepair')}`, true)
          })
        }
      }
    } catch (caught) {
      if (abort.signal.aborted || gen !== repairGen.current) return
      repairPending.current = false
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant' && !last.content) return prev.slice(0, -1)
        return prev
      })
      setError(inferenceErrorText(caught instanceof Error ? caught.message : '', t))
    } finally {
      if (abortRef.current === abort) abortRef.current = null
      if (gen === repairGen.current) {
        busyRef.current = false
        setBusy(false)
      }
    }
  }
  sendTextRef.current = sendText

  const send = async () => {
    await sendText(draft.trim(), false)
  }

  useEffect(() => {
    if (proposalActive) return
    repairPending.current = false
    repairGen.current += 1
    abortRef.current?.abort()
    busyRef.current = false
    setBusy(false)
  }, [proposalActive])

  useEffect(() => {
    if (!proposalActive || !repairPending.current || busy) return
    if (building) {
      sawBuilding.current = true
      return
    }
    const revisionAdvanced = buildRevision !== armedRevision.current
    const errorChanged = buildError !== armedError.current
    if (!sawBuilding.current && !revisionAdvanced && !(errorChanged && buildError)) return
    sawBuilding.current = false
    repairPending.current = false
    if (!buildError) {
      repairCount.current = 0
      return
    }
    if (repairCount.current >= repairLimit) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `${t('proposalRepairGaveUp')} ${buildError}` }])
      return
    }
    repairCount.current += 1
    void sendTextRef.current(`${t('proposalBuildFailed')}: ${buildError}\n${t('proposalRepair')}`, true)
  }, [proposalActive, building, buildRevision, buildError, busy, t])

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
