import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

const MAX_BODY = 2_000_000
const SYSTEM_LIMIT = 800_000
const providers = new Set(['vllm', 'openai', 'anthropic', 'compatible'])

type Turn = { role: 'user' | 'assistant'; content: string }

function localRequest(req: IncomingMessage) {
  const addr = req.socket.remoteAddress
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1'
}

function send(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(payload)
}

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('too-large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function isPrivateHost(host: string) {
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  return false
}

function parseBase(input: string) {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.username || url.password) return null
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const host = url.hostname.toLowerCase()
  if (host === '169.254.169.254' || host === 'metadata.google.internal') return null
  if (url.protocol === 'http:' && !isPrivateHost(host)) return null
  url.hash = ''
  url.search = ''
  return url
}

function openaiRoot(input: string) {
  const url = parseBase(input)
  if (!url) return null
  let path = url.pathname.replace(/\/+$/, '')
  if (path.endsWith('/chat/completions')) path = path.slice(0, -'/chat/completions'.length)
  if (path.endsWith('/models')) path = path.slice(0, -'/models'.length)
  if (!path.endsWith('/v1')) path = `${path}/v1`
  url.pathname = `${path}/`
  return url
}

function anthropicRoot(input: string) {
  const url = parseBase(input)
  if (!url) return null
  let path = url.pathname.replace(/\/+$/, '')
  if (path.endsWith('/messages')) path = path.slice(0, -'/messages'.length)
  if (path.endsWith('/models')) path = path.slice(0, -'/models'.length)
  if (path.endsWith('/v1')) path = path.slice(0, -3)
  url.pathname = path
  return url
}

function authHeaders(provider: string, apiKey: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (provider === 'anthropic') {
    headers['anthropic-version'] = '2023-06-01'
    if (apiKey) headers['x-api-key'] = apiKey
    return headers
  }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  return headers
}

async function upstreamText(response: Response) {
  const text = await response.text()
  try {
    const payload = JSON.parse(text) as { error?: { message?: unknown } | string; message?: unknown }
    if (typeof payload.error === 'string') return payload.error.slice(0, 280)
    if (payload.error && typeof payload.error === 'object' && typeof payload.error.message === 'string') return payload.error.message.slice(0, 280)
    if (typeof payload.message === 'string') return payload.message.slice(0, 280)
  } catch {
    // Rohtext, wenn der Server kein JSON liefert.
  }
  return text.replace(/\s+/g, ' ').slice(0, 280)
}

function modelNames(payload: unknown) {
  const data = payload && typeof payload === 'object' && 'data' in payload
    ? (payload as { data?: unknown }).data
    : payload
  if (!Array.isArray(data)) return []
  const names = data.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const id = (item as { id?: unknown }).id
    return typeof id === 'string' && id.trim() ? [id.trim()] : []
  })
  return [...new Set(names)].sort((a, b) => a.localeCompare(b)).slice(0, 500)
}

function systemText(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.length > SYSTEM_LIMIT ? value.slice(0, SYSTEM_LIMIT) : value
}

function turns(value: unknown): Turn[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const record = item as { role?: unknown; content?: unknown }
    if ((record.role !== 'user' && record.role !== 'assistant') || typeof record.content !== 'string') return []
    const content = record.content.slice(0, 20000)
    if (!content) return []
    return [{ role: record.role, content }]
  }).slice(-40)
}

async function listModels(provider: string, baseUrl: string, apiKey: string) {
  const headers = authHeaders(provider, apiKey)
  const root = provider === 'anthropic' ? anthropicRoot(baseUrl) : openaiRoot(baseUrl)
  if (!root) return { error: 'denied' as const }
  const url = provider === 'anthropic'
    ? new URL(`${root.pathname}/v1/models`.replace(/\/{2,}/g, '/'), root.origin)
    : new URL('models', root)
  const response = await fetch(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(20000) })
  if (response.status >= 300 && response.status < 400) return { error: 'denied' as const }
  if (!response.ok) return { error: await upstreamText(response) || `HTTP ${response.status}` }
  return { models: modelNames(await response.json()) }
}

function writeDelta(res: ServerResponse, delta: string) {
  res.write(`data: ${JSON.stringify({ delta })}\n\n`)
}

async function pipeOpenAI(res: ServerResponse, upstream: Response) {
  const reader = upstream.body?.getReader()
  if (!reader) return
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const step = await reader.read()
    if (step.done) break
    buffer += decoder.decode(step.value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') return
      try {
        const payload = JSON.parse(data) as { choices?: { delta?: { content?: unknown } }[] }
        const content = payload.choices?.[0]?.delta?.content
        if (typeof content === 'string' && content) writeDelta(res, content)
      } catch {
        // Unvollständige Zeilen kommen im nächsten Block.
      }
    }
  }
}

