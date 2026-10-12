export type GithubLocation = {
  owner: string
  repo: string
  ref: string
  path: string
}

export type GithubEntry = {
  name: string
  path: string
  type: 'file' | 'dir'
}

export class IncludeMissingError extends Error {
  readonly spec: string

  constructor(spec: string) {
    super(spec)
    this.spec = spec
  }
}

const includeLine = /^[ \t]*include\s*\(\s*(['"])([^'"]+)\1\s*\)\s*;?[ \t]*$/

export function parseGithubUrl(input: string): GithubLocation | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') return null
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length < 2) return null
  const owner = parts[0]
  const repo = parts[1].replace(/\.git$/, '')
  const kind = parts[2]
  if (!kind) return { owner, repo, ref: 'HEAD', path: '' }
  if (kind !== 'tree' && kind !== 'blob') return null
  const rest = parts.slice(3)
  if (rest.length === 0) return null
  const ref = decodeURIComponent(rest[0])
  const tail = rest.slice(1).map(decodeURIComponent)
  const path = kind === 'blob' ? tail.slice(0, -1).join('/') : tail.join('/')
  return { owner, repo, ref, path }
}

export function githubUrl(location: GithubLocation): string {
  const suffix = location.path ? `/${location.path.split('/').map(encodeURIComponent).join('/')}` : ''
  return `https://github.com/${location.owner}/${location.repo}/tree/${encodeURIComponent(location.ref)}${suffix}`
}

export async function listGithub(location: GithubLocation): Promise<GithubEntry[]> {
  const path = location.path ? `/${location.path.split('/').map(encodeURIComponent).join('/')}` : ''
  const url = `https://api.github.com/repos/${location.owner}/${location.repo}/contents${path}?ref=${encodeURIComponent(location.ref)}`
  const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } })
  if (!response.ok) throw new Error(String(response.status))
  const data: unknown = await response.json()
  if (!Array.isArray(data)) throw new Error('not-directory')
  const entries = data.flatMap((item): GithubEntry[] => {
    if (!item || typeof item !== 'object') return []
    const record = item as { name?: unknown; path?: unknown; type?: unknown }
    if (typeof record.name !== 'string' || typeof record.path !== 'string') return []
    if (record.type !== 'file' && record.type !== 'dir') return []
    return [{ name: record.name, path: record.path, type: record.type }]
  })
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return entries
}

export function isModelFile(name: string) {
  const lower = name.toLowerCase()
  return lower.endsWith('.js') || lower.endsWith('.jscad')
}

export async function loadModel(location: GithubLocation, filePath: string): Promise<string> {
  const text = await fetchRaw(location, filePath)
  return expandIncludes(text, filePath, location, new Set())
}

async function expandIncludes(source: string, filePath: string, location: GithubLocation, seen: Set<string>): Promise<string> {
  const lines = source.split('\n')
  const out: string[] = []
  for (const line of lines) {
    const match = line.match(includeLine)
    if (!match) {
      out.push(line)
      continue
    }
    const spec = match[2]
    const resolved = await resolveInclude(spec, filePath, location)
    if (seen.has(resolved.path)) continue
    seen.add(resolved.path)
    const expanded = await expandIncludes(resolved.text, resolved.path, location, seen)
    out.push(`// include: ${resolved.path}`)
    out.push(expanded)
  }
  return out.join('\n')
}

async function resolveInclude(spec: string, fromFile: string, location: GithubLocation) {
  for (const candidate of includeCandidates(spec, fromFile)) {
    const text = await fetchOptional(location, candidate)
    if (text !== null) return { path: candidate, text }
  }
  throw new IncludeMissingError(spec)
}

function includeCandidates(spec: string, fromFile: string): string[] {
  if (spec.startsWith('/')) {
    const relative = spec.replace(/^\/+/, '')
    return [`library/${relative}`, relative]
  }
  const slash = fromFile.lastIndexOf('/')
  const dir = slash >= 0 ? fromFile.slice(0, slash) : ''
  return [normalize(dir ? `${dir}/${spec}` : spec)]
}

function normalize(path: string) {
  const parts: string[] = []
  for (const part of path.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return parts.join('/')
}

async function fetchOptional(location: GithubLocation, path: string) {
  const response = await fetch(rawUrl(location, path))
  if (!response.ok) return null
  return response.text()
}

async function fetchRaw(location: GithubLocation, path: string) {
  const text = await fetchOptional(location, path)
  if (text === null) throw new IncludeMissingError(path)
  return text
}

function rawUrl(location: GithubLocation, path: string) {
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  return `https://raw.githubusercontent.com/${location.owner}/${location.repo}/${encodeURIComponent(location.ref)}/${encoded}`
}
