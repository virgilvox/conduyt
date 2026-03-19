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

        <div v-else-if="selectedBoard === 'uno'" class="avr-flash">
          <button class="flash-btn" @click="flashArduino" :disabled="flashing">
            {{ flashing ? 'Flashing...' : 'Flash Arduino Uno' }}
          </button>
          <p class="flash-note">
            Arduino flashing uses WebSerial (alpha support).
            The board may need to be in bootloader mode.
          </p>
        </div>

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

const manifestUrl = '/firmware/manifest.json'

const boards = [
  { id: 'esp32', name: 'ESP32', chip: 'Xtensa LX6' },
  { id: 'uno', name: 'Arduino Uno', chip: 'ATmega328P' },
  { id: 'pico', name: 'Raspberry Pi Pico', chip: 'RP2040' },
]

async function flashArduino() {
  flashing.value = true
  flashError.value = ''
  flashSuccess.value = false
  try {
    // avrgirl-arduino integration placeholder
    // const Avrgirl = (await import('avrgirl-arduino')).default
    flashError.value = 'Arduino flashing coming soon — firmware binary not yet available.'
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
    // picoflash integration placeholder
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
  max-width: 600px;
  margin: 0 auto;
  overflow-y: auto;
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
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
}

.board-option {
  flex: 1;
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
  .board-options { flex-direction: column; }
}
</style>
