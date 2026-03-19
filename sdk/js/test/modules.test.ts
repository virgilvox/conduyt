import { describe, it, expect, beforeEach } from 'vitest'
import { ConduytDevice } from '../src/device.js'
import { MockTransport } from '../src/transports/mock.js'
import { wireEncode, wireDecode, makePacket } from '../src/core/wire.js'
import { CMD, EVT, DS_TYPE } from '../src/core/constants.js'
import { ConduytServo } from '../src/modules/servo.js'
import { ConduytNeoPixel } from '../src/modules/neopixel.js'
import { ConduytOLED } from '../src/modules/oled.js'
import { ConduytDHT } from '../src/modules/dht.js'
import { ConduytEncoder } from '../src/modules/encoder.js'
import { ConduytStepper } from '../src/modules/stepper.js'
import { ConduytPID } from '../src/modules/pid.js'

const ALL_MODULES = ['servo', 'neopixel', 'oled1306', 'dht', 'encoder', 'stepper', 'pid'] as const

/**
 * Build a HELLO_RESP payload that advertises all 7 modules.
 */
function makeHelloRespPayload(): Uint8Array {
  const parts: number[] = []
  // firmware_name: 16 bytes
  const name = new TextEncoder().encode('MockBoard')
  for (let i = 0; i < 16; i++) parts.push(i < name.length ? name[i] : 0)
  // version: 1.0.0
  parts.push(1, 0, 0)
  // mcu_id: 8 bytes
  for (let i = 0; i < 8; i++) parts.push(0)
  // ota_capable
  parts.push(0)
  // pin_count = 20
  parts.push(20)
  for (let i = 0; i < 20; i++) parts.push(0x0F) // DIN|DOUT|PWM|AIN
  // i2c, spi, uart
  parts.push(1, 1, 1)
  // max_payload: 512
  parts.push(0x00, 0x02)
  // module_count = 7
  parts.push(ALL_MODULES.length)
  for (let idx = 0; idx < ALL_MODULES.length; idx++) {
    parts.push(idx) // module_id
    const modName = new TextEncoder().encode(ALL_MODULES[idx])
    for (let i = 0; i < 8; i++) parts.push(i < modName.length ? modName[i] : 0)
    parts.push(1, 0) // version 1.0
    parts.push(0)     // 0 pins claimed
  }
  // datastream_count = 1
  parts.push(1)
  const dsName = new TextEncoder().encode('temperature')
  for (let i = 0; i < 16; i++) parts.push(i < dsName.length ? dsName[i] : 0)
  parts.push(DS_TYPE.FLOAT32)
  const unit = new TextEncoder().encode('celsius')
  for (let i = 0; i < 8; i++) parts.push(i < unit.length ? unit[i] : 0)
  parts.push(0)    // not writable
  parts.push(0xFF) // no pin ref
  parts.push(0)    // no retain
  return new Uint8Array(parts)
}

/**
 * Auto-respond mock: HELLO -> HELLO_RESP, everything else -> ACK.
 */
function autoRespond(transport: MockTransport) {
  const origSend = transport.send.bind(transport)
  transport.send = async (packet: Uint8Array) => {
    await origSend(packet)
    try {
      const decoded = wireDecode(packet)
      if (decoded.type === CMD.HELLO) {
        const resp = wireEncode(makePacket(EVT.HELLO_RESP, decoded.seq, makeHelloRespPayload()))
        transport.inject(resp)
      } else if (decoded.type === CMD.PING) {
        const resp = wireEncode(makePacket(EVT.PONG, decoded.seq))
        transport.inject(resp)
      } else {
        const resp = wireEncode(makePacket(EVT.ACK, decoded.seq))
        transport.inject(resp)
      }
    } catch { /* ignore decode errors */ }
  }
}

/**
 * Auto-respond that returns MOD_RESP for MOD_CMD, ACK for everything else.
 */
