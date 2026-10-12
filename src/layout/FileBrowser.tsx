import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import { displayPath, listFiles, parentPath, readFileText, type FileEntry } from '../lib/files'
import { isModelFile } from '../lib/github'
import { Icon } from './icons'

type Props = {
  path: string
  activePath: string
  onPath: (path: string) => void
  onOpen: (code: string, docName: string, path: string) => void
}

export function FileBrowser({ path, activePath, onPath, onOpen }: Props) {
  const { t } = useI18n()
  const [draft, setDraft] = useState(displayPath(path))
  const [current, setCurrent] = useState(path)
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = async (next: string) => {
    setBusy(true)
    setError(null)
    try {
      const listed = await listFiles(next)
      setCurrent(listed.path)
      setEntries(listed.entries)
      setDraft(displayPath(listed.path))
      onPath(listed.path)
    } catch {
      setError(t('filesFailed'))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void load(path)
    // Nur den gespeicherten Ordner beim Öffnen laden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openFile = async (entry: FileEntry) => {
    if (!isModelFile(entry.name)) return
    setBusy(true)
    setError(null)
    try {
      const text = await readFileText(entry.path)
      const stem = entry.name.replace(/\.(js|jscad)$/i, '')
      onOpen(text, stem, entry.path)
    } catch {
      setError(t('filesReadFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="cs-features cs-github">
      <form
        className="cs-browser-bar"
        onSubmit={(event) => {
          event.preventDefault()
          void load(draft)
        }}
      >
        <input
          value={draft}
          aria-label={t('filesPath')}
          placeholder="~"
          onChange={(event) => setDraft(event.target.value)}
        />
      </form>
      <div className="cs-tree">
        {current ? (
          <button className="cs-feature-row" onClick={() => void load(parentPath(current))}>
            <span className="cs-feature-icon"><Icon name="folder" size={15} /></span>
            <span className="cs-row-label">..</span>
          </button>
        ) : null}
        {error ? <div className="cs-empty">{error}</div> : null}
        {!error && entries.length === 0 && !busy ? <div className="cs-empty">{t('filesEmpty')}</div> : null}
        {entries.map((entry) => (
          <button
            key={entry.path}
            className={entry.path === activePath ? 'cs-feature-row is-selected' : 'cs-feature-row'}
            onClick={() => {
              if (entry.type === 'dir') void load(entry.path)
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
