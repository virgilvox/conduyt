<template>
  <div class="toolbar">
    <div class="toolbar-left">
      <button class="tb-btn tb-run" :disabled="running || !serialConnected" @click="$emit('run')" title="Run code">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
        <span>Run</span>
      </button>
      <button class="tb-btn tb-stop" :disabled="!running" @click="$emit('stop')" title="Stop execution">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
        <span>Stop</span>
      </button>
      <div class="tb-sep" />
      <button class="tb-btn" :class="{ active: activePanel === 'flash' }" @click="$emit('panel', 'flash')" title="Flash firmware">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13,2 3,14 12,14 11,22 21,10 12,10" />
        </svg>
        <span>Flash</span>
      </button>
      <button
        class="tb-btn"
        @click="$emit('connect')"
        :title="serialConnected ? 'Disconnect' : 'Connect serial port'"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M12 2v6m0 8v6M6 8h12a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4a2 2 0 012-2z" />
        </svg>
        <span>{{ serialConnected ? 'Disconnect' : 'Connect' }}</span>
      </button>
    </div>
    <div class="toolbar-right">
      <select class="tb-examples" @change="onExampleChange($event)" title="Load example">
        <option value="" disabled selected>Examples</option>
        <option v-for="ex in examples" :key="ex.name" :value="ex.name">{{ ex.name }}</option>
      </select>
      <span v-if="serialConnected" class="tb-status connected">Connected</span>
      <span v-else class="tb-status">No device</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { examples } from '~/lib/playground-examples'

defineProps<{
  running: boolean
  serialConnected: boolean
  activePanel: string
}>()

const emit = defineEmits<{
  run: []
  stop: []
  connect: []
  panel: [panel: string]
  example: [name: string]
}>()

function onExampleChange(e: Event) {
  const name = (e.target as HTMLSelectElement).value
  if (name) {
    emit('example', name)
    ;(e.target as HTMLSelectElement).selectedIndex = 0
  }
}
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 12px;
  background: var(--surface);
  border-top: 1px solid var(--border);
  gap: 8px;
}

.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tb-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border: 1px solid var(--border-bright);
  border-radius: 4px;
  background: transparent;
  color: var(--text);
  font-family: var(--mono);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.tb-btn:hover:not(:disabled) { color: var(--text-bright); border-color: var(--accent); }
.tb-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.tb-btn.active { border-color: var(--accent); color: var(--accent); }

.tb-run:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.tb-stop:hover:not(:disabled) { border-color: var(--red); color: var(--red); }

.tb-sep {
  width: 1px;
  height: 20px;
  background: var(--border);
  margin: 0 4px;
}

.tb-examples {
  padding: 5px 8px;
  border: 1px solid var(--border-bright);
  border-radius: 4px;
  background: var(--surface);
  color: var(--text);
  font-family: var(--mono);
  font-size: 12px;
  cursor: pointer;
}

.tb-status {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-dim);
}
.tb-status.connected { color: var(--accent); }

@media (max-width: 700px) {
  .tb-btn span { display: none; }
  .toolbar-right .tb-status { display: none; }
}
</style>
