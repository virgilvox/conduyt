export interface PlaygroundExample {
  name: string
  description: string
  code: string
}

export const examples: PlaygroundExample[] = [
  {
    name: 'Blink',
    description: 'Toggle the built-in LED on and off',
    code: `// Blink — toggle LED on pin 13 (built-in LED)
await device.connect()
log('Connected:', device.capabilities.firmwareName)

await device.pin(13).mode('output')

for (let i = 0; i < 10; i++) {
  await device.pin(13).write(1)
  log('LED ON')
  await sleep(500)

  await device.pin(13).write(0)
  log('LED OFF')
  await sleep(500)
}

log('Done!')`,
  },
  {
    name: 'Read Sensor',
    description: 'Read an analog sensor and log values',
    code: `// Read analog sensor on pin A0 (pin 36 on ESP32)
await device.connect()
log('Connected:', device.capabilities.firmwareName)

await device.pin(36).mode('analog')

for (let i = 0; i < 20; i++) {
  const value = await device.pin(36).read()
  log(\`Sensor reading: \${value}\`)
  await sleep(250)
}

log('Done!')`,
  },
  {
    name: 'Ping',
    description: 'Connect and ping the device',
    code: `// Simple ping test
await device.connect()
log('Connected to:', device.capabilities.firmwareName)
log('Version:', device.capabilities.firmwareVersion.join('.'))
log('Pins:', device.capabilities.pinCount)

await device.ping()
log('Ping OK!')

log('Device capabilities (raw):')
log(Array.from(device.capabilities.raw).map(b => b.toString(16).padStart(2, '0')).join(' '))`,
  },
  {
    name: 'PWM Fade',
    description: 'Fade an LED using PWM',
    code: `// PWM fade on pin 13
await device.connect()
log('Connected!')

await device.pin(13).mode('pwm')

// Fade up
for (let i = 0; i <= 255; i += 5) {
  await device.pin(13).write(i)
  await sleep(20)
}
log('Fade up complete')

// Fade down
for (let i = 255; i >= 0; i -= 5) {
  await device.pin(13).write(i)
  await sleep(20)
}
log('Fade down complete')`,
  },
  {
    name: 'Raw Packets',
    description: 'Send and receive raw CONDUYT packets',
    code: `// Low-level packet demo using conduyt-wasm directly
const CMD = conduyt.getCMD()
const EVT = conduyt.getEVT()

log('CONDUYT Protocol Version:', conduyt.PROTOCOL_VERSION())
log('Header size:', conduyt.HEADER_SIZE(), 'bytes')

// Build a PING packet
const pkt = conduyt.makePacket(CMD.PING, 0)
log('Packet:', JSON.stringify(pkt))

// Encode to wire format
const wire = conduyt.wireEncode(pkt)
log('Wire bytes:', Array.from(wire).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '))

// COBS encode for serial framing
const cobs = conduyt.cobsEncode(wire)
log('COBS frame:', Array.from(cobs).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '))

// Decode it back
const decoded = conduyt.cobsDecode(cobs)
const pktBack = conduyt.wireDecode(decoded)
log('Decoded:', JSON.stringify(pktBack))
log('CRC8 of wire[2..7]:', '0x' + conduyt.crc8(wire.slice(2, 7)).toString(16))`,
  },
]
