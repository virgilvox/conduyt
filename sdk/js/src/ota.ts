/**
 * CONDUYT OTA — Over-the-Air firmware update orchestrator.
 *
 * Wraps the device.otaBegin / otaChunk / otaFinalize primitives with:
 *   - SHA-256 of the firmware image computed via Web Crypto (same API in
 *     Node 20+ and browsers).
 *   - Sequential chunk send with progress callbacks.
 *   - Auto-sized chunks based on the device's advertised maxPayload — so
 *     a board with a 256-byte serial buffer doesn't choke on 4 KB chunks.
 *
 * Only useful when the firmware was compiled with `-DCONDUYT_OTA`. Check
 * `device.capabilities()?.otaCapable` before starting; the device will
 * NAK `OTA_BEGIN` with `OTA_INVALID` (0x0F) if OTA isn't built in.
 */

import type { ConduytDevice } from './device.js'

export interface OTAFlashOptions {
  /** Bytes per OTA_CHUNK packet. Defaults to (maxPayload - 4) so the LE u32 offset fits. */
  chunkSize?: number
  /** Progress callback. Fires after every successful chunk. */
  onProgress?: (sent: number, total: number) => void
  /** Optional pre-computed SHA-256. If omitted, computed via Web Crypto. */
  sha256?: Uint8Array
}

export class ConduytOTA {
  constructor(private device: ConduytDevice) {}

  /**
   * Flash a firmware image. Resolves once OTA_FINALIZE is acked — the device
   * typically reboots immediately after, so the next round-trip will fail
   * until you reconnect.
   */
  async flash(firmware: Uint8Array, opts: OTAFlashOptions = {}): Promise<void> {
    const total = firmware.length
    if (total === 0) throw new Error('OTA: firmware is empty')

    const sha = opts.sha256 ?? await sha256(firmware)

    // Pick a chunk size. Reserve 4 bytes for the LE u32 offset header that
    // OTA_CHUNK prepends to every payload. Default to 240 bytes (fits in
    // most serial peripheral buffers + room for COBS overhead) if the
    // device hasn't told us its maxPayload.
    const advertised = this.device.capabilities?.maxPayload
    const safeMax = advertised ? Math.max(64, advertised - 4) : 240
    const chunkSize = opts.chunkSize ?? safeMax

    await this.device.otaBegin(total, sha)
    let sent = 0
    while (sent < total) {
      const end = Math.min(sent + chunkSize, total)
      await this.device.otaChunk(sent, firmware.subarray(sent, end))
      sent = end
      opts.onProgress?.(sent, total)
    }
    await this.device.otaFinalize()
  }
}

/** SHA-256 via Web Crypto. Works in browsers and Node 20+. */
async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw new Error('OTA: globalThis.crypto.subtle is unavailable. Use Node 20+ or a browser.')
  }
  // crypto.subtle.digest rejects Uint8Array typed as ArrayBufferLike
  // (which now includes SharedArrayBuffer) under strict TS. Materialize
  // into a fresh ArrayBuffer-backed view so the type is unambiguous.
  const view = new Uint8Array(data.byteLength)
  view.set(data)
  const buf = await subtle.digest('SHA-256', view.buffer)
  return new Uint8Array(buf)
}
