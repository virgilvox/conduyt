<template>
  <div class="playground">
    <div class="playground-panels">
      <!-- Editor -->
      <div class="panel-editor">
        <CodeEditor v-model="code" />
      </div>

      <!-- Right side: Console + Device -->
      <div class="panel-right">
        <div class="panel-console">
          <ConsolePanel :lines="consoleLines" @clear="consoleLines = []" />
        </div>
        <div class="panel-device">
          <DevicePanel :serial="serial" :capabilities="deviceCapabilities" />
        </div>
      </div>
    </div>

    <!-- Toolbar -->
    <Toolbar
      :running="runner.running.value"
      :serial-connected="serial.connected.value"
      :active-panel="activePanel"
      @run="runCode"
      @stop="runner.stop()"
      @connect="toggleConnect"
      @panel="togglePanel"
      @example="loadExample"
    />

    <!-- Flash overlay -->
    <FlashPanel v-if="activePanel === 'flash'" @close="activePanel = ''" />

    <!-- Mobile tabs (visible on small screens) -->
    <div class="mobile-tabs">
      <button :class="{ active: mobileTab === 'editor' }" @click="mobileTab = 'editor'">Editor</button>
      <button :class="{ active: mobileTab === 'console' }" @click="mobileTab = 'console'">Console</button>
      <button :class="{ active: mobileTab === 'device' }" @click="mobileTab = 'device'">Device</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import CodeEditor from '~/components/playground/CodeEditor.vue'
import ConsolePanel from '~/components/playground/ConsolePanel.vue'
import DevicePanel from '~/components/playground/DevicePanel.vue'
import FlashPanel from '~/components/playground/FlashPanel.vue'
import Toolbar from '~/components/playground/Toolbar.vue'
import type { ConsoleLine } from '~/components/playground/ConsolePanel.vue'
import type { HelloResp } from '~/lib/conduyt-device'
import { examples } from '~/lib/playground-examples'
import { useSerial } from '~/composables/useSerial'
import { useRunner } from '~/composables/useRunner'

definePageMeta({ layout: 'playground' })

useHead({ title: 'Playground - CONDUYT' })

const serial = useSerial()
const runner = useRunner()

const activePanel = ref('')
const mobileTab = ref('editor')
const deviceCapabilities = ref<HelloResp | null>(null)

// Code state - persist to localStorage
const STORAGE_KEY = 'conduyt-playground-code'
const defaultCode = examples[0].code

const code = ref(defaultCode)

onMounted(() => {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) code.value = saved
})

watch(code, (v) => {
  localStorage.setItem(STORAGE_KEY, v)
})

// Console
const consoleLines = ref<ConsoleLine[]>([])

function log(...args: any[]) {
  const text = args.map(a => {
    if (typeof a === 'object') {
      try { return JSON.stringify(a) } catch { return String(a) }
    }
    return String(a)
  }).join(' ')

  const type = text.startsWith('[error]') ? 'error' as const
    : text.startsWith('[runner]') ? 'system' as const
    : 'log' as const

  consoleLines.value.push({ text, type, time: Date.now() })
}

// Actions
async function toggleConnect() {
  if (serial.connected.value) {
    await serial.disconnect()
    deviceCapabilities.value = null
    log('[runner] Disconnected')
  } else {
    const ok = await serial.requestPort()
    if (ok) log('[runner] Serial port connected')
  }
}

function togglePanel(panel: string) {
  activePanel.value = activePanel.value === panel ? '' : panel
}

async function runCode() {
  if (!serial.connected.value) {
    log('[error] Not connected - click Connect first')
    return
  }
  await runner.run(code.value, serial, log)
}

function loadExample(name: string) {
  const ex = examples.find(e => e.name === name)
  if (ex) {
    code.value = ex.code
    log(`[runner] Loaded example: ${ex.name}`)
  }
}
</script>

<style scoped>
.playground {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.playground-panels {
  flex: 1;
  display: flex;
  gap: 0;
  overflow: hidden;
}

.panel-editor {
  flex: 1;
  min-width: 0;
  padding: 8px 0 8px 8px;
}

.panel-right {
  width: 360px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 8px 8px 8px 8px;
}

.panel-console {
  flex: 1;
  min-height: 0;
}

.panel-device {
  height: 180px;
  flex-shrink: 0;
  margin-top: 8px;
}

.mobile-tabs {
  display: none;
}

@media (max-width: 800px) {
  .playground-panels {
    flex-direction: column;
  }

  .panel-editor {
    padding: 8px;
  }

  .panel-right {
    width: 100%;
    padding: 0 8px 8px;
  }

  .mobile-tabs {
    display: flex;
    border-top: 1px solid var(--border);
    background: var(--surface);
  }

  .mobile-tabs button {
    flex: 1;
    padding: 8px;
    border: none;
    background: transparent;
    color: var(--text-dim);
    font-family: var(--mono);
    font-size: 12px;
    cursor: pointer;
  }
  .mobile-tabs button.active {
    color: var(--accent);
    border-bottom: 2px solid var(--accent);
  }
}
</style>
