import { useI18n, type MessageKey } from '../i18n'
import type { DisplayPart, PlaneKey, Planes } from '../types'
import { Icon } from './icons'

type Props = {
  docName: string
  query: string
  onQuery: (value: string) => void
  planes: Planes
  onTogglePlane: (key: PlaneKey) => void
  parts: DisplayPart[]
  hidden: Record<string, boolean>
  selectedId: string | null
  onSelect: (id: string | null) => void
  onTogglePart: (id: string) => void
}

const features: Array<{ key: PlaneKey; label: MessageKey; swatch: string }> = [
  { key: 'origin', label: 'origin', swatch: '' },
  { key: 'top', label: 'planeTop', swatch: '#2f6fed' },
  { key: 'front', label: 'planeFront', swatch: '#d4534e' },
  { key: 'right', label: 'planeRight', swatch: '#2f9d5a' },
]

function matches(text: string, query: string) {
  return text.toLowerCase().includes(query.trim().toLowerCase())
}

function cssColor(color: [number, number, number, number]) {
  const channel = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 255)
  return `rgb(${channel(color[0])} ${channel(color[1])} ${channel(color[2])})`
}

export function FeaturePanel({
  docName,
  query,
  onQuery,
  planes,
  onTogglePlane,
  parts,
  hidden,
  selectedId,
  onSelect,
  onTogglePart,
}: Props) {
  const { t } = useI18n()
  const shownFeatures = features.filter((item) => matches(t(item.label), query))
  const scriptName = `${docName}.js`
  const showScript = matches(scriptName, query) || matches(t('script'), query)
  const shownParts = parts.filter((part) => matches(part.name, query))
  const featureCount = shownFeatures.length + (showScript ? 1 : 0)

  return (
    <aside className="cs-features">
      <div className="cs-panel-head">
        <span>{t('features')}</span>
        <span className="cs-count">{featureCount}</span>
      </div>
      <label className="cs-search">
        <Icon name="search" size={14} />
        <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder={t('search')} />
      </label>
      <div className="cs-tree">
        {shownFeatures.map((item) => (
          <div className="cs-row" key={item.key}>
            <span className="cs-swatch" style={item.swatch ? { background: item.swatch } : undefined}>
              {item.key === 'origin' ? <Icon name="origin" size={14} /> : null}
            </span>
            <span className="cs-row-label">{t(item.label)}</span>
            <button
              className={`cs-eye ${planes[item.key] ? 'is-on' : ''}`}
              title={planes[item.key] ? t('hideItem') : t('showItem')}
              onClick={() => onTogglePlane(item.key)}
            >
              <Icon name={planes[item.key] ? 'eye' : 'eyeOff'} size={14} />
            </button>
          </div>
        ))}
        {showScript ? (
          <button className="cs-row is-button is-script" onClick={() => onSelect(null)}>
            <span className="cs-swatch is-code"><Icon name="code" size={13} /></span>
            <span className="cs-row-label">{scriptName}</span>
          </button>
        ) : null}
        {featureCount === 0 ? <div className="cs-empty">{t('noMatches')}</div> : null}
      </div>
      <div className="cs-panel-head cs-parts-head">
        <span>{t('parts')}</span>
        <span className="cs-count">{shownParts.length}</span>
      </div>
      <div className="cs-tree cs-parts">
        {shownParts.map((part) => (
          <div
            key={part.id}
            className={`cs-row is-button ${selectedId === part.id ? 'is-selected' : ''}`}
            onClick={() => onSelect(part.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onSelect(part.id)
            }}
          >
            <span className="cs-swatch is-part" style={{ background: cssColor(part.color) }} />
            <span className="cs-row-label">{part.name}</span>
            <button
              className={`cs-eye ${hidden[part.id] ? '' : 'is-on'}`}
              title={hidden[part.id] ? t('showItem') : t('hideItem')}
              onClick={(event) => {
                event.stopPropagation()
                onTogglePart(part.id)
              }}
            >
              <Icon name={hidden[part.id] ? 'eyeOff' : 'eye'} size={14} />
            </button>
          </div>
        ))}
        {shownParts.length === 0 ? <div className="cs-empty">{t('noParts')}</div> : null}
      </div>
    </aside>
  )
}
