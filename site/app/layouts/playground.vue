<template>
  <div class="playground-layout">
    <SiteHeader />
    <div class="playground-content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.playground-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.playground-content {
  flex: 1;
  padding-top: 56px;
  overflow: hidden;
}
</style>
