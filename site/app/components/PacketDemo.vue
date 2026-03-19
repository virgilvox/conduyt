<template>
  <div class="demo">
    <!-- Command picker -->
    <div class="demo-commands">
      <button
        v-for="cmd in commands"
        :key="cmd.name"
        :class="['demo-cmd', { active: activeCmd === cmd.name }]"
        @click="runCommand(cmd)"
      >
        <span class="cmd-icon">{{ cmd.icon }}</span>
        {{ cmd.label }}
      </button>
    </div>

    <!-- Visualization -->
    <div class="demo-viz">
      <!-- Host side -->
      <div class="demo-node demo-host">
        <div class="node-label">HOST</div>
        <div class="node-code">
          <transition name="fade" mode="out-in">
            <code :key="hostCode">{{ hostCode }}</code>
          </transition>
        </div>
      </div>

      <!-- Wire -->
      <div class="demo-wire">
        <div class="wire-line">
          <div class="wire-track" />
          <!-- Command packet going right -->
          <transition name="packet-right">
            <div v-if="phase === 'sending'" class="wire-packet wire-packet-right">
              <span class="packet-bytes">{{ cmdBytes }}</span>
            </div>
          </transition>
          <!-- Response packet going left -->
          <transition name="packet-left">
            <div v-if="phase === 'responding'" class="wire-packet wire-packet-left">
              <span class="packet-bytes">{{ respBytes }}</span>
            </div>
          </transition>
        </div>
        <div class="wire-label">
          <transition name="fade" mode="out-in">
            <span :key="wireLabel">{{ wireLabel }}</span>
          </transition>
        </div>
      </div>

      <!-- Device side -->
      <div class="demo-node demo-device">
        <div class="node-label">DEVICE</div>
        <div class="node-board">
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <!-- Board outline -->
            <rect x="4" y="8" width="48" height="40" rx="3" stroke="var(--border-bright)" stroke-width="1.5" fill="var(--card)" />
            <!-- Chip -->
            <rect x="18" y="20" width="20" height="16" rx="2" fill="var(--border-bright)" />
            <text x="28" y="30" text-anchor="middle" fill="var(--text-dim)" font-size="6" font-family="var(--mono)">MCU</text>
            <!-- LED -->
            <circle cx="44" cy="14" r="4" :fill="ledOn ? '#00ff88' : 'var(--border)'" :class="{ 'led-glow': ledOn }" />
            <!-- Pins -->
            <rect v-for="i in 8" :key="'pin-t-'+i" :x="8 + i * 5" y="5" width="2" height="4" fill="var(--border-bright)" />
            <rect v-for="i in 8" :key="'pin-b-'+i" :x="8 + i * 5" y="47" width="2" height="4" fill="var(--border-bright)" />
          </svg>
        </div>
        <div class="node-status">
          <transition name="fade" mode="out-in">
            <span :key="deviceStatus" :class="['status-text', { 'status-active': phase !== 'idle' }]">{{ deviceStatus }}</span>
          </transition>
        </div>
      </div>
    </div>

    <!-- Packet breakdown -->
    <transition name="slide-up">
      <div v-if="phase === 'done'" class="demo-breakdown">
        <div class="breakdown-row">
          <span v-for="(byte, i) in activePacketBytes" :key="i" :class="['byte', byteClass(i)]">
            {{ byte }}
          </span>
        </div>
        <div class="breakdown-labels">
          <span class="bl bl-magic">MAGIC</span>
          <span class="bl bl-ver">VER</span>
          <span class="bl bl-type">TYPE</span>
          <span class="bl bl-seq">SEQ</span>
          <span class="bl bl-len">LEN</span>
          <span class="bl bl-crc">CRC</span>
          <span class="bl bl-payload">PAYLOAD</span>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
const phase = ref<'idle' | 'sending' | 'responding' | 'done'>('idle')
const activeCmd = ref('blink')
const hostCode = ref('await device.pin(13).write(1)')
const cmdBytes = ref('43 44 01 11 00 02 0D 01')
const respBytes = ref('43 44 01 82 00 00')
const wireLabel = ref('serial @ 115200')
const deviceStatus = ref('Ready')
const ledOn = ref(false)
const activePacketBytes = ref<string[]>([])

const commands = [
  {
    name: 'blink',
    label: 'Blink LED',
    icon: '/',
    host: 'await device.pin(13).write(1)',
    cmd: '43 44 01 11 00 02 0D 01',
    resp: '43 44 01 82 00 00',
    status: 'Pin 13 HIGH',
    led: true,
    packet: ['43', '44', '01', '11', '00', '02', '00', '0D', '01'],
  },
  {
    name: 'read',
    label: 'Read Sensor',
    icon: '~',
    host: 'await device.pin(0).read("analog")',
    cmd: '43 44 01 12 01 02 00 03',
    resp: '43 44 01 91 00 03 00 01 A4',
    status: 'A0 = 420',
    led: false,
    packet: ['43', '44', '01', '12', '01', '02', '00', '00', '03'],
  },
  {
    name: 'servo',
    label: 'Move Servo',
    icon: '>',
    host: 'await servo.write(90)',
    cmd: '43 44 01 40 02 03 00 01 5A',
    resp: '43 44 01 82 02 00',
    status: 'Servo 90deg',
    led: false,
    packet: ['43', '44', '01', '40', '02', '03', '00', '00', '01', '5A'],
  },
]

