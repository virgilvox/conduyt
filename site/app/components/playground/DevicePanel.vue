<template>
  <div class="device-panel">
    <div class="device-header">
      <span class="device-title">Device</span>
      <span class="device-status" :class="{ connected: serial.connected.value }">
        {{ serial.connected.value ? 'Connected' : 'Disconnected' }}
      </span>
    </div>
    <div class="device-body">
      <div v-if="serial.connected.value" class="device-info">
        <div class="info-row">
          <span class="info-label">Port</span>
          <span class="info-value">{{ serial.portInfo.value }}</span>
        </div>
        <div v-if="capabilities" class="info-row">
          <span class="info-label">Firmware</span>
          <span class="info-value">{{ capabilities.firmwareName }}</span>
        </div>
        <div v-if="capabilities" class="info-row">
          <span class="info-label">Version</span>
          <span class="info-value">{{ capabilities.firmwareVersion.join('.') }}</span>
        </div>
        <div v-if="capabilities" class="info-row">
          <span class="info-label">Pins</span>
          <span class="info-value">{{ capabilities.pinCount }}</span>
        </div>
      </div>
      <div v-else class="device-empty">
        <p>No device connected.</p>
        <p class="device-hint">Click <strong>Connect</strong> to select a serial port.</p>
      </div>
      <div v-if="serial.error.value" class="device-error">
        {{ serial.error.value }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { HelloResp } from '~/lib/conduyt-device'

defineProps<{
  serial: ReturnType<typeof import('../../composables/useSerial').useSerial>
  capabilities: HelloResp | null
}>()
</script>

<style scoped>
.device-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.device-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
}

.device-title {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-dim);
}

.device-status {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--red);
}
.device-status.connected { color: var(--accent); }

.device-body {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
}

.device-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  font-family: var(--mono);
  font-size: 12px;
}

.info-label { color: var(--text-dim); }
.info-value { color: var(--text-bright); }

.device-empty {
  color: var(--text-dim);
  font-size: 13px;
  line-height: 1.6;
}

.device-hint {
  margin-top: 4px;
  font-size: 12px;
}

.device-error {
  margin-top: 8px;
  padding: 8px;
  background: rgba(224, 93, 112, 0.1);
  border: 1px solid rgba(224, 93, 112, 0.3);
  border-radius: 4px;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--red);
}
</style>
