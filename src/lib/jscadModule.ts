import { transform } from '@babel/standalone'

export function toCommonJs(code: string) {
  const result = transform(code, {
    filename: 'design.ts',
    babelrc: false,
    configFile: false,
    retainLines: true,
    sourceType: 'unambiguous',
    presets: ['typescript'],
    plugins: ['transform-modules-commonjs'],
  })
  if (!result?.code) throw new Error('Das Skript konnte nicht gelesen werden.')
  return result.code
}
