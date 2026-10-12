import type { SimRequest, SimSuccess } from './simulate'

let worker: Worker | null = null
let nextId = 0

export function runFem(request: SimRequest, onStage: (stage: 'mesh' | 'solve') => void) {
  worker ??= new Worker(new URL('../../worker/fem.worker.ts', import.meta.url), { type: 'module' })
  const id = ++nextId
  const done = new Promise<SimSuccess>((resolve, reject) => {
    const finish = () => {
      worker?.removeEventListener('message', onMessage)
      worker?.removeEventListener('error', onError)
    }
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { id?: number; type?: string; stage?: 'mesh' | 'solve'; ok?: boolean; result?: SimSuccess; error?: string }
      if (!data || data.id !== id) return
      if (data.type === 'progress' && data.stage) {
        onStage(data.stage)
        return
      }
      if (data.type !== 'done') return
      finish()
      if (data.ok && data.result) resolve(data.result)
      else reject(new Error(data.error || 'femFailed'))
    }
    const onError = () => {
      finish()
      reject(new Error('femFailed'))
    }
    worker?.addEventListener('message', onMessage)
    worker?.addEventListener('error', onError)
  })
  worker.postMessage({ id, request })
  return done
}
