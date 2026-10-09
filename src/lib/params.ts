import type { ParamDef, ParamValue } from '../types'

export function initialOf(def: ParamDef): ParamValue {
  if (def.type === 'checkbox') {
    if (typeof def.initial === 'boolean') return def.initial
    if (typeof def.checked === 'boolean') return def.checked
    return Boolean(def.initial ?? def.checked)
  }
  if (def.initial !== undefined) return def.initial
  if (def.type === 'choice') return def.values?.[0] ?? ''
  if (def.type === 'int' || def.type === 'float' || def.type === 'number') return 0
  return ''
}

export function applyParamDefaults(
  defs: ParamDef[],
  params: Record<string, ParamValue>,
): Record<string, ParamValue> {
  const next: Record<string, ParamValue> = { ...params }
  for (const def of defs) {
    if (!def.name || def.type === 'group') continue
    if (next[def.name] === undefined) next[def.name] = initialOf(def)
  }
  return next
}

export function mergeParamValues(
  prev: Record<string, ParamValue>,
  defs: ParamDef[],
): Record<string, ParamValue> {
  const next: Record<string, ParamValue> = {}
  for (const def of defs) {
    if (!def.name || def.type === 'group') continue
    next[def.name] = Object.prototype.hasOwnProperty.call(prev, def.name) ? prev[def.name] : initialOf(def)
  }
  const prevKeys = Object.keys(prev)
  const nextKeys = Object.keys(next)
  if (prevKeys.length === nextKeys.length && nextKeys.every((key) => prev[key] === next[key])) return prev
  return next
}
