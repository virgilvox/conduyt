<template>
  <div class="flash-panel">
    <div class="flash-header">
      <h3>Flash Firmware</h3>
      <button class="flash-close" @click="$emit('close')" title="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>

    <div class="flash-body">
      <p class="flash-intro">
        Flash CONDUYT firmware to your board directly from this page.
        No tools or drivers required - just plug in via USB and click Install.
      </p>

      <!-- Step 1: Board family -->
      <div class="board-selector">
        <label class="board-label">Select your board family:</label>
        <div class="board-options">
          <button
            v-for="family in boardFamilies"
            :key="family.id"
            class="board-option"
            :class="{ selected: selectedFamily === family.id }"
            @click="selectFamily(family.id)"
          >
            <span class="board-name">{{ family.name }}</span>
            <span class="board-chip">{{ family.description }}</span>
          </button>
        </div>
      </div>

      <!-- Step 2: Board variant -->
      <div v-if="selectedFamily && activeFamily" class="variant-selector">
        <label class="board-label">Choose variant:</label>
        <select v-model="selectedVariant" class="variant-select">
          <option v-for="v in activeFamily.variants" :key="v.id" :value="v.id">
            {{ v.name }} - {{ v.chip }}
            <template v-if="!v.firmwareReady"> (firmware coming soon)</template>
          </option>
        </select>
      </div>

      <!-- Step 3: Flash UI -->
      <div v-if="activeVariant" class="flash-action">
        <!-- ESP32 family: esp-web-tools -->
        <div v-if="activeVariant.flashMethod === 'esptool'" class="esp-flash">
          <ClientOnly>
            <esp-web-install-button
              :manifest="activeVariant.manifest || manifestUrl"
              class="esp-button"
            >
              <button slot="activate" class="flash-btn">
                Install CONDUYT on {{ activeVariant.name }}
              </button>
              <span slot="unsupported">
                <p class="flash-unsupported">
                  WebSerial not available. Use <strong>Chrome</strong> or <strong>Edge</strong> on desktop.
                </p>
              </span>
              <span slot="not-allowed">
                <p class="flash-unsupported">
                  WebSerial access denied. Make sure you're on HTTPS or localhost.
                </p>
              </span>
            </esp-web-install-button>
            <p class="flash-note">
              {{ activeVariant.notes || 'Connect your board via USB, then click Install. The correct chip variant is auto-detected.' }}
            </p>
          </ClientOnly>
        </div>

        <!-- WebUSB DFU -->
        <div v-else-if="activeVariant.flashMethod === 'dfu'" class="dfu-flash">
          <button class="flash-btn" @click="flashDFU" :disabled="flashing">
            {{ dfuStatus }}
          </button>
          <p class="flash-note">
            {{ activeVariant.notes || 'Put your board in DFU mode, then click Flash. Uses WebUSB - Chrome or Edge required.' }}
          </p>
          <div v-if="flashProgress > 0 && flashing" class="flash-progress">
            <div class="flash-progress-bar" :style="{ width: flashProgress + '%' }" />
            <span class="flash-progress-text">{{ flashProgress }}%</span>
          </div>
        </div>

        <!-- WebSerial STK500 (AVR boards) -->
        <div v-else-if="activeVariant.flashMethod === 'stk500'" class="avr-flash">
          <button class="flash-btn" @click="flashSTK500" :disabled="flashing || !activeVariant.firmwareReady">
            {{ flashing ? 'Flashing...' : `Flash ${activeVariant.name}` }}
          </button>
          <p class="flash-note">
            {{ activeVariant.notes || 'Uses WebSerial with STK500 protocol. Chrome or Edge required.' }}
            <span v-if="!activeVariant.firmwareReady" class="coming-soon">Firmware binary coming soon.</span>
          </p>
        </div>

        <!-- UF2 / PICOBOOT -->
        <div v-else-if="activeVariant.flashMethod === 'uf2'" class="pico-flash">
          <a v-if="activeVariant.firmwareReady"
            :href="activeVariant.firmwarePath"
            :download="activeVariant.firmwareFile"
            class="flash-btn download-btn"
          >
            Download UF2 for {{ activeVariant.name }}
          </a>
          <button v-else class="flash-btn" disabled>
            {{ activeVariant.name }} - firmware coming soon
          </button>
          <p class="flash-note">
            {{ activeVariant.notes || 'Hold BOOTSEL while plugging in USB, then drag the UF2 file to the drive that appears.' }}
          </p>
        </div>

        <!-- HEX download (Teensy, nRF, etc.) -->
        <div v-else-if="activeVariant.flashMethod === 'hex'" class="hex-flash">
          <a v-if="activeVariant.firmwareReady"
            :href="activeVariant.firmwarePath"
            :download="activeVariant.firmwareFile"
            class="flash-btn download-btn"
          >
            Download firmware for {{ activeVariant.name }}
          </a>
          <button v-else class="flash-btn" disabled>
            {{ activeVariant.name }} - firmware coming soon
          </button>
          <p class="flash-note">
            {{ activeVariant.notes }}
          </p>
        </div>
      </div>

      <div v-if="flashError" class="flash-error">{{ flashError }}</div>
      <div v-if="flashSuccess" class="flash-success">
        Firmware flashed successfully! Click <strong>Connect</strong> below to start coding.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineEmits<{ close: [] }>()

