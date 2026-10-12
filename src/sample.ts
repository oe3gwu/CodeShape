export const SAMPLE_NAME = 'Primitive'

export const SAMPLE = `// This sketch combines two JSCAD demonstrations: 3D Primitives and Transparency

/**
 * 3D Primitives Demonstration
 * @category Creating Shapes
 * @skillLevel 1
 * @description Demonstrating the basics of a variety of 3D primitives
 * @tags cube, cuboid, sphere, ellipsoid, cylinder, torus, shape, 3d
 * @authors Rene K. Mueller, Moissette Mark, Simon Clark
 * @licence MIT License
 */

/**
 * Transparency
 * @category Colors
 * @skillLevel 2
 * @description showing transparent objects
 * @tags colors, transparency, hsltorgb
 * @authors Rene K. Mueller, Moissette Mark, Simon Clark
 * @licence MIT License
 */

import { colors, primitives, transforms } from '@jscad/modeling'
const { colorize, hslToRgb, colorNameToRgb } = colors
const {
  cube,
  cuboid,
  roundedCuboid,
  roundedCylinder,
  sphere,
  geodesicSphere,
  ellipsoid,
  cylinder,
  cylinderElliptic,
  torus,
} = primitives
const { translate } = transforms

export const main = () => {
  const shapes = []
  for (let i = 6; i >= 0; i--) {
    // reverse order for seeing through all cylinders (see http://www.opengl.org/wiki/Transparency_Sorting)
    const shapeColor = hslToRgb(i / 8, 1, 0.5, (i + 1) / 8) // hslToRGB can accept a transparency value as well.
    shapes.push(
      colorize(
        shapeColor,
        translate([(i - 3) * 7.5, 0, 0], cylinder({ radius: 3, height: 20 })),
      ),
    )
  }
  shapes.push(
    colorize(
      colorNameToRgb('red'),
      translate([-4, -10, 0], cuboid({ size: [5, 5, 5] })),
    ),
  )
  shapes.push(
    colorize(
      [1, 0, 0, 0.5],
      translate([4, -10, 0], cuboid({ size: [5, 5, 5] })),
    ),
  )

  const allPrimitives = [
    cube(),
    cuboid({ size: [1, 2, 3] }),
    roundedCuboid({ size: [2, 3, 2], roundRadius: 0.4, segments: 32 }),
    roundedCuboid({ size: [1, 2, 3], roundRadius: 0.4, segments: 16 }),
    sphere({ radius: 2, segments: 16 }),
    geodesicSphere({ radius: 1.5, segments: 16 }),
    ellipsoid({
      radius: [2, 1, 1.5],
      segments: 64,
      axes: [
        [1, 1, 0],
        [0, -1, 1],
        [-1, 0, 1],
      ],
    }),
    cylinder({ radius: 1, height: 5 }),
    roundedCylinder({ radius: 1, height: 8, roundRadius: 0.8 }),
    cylinderElliptic({
      height: 8,
      startRadius: [1, 2],
      startAngle: 0,
      endRadius: [1, 2],
      endAngle: Math.PI / 8,
      segments: 32,
    }),
    cylinder({ start: [0, 0, 0], end: [3, 3, 10], radius: 1 }),
    torus({ innerRadius: 1, outerRadius: 1.2 }),
    torus({
      innerRadius: 1,
      outerRadius: 1.5,
      innerSegments: 4,
      outerSegments: 6,
      innerRotation: 0,
    }),
  ]

  allPrimitives
    .map((primitive, index) => {
      return translate(
        [10 + ((index % 4) - 2) * 6, Math.floor(index / 4 - 2) * 6, 30],
        primitive,
      )
    })
    .forEach(p => shapes.push(p))

  return shapes
}
`
