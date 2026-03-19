/**
 * CONDUYT OLED SSD1306 Module — Typed JS wrapper
 */

import type { ConduytDevice } from '../device.js'

export class ConduytOLED {
  private _device: ReturnType<ConduytDevice['module']>

  constructor(device: ConduytDevice) {
    this._device = device.module('oled1306')
  }

  /** Initialize the OLED display. */
  async begin(width = 128, height = 64, i2cAddr = 0x3C): Promise<void> {
    await this._device.cmd(0x01, new Uint8Array([width, height, i2cAddr]))
  }

  /** Clear the display buffer. Call show() to apply. */
  async clear(): Promise<void> {
    await this._device.cmd(0x02)
  }

  /** Draw text at position with size. */
  async text(x: number, y: number, size: number, str: string): Promise<void> {
    const strBytes = new TextEncoder().encode(str)
    const buf = new Uint8Array(3 + strBytes.length)
    buf[0] = x; buf[1] = y; buf[2] = size
    buf.set(strBytes, 3)
    await this._device.cmd(0x03, buf)
  }

  /** Draw a rectangle. fill=true for filled. */
  async drawRect(x: number, y: number, w: number, h: number, fill = false): Promise<void> {
    await this._device.cmd(0x04, new Uint8Array([x, y, w, h, fill ? 1 : 0]))
  }

  /** Draw a 1-bit bitmap. */
  async drawBitmap(x: number, y: number, w: number, h: number, data: Uint8Array): Promise<void> {
    const buf = new Uint8Array(4 + data.length)
    buf[0] = x; buf[1] = y; buf[2] = w; buf[3] = h
    buf.set(data, 4)
    await this._device.cmd(0x05, buf)
  }

  /** Flush the display buffer to the screen. */
  async show(): Promise<void> {
    await this._device.cmd(0x06)
  }
}