// Register esp-web-install-button custom element (client-side only)
onMounted(() => import('esp-web-tools'))

const selectedFamily = ref<string | null>('esp32')
const selectedVariant = ref<string>('esp32')
const flashing = ref(false)
const flashError = ref('')
const flashSuccess = ref(false)
const flashProgress = ref(0)

const FIRMWARE_BASE = '/firmware'
const manifestUrl = '/firmware/manifest.json'


// --- Board data ---

interface BoardVariant {
  id: string
  name: string
  chip: string
  flashMethod: 'esptool' | 'dfu' | 'stk500' | 'uf2' | 'hex'
  firmwareReady: boolean
  firmwarePath?: string
  firmwareFile?: string
  manifest?: string
  vendorId?: number
  productId?: number
  notes?: string
}

interface BoardFamily {
  id: string
  name: string
  description: string
  variants: BoardVariant[]
}

const boardFamilies: BoardFamily[] = [
  {
    id: 'esp32',
    name: 'ESP32',
    description: 'Espressif WiFi + BLE',
    variants: [
      {
        id: 'esp32',
        name: 'ESP32',
        chip: 'Xtensa LX6 dual-core 240 MHz',
        flashMethod: 'esptool',
        firmwareReady: true,
        notes: 'Works with ESP32 DevKit, NodeMCU-32S, WROOM, WROVER, and compatible boards.',
      },
      {
        id: 'esp32s2',
        name: 'ESP32-S2',
        chip: 'Xtensa LX7 single-core 240 MHz',
        flashMethod: 'esptool',
        firmwareReady: true,
        notes: 'Native USB support. Works with ESP32-S2 DevKit, Saola, and Adafruit Feather S2.',
      },
      {
        id: 'esp32s3',
        name: 'ESP32-S3',
        chip: 'Xtensa LX7 dual-core 240 MHz',
        flashMethod: 'esptool',
        firmwareReady: true,
        notes: 'USB OTG + WiFi + BLE 5. Works with ESP32-S3 DevKit, Adafruit Feather S3, XIAO S3.',
      },
      {
        id: 'esp32c3',
        name: 'ESP32-C3',
        chip: 'RISC-V single-core 160 MHz',
        flashMethod: 'esptool',
        firmwareReady: true,
        notes: 'Low-cost RISC-V with WiFi + BLE. Works with ESP32-C3 DevKit, XIAO C3, Seeed Studio.',
      },
      {
        id: 'esp32c6',
        name: 'ESP32-C6',
        chip: 'RISC-V single-core 160 MHz',
        flashMethod: 'esptool',
        firmwareReady: false,
        notes: 'WiFi 6 + BLE 5.3 + Thread/Zigbee. Works with ESP32-C6 DevKit.',
      },
      {
        id: 'esp32h2',
        name: 'ESP32-H2',
        chip: 'RISC-V single-core 96 MHz',
        flashMethod: 'esptool',
        firmwareReady: false,
        notes: 'Thread/Zigbee + BLE 5.3 (no WiFi). Designed for mesh/IoT gateway use.',
      },
    ],
  },
  {
    id: 'esp8266',
    name: 'ESP8266',
    description: 'Espressif WiFi (legacy)',
    variants: [
      {
        id: 'nodemcuv2',
        name: 'NodeMCU v2',
        chip: 'ESP8266 Tensilica L106 80 MHz',
        flashMethod: 'esptool',
        firmwareReady: true,
        manifest: '/firmware/manifest-esp8266.json',
        notes: 'Classic WiFi board. Also works with Wemos D1 Mini and other ESP8266 boards.',
      },
      {
        id: 'esp01',
        name: 'ESP-01 / ESP-01S',
        chip: 'ESP8266 (2 GPIO)',
        flashMethod: 'esptool',
        firmwareReady: false,
        notes: 'Minimal ESP8266 module. Requires USB-to-serial adapter for flashing.',
      },
    ],
  },
  {
    id: 'arduino',
    name: 'Arduino',
    description: 'Official Arduino boards',
    variants: [
      {
        id: 'uno_r4_minima',
        name: 'Uno R4 Minima',
        chip: 'Renesas RA4M1 48 MHz',
        flashMethod: 'dfu',
        firmwareReady: true,
        firmwarePath: `${FIRMWARE_BASE}/conduyt-uno-r4-minima.bin`,
        firmwareFile: 'conduyt-uno-r4-minima.bin',
        vendorId: 0x2341,
        productId: 0x0369,
        notes: 'Double-tap RESET to enter DFU mode (the "L" LED will pulse), then click Flash. Uses WebUSB.',
      },
      {
        id: 'uno_r4_wifi',
        name: 'Uno R4 WiFi',
        chip: 'Renesas RA4M1 48 MHz + ESP32-S3',
        flashMethod: 'dfu',
        firmwareReady: true,
        firmwarePath: `${FIRMWARE_BASE}/conduyt-uno-r4-wifi.bin`,
        firmwareFile: 'conduyt-uno-r4-wifi.bin',
        vendorId: 0x2341,
        productId: 0x1002,
        notes: 'Double-tap RESET to enter DFU mode, then click Flash. Uses WebUSB.',
      },
      {
        id: 'uno_r2',
        name: 'Uno R2',
        chip: 'ATmega328P 16 MHz',
        flashMethod: 'stk500',
        firmwareReady: true,
        firmwarePath: `${FIRMWARE_BASE}/conduyt-uno-r3.hex`,
        firmwareFile: 'conduyt-uno-r3.hex',
        notes: 'Same ATmega328P as the R3. Uses WebSerial with STK500 protocol (alpha).',
      },
      {
        id: 'uno_r3',
        name: 'Uno R3',
        chip: 'ATmega328P 16 MHz',
        flashMethod: 'stk500',
        firmwareReady: true,
        firmwarePath: `${FIRMWARE_BASE}/conduyt-uno-r3.hex`,
        firmwareFile: 'conduyt-uno-r3.hex',
        notes: 'Classic Arduino. Uses WebSerial with STK500 protocol (alpha).',
      },
      {
        id: 'mega2560',
        name: 'Mega 2560',
        chip: 'ATmega2560 16 MHz',
        flashMethod: 'stk500',
        firmwareReady: true,
        firmwarePath: `${FIRMWARE_BASE}/conduyt-mega2560.hex`,
        firmwareFile: 'conduyt-mega2560.hex',
        notes: 'Uses WebSerial with STK500v2 protocol. 54 digital + 16 analog pins.',
      },
      {
        id: 'nano',
        name: 'Nano',
        chip: 'ATmega328P 16 MHz',
        flashMethod: 'stk500',
        firmwareReady: true,
        firmwarePath: `${FIRMWARE_BASE}/conduyt-nano.hex`,
        firmwareFile: 'conduyt-nano.hex',
        notes: 'Compact form factor. Uses WebSerial with STK500 protocol.',
      },
      {
        id: 'nano_every',
        name: 'Nano Every',
        chip: 'ATmega4809 20 MHz',
        flashMethod: 'stk500',
        firmwareReady: true,
        firmwarePath: `${FIRMWARE_BASE}/conduyt-nano-every.hex`,
        firmwareFile: 'conduyt-nano-every.hex',
        notes: 'Upgraded Nano with more memory. Uses WebSerial.',
      },
      {
        id: 'nano_esp32',
        name: 'Nano ESP32',
        chip: 'ESP32-S3 (Arduino form factor)',
        flashMethod: 'esptool',
        firmwareReady: true,
        manifest: '/firmware/manifest-nano-esp32.json',
        notes: 'Arduino Nano with ESP32-S3. Flash via WebSerial esptool.',
      },
      {
        id: 'leonardo',
        name: 'Leonardo',
        chip: 'ATmega32U4 16 MHz',
        flashMethod: 'hex',
        firmwareReady: true,
        firmwarePath: `${FIRMWARE_BASE}/conduyt-leonardo.hex`,
        firmwareFile: 'conduyt-leonardo.hex',
        notes: 'Download HEX and flash with Arduino IDE. Uses AVR109 bootloader (tap RESET to enter).',
      },
      {
        id: 'micro',
        name: 'Micro',
        chip: 'ATmega32U4 16 MHz',
        flashMethod: 'hex',
        firmwareReady: true,
        firmwarePath: `${FIRMWARE_BASE}/conduyt-leonardo.hex`,
        firmwareFile: 'conduyt-leonardo.hex',
        notes: 'Same firmware as Leonardo. Download HEX and flash with Arduino IDE.',
      },
    ],
  },
  {
    id: 'rpi',
    name: 'Raspberry Pi',
    description: 'RP2040 / RP2350 MCUs',
    variants: [
      {
        id: 'pico',
        name: 'Pico',
        chip: 'RP2040 dual-core 133 MHz',
        flashMethod: 'uf2',
        firmwareReady: true,
        firmwarePath: `${FIRMWARE_BASE}/conduyt-pico.uf2`,
        firmwareFile: 'conduyt-pico.uf2',
        notes: 'Hold BOOTSEL while plugging in USB, then drag the UF2 file to the RPI-RP2 drive.',
      },
      {
        id: 'pico_w',
        name: 'Pico W',
        chip: 'RP2040 + CYW43439 WiFi/BLE',
        flashMethod: 'uf2',
        firmwareReady: true,
        firmwarePath: `${FIRMWARE_BASE}/conduyt-pico.uf2`,
        firmwareFile: 'conduyt-pico.uf2',
        notes: 'Uses standard RP2040 UF2 (WiFi driver not yet included). Hold BOOTSEL, drag to drive.',
      },
      {
        id: 'pico2',
        name: 'Pico 2',
        chip: 'RP2350 dual-core 150 MHz',
        flashMethod: 'uf2',
        firmwareReady: false,
        notes: 'Next-gen RP2350 with security features. Hold BOOTSEL, then drag UF2 to drive.',
      },
    ],
  },
  {
    id: 'nordic',
    name: 'Nordic nRF',
    description: 'BLE / Thread / Zigbee',
    variants: [
      {
        id: 'nrf52840dk',
        name: 'nRF52840 DK',
        chip: 'nRF52840 Cortex-M4F 64 MHz',
        flashMethod: 'hex',
        firmwareReady: true,
        firmwarePath: `${FIRMWARE_BASE}/conduyt-nrf52840-dk.hex`,
        firmwareFile: 'conduyt-nrf52840-dk.hex',
        notes: 'Download the HEX file and flash with nRF Connect, J-Link, or drag to the JLINK drive.',
      },
      {
        id: 'nrf52840dongle',
        name: 'nRF52840 Dongle',
        chip: 'nRF52840 (USB dongle form factor)',
        flashMethod: 'hex',
        firmwareReady: true,
        firmwarePath: `${FIRMWARE_BASE}/conduyt-nrf52840-dk.hex`,
        firmwareFile: 'conduyt-nrf52840-dk.hex',
        notes: 'Uses standard nRF52840 firmware. Flash with nRF Connect Programmer.',
      },
      {
        id: 'xiao_nrf52840',
        name: 'XIAO nRF52840',
        chip: 'nRF52840 (Seeed Studio)',
        flashMethod: 'hex',
        firmwareReady: true,
        firmwarePath: `${FIRMWARE_BASE}/conduyt-nrf52840-dk.hex`,
        firmwareFile: 'conduyt-nrf52840-dk.hex',
        notes: 'Uses standard nRF52840 firmware. Flash via Adafruit nRF52 bootloader or nRF Connect.',
      },
    ],
  },
  {
    id: 'teensy',
    name: 'Teensy',
    description: 'PJRC high-performance',
    variants: [
      {
        id: 'teensy41',
        name: 'Teensy 4.1',
        chip: 'i.MX RT1062 Cortex-M7 600 MHz',
        flashMethod: 'hex',
        firmwareReady: true,
        firmwarePath: `${FIRMWARE_BASE}/conduyt-teensy41.hex`,
        firmwareFile: 'conduyt-teensy41.hex',
        notes: 'Download the HEX file and flash with Teensy Loader. Press the button on the board to enter bootloader.',
      },
      {
        id: 'teensy40',
        name: 'Teensy 4.0',
        chip: 'i.MX RT1062 Cortex-M7 600 MHz',
        flashMethod: 'hex',
        firmwareReady: true,
        firmwarePath: `${FIRMWARE_BASE}/conduyt-teensy40.hex`,
        firmwareFile: 'conduyt-teensy40.hex',
        notes: 'Same MCU as 4.1 in a smaller form factor. Flash with Teensy Loader.',
      },
      {
        id: 'teensy36',
        name: 'Teensy 3.6',
        chip: 'MK66FX1M0 Cortex-M4F 180 MHz',
        flashMethod: 'hex',
        firmwareReady: true,
        firmwarePath: `${FIRMWARE_BASE}/conduyt-teensy36.hex`,
        firmwareFile: 'conduyt-teensy36.hex',
        notes: 'Flash with Teensy Loader. Press the button to enter bootloader.',
      },
    ],
  },
  {
    id: 'adafruit',
    name: 'Adafruit',
    description: 'Feather / QT Py / ItsyBitsy',
    variants: [
      {
        id: 'feather_esp32s3',
        name: 'Feather ESP32-S3',
        chip: 'ESP32-S3 (Feather form factor)',
        flashMethod: 'esptool',
        firmwareReady: true,
        notes: 'Uses standard ESP32-S3 firmware. Chip variant auto-detected during flash.',
      },
      {
        id: 'feather_esp32s2',
        name: 'Feather ESP32-S2',
        chip: 'ESP32-S2 (Feather form factor)',
        flashMethod: 'esptool',
        firmwareReady: true,
        notes: 'Uses standard ESP32-S2 firmware. Chip variant auto-detected during flash.',
      },
      {
        id: 'feather_nrf52840',
        name: 'Feather nRF52840',
        chip: 'nRF52840 (Feather form factor)',
        flashMethod: 'hex',
        firmwareReady: true,
        firmwarePath: `${FIRMWARE_BASE}/conduyt-nrf52840-dk.hex`,
        firmwareFile: 'conduyt-nrf52840-dk.hex',
        notes: 'Download HEX and flash with Adafruit nRF52 Bootloader or nRF Connect.',
      },
      {
        id: 'feather_rp2040',
        name: 'Feather RP2040',
        chip: 'RP2040 (Feather form factor)',
        flashMethod: 'uf2',
        firmwareReady: true,
        firmwarePath: `${FIRMWARE_BASE}/conduyt-pico.uf2`,
        firmwareFile: 'conduyt-pico.uf2',
        notes: 'Uses standard RP2040 UF2. Hold BOOTSEL while plugging in, drag to RPI-RP2 drive.',
      },
      {
        id: 'qtpy_esp32s3',
        name: 'QT Py ESP32-S3',
        chip: 'ESP32-S3 (tiny form factor)',
        flashMethod: 'esptool',
        firmwareReady: true,
        notes: 'Uses standard ESP32-S3 firmware. Chip variant auto-detected during flash.',
      },
    ],
  },
  {
    id: 'seeed',
    name: 'Seeed XIAO',
    description: 'Ultra-compact MCUs',
    variants: [
      {
        id: 'xiao_esp32s3',
        name: 'XIAO ESP32S3',
        chip: 'ESP32-S3 (thumb-sized)',
        flashMethod: 'esptool',
        firmwareReady: true,
        notes: 'Uses standard ESP32-S3 firmware. Chip variant auto-detected during flash.',
      },
      {
        id: 'xiao_esp32c3',
        name: 'XIAO ESP32C3',
        chip: 'ESP32-C3 RISC-V',
        flashMethod: 'esptool',
        firmwareReady: true,
        notes: 'Uses standard ESP32-C3 firmware. Chip variant auto-detected during flash.',
      },
      {
        id: 'xiao_rp2040',
        name: 'XIAO RP2040',
        chip: 'RP2040 (thumb-sized)',
        flashMethod: 'uf2',
        firmwareReady: true,
        firmwarePath: `${FIRMWARE_BASE}/conduyt-pico.uf2`,
        firmwareFile: 'conduyt-pico.uf2',
        notes: 'Uses standard RP2040 UF2. Hold BOOT while plugging in, drag to RPI-RP2 drive.',
      },
      {
        id: 'xiao_samd21',
        name: 'XIAO SAMD21',
        chip: 'SAMD21 Cortex-M0+ 48 MHz',
        flashMethod: 'uf2',
        firmwareReady: false,
        notes: 'Double-tap RESET for UF2 bootloader, then drag firmware to the drive.',
      },
    ],
  },
]

