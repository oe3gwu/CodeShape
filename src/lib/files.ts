import { IncludeMissingError } from './github'

export type FileEntry = {
  name: string
  path: string
  type: 'file' | 'dir'
}

const includeLine = /^[ \t]*include\s*\(\s*(['"])([^'"]+)\1\s*\)\s*;?[ \t]*$/

export function displayPath(rel: string) {
  return rel ? `~/${rel}` : '~'
}

export function parentPath(rel: string) {
  const slash = rel.lastIndexOf('/')
  return slash >= 0 ? rel.slice(0, slash) : ''
}

async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(String(response.status))
  return response.json() as Promise<T>
}

export async function listFiles(rel: string) {
  return apiGet<{ path: string; entries: FileEntry[] }>(`/api/files?path=${encodeURIComponent(rel)}`)
}

export async function readFileText(rel: string) {
  const data = await apiGet<{ text: string }>(`/api/files/read?path=${encodeURIComponent(rel)}`)
  return data.text
}

export async function projectRoot(rel: string) {
  const data = await apiGet<{ root: string }>(`/api/files/root?path=${encodeURIComponent(rel)}`)
  return data.root
}

export async function writeFileText(rel: string, text: string) {
  const response = await fetch('/api/files', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: rel, text }),
  })
  if (!response.ok) throw new Error(String(response.status))
}

export async function expandLocalIncludes(source: string, filePath: string) {
  if (!/^[ \t]*include\s*\(/m.test(source)) return source
  const root = await projectRoot(filePath)
  return expand(source, filePath, root, new Set())
}

async function expand(source: string, filePath: string, root: string, seen: Set<string>) {
  const lines = source.split('\n')
  const out: string[] = []
  for (const line of lines) {
    const match = line.match(includeLine)
    if (!match) {
      out.push(line)
      continue
    }
    const spec = match[2]
    const resolved = await resolveInclude(spec, filePath, root)
    if (seen.has(resolved.path)) continue
    seen.add(resolved.path)
    const nested = await expand(resolved.text, resolved.path, root, seen)
    out.push(`// include: ${resolved.path}`)
    out.push(nested)
  }
  return out.join('\n')
}

async function resolveInclude(spec: string, fromFile: string, root: string) {
  for (const candidate of includeCandidates(spec, fromFile, root)) {
    try {
      const text = await readFileText(candidate)
      return { path: candidate, text }
    } catch {
      // Nächster Kandidat, etwa library/ vor dem Projektwurzelpfad.
    }
  }
  throw new IncludeMissingError(spec)
}

function includeCandidates(spec: string, fromFile: string, root: string) {
  if (spec.startsWith('/')) {
    const relative = spec.replace(/^\/+/, '')
    return [joinRel(root, `library/${relative}`), joinRel(root, relative)].filter((item): item is string => item !== null)
  }
  const slash = fromFile.lastIndexOf('/')
  const dir = slash >= 0 ? fromFile.slice(0, slash) : ''
  const joined = joinRel(dir, spec)
  return joined === null ? [] : [joined]
}

function joinRel(dir: string, spec: string) {
  const parts: string[] = []
  for (const part of `${dir}/${spec}`.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (parts.length === 0) return null
      parts.pop()
      continue
    }
    parts.push(part)
  }
  return parts.join('/')
}