function autoRespondWithModResp(transport: MockTransport, modRespPayload: Uint8Array) {
  transport.send = async (packet: Uint8Array) => {
    transport.sentPackets.push(new Uint8Array(packet))
    try {
      const decoded = wireDecode(packet)
      if (decoded.type === CMD.HELLO) {
        transport.inject(wireEncode(makePacket(EVT.HELLO_RESP, decoded.seq, makeHelloRespPayload())))
      } else if (decoded.type === CMD.MOD_CMD) {
        transport.inject(wireEncode(makePacket(EVT.MOD_RESP, decoded.seq, modRespPayload)))
      } else {
        transport.inject(wireEncode(makePacket(EVT.ACK, decoded.seq)))
      }
    } catch { /* ignore */ }
  }
}

/** Find the last MOD_CMD packet sent on the transport. */
function findModCmd(transport: MockTransport): ReturnType<typeof wireDecode> | undefined {
  for (let i = transport.sentPackets.length - 1; i >= 0; i--) {
    try {
      const d = wireDecode(transport.sentPackets[i])
      if (d.type === CMD.MOD_CMD) return d
    } catch { /* skip */ }
  }
  return undefined
}

describe('ConduytServo', () => {
  let transport: MockTransport

  beforeEach(() => {
    transport = new MockTransport()
    autoRespond(transport)
  })

  it('attach sends cmd 0x01 with pin and pulse widths', async () => {
    const device = await ConduytDevice.connect(transport)
    const servo = new ConduytServo(device)
    await servo.attach(9, 544, 2400)

    const pkt = findModCmd(transport)
    expect(pkt).toBeDefined()
    expect(pkt!.payload[0]).toBe(0) // module_id for servo
    expect(pkt!.payload[1]).toBe(0x01) // attach cmd
    expect(pkt!.payload[2]).toBe(9)    // pin
    // 544 = 0x0220 LE -> 0x20, 0x02
    expect(pkt!.payload[3]).toBe(544 & 0xFF)
    expect(pkt!.payload[4]).toBe((544 >> 8) & 0xFF)
    // 2400 = 0x0960 LE -> 0x60, 0x09
    expect(pkt!.payload[5]).toBe(2400 & 0xFF)
    expect(pkt!.payload[6]).toBe((2400 >> 8) & 0xFF)
  })

  it('write sends cmd 0x02 with angle byte', async () => {
    const device = await ConduytDevice.connect(transport)
    const servo = new ConduytServo(device)
    await servo.write(90)

    const pkt = findModCmd(transport)
    expect(pkt).toBeDefined()
    expect(pkt!.payload[1]).toBe(0x02)
    expect(pkt!.payload[2]).toBe(90)
  })

  it('write with angle 0 sends single byte 0x00', async () => {
    const device = await ConduytDevice.connect(transport)
    const servo = new ConduytServo(device)
    await servo.write(0)

    const pkt = findModCmd(transport)
    expect(pkt).toBeDefined()
    expect(pkt!.payload[1]).toBe(0x02)
    expect(pkt!.payload[2]).toBe(0)
    // module_id(1) + cmd(1) + angle(1) = 3 bytes total
    expect(pkt!.payload.length).toBe(3)
  })

  it('write with angle 180 sends single byte 0xB4', async () => {
    const device = await ConduytDevice.connect(transport)
    const servo = new ConduytServo(device)
    await servo.write(180)

    const pkt = findModCmd(transport)
    expect(pkt).toBeDefined()
    expect(pkt!.payload[1]).toBe(0x02)
    expect(pkt!.payload[2]).toBe(180)
    expect(pkt!.payload.length).toBe(3)
  })

  it('writeMicroseconds sends cmd 0x03 with LE uint16', async () => {
    const device = await ConduytDevice.connect(transport)
    const servo = new ConduytServo(device)
    await servo.writeMicroseconds(1500)

    const pkt = findModCmd(transport)
    expect(pkt).toBeDefined()
    expect(pkt!.payload[1]).toBe(0x03)
    expect(pkt!.payload[2]).toBe(1500 & 0xFF)
    expect(pkt!.payload[3]).toBe((1500 >> 8) & 0xFF)
  })

  it('detach sends cmd 0x04 with no payload', async () => {
    const device = await ConduytDevice.connect(transport)
    const servo = new ConduytServo(device)
    await servo.detach()

    const pkt = findModCmd(transport)
    expect(pkt).toBeDefined()
    expect(pkt!.payload[1]).toBe(0x04)
    expect(pkt!.payload.length).toBe(2) // module_id + cmd only
  })
})