const activeFamily = computed(() =>
  boardFamilies.find(f => f.id === selectedFamily.value) || null
)

const activeVariant = computed(() => {
  if (!activeFamily.value) return null
  return activeFamily.value.variants.find(v => v.id === selectedVariant.value) || null
})

function selectFamily(id: string) {
  selectedFamily.value = id
  const family = boardFamilies.find(f => f.id === id)
  if (family && family.variants.length > 0) {
    selectedVariant.value = family.variants[0].id
  }
}

const dfuStatus = computed(() => {
  if (!flashing.value) return `Flash ${activeVariant.value?.name || 'Board'}`
  if (flashProgress.value > 0) return `Flashing... ${flashProgress.value}%`
  return 'Connecting...'
})

// WebUSB DFU flashing
async function flashDFU() {
  if (!activeVariant.value) return
  flashing.value = true
  flashError.value = ''
  flashSuccess.value = false
  flashProgress.value = 0

  try {
    if (!('usb' in navigator)) {
      throw new Error('WebUSB not supported. Use Chrome or Edge on desktop.')
    }

    const filters: Array<{ vendorId?: number; productId?: number }> = []
    if (activeVariant.value.vendorId && activeVariant.value.productId) {
      filters.push({ vendorId: activeVariant.value.vendorId, productId: activeVariant.value.productId })
    }
    if (activeVariant.value.vendorId) {
      filters.push({ vendorId: activeVariant.value.vendorId })
    }

    const device = await (navigator as any).usb.requestDevice({ filters })
    const { WebDFU } = await import('dfu')

    const dfu = new WebDFU(device, { forceInterfacesName: true })
    await dfu.init()

    if (dfu.interfaces.length === 0) {
      throw new Error('No DFU interfaces found. Make sure the board is in DFU mode.')
    }

    await dfu.connect(0)

    if (!activeVariant.value.firmwarePath) {
      throw new Error('Firmware binary path not configured for this board.')
    }

    const resp = await fetch(activeVariant.value.firmwarePath)
    if (!resp.ok) {
      throw new Error(`Firmware binary not found at ${activeVariant.value.firmwarePath}`)
    }
    const firmwareData = await resp.arrayBuffer()

    const transferSize = dfu.properties?.TransferSize || 1024

    await new Promise<void>((resolve, reject) => {
      const process = dfu.write(transferSize, firmwareData, true)

      process.events.on('erase/start', () => { flashProgress.value = 0 })
      process.events.on('erase/process', (bytesSent: number, total: number) => {
        flashProgress.value = Math.round((bytesSent / total) * 30)
      })
      process.events.on('write/start', () => { flashProgress.value = 30 })
      process.events.on('write/process', (bytesSent: number, expectedSize: number) => {
        flashProgress.value = 30 + Math.round((bytesSent / expectedSize) * 65)
      })
      process.events.on('write/end', () => { flashProgress.value = 100; resolve() })
      process.events.on('error', (err: any) => {
        reject(new Error(err?.message || 'DFU write failed'))
      })

      setTimeout(() => reject(new Error('DFU flash timed out after 2 minutes')), 120000)
    })

    flashSuccess.value = true
  } catch (e: any) {
    if (e.name === 'NotFoundError') {
      flashError.value = 'No DFU device found. Put the board in DFU mode and try again.'
    } else {
      flashError.value = e.message || 'Flash failed'
    }
  } finally {
    flashing.value = false
  }
}

