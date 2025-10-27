<template>
  <div class="app">
    <header class="header">
      <h1>脚本执行与文件检索工具</h1>
      <p>支持快速搜索 SQL / XML 文件并批量执行 SQL、PCK 脚本</p>
    </header>
    <div class="workspace">
      <aside class="sidebar">
        <button
          type="button"
          class="sidebar__item"
          :class="{ 'sidebar__item--active': activeView === 'search' }"
          @click="activeView = 'search'"
        >
          文件内容检索
        </button>
        <button
          type="button"
          class="sidebar__item"
          :class="{ 'sidebar__item--active': activeView === 'execute' }"
          @click="activeView = 'execute'"
        >
          脚本执行
        </button>
      </aside>
      <main class="content">
        <section v-if="activeView === 'search'" class="panel">
          <FileSearchSection />
        </section>
        <section v-else class="panel">
          <ScriptExecutorSection />
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import FileSearchSection from './components/FileSearchSection.vue';
import ScriptExecutorSection from './components/ScriptExecutorSection.vue';

const activeView = ref<'search' | 'execute'>('search');
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
  flex: 1;
  display: flex;
  padding: 24px 32px 48px;
  flex-direction: column;
}

.workspace {
  display: flex;
  flex: 1;
  gap: 24px;
}

.sidebar {
  width: 220px;
  padding: 24px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sidebar__item {
  margin: 0 16px;
  padding: 12px 16px;
  border-radius: 12px;
  border: none;
  background: transparent;
  color: #1f2937;
  text-align: left;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.sidebar__item:hover {
  background-color: rgba(37, 99, 235, 0.08);
  color: #1d4ed8;
}

.sidebar__item--active {
  background-color: #1f6feb;
  color: #ffffff;
  box-shadow: 0 10px 18px rgba(31, 111, 235, 0.25);
}

.panel {
  background-color: #ffffff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.12);
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

@media (max-width: 768px) {
  .workspace {
    flex-direction: column;
  }

  .sidebar {
    flex-direction: row;
    width: 100%;
    padding: 16px;
    gap: 16px;
    overflow-x: auto;
  }

  .sidebar__item {
    flex: 1;
    margin: 0;
    text-align: center;
  }

  .content {
    padding: 16px;
  }

  .panel {
    padding: 16px;
  }
}
</style>
