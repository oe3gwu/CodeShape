export const SAMPLE_NAME = 'Gehäuse'

export const SAMPLE = `const jscad = require('@jscad/modeling')
const { roundedCuboid, cuboid, cylinder } = jscad.primitives
const { subtract, union } = jscad.booleans
const { translate } = jscad.transforms
const { colorize } = jscad.colors

const getParameterDefinitions = () => [
  { name: 'laenge', caption: 'Länge', type: 'float', initial: 112, min: 70, max: 180, step: 1 },
  { name: 'breite', caption: 'Breite', type: 'float', initial: 64, min: 40, max: 120, step: 1 },
  { name: 'hoehe', caption: 'Höhe', type: 'float', initial: 28, min: 14, max: 60, step: 1 },
  { name: 'radius', caption: 'Kantenradius', type: 'float', initial: 6, min: 1, max: 14, step: 0.5 },
  { name: 'bohrung', caption: 'Bohrung', type: 'float', initial: 6.5, min: 2, max: 16, step: 0.5 },
]

const main = (p) => {
  const radius = Math.max(0.6, Math.min(p.radius, p.hoehe / 2 - 0.4, p.breite / 4, p.laenge / 4))
  let body = roundedCuboid({
    size: [p.laenge, p.breite, p.hoehe],
    roundRadius: radius,
    segments: 8,
  })
  body = translate([0, 0, p.hoehe / 2], body)

  const hole = (x) => translate(
    [x, 0, p.hoehe / 2],
    cylinder({ radius: p.bohrung / 2, height: p.hoehe + 8, segments: 32 }),
  )
  body = subtract(body, hole(-p.laenge * 0.28), hole(p.laenge * 0.28))

  const band = translate(
    [0, -p.breite / 2 + 3.4, p.hoehe * 0.62],
    cuboid({ size: [p.laenge * 0.72, 3.4, 5.2] }),
  )

  const key = (x, y) => translate(
    [x, y, p.hoehe + 1.15],
    roundedCuboid({ size: [18, 11, 2.5], roundRadius: 1.2, segments: 4 }),
  )

  return [
    colorize([0.45, 0.49, 0.55, 1], body),
    colorize([0.86, 0.87, 0.9, 1], band),
    colorize([0.16, 0.17, 0.19, 1], union(key(-14, 8), key(12, 10))),
  ]
}

module.exports = { main, getParameterDefinitions }
`