async function flashSTK500() {
  flashing.value = true
  flashError.value = ''
  flashSuccess.value = false
  try {
    if (!activeVariant.value?.firmwareReady) {
      flashError.value = `${activeVariant.value?.name || 'Board'} firmware binary not yet available.`
      return
    }
    flashError.value = `STK500 web flashing for ${activeVariant.value.name} is in alpha. Use Arduino IDE for now.`
  } catch (e: any) {
    flashError.value = e.message || 'Flash failed'
  } finally {
    flashing.value = false
  }
}
</script>

<style scoped>
.flash-panel {
  position: fixed;
  top: 56px;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--bg);
  z-index: 100;
  display: flex;
  flex-direction: column;
}

.flash-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border);
}

.flash-header h3 {
  font-size: 16px;
  text-transform: none;
  letter-spacing: 0;
}

.flash-close {
  background: none;
  border: 1px solid var(--border-bright);
  border-radius: 4px;
  color: var(--text);
  cursor: pointer;
  padding: 4px;
  display: flex;
}
.flash-close:hover { border-color: var(--accent); color: var(--accent); }

.flash-body {
  flex: 1;
  padding: 24px;
  max-width: 720px;
  margin: 0 auto;
  overflow-y: auto;
  width: 100%;
}

.flash-intro {
  color: var(--text);
  margin-bottom: 24px;
  line-height: 1.6;
}

