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
        No tools or drivers required — just plug in via USB and click Install.
      </p>

      <div class="board-selector">
        <label class="board-label">Select your board:</label>
        <div class="board-options">
          <button
            v-for="board in boards"
            :key="board.id"
            class="board-option"
            :class="{ selected: selectedBoard === board.id }"
            @click="selectedBoard = board.id"
          >
            <span class="board-name">{{ board.name }}</span>
            <span class="board-chip">{{ board.chip }}</span>
          </button>
        </div>
      </div>

      <div class="flash-action">
        <!-- ESP32: esp-web-tools -->
        <div v-if="selectedBoard === 'esp32'" class="esp-flash">
          <ClientOnly>
            <esp-web-install-button
              :manifest="manifestUrl"
              class="esp-button"
            >
              <button slot="activate" class="flash-btn">
                Install CONDUYT Firmware
              </button>
              <span slot="unsupported">
                <p class="flash-unsupported">
                  Your browser doesn't support WebSerial.
                  Use <strong>Chrome</strong> or <strong>Edge</strong> on desktop.
                </p>
              </span>
              <span slot="not-allowed">
                <p class="flash-unsupported">
                  WebSerial access denied. Make sure you're on HTTPS.
                </p>
              </span>
            </esp-web-install-button>
          </ClientOnly>
        </div>

        <!-- Uno R4: WebUSB DFU -->
        <div v-else-if="selectedBoard === 'uno_r4'" class="dfu-flash">
          <button class="flash-btn" @click="flashDFU" :disabled="flashing">
            {{ flashStatus }}
          </button>
          <p class="flash-note">
            <strong>Double-tap RESET</strong> on your Uno R4 to enter DFU mode
            (the "L" LED will pulse), then click Flash.
            Uses WebUSB — Chrome or Edge required.
          </p>
          <div v-if="flashProgress > 0 && flashing" class="flash-progress">
            <div class="flash-progress-bar" :style="{ width: flashProgress + '%' }" />
            <span class="flash-progress-text">{{ flashProgress }}%</span>
          </div>
        </div>

        <!-- Classic Uno R3: WebSerial STK500 -->
        <div v-else-if="selectedBoard === 'uno_r3'" class="avr-flash">
          <button class="flash-btn" @click="flashArduino" :disabled="flashing">
            {{ flashing ? 'Flashing...' : 'Flash Arduino Uno R3' }}
          </button>
          <p class="flash-note">
            Arduino Uno R3 flashing uses WebSerial (alpha support).
            The board may need to be in bootloader mode.
          </p>
        </div>

        <!-- Pico: WebUSB PICOBOOT -->
        <div v-else-if="selectedBoard === 'pico'" class="pico-flash">
          <button class="flash-btn" @click="flashPico" :disabled="flashing">
            {{ flashing ? 'Flashing...' : 'Flash Raspberry Pi Pico' }}
          </button>
          <p class="flash-note">
            Hold BOOTSEL while plugging in USB, then click Flash.
            Uses WebUSB (PICOBOOT protocol).
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

const selectedBoard = ref('esp32')
const flashing = ref(false)
const flashError = ref('')
const flashSuccess = ref(false)
const flashProgress = ref(0)

const FIRMWARE_BASE = '/firmware'
const manifestUrl = '/firmware/manifest.json'

const boards = [
  { id: 'esp32', name: 'ESP32', chip: 'Xtensa LX6' },
  { id: 'uno_r4', name: 'Arduino Uno R4', chip: 'Renesas RA4M1' },
  { id: 'uno_r3', name: 'Arduino Uno R3', chip: 'ATmega328P' },
  { id: 'pico', name: 'Raspberry Pi Pico', chip: 'RP2040' },
]

const flashStatus = computed(() => {
  if (!flashing.value) return 'Flash Arduino Uno R4'
  if (flashProgress.value > 0) return `Flashing... ${flashProgress.value}%`
  return 'Connecting...'
})

// Arduino Uno R4 — WebUSB DFU flashing
const UNO_R4_DFU_VENDOR_ID = 0x2341
const UNO_R4_DFU_PRODUCT_ID = 0x0369

async function flashDFU() {
  flashing.value = true
  flashError.value = ''
  flashSuccess.value = false
  flashProgress.value = 0

  try {
    // Check WebUSB support
    if (!('usb' in navigator)) {
      throw new Error('WebUSB not supported. Use Chrome or Edge on desktop.')
    }

    // Request the DFU device
    const device = await navigator.usb.requestDevice({
      filters: [
        { vendorId: UNO_R4_DFU_VENDOR_ID, productId: UNO_R4_DFU_PRODUCT_ID },
        { vendorId: UNO_R4_DFU_VENDOR_ID }, // fallback: any Arduino device in DFU
      ],
    })

    // Load WebDFU
    const { WebDFU } = await import('dfu')

    const dfu = new WebDFU(device, { forceInterfacesName: true })
    await dfu.init()

    if (dfu.interfaces.length === 0) {
      throw new Error('No DFU interfaces found. Make sure the board is in DFU mode (double-tap RESET).')
    }

    // Connect to first DFU interface
    await dfu.connect(0)

    // Fetch firmware binary
    const firmwareUrl = `${FIRMWARE_BASE}/conduyt-uno-r4-minima.bin`
    const resp = await fetch(firmwareUrl)
    if (!resp.ok) {
      throw new Error(`Firmware binary not found at ${firmwareUrl}`)
    }
    const firmwareData = await resp.arrayBuffer()

    // Write firmware
    const process = dfu.write(
      dfu.properties?.TransferSize || 1024,
      new DataView(firmwareData),
      true,
    )

    process.events.on('progress', (progress: number) => {
      flashProgress.value = Math.round(progress)
    })

    await process

    flashSuccess.value = true
  } catch (e: any) {
    if (e.name === 'NotFoundError') {
      flashError.value = 'No DFU device found. Double-tap RESET on your Uno R4 to enter DFU mode, then try again.'
    } else {
      flashError.value = e.message || 'Flash failed'
    }
  } finally {
    flashing.value = false
  }
}

async function flashArduino() {
  flashing.value = true
  flashError.value = ''
  flashSuccess.value = false
  try {
    flashError.value = 'Arduino Uno R3 flashing coming soon — firmware binary not yet available.'
  } catch (e: any) {
    flashError.value = e.message || 'Flash failed'
  } finally {
    flashing.value = false
  }
}

async function flashPico() {
  flashing.value = true
  flashError.value = ''
  flashSuccess.value = false
  try {
    flashError.value = 'Pico flashing coming soon — firmware binary not yet available.'
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
  max-width: 640px;
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
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
  margin-bottom: 24px;
}

.board-option {
  padding: 12px;
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
  font-size: 14px;
  color: var(--text-bright);
}

.board-chip {
  display: block;
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 2px;
}

.flash-action {
  margin-bottom: 16px;
}

.flash-btn {
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
}
.flash-btn:hover { opacity: 0.9; }
.flash-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.flash-note {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.5;
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
  color: var(--yellow);
  font-size: 13px;
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
  .board-options { grid-template-columns: 1fr; }
}
</style>
