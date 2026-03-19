<template>
  <div class="layout-root">
    <SiteHeader />
    <div class="layout-content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.layout-root {
  min-height: 100vh;
}
.layout-content {
  padding-top: 56px;
}
</style>