describe('ConduytNeoPixel', () => {
  let transport: MockTransport

  beforeEach(() => {
    transport = new MockTransport()
    autoRespond(transport)
  })

  it('begin sends cmd 0x01 with pin, count, and type', async () => {
    const device = await ConduytDevice.connect(transport)
    const np = new ConduytNeoPixel(device)
    await np.begin(6, 30, 0)

    const pkt = findModCmd(transport)
    expect(pkt).toBeDefined()
    expect(pkt!.payload[0]).toBe(1) // module_id for neopixel
    expect(pkt!.payload[1]).toBe(0x01)
    expect(pkt!.payload[2]).toBe(6)  // pin
    expect(pkt!.payload[3]).toBe(30) // count lo
    expect(pkt!.payload[4]).toBe(0)  // count hi
    expect(pkt!.payload[5]).toBe(0)  // type
  })

  it('setPixel sends cmd 0x02 with index, r, g, b', async () => {
    const device = await ConduytDevice.connect(transport)
    const np = new ConduytNeoPixel(device)
    await np.setPixel(5, 255, 128, 0)

    const pkt = findModCmd(transport)
    expect(pkt).toBeDefined()
    expect(pkt!.payload[1]).toBe(0x02)
    expect(pkt!.payload[2]).toBe(5)   // index lo
    expect(pkt!.payload[3]).toBe(0)   // index hi
    expect(pkt!.payload[4]).toBe(255) // r
    expect(pkt!.payload[5]).toBe(128) // g
    expect(pkt!.payload[6]).toBe(0)   // b
  })

  it('fill sends cmd 0x04 with r, g, b', async () => {
    const device = await ConduytDevice.connect(transport)
    const np = new ConduytNeoPixel(device)
    await np.fill(10, 20, 30)

    const pkt = findModCmd(transport)
    expect(pkt).toBeDefined()
    expect(pkt!.payload[1]).toBe(0x04)
    expect(pkt!.payload[2]).toBe(10)
    expect(pkt!.payload[3]).toBe(20)
    expect(pkt!.payload[4]).toBe(30)
  })

  it('show sends cmd 0x05 with no data', async () => {
    const device = await ConduytDevice.connect(transport)
    const np = new ConduytNeoPixel(device)
    await np.show()

    const pkt = findModCmd(transport)
    expect(pkt).toBeDefined()
    expect(pkt!.payload[1]).toBe(0x05)
    expect(pkt!.payload.length).toBe(2)
  })

  it('setBrightness sends cmd 0x06 with brightness byte', async () => {
    const device = await ConduytDevice.connect(transport)
    const np = new ConduytNeoPixel(device)
    await np.setBrightness(200)

    const pkt = findModCmd(transport)
    expect(pkt).toBeDefined()
    expect(pkt!.payload[1]).toBe(0x06)
    expect(pkt!.payload[2]).toBe(200)
  })

  it('setPixel with w parameter appends white channel byte (RGBW)', async () => {
    const device = await ConduytDevice.connect(transport)
    const np = new ConduytNeoPixel(device)
    await np.setPixel(0, 255, 128, 64, 32)

    const pkt = findModCmd(transport)
    expect(pkt).toBeDefined()
    expect(pkt!.payload[1]).toBe(0x02)
    // index LE
    expect(pkt!.payload[2]).toBe(0)  // index lo
    expect(pkt!.payload[3]).toBe(0)  // index hi
    // RGBW
    expect(pkt!.payload[4]).toBe(255) // r
    expect(pkt!.payload[5]).toBe(128) // g
    expect(pkt!.payload[6]).toBe(64)  // b
    expect(pkt!.payload[7]).toBe(32)  // w (white channel)
    // Total: module_id(1) + cmd(1) + index(2) + r(1) + g(1) + b(1) + w(1) = 8
    expect(pkt!.payload.length).toBe(8)
  })

  it('setPixel without w parameter does not append white channel', async () => {
    const device = await ConduytDevice.connect(transport)
    const np = new ConduytNeoPixel(device)
    await np.setPixel(0, 255, 128, 64)

    const pkt = findModCmd(transport)
    expect(pkt).toBeDefined()
    // Total: module_id(1) + cmd(1) + index(2) + r(1) + g(1) + b(1) = 7
    expect(pkt!.payload.length).toBe(7)
  })
})

