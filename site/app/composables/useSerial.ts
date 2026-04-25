/**
 * WebSerial composable for CONDUYT protocol communication.
 * Handles port lifecycle, COBS framing, and packet encode/decode.
 */
export function useSerial() {
  const connected = ref(false)
  const error = ref<string | null>(null)
  const portInfo = ref<string>('')

  let port: SerialPort | null = null
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  let writable: WritableStream<Uint8Array> | null = null
  let abortController: AbortController | null = null

  // COBS frame buffer - accumulate until 0x00 delimiter
  let frameBuffer = new Uint8Array(0)

  // Callbacks
  const packetHandlers: Array<(packet: any) => void> = []
  const rawHandlers: Array<(data: Uint8Array) => void> = []

  // Lazy WASM loading
  let wasm: any = null

  async function loadWasm() {
    if (wasm) return wasm
    const mod = await import('conduyt-wasm')
    // wasm-pack --target bundler exports an init function as `default`, but
    // vite-plugin-wasm auto-initializes at import time and replaces the
    // default export with the initialized binding object. So default() is
    // only a function in environments without the plugin (e.g. some test
    // runners). Be defensive.
    if (typeof (mod as any).default === 'function') {
      await (mod as any).default()
    }
    wasm = mod
    return wasm
  }

  async function requestPort(baudRate = 115200) {
    try {
      error.value = null
      const w = await loadWasm()

      port = await (navigator as any).serial.requestPort()
      await port!.open({ baudRate })
      writable = port!.writable!
      connected.value = true

      const info = port!.getInfo()
      portInfo.value = info.usbVendorId
        ? `USB ${info.usbVendorId.toString(16)}:${info.usbProductId?.toString(16)}`
        : 'Serial Port'

      // Start reading
      abortController = new AbortController()
      readLoop(w)

      return true
    } catch (e: any) {
      if (e.name === 'NotFoundError') {
        // User cancelled port selection
        return false
      }
      error.value = e.message || 'Failed to connect'
      return false
    }
  }

  async function readLoop(w: any) {
    if (!port?.readable) return

    try {
      while (port.readable && !abortController?.signal.aborted) {
        reader = port.readable.getReader()
        try {
          while (true) {
            const { value, done } = await reader.read()
            if (done) break
            if (value) {
              for (const handler of rawHandlers) handler(value)
              processBytes(value, w)
            }
          }
        } finally {
          reader.releaseLock()
          reader = null
        }
      }
    } catch (e: any) {
      if (!abortController?.signal.aborted) {
        error.value = e.message || 'Read error'
      }
    }
  }

  function processBytes(data: Uint8Array, w: any) {
    // Append to frame buffer
    const combined = new Uint8Array(frameBuffer.length + data.length)
    combined.set(frameBuffer)
    combined.set(data, frameBuffer.length)
    frameBuffer = combined

    // Process complete COBS frames (delimited by 0x00)
    let start = 0
    for (let i = 0; i < frameBuffer.length; i++) {
      if (frameBuffer[i] === 0x00) {
        if (i > start) {
          const frame = frameBuffer.slice(start, i)
          try {
            const decoded = w.cobsDecode(frame)
            if (decoded) {
              const packet = w.wireDecode(decoded)
              for (const handler of packetHandlers) handler(packet)
            }
          } catch {
            // Invalid frame, skip
          }
        }
        start = i + 1
      }
    }

    // Keep remaining bytes
    frameBuffer = frameBuffer.slice(start)
  }

  // WritableStream allows only one active writer at a time. Two concurrent
  // calls to writable.getWriter() throw "Cannot create writer when
  // WritableStream is locked" — which we hit whenever multiple polling
  // widgets + a mode change fire simultaneously. Serialize all writes
  // through a Promise-chain mutex so each call awaits the previous one.
  let writeChain: Promise<void> = Promise.resolve()
  function serialWrite(bytes: Uint8Array): Promise<void> {
    const next = writeChain.then(async () => {
      if (!writable) throw new Error('Not connected')
      const writer = writable.getWriter()
      try {
        await writer.write(bytes)
      } finally {
        writer.releaseLock()
      }
    })
    // Swallow errors on the chain itself so a single failed write doesn't
    // permanently break the queue. The caller still sees the rejection
    // because we return `next` directly.
    writeChain = next.catch(() => {})
    return next
  }

  async function sendPacket(pktType: number, seq: number, payload: Uint8Array = new Uint8Array(0)) {
    if (!connected.value || !writable) throw new Error('Not connected')

    const w = await loadWasm()
    const packet = w.makePacket(pktType, seq, payload)
    const wireBytes = w.wireEncode(packet)
    const cobsBytes = w.cobsEncode(wireBytes)

    // Add 0x00 delimiter
    const frame = new Uint8Array(cobsBytes.length + 1)
    frame.set(cobsBytes)
    frame[cobsBytes.length] = 0x00

    await serialWrite(frame)
  }

  async function sendRaw(data: Uint8Array) {
    if (!connected.value || !writable) throw new Error('Not connected')
    await serialWrite(data)
  }

  function onPacket(handler: (packet: any) => void) {
    packetHandlers.push(handler)
    return () => {
      const idx = packetHandlers.indexOf(handler)
      if (idx >= 0) packetHandlers.splice(idx, 1)
    }
  }

  function onRawData(handler: (data: Uint8Array) => void) {
    rawHandlers.push(handler)
    return () => {
      const idx = rawHandlers.indexOf(handler)
      if (idx >= 0) rawHandlers.splice(idx, 1)
    }
  }

  async function disconnect() {
    abortController?.abort()
    try {
      reader?.cancel()
    } catch {}
    try {
      await port?.close()
    } catch {}
    port = null
    reader = null
    writable = null
    connected.value = false
    portInfo.value = ''
    frameBuffer = new Uint8Array(0)
  }

  return {
    connected: readonly(connected),
    error: readonly(error),
    portInfo: readonly(portInfo),
    requestPort,
    disconnect,
    sendPacket,
    sendRaw,
    onPacket,
    onRawData,
    loadWasm,
  }
}
