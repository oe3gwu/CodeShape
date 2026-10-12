import { useState } from 'react'
import { useI18n, type MessageKey } from '../i18n'
import type { DisplayPart, PlaneKey, Planes } from '../types'
import { Icon, type IconName } from './icons'

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

const features: Array<{ key: PlaneKey; label: MessageKey; icon: IconName }> = [
  { key: 'origin', label: 'origin', icon: 'point' },
  { key: 'top', label: 'planeTop', icon: 'plane' },
  { key: 'front', label: 'planeFront', icon: 'plane' },
  { key: 'right', label: 'planeRight', icon: 'plane' },
]

function matches(text: string, query: string) {
  return text.toLowerCase().includes(query.trim().toLowerCase())
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
  const [folderOpen, setFolderOpen] = useState(true)
  const scriptName = `${docName}.js`
  const trimmed = query.trim()
  const groupNameHit = trimmed.length > 0 && matches(t('standardGeometry'), query)
  const shownFeatures = features.filter((item) => !trimmed || groupNameHit || matches(t(item.label), query))
  const showScript = !trimmed || matches(scriptName, query) || matches(t('script'), query)
  const shownParts = parts.filter((part) => !trimmed || matches(part.name, query))
  const featureCount = shownFeatures.length + (showScript ? 1 : 0) + shownParts.length
  const groupOpen = folderOpen || trimmed.length > 0
  const showGroup = shownFeatures.length > 0

  return (
    <aside className="cs-features">
      <label className="cs-search">
        <Icon name="filter" size={14} />
        <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder={t('filterByName')} />
      </label>
      <div className="cs-feature-title">{t('features')} ({featureCount})</div>
      <div className="cs-tree">
        {showGroup ? (
          <button className="cs-feature-row is-folder" onClick={() => setFolderOpen((open) => !open)}>
            <span className={`cs-twist ${groupOpen ? '' : 'is-collapsed'}`}>
              <Icon name="chevron" size={14} />
            </span>
            <span className="cs-row-label">{t('standardGeometry')}</span>
          </button>
        ) : null}
        {showGroup && groupOpen ? shownFeatures.map((item) => (
          <div className="cs-feature-row is-child" key={item.key}>
            <span className="cs-feature-icon"><Icon name={item.icon} size={15} /></span>
            <span className="cs-row-label">{t(item.label)}</span>
            <button
              className={`cs-eye ${planes[item.key] ? 'is-on' : 'is-off'}`}
              title={planes[item.key] ? t('hideItem') : t('showItem')}
              onClick={() => onTogglePlane(item.key)}
            >
              <Icon name={planes[item.key] ? 'eye' : 'eyeOff'} size={14} />
            </button>
          </div>
        )) : null}
        {showScript ? (
          <button className="cs-feature-row" onClick={() => onSelect(null)}>
            <span className="cs-feature-icon is-script"><Icon name="code" size={15} /></span>
            <span className="cs-row-label">{scriptName}</span>
          </button>
        ) : null}
        {shownParts.map((part) => (
          <div
            key={part.id}
            className={`cs-feature-row ${selectedId === part.id ? 'is-selected' : ''}`}
            onClick={() => onSelect(part.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onSelect(part.id)
            }}
          >
            <span className="cs-feature-icon"><Icon name="cube" size={15} /></span>
            <span className="cs-row-label">{part.name}</span>
            <button
              className={`cs-eye ${hidden[part.id] ? 'is-off' : 'is-on'}`}
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
        {featureCount === 0 ? <div className="cs-empty">{t('noMatches')}</div> : null}
      </div>
    </aside>
  )
}
