/**
 * CONDUYT Stepper Module — Typed JS wrapper
 */

import type { ConduytDevice } from '../device.js'

export class ConduytStepper {
  private _device: ReturnType<ConduytDevice['module']>

  constructor(device: ConduytDevice) {
    this._device = device.module('stepper')
  }

  /** Configure stepper pins and steps per revolution. */
  async config(stepPin: number, dirPin: number, enPin: number, stepsPerRev = 200): Promise<void> {
    const buf = new Uint8Array(5)
    buf[0] = stepPin; buf[1] = dirPin; buf[2] = enPin
    buf[3] = stepsPerRev & 0xFF; buf[4] = (stepsPerRev >> 8) & 0xFF
    await this._device.cmd(0x01, buf)
  }

  /** Move relative number of steps at given speed (Hz). */
  async move(steps: number, speedHz: number): Promise<void> {
    const buf = new Uint8Array(6)
    const view = new DataView(buf.buffer)
    view.setInt32(0, steps, true)
    view.setUint16(4, speedHz, true)
    await this._device.cmd(0x02, buf)
  }

  /** Move to absolute position at given speed (Hz). */
  async moveTo(position: number, speedHz: number): Promise<void> {
    const buf = new Uint8Array(6)
    const view = new DataView(buf.buffer)
    view.setInt32(0, position, true)
    view.setUint16(4, speedHz, true)
    await this._device.cmd(0x03, buf)
  }

  /** Emergency stop. */
  async stop(): Promise<void> {
    await this._device.cmd(0x04)
  }

  /** Listen for movement completion events. */
  onDone(handler: (position: number) => void): void {
    this._device.onEvent((code, data) => {
      if (code === 0x01 && data.length >= 4) {
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
        handler(view.getInt32(0, true))
      }
    })
  }
}
