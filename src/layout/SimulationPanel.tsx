import { materials, type Material } from '../lib/fem/materials'
import type { SimCondition, SimTool } from '../hooks/useSimulation'
import { useI18n, type MessageKey } from '../i18n'

const materialKey: Record<string, MessageKey> = {
  s235: 'matS235',
  al6061: 'matAl6061',
  ti64: 'matTi64',
  pla: 'matPla',
  'pla-cf': 'matPlaCf',
  petg: 'matPetg',
  'petg-cf': 'matPetgCf',
  pc: 'matPc',
  'pc-cf': 'matPcCf',
  pa: 'matPa',
  'pa-cf': 'matPaCf',
  pei: 'matPei',
  'pei-cf': 'matPeiCf',
  peek: 'matPeek',
  'peek-cf': 'matPeekCf',
  pekk: 'matPekk',
  'pekk-cf': 'matPekkCf',
  pps: 'matPps',
  'pps-cf': 'matPpsCf',
  custom: 'matCustom',
}

const femError = new Set<string>(['femMaterial', 'femMesh', 'femSingular', 'femNotConverged', 'femTooFine', 'femFailed', 'femUnbound', 'femSetup'])

type Props = {
  meshes: Array<{ id: string; name: string }>
  partId: string
  material: Material
  tool: SimTool
  conditions: SimCondition[]
  gravity: boolean
  edge: number
  showStress: boolean
  showDeformed: boolean
  scale: number
  opacity: number
  stage: 'mesh' | 'solve' | null
  error: string | null
  minVonMises: number | null
  maxVonMises: number | null
  safetyFactor: number | null
  hasResult: boolean
  onPart: (id: string) => void
  onPreset: (id: string) => void
  onMaterial: (patch: Partial<Material>) => void
  onTool: (tool: SimTool) => void
  onGravity: (value: boolean) => void
  onEdge: (value: number) => void
  onStress: (value: boolean) => void
  onDeformed: (value: boolean) => void
  onScale: (value: number) => void
  onOpacity: (value: number) => void
  onEdit: (id: number, patch: Partial<SimCondition>) => void
  onRemove: (id: number) => void
  onStart: () => void
  onReset: () => void
}

