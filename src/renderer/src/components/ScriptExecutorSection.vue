<template>
  <div class="section">
    <div class="section__header">
      <div>
        <h2>SQL / PCK 批量执行</h2>
        <p>列出并执行指定目录中的脚本，支持自定义 Oracle 连接</p>
      </div>
      <div class="header-actions">
        <button class="button" type="button" @click="triggerDirectoryDialog">选择目录</button>
        <button class="button" type="button" @click="refreshScripts" :disabled="isLoading">
          {{ isLoading ? '查询中...' : '查询脚本' }}
        </button>
      </div>
    </div>

    <div class="form">
      <label class="form__field">
        <span>脚本目录</span>
        <input v-model="directory" placeholder="例如：E:\\Database\\scripts" required />
      </label>
    </div>

    <details class="connection" open>
      <summary>Oracle 连接配置</summary>
      <div class="connection__grid">
        <label class="form__field">
          <span>用户名</span>
          <input v-model="connection.user" placeholder="请输入数据库用户名" />
        </label>
        <label class="form__field">
          <span>密码</span>
          <input v-model="connection.password" type="password" placeholder="请输入数据库密码" />
        </label>
        <label class="form__field">
          <span>主机</span>
          <input v-model="connection.host" placeholder="例如：127.0.0.1" />
        </label>
        <label class="form__field">
          <span>端口</span>
          <input v-model.number="connection.port" type="number" min="1" placeholder="例如：1521" />
        </label>
        <label class="form__field">
          <span>服务名</span>
          <input v-model="connection.serviceName" placeholder="例如：ORCL" />
        </label>
        <label class="form__field form__field--full">
          <span>自定义连接字符串（可选）</span>
          <input
            v-model="connection.connectString"
            placeholder="例如：192.168.1.10:1521/ORCL 或完整的 Easy Connect 字符串"
          />
        </label>
      </div>
    </details>

    <div class="actions">
      <button class="button button--primary" type="button" @click="executeAll" :disabled="scripts.length === 0">
        执行全部
      </button>
      <button class="button" type="button" @click="executeSelected" :disabled="selectedScripts.length === 0">
        执行选中
      </button>
    </div>

    <div class="table-wrapper">
      <table class="table" v-if="scripts.length > 0">
        <thead>
          <tr>
            <th style="width: 48px">
              <input type="checkbox" :checked="areAllSelected" @change="toggleSelectAll" />
            </th>
            <th>文件名</th>
            <th>执行状态</th>
            <th>消息</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in scripts" :key="item.path" :class="[`status--${item.status}`]">
            <td>
              <input type="checkbox" v-model="item.selected" />
            </td>
            <td class="path" @dblclick="openFile(item.path)">{{ item.name }}</td>
            <td>
              <span class="status" :data-status="item.status">
                {{ statusText(item.status) }}
              </span>
            </td>
            <td class="message">{{ item.message }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">暂无脚本，请先选择目录后点击“查询脚本”。</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';

interface ScriptItem {
  path: string;
  name: string;
  selected: boolean;
  status: 'pending' | 'success' | 'error' | 'skipped';
  message: string;
}

const directory = ref('');
const isLoading = ref(false);
const scripts = ref<ScriptItem[]>([]);

const connection = reactive({
  user: '',
  password: '',
  host: '127.0.0.1',
  port: 1521,
  serviceName: 'ORCL',
  connectString: '',
  configOverrides: {} as Record<string, unknown>
});

const selectedScripts = computed(() => scripts.value.filter((item) => item.selected));
const areAllSelected = computed(() => scripts.value.length > 0 && selectedScripts.value.length === scripts.value.length);

function statusText(status: ScriptItem['status']) {
  switch (status) {
    case 'success':
      return '成功';
    case 'error':
      return '失败';
    case 'skipped':
      return '跳过';
    default:
      return '未执行';
  }
}

async function triggerDirectoryDialog() {
  const selected = await window.api.selectDirectory();
  if (selected) {
    directory.value = selected;
    refreshScripts();
  }
}

async function refreshScripts() {
  if (!directory.value) {
    return;
  }
  isLoading.value = true;
  try {
    const data = await window.api.listScripts(directory.value);
    scripts.value = data.map((item) => ({
      ...item,
      selected: true,
      status: 'pending',
      message: ''
    }));
  } finally {
    isLoading.value = false;
  }
}

function toggleSelectAll(event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  scripts.value.forEach((item) => {
    item.selected = checked;
  });
}

async function executeAll() {
  scripts.value.forEach((item) => {
    item.selected = true;
  });
  await runExecution(scripts.value);
}

async function executeSelected() {
  await runExecution(selectedScripts.value);
}

function buildConnectionPayload() {
  return {
    user: connection.user,
    password: connection.password,
    host: connection.host,
    port: connection.port,
    serviceName: connection.serviceName,
    connectString: connection.connectString.trim() || undefined,
    configOverrides: connection.configOverrides
  };
}

async function runExecution(items: ScriptItem[]) {
  if (items.length === 0) {
    return;
  }
  const files = items.map((item) => item.path);
  scripts.value.forEach((item) => {
    if (files.includes(item.path)) {
      item.status = 'pending';
      item.message = '';
    }
  });

  const response = await window.api.executeScripts({
    files,
    connection: buildConnectionPayload()
  });

  response.results.forEach((result) => {
    const target = scripts.value.find((item) => item.path === result.filePath);
    if (!target) return;
    target.status = result.status;
    target.message = result.message;
  });

  if (!response.success) {
    const message = response.message || '执行过程中出现错误，请检查配置。';
    if (response.results.length === 0) {
      scripts.value.forEach((item) => {
        item.status = 'error';
        item.message = message;
      });
    }
  }
}

async function openFile(filePath: string) {
  await window.api.openFile(filePath);
}
</script>

<style scoped>
.section {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.section__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.header-actions {
  display: flex;
  gap: 12px;
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
  background-color: #16a34a;
  color: #ffffff;
}

.button--primary:hover {
  background-color: #15803d;
}

.form {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
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

.form__field--full {
  grid-column: 1 / -1;
}

.connection {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 0 16px 16px;
  background-color: #f8fafc;
}

.connection > summary {
  padding: 12px 0;
  font-weight: 600;
  color: #0f172a;
  cursor: pointer;
}

.connection__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.actions {
  display: flex;
  gap: 12px;
}

.table-wrapper {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  background-color: #ffffff;
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
  vertical-align: top;
}

.table tbody tr:hover {
  background-color: #f8fafc;
}

.path {
  font-family: 'Cascadia Code', 'Consolas', monospace;
  color: #1f2937;
}

.message {
  color: #4b5563;
  white-space: pre-wrap;
}

.status {
  font-weight: 600;
}

.status[data-status='success'] {
  color: #15803d;
}

.status[data-status='error'] {
  color: #dc2626;
}

.status[data-status='skipped'] {
  color: #f59e0b;
}

.empty {
  margin: 0;
  padding: 24px;
  text-align: center;
  color: #9ca3af;
}

@media (max-width: 768px) {
  .header-actions {
    flex-direction: column;
  }

  .actions {
    flex-direction: column;
  }
}
</style>
