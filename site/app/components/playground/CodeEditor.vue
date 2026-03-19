<template>
  <div class="editor-wrapper">
    <ClientOnly>
      <VueMonacoEditor
        v-model:value="code"
        :language="'javascript'"
        :theme="editorTheme"
        :options="editorOptions"
        @mount="onEditorMount"
      />
      <template #fallback>
        <div class="editor-fallback">
          <textarea
            v-model="code"
            class="editor-textarea"
            spellcheck="false"
          />
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { VueMonacoEditor } from '@guolao/vue-monaco-editor'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const code = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const colorMode = useColorMode()
const editorTheme = computed(() => colorMode.value === 'light' ? 'vs' : 'vs-dark')

const editorOptions = {
  minimap: { enabled: false },
  fontSize: 13,
  fontFamily: "'IBM Plex Mono', 'Menlo', monospace",
  lineHeight: 22,
  padding: { top: 12 },
  scrollBeyondLastLine: false,
  wordWrap: 'on' as const,
  tabSize: 2,
  renderLineHighlight: 'none' as const,
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
}

// conduyt-wasm type definitions for intellisense
const conduytDts = `
declare function log(...args: any[]): void;
declare function sleep(ms: number): Promise<void>;

declare const conduyt: {
  crc8(data: Uint8Array): number;
  cobsEncode(data: Uint8Array): Uint8Array;
  cobsDecode(data: Uint8Array): Uint8Array | null;
  wireEncode(packet: ConduytPacket): Uint8Array;
  wireDecode(data: Uint8Array): ConduytPacket;
  makePacket(type: number, seq: number, payload?: Uint8Array): ConduytPacket;
  wirePacketSize(payloadLen: number): number;
  wireFindPacket(buf: Uint8Array): [ConduytPacket, number] | null;
  errName(code: number): string;
  getCMD(): Record<string, number>;
  getEVT(): Record<string, number>;
  getERR(): Record<string, number>;
  PROTOCOL_VERSION(): number;
  HEADER_SIZE(): number;
};

interface ConduytPacket {
  version: number;
  type: number;
  seq: number;
  payload: Uint8Array;
}

declare const device: {
  connected: boolean;
  capabilities: {
    firmwareName: string;
    firmwareVersion: [number, number, number];
    pinCount: number;
    raw: Uint8Array;
  } | null;
  connect(timeoutMs?: number): Promise<any>;
  ping(): Promise<void>;
  reset(): Promise<void>;
  close(): Promise<void>;
  pin(num: number): {
    mode(m: 'input' | 'output' | 'pwm' | 'analog' | 'input_pullup'): Promise<void>;
    write(value: number): Promise<void>;
    read(): Promise<number>;
  };
  onEvent(handler: (pkt: ConduytPacket) => void): () => void;
};

declare const serial: {
  connected: { value: boolean };
  sendPacket(type: number, seq: number, payload?: Uint8Array): Promise<void>;
  sendRaw(data: Uint8Array): Promise<void>;
  onPacket(handler: (pkt: ConduytPacket) => void): () => void;
};
`

function onEditorMount(editor: any, monaco: any) {
  // Add conduyt type definitions for intellisense
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: false,
  })

  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
  })

  monaco.languages.typescript.javascriptDefaults.addExtraLib(
    conduytDts,
    'file:///conduyt-playground.d.ts',
  )
}
</script>

<style scoped>
.editor-wrapper {
  width: 100%;
  height: 100%;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.editor-fallback {
  width: 100%;
  height: 100%;
}

.editor-textarea {
  width: 100%;
  height: 100%;
  background: var(--pre-bg);
  color: var(--text);
  border: none;
  padding: 12px;
  font-family: var(--mono);
  font-size: 13px;
  line-height: 22px;
  resize: none;
  outline: none;
}
</style>
