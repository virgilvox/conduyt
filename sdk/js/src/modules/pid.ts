/**
 * CONDUYT PID Controller Module — Typed JS wrapper
 */

import type { ConduytDevice } from '../device.js'

export class ConduytPID {
  private _device: ReturnType<ConduytDevice['module']>

  constructor(device: ConduytDevice) {
    this._device = device.module('pid')
  }

  /** Configure PID gains. */
  async config(kp: number, ki: number, kd: number): Promise<void> {
    const buf = new Uint8Array(12)
    const view = new DataView(buf.buffer)
    view.setFloat32(0, kp, true)
    view.setFloat32(4, ki, true)
    view.setFloat32(8, kd, true)
    await this._device.cmd(0x01, buf)
  }

  /** Set the target setpoint. */
  async setTarget(value: number): Promise<void> {
    const buf = new Uint8Array(4)
    new DataView(buf.buffer).setFloat32(0, value, true)
    await this._device.cmd(0x02, buf)
  }

  /** Set the analog input pin. */
  async setInput(pin: number): Promise<void> {
    await this._device.cmd(0x03, new Uint8Array([pin]))
  }

  /** Set the PWM output pin. */
  async setOutput(pin: number): Promise<void> {
    await this._device.cmd(0x04, new Uint8Array([pin]))
  }

  /** Enable the PID controller. */
  async enable(): Promise<void> {
    await this._device.cmd(0x05, new Uint8Array([1]))
  }

  /** Disable the PID controller. */
  async disable(): Promise<void> {
    await this._device.cmd(0x05, new Uint8Array([0]))
  }

  /** Listen for PID tick events. */
  onTick(handler: (input: number, output: number, error: number) => void): void {
    this._device.onEvent((code, data) => {
      if (code === 0x01 && data.length >= 12) {
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
        handler(
          view.getFloat32(0, true),
          view.getFloat32(4, true),
          view.getFloat32(8, true),
        )
      }
    })
  }
}
