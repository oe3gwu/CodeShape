import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import {
  IncludeMissingError,
  githubUrl,
  isModelFile,
  listGithub,
  loadModel,
  parseGithubUrl,
  type GithubEntry,
  type GithubLocation,
} from '../lib/github'
import { Icon } from './icons'

type Props = {
  url: string
  onUrl: (url: string) => void
  onOpen: (code: string, docName: string) => void
}

export function GithubBrowser({ url, onUrl, onOpen }: Props) {
  const { t } = useI18n()
  const [draft, setDraft] = useState(url)
  const [location, setLocation] = useState<GithubLocation | null>(null)
  const [entries, setEntries] = useState<GithubEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = async (nextUrl: string) => {
    const parsed = parseGithubUrl(nextUrl)
    if (!parsed) {
      setError(t('githubFailed'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const listed = await listGithub(parsed)
      setLocation(parsed)
      setEntries(listed)
      setDraft(githubUrl(parsed))
      onUrl(githubUrl(parsed))
    } catch {
      setError(t('githubFailed'))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (url.trim()) void load(url)
    // Nur die gespeicherte Adresse beim Öffnen des Fensters laden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openDir = (entry: GithubEntry) => {
    if (!location) return
    const next = { ...location, path: entry.path }
    const address = githubUrl(next)
    setDraft(address)
    void load(address)
  }

  const openFile = async (entry: GithubEntry) => {
    if (!location || !isModelFile(entry.name)) return
    setBusy(true)
    setError(null)
    try {
      const code = await loadModel(location, entry.path)
      const stem = entry.name.replace(/\.(js|jscad)$/i, '')
      onOpen(code, stem)
    } catch (caught) {
      setError(caught instanceof IncludeMissingError ? `${t('includeMissing')}: ${caught.spec}` : t('githubFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="cs-features cs-github">
      <form
        className="cs-github-bar"
        onSubmit={(event) => {
          event.preventDefault()
          void load(draft)
        }}
      >
        <input
          value={draft}
          aria-label={t('githubUrl')}
          placeholder="https://github.com/owner/repo/tree/master"
          onChange={(event) => setDraft(event.target.value)}
        />
      </form>
      <div className="cs-tree">
        {location && location.path ? (
          <button
            className="cs-feature-row"
            onClick={() => {
              const parent = location.path.split('/').slice(0, -1).join('/')
              const address = githubUrl({ ...location, path: parent })
              setDraft(address)
              void load(address)
            }}
          >
            <span className="cs-feature-icon"><Icon name="folder" size={15} /></span>
            <span className="cs-row-label">..</span>
          </button>
        ) : null}
        {error ? <div className="cs-empty">{error}</div> : null}
        {!error && entries.length === 0 && !busy ? <div className="cs-empty">{t('githubEmpty')}</div> : null}
        {entries.map((entry) => (
          <button
            key={entry.path}
            className="cs-feature-row"
            onClick={() => {
              if (entry.type === 'dir') openDir(entry)
            }}
            onDoubleClick={() => {
              if (entry.type === 'file') void openFile(entry)
            }}
          >
            <span className="cs-feature-icon">
              <Icon name={entry.type === 'dir' ? 'folder' : 'file'} size={15} />
            </span>
            <span className="cs-row-label">{entry.name}</span>
          </button>
        ))}
      </div>
    </aside>
  )
}