.board-label {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
  display: block;
  margin-bottom: 8px;
}

.board-options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 8px;
  margin-bottom: 24px;
}

.board-option {
  padding: 10px 12px;
  border: 1px solid var(--border-bright);
  border-radius: var(--radius);
  background: var(--card);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}
.board-option:hover { border-color: var(--accent); }
.board-option.selected { border-color: var(--accent); background: var(--accent-dim); }

.board-name {
  display: block;
  font-family: var(--sans);
  font-weight: 600;
  font-size: 13px;
  color: var(--text-bright);
}

.board-chip {
  display: block;
  font-family: var(--mono);
  font-size: 10px;
  color: var(--text-dim);
  margin-top: 2px;
}

.variant-selector {
  margin-bottom: 20px;
}

.variant-select {
  width: 100%;
  padding: 10px 12px;
  background: var(--card);
  color: var(--text-bright);
  border: 1px solid var(--border-bright);
  border-radius: var(--radius);
  font-family: var(--mono);
  font-size: 13px;
  cursor: pointer;
  appearance: auto;
}
.variant-select:focus { border-color: var(--accent); outline: none; }

.flash-action {
  margin-bottom: 16px;
}

.flash-btn {
  display: inline-block;
  padding: 10px 24px;
  background: var(--accent);
  color: #000;
  border: none;
  border-radius: var(--radius);
  font-family: var(--mono);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
  text-decoration: none;
  text-align: center;
}
.flash-btn:hover { opacity: 0.9; }
.flash-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.download-btn {
  display: inline-block;
}

.flash-note {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.5;
}

.coming-soon {
  display: block;
  margin-top: 4px;
  color: var(--yellow);
  font-weight: 600;
}

.flash-progress {
  margin-top: 12px;
  height: 20px;
  background: var(--border);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.flash-progress-bar {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s;
  border-radius: 4px;
}

.flash-progress-text {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-bright);
}

.flash-unsupported {
  padding: 10px 14px;
  background: rgba(224, 178, 76, 0.1);
  border: 1px solid rgba(224, 178, 76, 0.3);
  border-radius: var(--radius);
  color: var(--yellow);
  font-size: 13px;
  margin-bottom: 12px;
}

.flash-error {
  padding: 10px 14px;
  background: rgba(224, 93, 112, 0.1);
  border: 1px solid rgba(224, 93, 112, 0.3);
  border-radius: var(--radius);
  color: var(--red);
  font-size: 13px;
}

.flash-success {
  padding: 10px 14px;
  background: var(--accent-dim);
  border: 1px solid var(--accent);
  border-radius: var(--radius);
  color: var(--accent);
  font-size: 13px;
}

@media (max-width: 600px) {
  .board-options { grid-template-columns: repeat(2, 1fr); }
}
</style>
