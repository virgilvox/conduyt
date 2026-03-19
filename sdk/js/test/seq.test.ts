import { describe, it, expect, vi } from 'vitest'
import { SeqTracker } from '../src/seq.js'
import { ConduytTimeoutError } from '../src/core/errors.js'

describe('SeqTracker', () => {
  it('starts at 0', () => {
    const seq = new SeqTracker()
    expect(seq.current).toBe(0)
  })

  it('increments and wraps at 255', () => {
    const seq = new SeqTracker()
    for (let i = 0; i < 255; i++) seq.next()
    expect(seq.current).toBe(255)
    seq.next()
    expect(seq.current).toBe(0)
  })

  it('tracks and resolves a pending command', async () => {
    const seq = new SeqTracker(1000)
    const s = seq.next()
    const promise = seq.track(s)
    seq.resolve(s, new Uint8Array([0x42]))
    const result = await promise
    expect(result).toEqual(new Uint8Array([0x42]))
  })

  it('tracks and rejects a pending command', async () => {
    const seq = new SeqTracker(1000)
    const s = seq.next()
    const promise = seq.track(s)
    const err = new Error('test error')
    seq.reject(s, err)
    await expect(promise).rejects.toBe(err)
  })

  it('times out unresolved commands', async () => {
    vi.useFakeTimers()
    const seq = new SeqTracker(50)
    const s = seq.next()
    const promise = seq.track(s)

    vi.advanceTimersByTime(60)

    await expect(promise).rejects.toBeInstanceOf(ConduytTimeoutError)
    vi.useRealTimers()
  })

  it('rejectAll clears all pending', async () => {
    const seq = new SeqTracker(5000)
    const p1 = seq.track(seq.next())
    const p2 = seq.track(seq.next())
    const p3 = seq.track(seq.next())
    expect(seq.pendingCount).toBe(3)

    const err = new Error('disconnected')
    seq.rejectAll(err)
    expect(seq.pendingCount).toBe(0)

    await expect(p1).rejects.toBe(err)
    await expect(p2).rejects.toBe(err)
    await expect(p3).rejects.toBe(err)
  })

  it('resolve returns false for unknown seq', () => {
    const seq = new SeqTracker()
    expect(seq.resolve(99)).toBe(false)
  })

  it('reset clears counter and pending', async () => {
    const seq = new SeqTracker(5000)
    seq.next(); seq.next(); seq.next()
    const p1 = seq.track(0).catch(() => {})
    const p2 = seq.track(1).catch(() => {})
    seq.reset(new Error('reset'))
    expect(seq.current).toBe(0)
    expect(seq.pendingCount).toBe(0)
    await p1
    await p2
  })
})