export function SimulationPanel(props: Props) {
  const { t, lang } = useI18n()
  const strength = props.material.strengthKind === 'yield' ? t('simStrengthYield') : t('simStrengthTensile')
  const locale = lang === 'de' ? 'de-DE' : 'en-US'
  const error = props.error ? (femError.has(props.error) ? t(props.error as MessageKey) : props.error) : null
  const tools: Array<{ id: SimTool; label: MessageKey }> = [
    { id: 'fixed', label: 'simFixed' },
    { id: 'slide', label: 'simSlide' },
    { id: 'force', label: 'simForce' },
    { id: 'pressure', label: 'simPressure' },
  ]
  return (
    <aside className="cs-features cs-sim">
      <h2>{t('sim')}</h2>
      <p className="cs-sim-note">{t('simMaterialHint')}</p>
      {props.meshes.length === 0 ? <p className="cs-sim-note">{t('simNoPart')}</p> : null}
      <label className="cs-param">
        <span>{t('simPart')}</span>
        <select value={props.partId} onChange={(event) => props.onPart(event.target.value)}>
          {props.meshes.map((part) => <option key={part.id} value={part.id}>{part.name}</option>)}
        </select>
      </label>
      <label className="cs-param">
        <span>{t('simMaterial')}</span>
        <select value={materials.some((item) => item.id === props.material.id) ? props.material.id : 'custom'} onChange={(event) => props.onPreset(event.target.value)}>
          {materials.map((item) => <option key={item.id} value={item.id}>{t(materialKey[item.id])}</option>)}
          <option value="custom">{t('matCustom')}</option>
        </select>
      </label>
      <NumberField label={`${t('simYoung')} (MPa)`} value={props.material.young} step={100} onChange={(young) => props.onMaterial({ young })} />
      <NumberField label={t('simPoisson')} value={props.material.poisson} step={0.01} onChange={(poisson) => props.onMaterial({ poisson })} />
      <NumberField label={`${strength} (MPa)`} value={props.material.strength} step={1} onChange={(strengthValue) => props.onMaterial({ strength: strengthValue })} />
      <NumberField label={`${t('simDensity')} (g/cm³)`} value={props.material.density} step={0.01} onChange={(density) => props.onMaterial({ density })} />
      <div className="cs-sim-tools">
        {tools.map((item) => (
          <button key={item.id} className={props.tool === item.id ? 'is-on' : ''} onClick={() => props.onTool(props.tool === item.id ? 'none' : item.id)}>
            {t(item.label)}
          </button>
        ))}
      </div>
      {props.tool !== 'none' ? <p className="cs-sim-note">{t('simClick')}</p> : null}
      <ul className="cs-sim-loads">
        {props.conditions.map((condition) => (
          <li key={condition.id}>
            <div className="cs-sim-load-head">
              <span>{t(condition.kind === 'fixed' ? 'simFixed' : condition.kind === 'slide' ? 'simSlide' : condition.kind === 'force' ? 'simForce' : 'simPressure')}</span>
              <button title={t('simDelete')} onClick={() => props.onRemove(condition.id)}>×</button>
            </div>
            {condition.kind === 'pressure' ? (
              <NumberField label="N/mm²" value={condition.pressure} step={0.1} onChange={(pressure) => props.onEdit(condition.id, { pressure })} />
            ) : null}
            {condition.kind === 'force' ? (
              <>
                <NumberField label="Fx (N)" value={condition.force[0]} step={1} onChange={(value) => props.onEdit(condition.id, { force: [value, condition.force[1], condition.force[2]] })} />
                <NumberField label="Fy (N)" value={condition.force[1]} step={1} onChange={(value) => props.onEdit(condition.id, { force: [condition.force[0], value, condition.force[2]] })} />
                <NumberField label="Fz (N)" value={condition.force[2]} step={1} onChange={(value) => props.onEdit(condition.id, { force: [condition.force[0], condition.force[1], value] })} />
              </>
            ) : null}
          </li>
        ))}
      </ul>
      <label className="cs-sim-check">
        <input type="checkbox" checked={props.gravity} onChange={(event) => props.onGravity(event.target.checked)} />
        <span>{t('simGravity')}</span>
      </label>
      <label className="cs-param">
        <span>{t('simResolution')}</span>
        <span className="cs-param-num">
          <input type="range" min={0.02} max={0.25} step={0.01} value={props.edge} onChange={(event) => props.onEdge(Number(event.target.value))} />
          <input type="number" min={0.02} max={0.25} step={0.01} value={props.edge} onChange={(event) => props.onEdge(Number(event.target.value))} />
        </span>
        <span className="cs-sim-note">{t('simResolutionHint')}</span>
      </label>
      <div className="cs-sim-actions">
        <button className="is-primary" disabled={props.meshes.length === 0 || props.stage !== null} onClick={props.onStart}>
          {props.stage === 'mesh' ? t('simRunningMesh') : props.stage === 'solve' ? t('simRunningSolve') : t('simRun')}
        </button>
        <button onClick={props.onReset}>{t('simReset')}</button>
      </div>
      {error ? <p className="cs-sim-error">{error}</p> : null}
      <label className="cs-sim-check">
        <input type="checkbox" checked={props.showStress} disabled={!props.hasResult} onChange={(event) => props.onStress(event.target.checked)} />
        <span>{t('simStress')}</span>
      </label>
      <label className="cs-sim-check">
        <input type="checkbox" checked={props.showDeformed} disabled={!props.hasResult} onChange={(event) => props.onDeformed(event.target.checked)} />
        <span>{t('simDeform')}</span>
      </label>
      <label className="cs-param">
        <span>{t('simScale')}</span>
        <span className="cs-param-num">
          <input type="range" min={1} max={200} step={1} value={props.scale} disabled={!props.showDeformed} onChange={(event) => props.onScale(Number(event.target.value))} />
          <input type="number" min={1} max={200} step={1} value={props.scale} disabled={!props.showDeformed} onChange={(event) => props.onScale(Number(event.target.value))} />
        </span>
      </label>
      <label className="cs-param">
        <span>{t('simOpacity')}</span>
        <span className="cs-param-num">
          <input type="range" min={0.15} max={1} step={0.05} value={props.opacity} disabled={!props.hasResult} onChange={(event) => props.onOpacity(Number(event.target.value))} />
          <input type="number" min={0.15} max={1} step={0.05} value={props.opacity} disabled={!props.hasResult} onChange={(event) => props.onOpacity(Number(event.target.value))} />
        </span>
      </label>
      {props.hasResult && props.minVonMises !== null && props.maxVonMises !== null ? (
        <dl className="cs-sim-results">
          <div><dt>{t('simMin')}</dt><dd>{formatMPa(props.minVonMises, locale)}</dd></div>
          <div><dt>{t('simMax')}</dt><dd>{formatMPa(props.maxVonMises, locale)}</dd></div>
          <div><dt>{t('simSafety')}</dt><dd className={props.safetyFactor !== null && props.safetyFactor < 1 ? 'is-hot' : ''}>{props.safetyFactor === null ? '—' : props.safetyFactor.toLocaleString(locale, { maximumFractionDigits: 2 })}</dd></div>
        </dl>
      ) : <p className="cs-sim-note">{t('simEmpty')}</p>}
    </aside>
  )
}

function NumberField({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (value: number) => void }) {
  return (
    <label className="cs-param">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => {
          const next = Number(event.target.value)
          if (Number.isFinite(next)) onChange(next)
        }}
      />
    </label>
  )
}

function formatMPa(value: number, locale: string) {
  return `${value.toLocaleString(locale, { maximumFractionDigits: value >= 100 ? 1 : 3 })} MPa`
}
