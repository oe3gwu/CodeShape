export type LineOp =
  | { type: 'equal'; text: string }
  | { type: 'insert'; text: string }
  | { type: 'delete'; text: string }

export type ScriptMarks = {
  adds: number[]
  deletes: { at: number; text: string }[]
}

export function normalizeScript(text: string) {
  return text.replace(/\r\n/g, '\n').replace(/\n+$/, '')
}

export function diffLines(before: string[], after: string[]): LineOp[] {
  const n = before.length
  const m = after.length
  if (n === 0 && m === 0) return []
  if (n * m > 1_500_000) {
    return [
      ...before.map((text) => ({ type: 'delete' as const, text })),
      ...after.map((text) => ({ type: 'insert' as const, text })),
    ]
  }
  const cols = m + 1
  const dp = new Uint32Array((n + 1) * cols)
  const at = (row: number, col: number) => row * cols + col
  for (let row = n - 1; row >= 0; row -= 1) {
    for (let col = m - 1; col >= 0; col -= 1) {
      dp[at(row, col)] = before[row] === after[col]
        ? dp[at(row + 1, col + 1)] + 1
        : Math.max(dp[at(row + 1, col)], dp[at(row, col + 1)])
    }
  }
  const ops: LineOp[] = []
  let row = 0
  let col = 0
  while (row < n && col < m) {
    if (before[row] === after[col]) {
      ops.push({ type: 'equal', text: after[col] })
      row += 1
      col += 1
    } else if (dp[at(row + 1, col)] >= dp[at(row, col + 1)]) {
      ops.push({ type: 'delete', text: before[row] })
      row += 1
    } else {
      ops.push({ type: 'insert', text: after[col] })
      col += 1
    }
  }
  while (row < n) {
    ops.push({ type: 'delete', text: before[row] })
    row += 1
  }
  while (col < m) {
    ops.push({ type: 'insert', text: after[col] })
    col += 1
  }
  return ops
}

function lineStarts(text: string) {
  const starts = [0]
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') starts.push(index + 1)
  }
  return starts
}

export function scriptMarks(before: string, after: string): ScriptMarks {
  const next = after.replace(/\r\n/g, '\n')
  const left = before.replace(/\r\n/g, '\n').split('\n')
  const right = next.split('\n')
  const starts = lineStarts(next)
  const adds: number[] = []
  const deletes: { at: number; text: string }[] = []
  let line = 0
  let removed: string[] = []
  const flush = () => {
    if (removed.length === 0) return
    deletes.push({ at: line < starts.length ? starts[line] : next.length, text: removed.join('\n') })
    removed = []
  }
  for (const op of diffLines(left, right)) {
    if (op.type === 'delete') {
      removed.push(op.text)
      continue
    }
    flush()
    if (op.type === 'insert') adds.push(starts[line] ?? next.length)
    line += 1
  }
  flush()
  return { adds, deletes }
}