function byteClass(i: number) {
  if (i < 2) return 'byte-magic'
  if (i === 2) return 'byte-ver'
  if (i === 3) return 'byte-type'
  if (i === 4) return 'byte-seq'
  if (i === 5 || i === 6) return 'byte-len'
  if (i === 7) return 'byte-crc'
  return 'byte-payload'
}

async function runCommand(cmd: typeof commands[0]) {
  if (phase.value !== 'idle' && phase.value !== 'done') return
  activeCmd.value = cmd.name
  hostCode.value = cmd.host
  cmdBytes.value = cmd.cmd
  respBytes.value = cmd.resp
  activePacketBytes.value = cmd.packet

  phase.value = 'sending'
  wireLabel.value = `CMD 0x${cmd.packet[3]}`
  deviceStatus.value = 'Processing...'

  await sleep(800)
  ledOn.value = cmd.led
  deviceStatus.value = cmd.status
  phase.value = 'responding'
  wireLabel.value = 'ACK'

  await sleep(600)
  phase.value = 'done'
  wireLabel.value = 'Packet breakdown'
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

onMounted(() => {
  setTimeout(() => runCommand(commands[0]), 600)
})
</script>

<style scoped>
.demo {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  overflow: hidden;
}

.demo-commands {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
}

.demo-cmd {
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 500;
  padding: 6px 14px;
  background: var(--bg);
  color: var(--text-dim);
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.demo-cmd:hover { color: var(--text); border-color: var(--border-bright); }
.demo-cmd.active { color: var(--accent); border-color: var(--accent); background: var(--accent-dim); }
.cmd-icon { opacity: 0.5; }

.demo-viz {
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 16px;
}

.demo-node {
  flex-shrink: 0;
  text-align: center;
  width: 140px;
}

.node-label {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 2px;
  color: var(--text-dim);
  margin-bottom: 8px;
}

.node-code {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--accent);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 10px;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  word-break: break-all;
}

.node-board {
  display: flex;
  justify-content: center;
  margin-bottom: 4px;
}

.node-status {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-dim);
  min-height: 18px;
}

.status-active { color: var(--accent); }

.led-glow {
  filter: drop-shadow(0 0 6px #00ff88);
}

.demo-wire {
  flex: 1;
  position: relative;
  padding: 0 12px;
  min-width: 120px;
}

.wire-line {
  position: relative;
  height: 40px;
  display: flex;
  align-items: center;
}

.wire-track {
  position: absolute;
  left: 0; right: 0;
  top: 50%;
  height: 1px;
  background: var(--border-bright);
}

.wire-track::before,
.wire-track::after {
  content: '';
  position: absolute;
  top: -3px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--border-bright);
}
.wire-track::before { left: -3px; }
.wire-track::after { right: -3px; }

.wire-packet {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: var(--accent-dim);
  border: 1px solid var(--accent);
  border-radius: 4px;
  padding: 2px 8px;
  white-space: nowrap;
}

.packet-bytes {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--accent);
  letter-spacing: 1px;
}

.wire-label {
  text-align: center;
  font-family: var(--mono);
  font-size: 10px;
  color: var(--text-dim);
  margin-top: 4px;
  min-height: 16px;
}

/* Animations */
.packet-right-enter-active {
  animation: slide-right 0.7s ease-out;
}
.packet-right-leave-active {
  animation: fade-out 0.2s ease-out;
}

.packet-left-enter-active {
  animation: slide-left 0.5s ease-out;
}
.packet-left-leave-active {
  animation: fade-out 0.2s ease-out;
}

@keyframes slide-right {
  from { left: 0; opacity: 0; }
  10% { opacity: 1; }
  to { left: calc(100% - 160px); opacity: 1; }
}

@keyframes slide-left {
  from { right: 0; opacity: 0; }
  10% { opacity: 1; }
  to { right: calc(100% - 120px); opacity: 1; }
}

@keyframes fade-out {
  to { opacity: 0; }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-up-enter-active { transition: all 0.3s ease-out; }
.slide-up-enter-from { opacity: 0; transform: translateY(8px); }

/* Breakdown */
.demo-breakdown {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px 16px 10px;
}

.breakdown-row {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.byte {
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 600;
  padding: 3px 7px;
  border-radius: 3px;
  border: 1px solid var(--border);
}

.byte-magic { color: var(--accent); background: var(--accent-dim); border-color: var(--accent); }
.byte-ver { color: var(--text-bright); }
.byte-type { color: var(--orange); background: var(--orange-dim); border-color: var(--orange); }
.byte-seq { color: var(--purple); }
.byte-len { color: var(--text); }
.byte-crc { color: var(--yellow); background: var(--yellow-dim); border-color: var(--yellow); }
.byte-payload { color: var(--purple); background: rgba(139,124,244,0.08); border-color: rgba(139,124,244,0.3); }

.breakdown-labels {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.bl {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.5px;
  padding: 1px 6px;
  border-radius: 2px;
}

.bl-magic { color: var(--accent); }
.bl-ver { color: var(--text-dim); }
.bl-type { color: var(--orange); }
.bl-seq { color: var(--purple); }
.bl-len { color: var(--text-dim); }
.bl-crc { color: var(--yellow); }
.bl-payload { color: var(--purple); }

@media (max-width: 700px) {
  .demo-viz { flex-direction: column; gap: 16px; }
  .demo-node { width: 100%; }
  .demo-wire { min-height: 60px; width: 100%; }
  .wire-line { height: 50px; }
}
</style>