describe('ConduytOLED', () => {
  let transport: MockTransport

  beforeEach(() => {
    transport = new MockTransport()
    autoRespond(transport)
  })

  it('begin sends cmd 0x01 with width, height, i2cAddr', async () => {
    const device = await ConduytDevice.connect(transport)
    const oled = new ConduytOLED(device)
    await oled.begin(128, 64, 0x3C)

    const pkt = findModCmd(transport)
    expect(pkt).toBeDefined()
    expect(pkt!.payload[0]).toBe(2) // module_id for oled1306
    expect(pkt!.payload[1]).toBe(0x01)
    expect(pkt!.payload[2]).toBe(128)
    expect(pkt!.payload[3]).toBe(64)
    expect(pkt!.payload[4]).toBe(0x3C)
  })

  it('clear sends cmd 0x02', async () => {
    const device = await ConduytDevice.connect(transport)
    const oled = new ConduytOLED(device)
    await oled.clear()

    const pkt = findModCmd(transport)
    expect(pkt).toBeDefined()
    expect(pkt!.payload[1]).toBe(0x02)
    expect(pkt!.payload.length).toBe(2)
  })

  it('text sends cmd 0x03 with x, y, size, and UTF-8 string', async () => {
    const device = await ConduytDevice.connect(transport)
    const oled = new ConduytOLED(device)
    await oled.text(10, 20, 1, 'Hi')

    const pkt = findModCmd(transport)
    expect(pkt).toBeDefined()
    expect(pkt!.payload[1]).toBe(0x03)
    expect(pkt!.payload[2]).toBe(10) // x
    expect(pkt!.payload[3]).toBe(20) // y
    expect(pkt!.payload[4]).toBe(1)  // size
    // 'Hi' in UTF-8
    expect(pkt!.payload[5]).toBe(0x48) // 'H'
    expect(pkt!.payload[6]).toBe(0x69) // 'i'
  })

  it('show sends cmd 0x06', async () => {
    const device = await ConduytDevice.connect(transport)
    const oled = new ConduytOLED(device)
    await oled.show()

    const pkt = findModCmd(transport)
    expect(pkt).toBeDefined()
    expect(pkt!.payload[1]).toBe(0x06)
    expect(pkt!.payload.length).toBe(2)
  })
})

describe('ConduytDHT', () => {
  let transport: MockTransport

  beforeEach(() => {
    transport = new MockTransport()
    autoRespond(transport)
  })

  it('begin sends cmd 0x01 with pin and type', async () => {
    const device = await ConduytDevice.connect(transport)
    const dht = new ConduytDHT(device)
    await dht.begin(4, 22)

    const pkt = findModCmd(transport)
    expect(pkt).toBeDefined()
    expect(pkt!.payload[0]).toBe(3) // module_id for dht
    expect(pkt!.payload[1]).toBe(0x01)
    expect(pkt!.payload[2]).toBe(4)  // pin
    expect(pkt!.payload[3]).toBe(22) // type
  })

  it('read returns temperature and humidity from MOD_RESP', async () => {
    // Build MOD_RESP payload with 2 float32 LE values: 23.5 and 65.0
    const respBuf = new Uint8Array(8)
    const respView = new DataView(respBuf.buffer)
    respView.setFloat32(0, 23.5, true)
    respView.setFloat32(4, 65.0, true)
    autoRespondWithModResp(transport, respBuf)

    const device = await ConduytDevice.connect(transport)
    const dht = new ConduytDHT(device)
    const reading = await dht.read()

    expect(reading.temperature).toBeCloseTo(23.5)
    expect(reading.humidity).toBeCloseTo(65.0)
  })
})

