<template>
  <div class="console-panel">
    <div class="console-header">
      <span class="console-title">Console</span>
      <button class="console-clear" @click="$emit('clear')" title="Clear">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
    <div ref="scrollRef" class="console-output">
      <div v-for="(line, i) in lines" :key="i" class="console-line" :class="lineClass(line)">
        <span class="console-prefix">{{ linePrefix(line) }}</span>
        <span class="console-text">{{ line.text }}</span>
      </div>
      <div v-if="lines.length === 0" class="console-empty">
        Output will appear here when you run your code.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface ConsoleLine {
  text: string
  type: 'log' | 'error' | 'system'
  time: number
}

const props = defineProps<{ lines: ConsoleLine[] }>()
defineEmits<{ clear: [] }>()

const scrollRef = ref<HTMLElement | null>(null)

function lineClass(line: ConsoleLine) {
  return `console-${line.type}`
}

function linePrefix(line: ConsoleLine) {
  if (line.type === 'error') return '!'
  if (line.type === 'system') return '#'
  return '>'
}

watch(() => props.lines.length, () => {
  nextTick(() => {
    if (scrollRef.value) {
      scrollRef.value.scrollTop = scrollRef.value.scrollHeight
    }
  })
})
</script>

<style scoped>
.console-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--pre-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.console-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.console-title {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-dim);
}

.console-clear {
  display: flex;
  align-items: center;
  background: none;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
}
.console-clear:hover { color: var(--text-bright); background: var(--hover-bg); }

.console-output {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.6;
}

.console-line {
  display: flex;
  gap: 8px;
  white-space: pre-wrap;
  word-break: break-all;
}

.console-prefix {
  color: var(--text-dim);
  user-select: none;
  flex-shrink: 0;
}

.console-text { color: var(--text); }
.console-error .console-text { color: var(--red); }
.console-error .console-prefix { color: var(--red); }
.console-system .console-text { color: var(--text-dim); font-style: italic; }

.console-empty {
  color: var(--text-dim);
  font-style: italic;
  padding: 12px 0;
}
</style>
