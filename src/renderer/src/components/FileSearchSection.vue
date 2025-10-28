<template>
  <div class="section">
    <div class="section__header">
      <div>
        <h2>文件内容检索</h2>
        <p>输入目录与关键字，快速定位 SQL / XML 文件</p>
      </div>
      <button class="button" type="button" @click="triggerDirectoryDialog">
        选择目录
      </button>
    </div>

    <form class="form" @submit.prevent="handleSearch">
      <label class="form__field">
        <span>文件夹路径</span>
        <input v-model="directory" placeholder="例如：E:\\Software" required />
      </label>
      <label class="form__field">
        <span>关键字</span>
        <input v-model="keyword" placeholder="请输入要查找的关键字" required />
      </label>
      <button class="button button--primary" type="submit" :disabled="isSearching">
        {{ isSearching ? '搜索中...' : '开始搜索' }}
      </button>
    </form>

    <p v-if="searchError" class="alert alert--error">{{ searchError }}</p>

    <div class="results" v-if="results.length > 0">
      <div class="results__header">
        <h3>共找到 {{ results.length }} 个匹配文件</h3>
        <small>右键文件可打开所在目录或直接打开文件</small>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th style="width: 40%">文件名</th>
            <th>完整路径</th>
            <th style="width: 120px">匹配次数</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in results"
            :key="item.path"
            @contextmenu.prevent="showContextMenu($event, item)"
            @dblclick="openFile(item.path)"
          >
            <td>{{ item.name }}</td>
            <td class="path">{{ item.path }}</td>
            <td class="count">{{ item.matches }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="empty" v-else-if="!searchError">暂无结果，输入路径与关键字后点击“开始搜索”。</p>

    <div
      v-if="contextMenu.visible"
      class="context-menu"
      :style="{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }"
      @click.self="hideContextMenu"
    >
      <button type="button" @click="openFile(contextMenu.item?.path)">打开文件</button>
      <button type="button" @click="revealFile(contextMenu.item?.path)">打开所在目录</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue';

type SearchResult = {
  path: string;
  name: string;
  matches: number;
};

const directory = ref('');
const keyword = ref('');
const isSearching = ref(false);
const results = ref<SearchResult[]>([]);
const searchError = ref<string | null>(null);
const contextMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  item: null as SearchResult | null
});

function resetContextMenu() {
  contextMenu.visible = false;
  contextMenu.item = null;
}

async function triggerDirectoryDialog() {
  const selected = await window.api.selectDirectory();
  if (selected) {
    directory.value = selected;
  }
}

async function handleSearch() {
  const trimmedDirectory = directory.value.trim();
  const trimmedKeyword = keyword.value.trim();

  if (!trimmedDirectory || !trimmedKeyword) {
    searchError.value = '请输入有效的目录与关键字后再试。';
    return;
  }

  isSearching.value = true;
  searchError.value = null;
  try {
    const response = await window.api.searchFiles({
      directory: trimmedDirectory,
      keyword: trimmedKeyword
    });
    results.value = Array.isArray(response) ? [...response] : [];
  } catch (error: any) {
    console.error('Failed to search files:', error);
    searchError.value = error?.message || '搜索过程中出现错误，请稍后重试。';
    results.value = [];
  } finally {
    isSearching.value = false;
    resetContextMenu();
  }
}

function showContextMenu(event: MouseEvent, item: SearchResult) {
  event.preventDefault();
  contextMenu.visible = true;
  contextMenu.x = event.clientX;
  contextMenu.y = event.clientY;
  contextMenu.item = item;
}

function hideContextMenu() {
  resetContextMenu();
}

async function openFile(filePath?: string | null) {
  if (!filePath) return;
  await window.api.openFile(filePath);
  hideContextMenu();
}

async function revealFile(filePath?: string | null) {
  if (!filePath) return;
  await window.api.revealFile(filePath);
  hideContextMenu();
}

function handleGlobalClick() {
  if (contextMenu.visible) {
    hideContextMenu();
  }
}

onMounted(() => {
  document.addEventListener('click', handleGlobalClick);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleGlobalClick);
});

watch([directory, keyword], () => {
  if (searchError.value) {
    searchError.value = null;
  }
});
</script>

<style scoped>
.section {
  display: flex;
  flex-direction: column;
  gap: 18px;
  position: relative;
}

.section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.section__header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #0f172a;
}

.section__header p {
  margin: 4px 0 0;
  color: #4b5563;
  font-size: 14px;
}

.form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  align-items: end;
}

.form__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  color: #1f2937;
}

.form__field input {
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.form__field input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.25);
}

.alert {
  margin: 0;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 13px;
}

.alert--error {
  background-color: rgba(220, 38, 38, 0.12);
  color: #b91c1c;
  border: 1px solid rgba(220, 38, 38, 0.3);
}

.button {
  padding: 10px 16px;
  border-radius: 8px;
  border: none;
  background-color: #e5e7eb;
  color: #1f2937;
  font-weight: 500;
  transition: background-color 0.2s ease, transform 0.1s ease;
}

.button:hover {
  background-color: #d1d5db;
}

.button:active {
  transform: translateY(1px);
}

.button--primary {
  background-color: #2563eb;
  color: #ffffff;
}

.button--primary:hover {
  background-color: #1d4ed8;
}

.results {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
}

.results__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: #f1f5f9;
  color: #0f172a;
}

.results__header small {
  color: #64748b;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  padding: 10px 14px;
  border-top: 1px solid #e5e7eb;
  text-align: left;
  font-size: 14px;
}

.table tbody tr:hover {
  background-color: #f8fafc;
}

.path {
  font-family: 'Cascadia Code', 'Consolas', monospace;
  color: #1f2937;
  word-break: break-all;
}

.count {
  text-align: center;
  font-weight: 600;
  color: #2563eb;
}

.empty {
  margin: 0;
  color: #9ca3af;
  text-align: center;
  font-size: 14px;
}

.context-menu {
  position: fixed;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.18);
  z-index: 10;
  overflow: hidden;
}

.context-menu button {
  padding: 10px 14px;
  border: none;
  background: transparent;
  text-align: left;
}

.context-menu button:hover {
  background-color: #f3f4f6;
}
</style>
