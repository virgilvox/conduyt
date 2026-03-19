/**
 * Code execution engine for the playground.
 * Wraps user code in an async function with conduyt API injected.
 */
import { ConduytDevice } from '~/lib/conduyt-device'

export function useRunner() {
  const running = ref(false)
  const error = ref<string | null>(null)

  let abortController: AbortController | null = null
  let currentDevice: ConduytDevice | null = null

  type LogFn = (...args: any[]) => void

  async function run(
    code: string,
    serial: ReturnType<typeof import('./useSerial').useSerial>,
    logFn: LogFn,
  ) {
    if (running.value) {
      logFn('[runner] Already running — stop first')
      return
    }

    error.value = null
    running.value = true
    abortController = new AbortController()
    const signal = abortController.signal

    try {
      // Load WASM
      const wasm = await serial.loadWasm()

      // Create device
      currentDevice = new ConduytDevice(serial)

      // sleep() that respects abort
      const sleep = (ms: number) => new Promise<void>((resolve, reject) => {
        if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'))
        const timer = setTimeout(() => {
          if (signal.aborted) reject(new DOMException('Aborted', 'AbortError'))
          else resolve()
        }, ms)
        signal.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(new DOMException('Aborted', 'AbortError'))
        }, { once: true })
      })

      // Build the async function
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
      const userFn = new AsyncFunction(
        'device', 'conduyt', 'log', 'sleep', 'serial',
        code,
      )

      await userFn(currentDevice, wasm, logFn, sleep, serial)

      logFn('[runner] Finished')
    } catch (e: any) {
      if (e.name === 'AbortError') {
        logFn('[runner] Stopped')
      } else {
        const msg = e.message || String(e)
        error.value = msg
        logFn(`[error] ${msg}`)
      }
    } finally {
      try { await currentDevice?.close() } catch {}
      currentDevice = null
      running.value = false
      abortController = null
    }
  }

  function stop() {
    abortController?.abort()
  }

  return {
    running: readonly(running),
    error: readonly(error),
    run,
    stop,
  }
}