describe('ConduytEncoder', () => {
  let transport: MockTransport

  beforeEach(() => {
    transport = new MockTransport()
    autoRespond(transport)
  })

  it('attach sends cmd 0x01 with pinA and pinB', async () => {
    const device = await ConduytDevice.connect(transport)
    const enc = new ConduytEncoder(device)
    await enc.attach(2, 3)

    const pkt = findModCmd(transport)
    expect(pkt).toBeDefined()
    expect(pkt!.payload[0]).toBe(4) // module_id for encoder
    expect(pkt!.payload[1]).toBe(0x01)
    expect(pkt!.payload[2]).toBe(2)
    expect(pkt!.payload[3]).toBe(3)
  })

  it('read returns int32 from MOD_RESP', async () => {
    // Build MOD_RESP payload with int32 LE value: -1024
    const respBuf = new Uint8Array(4)
    const respView = new DataView(respBuf.buffer)
    respView.setInt32(0, -1024, true)
    autoRespondWithModResp(transport, respBuf)

    const device = await ConduytDevice.connect(transport)
    const enc = new ConduytEncoder(device)
    const count = await enc.read()

    expect(count).toBe(-1024)
  })

  it('reset sends cmd 0x03 with no payload', async () => {
    const device = await ConduytDevice.connect(transport)
    const enc = new ConduytEncoder(device)
    await enc.reset()

    const pkt = findModCmd(transport)
    expect(pkt).toBeDefined()
    expect(pkt!.payload[1]).toBe(0x03)
    expect(pkt!.payload.length).toBe(2)
  })
})

describe('ConduytStepper', () => {
  let transport: MockTransport

  beforeEach(() => {
    transport = new MockTransport()
    autoRespond(transport)
  })

  it('config sends cmd 0x01 with pins and stepsPerRev', async () => {
    const device = await ConduytDevice.connect(transport)
    const stepper = new ConduytStepper(device)
    await stepper.config(2, 3, 4, 200)

    const pkt = findModCmd(transport)
    expect(pkt).toBeDefined()
    expect(pkt!.payload[0]).toBe(5) // module_id for stepper
    expect(pkt!.payload[1]).toBe(0x01)
    expect(pkt!.payload[2]).toBe(2) // stepPin
    expect(pkt!.payload[3]).toBe(3) // dirPin
    expect(pkt!.payload[4]).toBe(4) // enPin
    expect(pkt!.payload[5]).toBe(200 & 0xFF)  // stepsPerRev lo
    expect(pkt!.payload[6]).toBe((200 >> 8) & 0xFF) // stepsPerRev hi
  })

  it('move sends cmd 0x02 with int32 steps and uint16 speed', async () => {
    const device = await ConduytDevice.connect(transport)
    const stepper = new ConduytStepper(device)
    await stepper.move(-500, 1000)

    const pkt = findModCmd(transport)
    expect(pkt).toBeDefined()
    expect(pkt!.payload[1]).toBe(0x02)
    // Verify int32 LE encoding of -500
    const view = new DataView(pkt!.payload.buffer, pkt!.payload.byteOffset + 2, 6)
    expect(view.getInt32(0, true)).toBe(-500)
    expect(view.getUint16(4, true)).toBe(1000)
  })

  it('stop sends cmd 0x04 with no payload', async () => {
    const device = await ConduytDevice.connect(transport)
    const stepper = new ConduytStepper(device)
    await stepper.stop()

    const pkt = findModCmd(transport)
    expect(pkt).toBeDefined()
    expect(pkt!.payload[1]).toBe(0x04)
    expect(pkt!.payload.length).toBe(2)
  })
})

