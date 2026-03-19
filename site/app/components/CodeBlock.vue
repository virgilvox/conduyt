<template>
  <div class="code-block" v-if="html" v-html="html" />
  <pre v-else><code>{{ code }}</code></pre>
</template>

<script setup lang="ts">
import { codeToHtml } from 'shiki'

const props = defineProps<{ code: string; lang: string }>()

const codeHash = computed(() => {
  let h = 0
  for (let i = 0; i < props.code.length; i++) {
    h = ((h << 5) - h + props.code.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(36)
})

const { data: html } = await useAsyncData(
  `code-${props.lang}-${codeHash.value}`,
  () => codeToHtml(props.code, {
    lang: props.lang,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  })
)
</script>

<style scoped>
.code-block :deep(pre) {
  background: var(--pre-bg) !important;
  border: none;
  margin: 0;
  padding: 20px 24px;
  font-family: var(--mono);
  font-size: 13px;
  line-height: 1.7;
  overflow-x: auto;
  border-radius: 0;
}

.code-block :deep(code) {
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
  font-size: inherit;
  color: inherit;
}

.code-block :deep(.shiki) {
  background: transparent !important;
}
</style>
