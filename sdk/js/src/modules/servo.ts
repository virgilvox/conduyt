/**
 * CONDUYT Servo Module — Typed JS wrapper
 */

import type { ConduytDevice } from '../device.js'

export class ConduytServo {
  private _device: ReturnType<ConduytDevice['module']>

  constructor(device: ConduytDevice) {
    this._device = device.module('servo')
  }

  /** Attach servo to a pin with optional min/max pulse width in microseconds. */
  async attach(pin: number, minUs = 544, maxUs = 2400): Promise<void> {
    const buf = new Uint8Array(5)
    buf[0] = pin
    buf[1] = minUs & 0xFF; buf[2] = (minUs >> 8) & 0xFF
    buf[3] = maxUs & 0xFF; buf[4] = (maxUs >> 8) & 0xFF
    await this._device.cmd(0x01, buf)
  }

  /** Write angle (0-180 degrees). */
  async write(angle: number): Promise<void> {
    await this._device.cmd(0x02, new Uint8Array([angle & 0xFF]))
  }

  /** Write pulse width in microseconds. */
  async writeMicroseconds(us: number): Promise<void> {
    const buf = new Uint8Array(2)
    buf[0] = us & 0xFF; buf[1] = (us >> 8) & 0xFF
    await this._device.cmd(0x03, buf)
  }

  /** Detach the servo (release the pin). */
  async detach(): Promise<void> {
    await this._device.cmd(0x04)
  }
}
