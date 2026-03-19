/**
 * CONDUYT DHT Module — Typed JS wrapper
 */

import type { ConduytDevice } from '../device.js'

export interface DHTReading {
  temperature: number
  humidity: number
}

export class ConduytDHT {
  private _device: ReturnType<ConduytDevice['module']>

  constructor(device: ConduytDevice) {
    this._device = device.module('dht')
  }

  /** Initialize DHT sensor. type: 11 for DHT11, 22 for DHT22. */
  async begin(pin: number, type: 11 | 22 = 22): Promise<void> {
    await this._device.cmd(0x01, new Uint8Array([pin, type]))
  }

  /** Trigger a reading. Returns temperature and humidity. */
  async read(): Promise<DHTReading> {
    const resp = await this._device.cmd(0x02)
    if (resp.length >= 8) {
      const view = new DataView(resp.buffer, resp.byteOffset, resp.byteLength)
      return {
        temperature: view.getFloat32(0, true),
        humidity: view.getFloat32(4, true),
      }
    }
    return { temperature: 0, humidity: 0 }
  }
}