describe('ConduytPID', () => {
  let transport: MockTransport

  beforeEach(() => {
    transport = new MockTransport()
    autoRespond(transport)
  })

  it('config sends cmd 0x01 with 3 float32 LE values', async () => {
    const device = await ConduytDevice.connect(transport)
    const pid = new ConduytPID(device)
    await pid.config(1.0, 0.5, 0.1)

    const pkt = findModCmd(transport)
    expect(pkt).toBeDefined()
    expect(pkt!.payload[0]).toBe(6) // module_id for pid
    expect(pkt!.payload[1]).toBe(0x01)
    const view = new DataView(pkt!.payload.buffer, pkt!.payload.byteOffset + 2, 12)
    expect(view.getFloat32(0, true)).toBeCloseTo(1.0)
    expect(view.getFloat32(4, true)).toBeCloseTo(0.5)
    expect(view.getFloat32(8, true)).toBeCloseTo(0.1)
  })

  it('setTarget sends cmd 0x02 with float32 LE', async () => {
    const device = await ConduytDevice.connect(transport)
    const pid = new ConduytPID(device)
    await pid.setTarget(75.5)

    const pkt = findModCmd(transport)
    expect(pkt).toBeDefined()
    expect(pkt!.payload[1]).toBe(0x02)
    const view = new DataView(pkt!.payload.buffer, pkt!.payload.byteOffset + 2, 4)
    expect(view.getFloat32(0, true)).toBeCloseTo(75.5)
  })

  it('enable sends cmd 0x05 with [1]', async () => {
    const device = await ConduytDevice.connect(transport)
    const pid = new ConduytPID(device)
    await pid.enable()

    const pkt = findModCmd(transport)
    expect(pkt).toBeDefined()
    expect(pkt!.payload[1]).toBe(0x05)
    expect(pkt!.payload[2]).toBe(1)
  })

  it('disable sends cmd 0x05 with [0]', async () => {
    const device = await ConduytDevice.connect(transport)
    const pid = new ConduytPID(device)
    await pid.disable()

    const pkt = findModCmd(transport)
    expect(pkt).toBeDefined()
    expect(pkt!.payload[1]).toBe(0x05)
    expect(pkt!.payload[2]).toBe(0)
  })
})

describe('Module on unknown module name', () => {
  it('ConduytNeoPixel throws when device only has servo module', async () => {
    const transport = new MockTransport()

    // Build a HELLO_RESP with ONLY servo (no neopixel)
    function makeServoOnlyHelloResp(): Uint8Array {
      const parts: number[] = []
      const name = new TextEncoder().encode('MockBoard')
      for (let i = 0; i < 16; i++) parts.push(i < name.length ? name[i] : 0)
      parts.push(1, 0, 0) // version
      for (let i = 0; i < 8; i++) parts.push(0) // mcu_id
      parts.push(0) // ota
      parts.push(20) // pin_count
      for (let i = 0; i < 20; i++) parts.push(0x0F)
      parts.push(1, 1, 1) // i2c, spi, uart
      parts.push(0x00, 0x02) // max_payload
      // module_count = 1 (servo only)
      parts.push(1)
      parts.push(0) // module_id
      const modName = new TextEncoder().encode('servo')
      for (let i = 0; i < 8; i++) parts.push(i < modName.length ? modName[i] : 0)
      parts.push(1, 0) // version
      parts.push(0) // 0 pins
      // datastream_count = 0
      parts.push(0)
      return new Uint8Array(parts)
    }

    transport.send = async (packet: Uint8Array) => {
      transport.sentPackets.push(new Uint8Array(packet))
      try {
        const decoded = wireDecode(packet)
        if (decoded.type === CMD.HELLO) {
          transport.inject(wireEncode(makePacket(EVT.HELLO_RESP, decoded.seq, makeServoOnlyHelloResp())))
        } else {
          transport.inject(wireEncode(makePacket(EVT.ACK, decoded.seq)))
        }
      } catch { /* ignore */ }
    }

    const device = await ConduytDevice.connect(transport)

    // Servo should work fine
    expect(() => new ConduytServo(device)).not.toThrow()

    // NeoPixel should throw because 'neopixel' module is not in HELLO_RESP
    expect(() => new ConduytNeoPixel(device)).toThrow('not found')
  })
})
