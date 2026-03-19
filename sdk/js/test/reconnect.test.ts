import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ReconnectTransport } from '../src/reconnect.js'
import { MockTransport } from '../src/transports/mock.js'

describe('ReconnectTransport', () => {
  let inner: MockTransport

  beforeEach(() => {
    inner = new MockTransport()
  })

  it('delegates connect/disconnect to inner transport', async () => {
    const rt = new ReconnectTransport(inner)

    expect(inner.connected).toBe(false)
    await rt.connect()
    expect(inner.connected).toBe(true)

    await rt.disconnect()
    expect(inner.connected).toBe(false)
  })

  it('connected proxies to inner transport', async () => {
    const rt = new ReconnectTransport(inner)

    expect(rt.connected).toBe(false)
    await rt.connect()
    expect(rt.connected).toBe(true)

    await rt.disconnect()
    expect(rt.connected).toBe(false)
  })

  it('needsCOBS proxies to inner transport', () => {
    const rt = new ReconnectTransport(inner)
    expect(rt.needsCOBS).toBe(inner.needsCOBS)
  })

  it('send when disconnected triggers reconnect', async () => {
    const rt = new ReconnectTransport(inner)

    // Connect first, then simulate disconnect by manipulating _connected
    await rt.connect()
    ;(inner as any)._connected = false

    // send should trigger reconnect (inner.connect sets _connected=true)
    const data = new Uint8Array([1, 2, 3])
    await rt.send(data)

    expect(inner.connected).toBe(true)
    expect(inner.sentPackets.length).toBe(1)
    expect(inner.sentPackets[0]).toEqual(data)
  })

  describe('exponential backoff', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('doubles delay on each failed attempt', async () => {
      const rt = new ReconnectTransport(inner, {
        initialDelay: 100,
        multiplier: 2,
        maxAttempts: 0,
      })

      let connectAttempts = 0
      const failCount = 3
      const origConnect = inner.connect.bind(inner)
      inner.connect = async () => {
        connectAttempts++
        if (connectAttempts <= failCount) {
          throw new Error('connection failed')
        }
        await origConnect()
      }

      // Connect initially (before we override, the transport is disconnected)
      ;(inner as any)._connected = false

      // Start the send which triggers reconnect
      const sendPromise = rt.send(new Uint8Array([0x01]))

      // Attempt 1 fails -> wait 100ms
      await vi.advanceTimersByTimeAsync(100)
      // Attempt 2 fails -> wait 200ms
      await vi.advanceTimersByTimeAsync(200)
      // Attempt 3 fails -> wait 400ms
      await vi.advanceTimersByTimeAsync(400)
      // Attempt 4 succeeds

      await sendPromise
      expect(connectAttempts).toBe(4)
    })
  })

  describe('maxAttempts', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('fails after N attempts with correct error message', async () => {
      const maxAttempts = 3
      const rt = new ReconnectTransport(inner, {
        initialDelay: 50,
        maxAttempts,
      })

      inner.connect = async () => {
        throw new Error('connection failed')
      }
      ;(inner as any)._connected = false

      // Capture the promise immediately so the rejection is handled
      let sendError: Error | undefined
      const sendPromise = rt.send(new Uint8Array([0x01])).catch((e: Error) => {
        sendError = e
      })

      // Advance timers to let each failed attempt + delay proceed
      // Attempt 1 fails -> wait 50ms
      await vi.advanceTimersByTimeAsync(50)
      // Attempt 2 fails -> wait 100ms
      await vi.advanceTimersByTimeAsync(100)
      // Attempt 3 fails -> wait 200ms (but maxAttempts exceeded on attempt 4 check)
      await vi.advanceTimersByTimeAsync(200)

      await sendPromise
      expect(sendError).toBeDefined()
      expect(sendError!.message).toBe(`Reconnect failed after ${maxAttempts} attempts`)
    })
  })

  it('re-registers onReceive handler after reconnect', async () => {
    const rt = new ReconnectTransport(inner)

    const received: Uint8Array[] = []
    rt.onReceive((data) => {
      received.push(data)
    })

    await rt.connect()

    // Simulate receiving data
    inner.inject(new Uint8Array([0xAA]))
    expect(received.length).toBe(1)

    // Simulate disconnect and reconnect
    ;(inner as any)._connected = false
    await rt.send(new Uint8Array([0x01]))

    // After reconnect, injecting data should still reach our handler
    inner.inject(new Uint8Array([0xBB]))
    expect(received.length).toBe(2)
    expect(received[1]).toEqual(new Uint8Array([0xBB]))
  })

  it('fires onReconnect callback', async () => {
    const rt = new ReconnectTransport(inner)
    let reconnected = false
    rt.onReconnect = () => { reconnected = true }

    await rt.connect()

    // Simulate disconnect then send to trigger reconnect
    ;(inner as any)._connected = false
    await rt.send(new Uint8Array([0x01]))

    expect(reconnected).toBe(true)
  })

  describe('maxDelay cap', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('caps delay at maxDelay after multiple failures', async () => {
      const rt = new ReconnectTransport(inner, {
        initialDelay: 100,
        maxDelay: 400,
        multiplier: 2,
        maxAttempts: 0,
      })

      const delays: number[] = []
      let connectAttempts = 0
      const failCount = 4
      const origConnect = inner.connect.bind(inner)

      // Track the actual delays by capturing setTimeout calls
      const origSetTimeout = globalThis.setTimeout
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')

      inner.connect = async () => {
        connectAttempts++
        if (connectAttempts <= failCount) {
          throw new Error('connection failed')
        }
        await origConnect()
      }

      ;(inner as any)._connected = false

      const sendPromise = rt.send(new Uint8Array([0x01]))

      // Attempt 1 fails -> wait 100ms
      await vi.advanceTimersByTimeAsync(100)
      // Attempt 2 fails -> wait 200ms
      await vi.advanceTimersByTimeAsync(200)
      // Attempt 3 fails -> wait 400ms (min(400, 400) = 400, capped)
      await vi.advanceTimersByTimeAsync(400)
      // Attempt 4 fails -> wait 400ms (min(800, 400) = 400, capped!)
      await vi.advanceTimersByTimeAsync(400)
      // Attempt 5 succeeds

      await sendPromise
      expect(connectAttempts).toBe(5)

      // Verify that setTimeout was called with delays that never exceed maxDelay
      const timeoutCalls = setTimeoutSpy.mock.calls
        .map(call => call[1] as number)
        .filter(d => d !== undefined && d > 0)
      for (const d of timeoutCalls) {
        expect(d).toBeLessThanOrEqual(400)
      }

      setTimeoutSpy.mockRestore()
    })
  })

  it('transport is connected and functional after successful reconnect', async () => {
    const rt = new ReconnectTransport(inner)

    await rt.connect()
    expect(rt.connected).toBe(true)

    // Simulate disconnect
    ;(inner as any)._connected = false
    expect(rt.connected).toBe(false)

    // Send triggers reconnect (inner.connect will set _connected=true)
    const data = new Uint8Array([0xAA, 0xBB])
    await rt.send(data)

    // After reconnect, transport should be connected
    expect(rt.connected).toBe(true)
    expect(inner.connected).toBe(true)

    // Subsequent send should work without triggering another reconnect
    const data2 = new Uint8Array([0xCC, 0xDD])
    await rt.send(data2)
    expect(inner.sentPackets.length).toBe(2)
    expect(inner.sentPackets[0]).toEqual(data)
    expect(inner.sentPackets[1]).toEqual(data2)
    expect(rt.connected).toBe(true)
  })

  it('disconnect cancels pending reconnect', async () => {
    vi.useFakeTimers()

    const rt = new ReconnectTransport(inner, { initialDelay: 1000 })

    let connectAttempts = 0
    const origConnect = inner.connect.bind(inner)
    inner.connect = async () => {
      connectAttempts++
      if (connectAttempts <= 10) {
        throw new Error('connection failed')
      }
      await origConnect()
    }
    ;(inner as any)._connected = false

    // Start reconnect attempt via send (will fail and start backoff loop)
    const sendPromise = rt.send(new Uint8Array([0x01])).catch(() => {})

    // Let first attempt fail
    await vi.advanceTimersByTimeAsync(0)
    const attemptsBeforeDisconnect = connectAttempts

    // Disconnect should cancel the reconnect loop
    await rt.disconnect()

    // Advance timers significantly - no more attempts should happen
    await vi.advanceTimersByTimeAsync(30000)
    expect(connectAttempts).toBe(attemptsBeforeDisconnect)

    await sendPromise
    vi.useRealTimers()
  })
})
