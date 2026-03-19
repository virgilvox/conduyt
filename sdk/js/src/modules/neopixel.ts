/**
 * CONDUYT NeoPixel Module — Typed JS wrapper
 */

import type { ConduytDevice } from '../device.js'

export class ConduytNeoPixel {
  private _device: ReturnType<ConduytDevice['module']>

  constructor(device: ConduytDevice) {
    this._device = device.module('neopixel')
  }

  /** Initialize the NeoPixel strip. type: 0 = NEO_GRB+800KHz (default). */
  async begin(pin: number, count: number, type = 0): Promise<void> {
    const buf = new Uint8Array(4)
    buf[0] = pin
    buf[1] = count & 0xFF; buf[2] = (count >> 8) & 0xFF
    buf[3] = type
    await this._device.cmd(0x01, buf)
  }

  /** Set a single pixel color. */
  async setPixel(index: number, r: number, g: number, b: number, w = 0): Promise<void> {
    const buf = new Uint8Array(5 + (w ? 1 : 0))
    buf[0] = index & 0xFF; buf[1] = (index >> 8) & 0xFF
    buf[2] = r; buf[3] = g; buf[4] = b
    if (w) buf[5] = w
    await this._device.cmd(0x02, buf)
  }

  /** Set a range of pixels to the same color. */
  async setRange(start: number, count: number, r: number, g: number, b: number): Promise<void> {
    const buf = new Uint8Array(7)
    buf[0] = start & 0xFF; buf[1] = (start >> 8) & 0xFF
    buf[2] = count & 0xFF; buf[3] = (count >> 8) & 0xFF
    buf[4] = r; buf[5] = g; buf[6] = b
    await this._device.cmd(0x03, buf)
  }

  /** Fill all pixels with a color. */
  async fill(r: number, g: number, b: number, w = 0): Promise<void> {
    const buf = new Uint8Array(3 + (w ? 1 : 0))
    buf[0] = r; buf[1] = g; buf[2] = b
    if (w) buf[3] = w
    await this._device.cmd(0x04, buf)
  }

  /** Flush pixel buffer to the strip. */
  async show(): Promise<void> {
    await this._device.cmd(0x05)
  }

  /** Set global brightness (0-255). */
  async setBrightness(brightness: number): Promise<void> {
    await this._device.cmd(0x06, new Uint8Array([brightness & 0xFF]))
  }
}