async function pipeAnthropic(res: ServerResponse, upstream: Response) {
  const reader = upstream.body?.getReader()
  if (!reader) return
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const step = await reader.read()
    if (step.done) break
    buffer += decoder.decode(step.value, { stream: true })
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''
    for (const chunk of chunks) {
      const dataLine = chunk.split('\n').find((line) => line.startsWith('data:'))
      if (!dataLine) continue
      try {
        const payload = JSON.parse(dataLine.slice(5).trim()) as { type?: string; delta?: { text?: unknown } }
        if (payload.type === 'content_block_delta' && typeof payload.delta?.text === 'string') writeDelta(res, payload.delta.text)
      } catch {
        // Nächster Block.
      }
    }
  }
}

async function chat(res: ServerResponse, provider: string, baseUrl: string, apiKey: string, model: string, messages: Turn[], system: string, signal: AbortSignal) {
  const headers = authHeaders(provider, apiKey)
  if (provider === 'anthropic') {
    const root = anthropicRoot(baseUrl)
    if (!root) {
      send(res, 400, { error: 'denied' })
      return
    }
    const url = new URL(`${root.pathname}/v1/messages`.replace(/\/{2,}/g, '/'), root.origin)
    const payload: Record<string, unknown> = { model, max_tokens: 4096, stream: true, messages }
    if (system) payload.system = system
    const upstream = await fetch(url, {
      method: 'POST',
      headers,
      redirect: 'manual',
      signal,
      body: JSON.stringify(payload),
    })
    if (upstream.status >= 300 && upstream.status < 400) {
      send(res, 400, { error: 'denied' })
      return
    }
    if (!upstream.ok) {
      send(res, upstream.status, { error: await upstreamText(upstream) || `HTTP ${upstream.status}` })
      return
    }
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.flushHeaders()
    await pipeAnthropic(res, upstream)
    res.end()
    return
  }
  const root = openaiRoot(baseUrl)
  if (!root) {
    send(res, 400, { error: 'denied' })
    return
  }
  const outbound = system ? [{ role: 'system', content: system }, ...messages] : messages
  const upstream = await fetch(new URL('chat/completions', root), {
    method: 'POST',
    headers,
    redirect: 'manual',
    signal,
    body: JSON.stringify({ model, stream: true, messages: outbound }),
  })
  if (upstream.status >= 300 && upstream.status < 400) {
    send(res, 400, { error: 'denied' })
    return
  }
  if (!upstream.ok) {
    send(res, upstream.status, { error: await upstreamText(upstream) || `HTTP ${upstream.status}` })
    return
  }
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.flushHeaders()
  await pipeOpenAI(res, upstream)
  res.end()
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  if (!localRequest(req)) {
    send(res, 403, { error: 'denied' })
    return
  }
  if (req.method !== 'POST') {
    send(res, 405, { error: 'failed' })
    return
  }
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  let body: unknown
  try {
    body = JSON.parse(await readBody(req))
  } catch {
    send(res, 400, { error: 'failed' })
    return
  }
  const record = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  const provider = typeof record.provider === 'string' ? record.provider : ''
  const baseUrl = typeof record.baseUrl === 'string' ? record.baseUrl : ''
  const apiKey = typeof record.apiKey === 'string' ? record.apiKey : ''
  const model = typeof record.model === 'string' ? record.model.trim() : ''
  if (!providers.has(provider) || !baseUrl.trim()) {
    send(res, 400, { error: 'missing' })
    return
  }
  if (url.pathname === '/api/inference/models') {
    const listed = await listModels(provider, baseUrl, apiKey)
    if ('error' in listed && listed.error === 'denied') {
      send(res, 400, { error: 'denied' })
      return
    }
    if ('error' in listed) {
      send(res, 502, { error: listed.error })
      return
    }
    send(res, 200, { models: listed.models })
    return
  }
  if (url.pathname === '/api/inference/chat') {
    const messages = turns(record.messages)
    const system = systemText(record.system)
    if (!model || messages.length === 0) {
      send(res, 400, { error: 'missing' })
      return
    }
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), 180000)
    req.on('close', () => abort.abort())
    try {
      await chat(res, provider, baseUrl, apiKey, model, messages, system, abort.signal)
    } finally {
      clearTimeout(timer)
    }
    return
  }
  send(res, 404, { error: 'missing' })
}

export function inferenceApiPlugin(): Plugin {
  return {
    name: 'codeshape-inference',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0]
        if (pathname !== '/api/inference/models' && pathname !== '/api/inference/chat') {
          next()
          return
        }
        void handle(req, res).catch((error: unknown) => {
          if (res.headersSent) {
            if (!res.writableEnded) res.end()
            return
          }
          const message = error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'failed'
          send(res, 500, { error: message })
        })
      })
    },
  }
}
