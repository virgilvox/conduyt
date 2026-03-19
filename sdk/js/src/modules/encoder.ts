/**
 * CONDUYT Encoder Module — Typed JS wrapper
 */

import type { ConduytDevice } from '../device.js'

export class ConduytEncoder {
  private _device: ReturnType<ConduytDevice['module']>

  constructor(device: ConduytDevice) {
    this._device = device.module('encoder')
  }

  /** Attach encoder to two pins. */
  async attach(pinA: number, pinB: number): Promise<void> {
    await this._device.cmd(0x01, new Uint8Array([pinA, pinB]))
  }

  /** Read current count. */
  async read(): Promise<number> {
    const resp = await this._device.cmd(0x02)
    if (resp.length >= 4) {
      const view = new DataView(resp.buffer, resp.byteOffset, resp.byteLength)
      return view.getInt32(0, true)
    }
    return 0
  }

  /** Reset count to zero. */
  async reset(): Promise<void> {
    await this._device.cmd(0x03)
  }

  /** Listen for tick events. */
  onTick(handler: (count: number, delta: number) => void): void {
    this._device.onEvent((code, data) => {
      if (code === 0x01 && data.length >= 6) {
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
        handler(view.getInt32(0, true), view.getInt16(4, true))
      }
    })
  }
}
