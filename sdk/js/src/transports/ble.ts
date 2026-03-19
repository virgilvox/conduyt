/**
 * CONDUYT BLE Transport — Browser Web Bluetooth API
 *
 * Connects to a CONDUYT device via BLE GATT.
 * COBS-framed with MTU-aware chunking.
 *
 * GATT Service:   CONDUYT_SERVICE_UUID
 * TX Char (notify): device → host (subscribe for notifications)
 * RX Char (write):  host → device (write with response)
 */

import type { ConduytTransport } from './transport.js'

// Default UUIDs (can be overridden)
const CONDUYT_SERVICE_UUID = '0000cd01-0000-1000-8000-00805f9b34fb'
const CONDUYT_TX_CHAR_UUID = '0000cd02-0000-1000-8000-00805f9b34fb'
const CONDUYT_RX_CHAR_UUID = '0000cd03-0000-1000-8000-00805f9b34fb'

export interface BLETransportOptions {
  serviceUUID?: string
  txCharUUID?: string
  rxCharUUID?: string
  /** Existing BluetoothDevice (if already paired) */
  device?: BluetoothDevice
}

export class BLETransport implements ConduytTransport {
  private _options: BLETransportOptions
  private _device: BluetoothDevice | null = null
  private _server: BluetoothRemoteGATTServer | null = null
  private _txChar: BluetoothRemoteGATTCharacteristic | null = null
  private _rxChar: BluetoothRemoteGATTCharacteristic | null = null
  private _handler: ((packet: Uint8Array) => void) | null = null
  private _connected = false
  private _mtu = 20 // BLE default, negotiate higher

  readonly needsCOBS = true

  constructor(options: BLETransportOptions = {}) {
    this._options = options
  }

  get connected(): boolean {
    return this._connected
  }

  async connect(): Promise<void> {
    if (!('bluetooth' in navigator)) {
      throw new Error('Web Bluetooth API not available in this browser')
    }

    const serviceUUID = this._options.serviceUUID ?? CONDUYT_SERVICE_UUID

    // Request or reuse device
    if (this._options.device) {
      this._device = this._options.device
    } else {
      this._device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [serviceUUID] }],
      })
    }

    this._device.addEventListener('gattserverdisconnected', () => {
      this._connected = false
    })

    // Connect GATT
    this._server = await this._device.gatt!.connect()

    const service = await this._server.getPrimaryService(serviceUUID)

    // TX: device notifications → host
    this._txChar = await service.getCharacteristic(
      this._options.txCharUUID ?? CONDUYT_TX_CHAR_UUID
    )
    await this._txChar.startNotifications()
    this._txChar.addEventListener('characteristicvaluechanged', (event: Event) => {
      const char = event.target as BluetoothRemoteGATTCharacteristic
      if (char.value && this._handler) {
        this._handler(new Uint8Array(char.value.buffer))
      }
    })

    // RX: host writes → device
    this._rxChar = await service.getCharacteristic(
      this._options.rxCharUUID ?? CONDUYT_RX_CHAR_UUID
    )

    this._connected = true
  }

  async disconnect(): Promise<void> {
    if (this._txChar) {
      try { await this._txChar.stopNotifications() } catch { /* ignore */ }
    }
    if (this._server) {
      this._server.disconnect()
    }
    this._connected = false
    this._txChar = null
    this._rxChar = null
    this._server = null
  }

  async send(packet: Uint8Array): Promise<void> {
    if (!this._rxChar || !this._connected) throw new Error('BLE: not connected')

    // MTU-aware chunking: split large packets into MTU-3 byte chunks
    const chunkSize = this._mtu - 3
    for (let offset = 0; offset < packet.length; offset += chunkSize) {
      const chunk = packet.slice(offset, offset + chunkSize)
      await this._rxChar.writeValueWithResponse(chunk)
    }
  }

  onReceive(handler: (packet: Uint8Array) => void): void {
    this._handler = handler
  }
}
