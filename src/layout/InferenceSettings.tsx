import { useCallback, useEffect, useState } from 'react'
import { useI18n, type MessageKey } from '../i18n'
import {
  inferenceDefaults,
  inferenceProviders,
  inferenceErrorText,
  listInferenceModels,
  type InferenceConfig,
  type InferenceProvider,
} from '../lib/inference'

const providerKey: Record<InferenceProvider, MessageKey> = {
  vllm: 'inferenceProviderVllm',
  openai: 'inferenceProviderOpenai',
  anthropic: 'inferenceProviderAnthropic',
  compatible: 'inferenceProviderCompatible',
}

type Props = {
  config: InferenceConfig
  onClose: () => void
  onSave: (config: InferenceConfig) => void
}

export function InferenceSettings({ config, onClose, onSave }: Props) {
  const { t } = useI18n()
  const [draft, setDraft] = useState(config)
  const [models, setModels] = useState<string[]>(config.model ? [config.model] : [])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const loadModels = useCallback(async (next: InferenceConfig, isCurrent: () => boolean = () => true) => {
    setBusy(true)
    setError(null)
    try {
      const listed = await listInferenceModels(next)
      if (!isCurrent()) return
      setModels(listed)
      setDraft((prev) => ({ ...prev, model: listed.includes(prev.model) ? prev.model : (listed[0] ?? '') }))
      if (listed.length === 0) setError(t('inferenceNoModels'))
    } catch (caught) {
      if (!isCurrent()) return
      setError(inferenceErrorText(caught instanceof Error ? caught.message : '', t))
    } finally {
      if (isCurrent()) setBusy(false)
    }
  }, [t])

  useEffect(() => {
    const baseUrl = draft.baseUrl.trim()
    const apiKey = draft.apiKey.trim()
    if (!baseUrl || !apiKey) return
    let current = true
    const timer = window.setTimeout(() => {
      void loadModels({ provider: draft.provider, baseUrl, apiKey, model: '' }, () => current)
    }, 400)
    return () => {
      current = false
      window.clearTimeout(timer)
      setBusy(false)
    }
  }, [draft.provider, draft.baseUrl, draft.apiKey, loadModels])

  const chooseProvider = (provider: InferenceProvider) => {
    setDraft((prev) => {
      const known = Object.values(inferenceDefaults)
      const baseUrl = !prev.baseUrl.trim() || known.includes(prev.baseUrl.trim()) ? inferenceDefaults[provider] : prev.baseUrl
      return { ...prev, provider, baseUrl, model: '' }
    })
    setModels([])
  }

  return (
    <div className="cs-modal-back" onPointerDown={onClose}>
      <form
        className="cs-modal cs-inference-settings"
        onPointerDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          onSave(draft)
        }}
      >
        <header>
          <strong>{t('inferenceConfigure')}</strong>
          <button type="button" onClick={onClose}>{t('helpClose')}</button>
        </header>
        <div className="cs-form">
          <label className="cs-param">
            <span>{t('inferenceProvider')}</span>
            <select
              value={draft.provider}
              onChange={(event) => chooseProvider(event.target.value as InferenceProvider)}
            >
              {inferenceProviders.map((provider) => (
                <option key={provider} value={provider}>{t(providerKey[provider])}</option>
              ))}
            </select>
          </label>
          <label className="cs-param">
            <span>{t('inferenceUrl')}</span>
            <input
              type="url"
              value={draft.baseUrl}
              placeholder={inferenceDefaults[draft.provider]}
              onChange={(event) => setDraft((prev) => ({ ...prev, baseUrl: event.target.value }))}
            />
          </label>
          <label className="cs-param">
            <span>{t('inferenceApiKey')}</span>
            <input
              type="password"
              value={draft.apiKey}
              autoComplete="off"
              onChange={(event) => setDraft((prev) => ({ ...prev, apiKey: event.target.value }))}
            />
          </label>
          <label className="cs-param">
            <span>{t('inferenceModel')}</span>
            <select
              value={draft.model}
              onChange={(event) => setDraft((prev) => ({ ...prev, model: event.target.value }))}
            >
              <option value="">{t('inferenceModelsEmpty')}</option>
              {models.map((model) => <option key={model} value={model}>{model}</option>)}
            </select>
          </label>
          {error ? <div className="cs-form-error">{error}</div> : null}
          <div className="cs-form-row">
            <button type="button" onClick={() => void loadModels(draft)} disabled={busy || !draft.baseUrl.trim()}>
              {busy ? t('inferenceLoading') : t('inferenceLoadModels')}
            </button>
            <button type="submit" className="cs-text-primary" disabled={!draft.baseUrl.trim()}>{t('save')}</button>
          </div>
        </div>
      </form>
    </div>
  )
}
