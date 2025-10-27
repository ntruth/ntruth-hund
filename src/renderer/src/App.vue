<template>
  <div class="app">
    <header class="header">
      <h1>脚本执行与文件检索工具</h1>
      <p>支持快速搜索 SQL / XML 文件并批量执行 SQL、PCK 脚本</p>
    </header>
    <main class="content">
      <section class="panel">
        <FileSearchSection />
      </section>
      <section class="panel">
        <ScriptExecutorSection />
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import FileSearchSection from './components/FileSearchSection.vue';
import ScriptExecutorSection from './components/ScriptExecutorSection.vue';
</script>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: linear-gradient(180deg, #f9fafb 0%, #e5e7eb 100%);
}

.header {
  padding: 24px 32px 16px;
  background-color: #1f6feb;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(31, 111, 235, 0.35);
}

.header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.header p {
  margin: 8px 0 0;
  font-size: 14px;
  opacity: 0.9;
}

.content {
  display: grid;
  gap: 24px;
  padding: 24px 32px 48px;
  grid-template-columns: repeat(auto-fit, minmax(480px, 1fr));
  flex: 1;
}

.panel {
  background-color: #ffffff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.12);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

@media (max-width: 768px) {
  .content {
    padding: 16px;
    grid-template-columns: 1fr;
  }

  .panel {
    padding: 16px;
  }
}
</style>
