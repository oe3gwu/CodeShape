import type { Lang, MessageKey } from '../i18n'
import { normalizeScript } from './scriptDiff'

export const inferenceProviders = ['vllm', 'openai', 'anthropic', 'compatible'] as const

export type InferenceProvider = (typeof inferenceProviders)[number]

export type InferenceConfig = {
  provider: InferenceProvider
  baseUrl: string
  apiKey: string
  model: string
}

export type ChatTurn = {
  role: 'user' | 'assistant'
  content: string
}

export const inferenceDefaults: Record<InferenceProvider, string> = {
  vllm: 'http://127.0.0.1:8000/v1',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  compatible: 'http://127.0.0.1:11434/v1',
}

export const emptyInference: InferenceConfig = {
  provider: 'vllm',
  baseUrl: inferenceDefaults.vllm,
  apiKey: '',
  model: '',
}

const inferenceErrorKeys: Record<string, MessageKey> = {
  denied: 'inferenceDenied',
  missing: 'inferenceIncomplete',
  timeout: 'inferenceTimeout',
  failed: 'inferenceFailed',
}

export function inferenceErrorText(message: string, t: (key: MessageKey) => string) {
  const key = inferenceErrorKeys[message]
  return key ? t(key) : (message || t('inferenceFailed'))
}

export function isInferenceProvider(value: unknown): value is InferenceProvider {
  return inferenceProviders.includes(value as InferenceProvider)
}

export async function listInferenceModels(config: InferenceConfig): Promise<string[]> {
  const response = await fetch('/api/inference/models', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  const data = await response.json().catch(() => ({})) as { models?: unknown; error?: unknown }
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'failed')
  if (!Array.isArray(data.models)) return []
  return data.models.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

const scriptLimit = 700_000

export function inferenceSystemPrompt(docName: string, script: string, lang: Lang) {
  const normalized = script.replace(/\r\n/g, '\n')
  const truncated = normalized.length > scriptLimit
  const body = truncated ? normalized.slice(0, scriptLimit) : normalized
  const note = truncated
    ? (lang === 'de'
      ? 'Das Skript ist gekürzt. Gib in diesem Fall keinen codeshape-script-Block zurück.'
      : 'The script is truncated. Do not return a codeshape-script block in that case.')
    : ''
  if (lang === 'de') {
    return [
      'Du bist der Assistent in CodeShape, einer CAD-Anwendung.',
      'Das Skript ist OpenJSCAD-Syntax, also JSCAD mit @jscad/modeling.',
      'Schreibe in genau dieser Syntax und im Stil des aktuellen Skripts, inklusive Imports, Hilfsfunktionen und exports.',
      'Erfinde keine Funktionen. Ein Quader ist cuboid oder cube, nicht box.',
      'include()-Zeilen bleiben im Skript stehen und werden nicht aufgelöst.',
      'Wenn eine konkrete Änderung am Skript nötig ist, gib das vollständige aktualisierte Skript in genau einem Block zurück, der mit ```codeshape-script beginnt und mit ``` endet.',
      'Erkläre die Änderung außerhalb dieses Blocks.',
      'Ein Vorschlag ohne diesen Block ändert das Skript nicht.',
      'Wenn der Aufbau fehlschlägt, korrigiere das Skript und gib es erneut vollständig zurück, bis es baut.',
      'Antworte auf Deutsch.',
      note,
      `Dokument: ${docName}`,
      'Aktuelles Skript:',
      body,
    ].filter(Boolean).join('\n')
  }
  return [
    'You are the assistant inside CodeShape, a CAD application.',
    'The script uses OpenJSCAD syntax, which is JSCAD with @jscad/modeling.',
    'Write in exactly that syntax and in the style of the current script, including imports, helpers and exports.',
    'Do not invent functions. A box is cuboid or cube, not box.',
    'include() lines stay in the script and are not expanded.',
    'When a concrete script change is required, return the complete updated script in exactly one block that starts with ```codeshape-script and ends with ```.',
    'Explain the change outside that block.',
    'A suggestion without that block does not change the script.',
    'If the build fails, correct the script and return the complete script again until it builds.',
    'Reply in English.',
    note,
    `Document: ${docName}`,
    'Current script:',
    body,
  ].filter(Boolean).join('\n')
}

export function takeScriptProposal(text: string) {
  const scriptBlock = /```codeshape-script[^\n]*\n([\s\S]*?)```/gi
  let script: string | null = null
  const message = text.replace(scriptBlock, (_all, body: string) => {
    script = body.replace(/\r\n/g, '\n').replace(/\n$/, '')
    return ''
  }).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return { message, script }
}

export function sameScript(left: string, right: string) {
  return normalizeScript(left) === normalizeScript(right)
}

export function visibleChatText(text: string) {
  const taken = takeScriptProposal(text)
  if (/```codeshape-script/i.test(text) && taken.script === null) {
    return text.slice(0, text.search(/```codeshape-script/i)).trim()
  }
  return taken.message
}

export async function streamInferenceChat(
  config: InferenceConfig,
  messages: ChatTurn[],
  system: string,
  onDelta: (text: string) => void,
  signal: AbortSignal,
) {
  const response = await fetch('/api/inference/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...config, messages, system }),
    signal,
  })
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({})) as { error?: unknown }
    throw new Error(typeof data.error === 'string' ? data.error : 'failed')
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const step = await reader.read()
    if (step.done) break
    buffer += decoder.decode(step.value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      const line = part.split('\n').find((entry) => entry.startsWith('data:'))
      if (!line) continue
      const payload = JSON.parse(line.slice(5).trim()) as { delta?: unknown; error?: unknown }
      if (typeof payload.error === 'string' && payload.error) throw new Error(payload.error)
      if (typeof payload.delta === 'string' && payload.delta) onDelta(payload.delta)
    }
  }
}
