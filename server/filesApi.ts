import fs from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import type { Plugin } from 'vite'

const MAX_BYTES = 2_000_000

type Entry = { name: string; path: string; type: 'file' | 'dir' }

let homeReal: Promise<string> | null = null

function homeDir() {
  homeReal ??= fs.realpath(os.homedir())
  return homeReal
}

function relativeTo(home: string, abs: string) {
  const rel = path.relative(home, abs)
  if (rel === '') return ''
  if (rel.startsWith(`..${path.sep}`) || rel === '..' || path.isAbsolute(rel)) return null
  return rel.split(path.sep).join('/')
}

function lexical(home: string, input: string) {
  let text = input.replace(/\0/g, '').trim().replace(/\\/g, '/')
  if (text === '~' || text === '~/' || text === '') text = ''
  else if (text.startsWith('~/')) text = text.slice(2)
  const homePosix = home.split(path.sep).join('/')
  if (text === homePosix) text = ''
  else if (text.startsWith(`${homePosix}/`)) text = text.slice(homePosix.length + 1)
  if (text.startsWith('/')) return null
  const parts: string[] = []
  for (const part of text.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (parts.length === 0) return null
      parts.pop()
      continue
    }
    parts.push(part)
  }
  const abs = path.resolve(home, ...parts)
  return relativeTo(home, abs) === null ? null : abs
}

async function realInside(home: string, abs: string) {
  try {
    const real = await fs.realpath(abs)
    return relativeTo(home, real) === null ? null : real
  } catch {
    return null
  }
}

function send(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Length', Buffer.byteLength(payload))
  res.end(payload)
}

function localRequest(req: IncomingMessage) {
  const addr = req.socket.remoteAddress
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1'
}

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BYTES + 1024) {
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

async function kindOf(home: string, dir: string, dirent: Dirent): Promise<Entry | null> {
  if (dirent.name.startsWith('.') || dirent.name === 'node_modules') return null
  const real = await realInside(home, path.join(dir, dirent.name))
  if (!real) return null
  const stat = await fs.stat(real)
  const rel = relativeTo(home, real)
  if (rel === null || rel === '') return null
  if (stat.isDirectory()) return { name: dirent.name, path: rel, type: 'dir' }
  if (stat.isFile()) return { name: dirent.name, path: rel, type: 'file' }
  return null
}

async function listDir(home: string, abs: string) {
  const real = await realInside(home, abs)
  if (!real) return null
  const stat = await fs.stat(real)
  if (!stat.isDirectory()) return null
  const dirents = await fs.readdir(real, { withFileTypes: true })
  const entries: Entry[] = []
  for (const dirent of dirents) {
    const entry = await kindOf(home, real, dirent)
    if (entry) entries.push(entry)
  }
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return { path: relativeTo(home, real) ?? '', entries: entries.slice(0, 2000) }
}

async function readText(home: string, abs: string) {
  const real = await realInside(home, abs)
  if (!real) return null
  const stat = await fs.stat(real)
  if (!stat.isFile() || stat.size > MAX_BYTES) return null
  const text = await fs.readFile(real, 'utf8')
  return text.replace(/\r\n/g, '\n')
}

async function findRoot(home: string, fileAbs: string) {
  const real = await realInside(home, fileAbs)
  if (!real) return null
  const fileStat = await fs.stat(real)
  if (!fileStat.isFile()) return null
  let dir = path.dirname(real)
  while (relativeTo(home, dir) !== null) {
    const hasGit = await fs.lstat(path.join(dir, '.git')).then(() => true, () => false)
    const library = await fs.stat(path.join(dir, 'library')).then((stat) => stat.isDirectory(), () => false)
    if (hasGit || library) return relativeTo(home, dir)
    if (dir === home) break
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return relativeTo(home, path.dirname(real))
}

async function writeText(home: string, abs: string, text: string) {
  if (Buffer.byteLength(text) > MAX_BYTES) return 'too-large' as const
  const real = await realInside(home, abs)
  if (!real) return 'denied' as const
  const stat = await fs.stat(real)
  if (!stat.isFile()) return 'denied' as const
  await fs.writeFile(real, text, 'utf8')
  return 'ok' as const
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  if (!localRequest(req)) {
    send(res, 403, { error: 'denied' })
    return
  }
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const home = await homeDir()
  const query = url.searchParams.get('path') ?? ''
  const method = req.method ?? 'GET'

  if (method === 'GET' && url.pathname === '/api/files') {
    const abs = lexical(home, query)
    if (!abs) {
      send(res, 400, { error: 'denied' })
      return
    }
    const listed = await listDir(home, abs)
    if (!listed) {
      send(res, 404, { error: 'missing' })
      return
    }
    send(res, 200, listed)
    return
  }

  if (method === 'GET' && url.pathname === '/api/files/read') {
    const abs = lexical(home, query)
    if (!abs) {
      send(res, 400, { error: 'denied' })
      return
    }
    const text = await readText(home, abs)
    if (text === null) {
      send(res, 404, { error: 'missing' })
      return
    }
    send(res, 200, { text })
    return
  }

  if (method === 'GET' && url.pathname === '/api/files/root') {
    const abs = lexical(home, query)
    if (!abs) {
      send(res, 400, { error: 'denied' })
      return
    }
    const root = await findRoot(home, abs)
    if (root === null) {
      send(res, 404, { error: 'missing' })
      return
    }
    send(res, 200, { root })
    return
  }

  if (method === 'PUT' && url.pathname === '/api/files') {
    let body: unknown
    try {
      body = JSON.parse(await readBody(req))
    } catch (error) {
      send(res, error instanceof Error && error.message === 'too-large' ? 413 : 400, { error: 'failed' })
      return
    }
    const record = body && typeof body === 'object' ? body as { path?: unknown; text?: unknown } : {}
    if (typeof record.path !== 'string' || typeof record.text !== 'string' || record.path.trim() === '') {
      send(res, 400, { error: 'failed' })
      return
    }
    const abs = lexical(home, record.path)
    if (!abs) {
      send(res, 400, { error: 'denied' })
      return
    }
    const result = await writeText(home, abs, record.text)
    if (result === 'too-large') {
      send(res, 413, { error: 'too-large' })
      return
    }
    if (result !== 'ok') {
      send(res, 404, { error: 'missing' })
      return
    }
    send(res, 200, { ok: true })
    return
  }

  send(res, 404, { error: 'missing' })
}

export function filesApiPlugin(): Plugin {
  return {
    name: 'codeshape-files',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0]
        if (pathname !== '/api/files' && pathname !== '/api/files/read' && pathname !== '/api/files/root') {
          next()
          return
        }
        void handle(req, res).catch(() => {
          if (!res.headersSent) send(res, 500, { error: 'failed' })
        })
      })
    },
  }
}
