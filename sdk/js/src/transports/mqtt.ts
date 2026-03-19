/**
 * CONDUYT MQTT Transport — Node.js + Browser
 *
 * Uses the `mqtt` npm package. Message-oriented (no COBS needed).
 * Install: npm install mqtt
 *
 * Topic schema:
 *   conduyt/{deviceId}/cmd/{typeHex}  — host publishes commands
 *   conduyt/{deviceId}/evt/{typeHex}  — device publishes events
 *   conduyt/{deviceId}/hello          — retained HELLO_RESP
 *   conduyt/{deviceId}/status         — online/offline (LWT)
 */

import type { ConduytTransport } from './transport.js'

export interface MQTTTransportOptions {
  /** MQTT broker URL (e.g., 'mqtt://broker.local' or 'ws://broker.local:9001') */
  broker: string
  /** Device ID for topic routing */
  deviceId: string
  /** MQTT username (optional) */
  username?: string
  /** MQTT password (optional) */
  password?: string
  /** Default QoS for commands (default: 1) */
  qos?: 0 | 1 | 2
}

export class MQTTTransport implements ConduytTransport {
  private _options: MQTTTransportOptions
  private _client: any = null
  private _handler: ((packet: Uint8Array) => void) | null = null
  private _connected = false
  private _prefix: string

  readonly needsCOBS = false

  constructor(options: MQTTTransportOptions) {
    this._options = options
    this._prefix = `conduyt/${options.deviceId}`
  }

  get connected(): boolean {
    return this._connected
  }

  async connect(): Promise<void> {
    const mqtt = await import('mqtt')

    const connectOpts: any = {}
    if (this._options.username) connectOpts.username = this._options.username
    if (this._options.password) connectOpts.password = this._options.password

    this._client = await mqtt.connectAsync(this._options.broker, connectOpts)
    this._connected = true

    // Subscribe to device event topics
    await this._client.subscribeAsync([
      `${this._prefix}/evt/#`,
      `${this._prefix}/hello`,
      `${this._prefix}/status`,
      `${this._prefix}/ds/+/evt`,
    ], { qos: 1 })

    // Handle incoming messages
    this._client.on('message', (topic: string, payload: Buffer) => {
      if (this._handler) {
        this._handler(new Uint8Array(payload))
      }
    })

    this._client.on('close', () => {
      this._connected = false
    })

    this._client.on('error', () => {
      this._connected = false
    })
  }

  async disconnect(): Promise<void> {
    if (this._client) {
      await this._client.endAsync()
      this._client = null
    }
    this._connected = false
  }

  async send(packet: Uint8Array): Promise<void> {
    if (!this._client || !this._connected) throw new Error('MQTT: not connected')

    // Extract type byte from wire-encoded packet to determine topic
    if (packet.length >= 4) {
      const type = packet[3]
      const typeHex = type.toString(16).padStart(2, '0')
      const topic = `${this._prefix}/cmd/${typeHex}`
      const qos = this._options.qos ?? 1

      await this._client.publishAsync(topic, Buffer.from(packet), { qos })
    }
  }

  onReceive(handler: (packet: Uint8Array) => void): void {
    this._handler = handler
  }
}
