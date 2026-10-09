import { useState } from 'react'
import { useI18n } from '../i18n'
import type { ParamDef, ParamValue } from '../types'
import { Icon } from './icons'

type Props = {
  definitions: ParamDef[]
  values: Record<string, ParamValue>
  onChange: (name: string, value: ParamValue) => void
}

export function ParameterDialog({ definitions, values, onChange }: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState(true)
  const fields = definitions.filter((def) => def.type !== 'group' && def.name)
  if (fields.length === 0 && !definitions.some((def) => def.type === 'group')) return null

  return (
    <section className={`cs-dialog ${open ? '' : 'is-collapsed'}`}>
      <header>
        <span>{t('parameters')}</span>
        <button title={open ? t('collapse') : t('expand')} onClick={() => setOpen((value) => !value)}>
          <Icon name="chevron" size={14} />
        </button>
      </header>
      {open ? (
        <div className="cs-dialog-body">
          {definitions.map((def, index) => {
            if (def.type === 'group') {
              return <div className="cs-param-group" key={`group-${index}`}>{def.caption ?? def.name}</div>
            }
            if (!def.name) return null
            return (
              <label className="cs-param" key={def.name}>
                <span>{def.caption || def.name}</span>
                <Field def={def} value={values[def.name]} onChange={(value) => onChange(def.name!, value)} />
              </label>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}

function Field({
  def,
  value,
  onChange,
}: {
  def: ParamDef
  value: ParamValue | undefined
  onChange: (value: ParamValue) => void
}) {
  if (def.type === 'checkbox') {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(event) => onChange(event.target.checked)}
      />
    )
  }
  if (def.type === 'choice') {
    return (
      <select value={String(value ?? '')} onChange={(event) => onChange(event.target.value)}>
        {(def.values ?? []).map((option, index) => (
          <option key={String(option)} value={String(option)}>
            {def.captions?.[index] ?? String(option)}
          </option>
        ))}
      </select>
    )
  }
  if (def.type === 'color') {
    const hex = typeof value === 'string' && value.startsWith('#') ? value : '#888888'
    return <input type="color" value={hex} onChange={(event) => onChange(event.target.value)} />
  }
  if (def.type === 'text' || def.type === 'string') {
    return <input value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} />
  }
  const numeric = typeof value === 'number' ? value : Number(value ?? 0)
  const step = def.step ?? (def.type === 'int' ? 1 : 0.1)
  const commit = (raw: string) => {
    const next = def.type === 'int' ? parseInt(raw, 10) : Number(raw)
    if (Number.isFinite(next)) onChange(next)
  }
  return (
    <span className="cs-param-num">
      {def.min !== undefined && def.max !== undefined ? (
        <input
          type="range"
          min={def.min}
          max={def.max}
          step={step}
          value={Number.isFinite(numeric) ? numeric : def.min}
          onChange={(event) => commit(event.target.value)}
        />
      ) : null}
      <input
        type="number"
        min={def.min}
        max={def.max}
        step={step}
        value={Number.isFinite(numeric) ? numeric : 0}
        onChange={(event) => commit(event.target.value)}
      />
    </span>
  )
}
