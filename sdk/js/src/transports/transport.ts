/**
 * CONDUYT Transport Interface
 *
 * All transport implementations must satisfy this interface.
 * The protocol layer calls these methods without knowing
 * whether bytes travel over serial, BLE, MQTT, or WebSocket.
 */

export interface ConduytTransport {
  /** Establish the connection. Resolves when ready to send/receive. */
  connect(): Promise<void>

  /** Cleanly close the connection. */
  disconnect(): Promise<void>

  /** Send a raw packet (already wire-encoded, optionally COBS-encoded). */
  send(packet: Uint8Array): Promise<void>

  /** Register a handler for incoming packets. */
  onReceive(handler: (packet: Uint8Array) => void): void

  /** Whether the transport is currently connected. */
  readonly connected: boolean

  /**
   * Whether this transport requires COBS framing.
   * Serial/BLE = true (byte stream needs delimiters)
   * MQTT/TCP/WebSocket = false (message-oriented)
   */
  readonly needsCOBS: boolean
}
