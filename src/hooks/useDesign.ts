import { useEffect, useRef, useState } from 'react'
import { mergeParamValues } from '../lib/params'
import type { BuildResponse, DisplayPart, ParamDef, ParamValue } from '../types'

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      setDebounced(value)
      return
    }
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function useDesign(code: string) {
  const [params, setParams] = useState<Record<string, ParamValue>>({})
  const [definitions, setDefinitions] = useState<ParamDef[]>([])
  const [parts, setParts] = useState<DisplayPart[]>([])
  const [error, setError] = useState<string | null>(null)
  const [building, setBuilding] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [triangles, setTriangles] = useState(0)
  const [nonce, setNonce] = useState(0)
  const workerRef = useRef<Worker | null>(null)
  const requestId = useRef(0)
  const codeRef = useRef(code)
  const immediate = useRef(false)
  const timerRef = useRef(0)
  const settledKey = useRef('')
  const builtCode = useRef(code)
  codeRef.current = code

  const debouncedCode = useDebounced(code, 320)
  const paramsKey = JSON.stringify(params)
  const debouncedKey = useDebounced(paramsKey, 80)

  const spawn = () => {
    workerRef.current?.terminate()
    const worker = new Worker(new URL('../worker/jscad.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<BuildResponse>) => {
      const message = event.data
      if (message.id !== requestId.current) return
      window.clearTimeout(timerRef.current)
      setBuilding(false)
      if (!message.ok) {
        setError(message.error)
        return
      }
      setError(null)
      setParts(message.parts)
      setDefinitions(message.parameters)
      setElapsed(message.elapsed)
      setTriangles(message.triangles)
      setParams((prev) => {
        const merged = mergeParamValues(prev, message.parameters)
        settledKey.current = JSON.stringify(merged)
        return merged
      })
    }
    worker.onerror = () => {
      setBuilding(false)
      setError('errWorker')
    }
    workerRef.current = worker
  }

  useEffect(() => {
    spawn()
    return () => workerRef.current?.terminate()
    // Der Worker wird einmal erzeugt und bei einem Zeitlimit neu gestartet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const force = immediate.current
    const source = force ? codeRef.current : debouncedCode
    immediate.current = false
    if (!force && source === builtCode.current && debouncedKey === settledKey.current) return
    builtCode.current = source

    const id = ++requestId.current
    setBuilding(true)
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      if (requestId.current !== id) return
      setBuilding(false)
      setError('errTimeout')
      spawn()
    }, 45000)
    workerRef.current?.postMessage({
      id,
      type: 'build',
      code: source,
      params: JSON.parse(debouncedKey) as Record<string, ParamValue>,
    })
    return () => window.clearTimeout(timerRef.current)
  }, [debouncedCode, debouncedKey, nonce])

  const setParam = (name: string, value: ParamValue) => {
    setParams((prev) => ({ ...prev, [name]: value }))
  }

  const resetParams = () => setParams({})

  const rebuild = () => {
    immediate.current = true
    setNonce((value) => value + 1)
  }

  return {
    parts,
    definitions,
    params,
    setParam,
    resetParams,
    error,
    building,
    elapsed,
    triangles,
    rebuild,
  }
}
