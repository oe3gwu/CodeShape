export type StrengthKind = 'yield' | 'tensile'

export type Material = {
  id: string
  young: number
  poisson: number
  strength: number
  density: number
  strengthKind: StrengthKind
}

export const materials: Material[] = [
  { id: 's235', young: 210000, poisson: 0.3, strength: 235, density: 7.85, strengthKind: 'yield' },
  { id: 'al6061', young: 68900, poisson: 0.33, strength: 276, density: 2.7, strengthKind: 'yield' },
  { id: 'ti64', young: 114000, poisson: 0.34, strength: 880, density: 4.43, strengthKind: 'yield' },
  { id: 'pla', young: 3500, poisson: 0.36, strength: 50, density: 1.24, strengthKind: 'tensile' },
  { id: 'pla-cf', young: 6500, poisson: 0.36, strength: 48, density: 1.25, strengthKind: 'tensile' },
  { id: 'petg', young: 2000, poisson: 0.4, strength: 50, density: 1.27, strengthKind: 'tensile' },
  { id: 'petg-cf', young: 4500, poisson: 0.38, strength: 52, density: 1.27, strengthKind: 'tensile' },
  { id: 'pc', young: 2400, poisson: 0.37, strength: 65, density: 1.2, strengthKind: 'tensile' },
  { id: 'pc-cf', young: 6500, poisson: 0.36, strength: 75, density: 1.22, strengthKind: 'tensile' },
  { id: 'pa', young: 1700, poisson: 0.4, strength: 50, density: 1.14, strengthKind: 'tensile' },
  { id: 'pa-cf', young: 6000, poisson: 0.38, strength: 70, density: 1.2, strengthKind: 'tensile' },
  { id: 'pei', young: 3200, poisson: 0.36, strength: 80, density: 1.27, strengthKind: 'tensile' },
  { id: 'pei-cf', young: 7000, poisson: 0.36, strength: 90, density: 1.32, strengthKind: 'tensile' },
  { id: 'peek', young: 3600, poisson: 0.38, strength: 100, density: 1.3, strengthKind: 'tensile' },
  { id: 'peek-cf', young: 18000, poisson: 0.38, strength: 140, density: 1.4, strengthKind: 'tensile' },
  { id: 'pekk', young: 3500, poisson: 0.38, strength: 100, density: 1.3, strengthKind: 'tensile' },
  { id: 'pekk-cf', young: 16000, poisson: 0.38, strength: 130, density: 1.39, strengthKind: 'tensile' },
  { id: 'pps', young: 3800, poisson: 0.36, strength: 75, density: 1.35, strengthKind: 'tensile' },
  { id: 'pps-cf', young: 15000, poisson: 0.36, strength: 120, density: 1.45, strengthKind: 'tensile' },
]

export const customMaterial: Material = {
  id: 'custom',
  young: 210000,
  poisson: 0.3,
  strength: 235,
  density: 7.85,
  strengthKind: 'yield',
}

export function materialPreset(id: string) {
  return materials.find((material) => material.id === id) ?? null
}
