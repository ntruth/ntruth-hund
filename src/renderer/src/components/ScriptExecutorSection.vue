<template>
  <div class="section">
    <div class="section__header">
      <div>
        <h2>SQL / PCK 批量执行</h2>
        <p>列出并执行指定目录中的脚本，支持自定义 Oracle 连接</p>
      </div>
      <div class="header-actions">
        <button class="button" type="button" @click="triggerDirectoryDialog" :disabled="isExecuting">
          选择目录
        </button>
        <button class="button" type="button" @click="refreshScripts" :disabled="isLoading || isExecuting">
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
      <button
        class="button button--primary"
        type="button"
        @click="executeAll"
        :disabled="scripts.length === 0 || isExecuting"
      >
        执行全部
      </button>
      <button
        class="button"
        type="button"
        @click="executeSelected"
        :disabled="selectedScripts.length === 0 || isExecuting"
      >
        执行选中
      </button>
    </div>

    <div class="table-wrapper">
      <table class="table" v-if="scripts.length > 0">
        <thead>
          <tr>
            <th style="width: 48px">
              <input type="checkbox" :checked="areAllSelected" @change="toggleSelectAll" :disabled="isExecuting" />
            </th>
            <th>文件名</th>
            <th>执行状态</th>
            <th>消息</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in scripts"
            :key="item.path"
            :class="[`status--${item.status}`, { 'row--active': item.path === currentExecutingPath }]"
          >
            <td>
              <input type="checkbox" v-model="item.selected" :disabled="isExecuting" />
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

    <section class="logs" v-if="executionLogs.length > 0">
      <header class="logs__header">
        <h3>执行日志</h3>
        <button class="button button--ghost" type="button" @click="clearLogs" :disabled="isExecuting">
          清空日志
        </button>
      </header>
      <ul class="logs__list">
        <li v-for="entry in executionLogs" :key="entry.id" :data-status="entry.status">
          <span class="logs__time">{{ entry.timestamp }}</span>
          <span class="logs__name" v-if="entry.filePath">{{ entry.name }}</span>
          <span class="logs__status">{{ statusText(entry.status) }}</span>
          <span class="logs__message">{{ entry.message }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, toRaw } from 'vue';

type ExecutionStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped';

interface ScriptItem {
  path: string;
  name: string;
  selected: boolean;
  status: ExecutionStatus;
  message: string;
}

interface ProgressPayload {
  filePath: string | null;
  status: ExecutionStatus;
  message: string;
}

interface LogEntry {
  id: number;
  filePath: string | null;
  name: string;
  status: ExecutionStatus;
  message: string;
  timestamp: string;
}

const directory = ref('');
const isLoading = ref(false);
const isExecuting = ref(false);
const scripts = ref<ScriptItem[]>([]);
const currentExecutingPath = ref<string | null>(null);
const executionQueue = ref<string[]>([]);
const executionLogs = ref<LogEntry[]>([]);

type ConnectionPayload = {
  user: string;
  password: string;
  host?: string;
  port?: number;
  serviceName?: string;
  connectString?: string;
  configOverrides?: Record<string, unknown>;
};

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

let disposeProgressListener: (() => void) | null = null;
let logCounter = 0;

onMounted(() => {
  if (typeof window.api?.onScriptProgress === 'function') {
    disposeProgressListener = window.api.onScriptProgress(handleProgress);
  }
});

onBeforeUnmount(() => {
  disposeProgressListener?.();
});

function statusText(status: ExecutionStatus) {
  switch (status) {
    case 'running':
      return '执行中';
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

function appendLog(filePath: string | null, status: ExecutionStatus, message: string) {
  const timestamp = new Date().toLocaleTimeString();
  const name = filePath ? filePath.split(/[/\\]/).pop() || filePath : '系统';
  executionLogs.value.push({
    id: ++logCounter,
    filePath,
    name,
    status,
    message: message || '',
    timestamp
  });

  if (executionLogs.value.length > 500) {
    executionLogs.value.shift();
  }
}

function handleProgress(payload: ProgressPayload) {
  const { filePath, status, message } = payload;
  appendLog(filePath, status, message);

  if (!filePath) {
    return;
  }

  const target = scripts.value.find((item) => item.path === filePath);
  if (!target) {
    return;
  }

  target.status = status;
  if (message) {
    target.message = message;
  }

  if (status === 'running') {
    currentExecutingPath.value = filePath;
    target.selected = true;
  } else if (status === 'success' || status === 'error' || status === 'skipped') {
    const currentIndex = executionQueue.value.indexOf(filePath);
    if (currentIndex !== -1 && currentIndex === executionQueue.value.length - 1) {
      if (currentExecutingPath.value === filePath) {
        currentExecutingPath.value = null;
      }
    }
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
      status: 'pending' as ExecutionStatus,
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
  if (scripts.value.length === 0) {
    return;
  }
  scripts.value.forEach((item) => {
    item.selected = true;
  });
  await runExecution(scripts.value);
}

async function executeSelected() {
  await runExecution(selectedScripts.value);
}

function buildConnectionPayload(): ConnectionPayload {
  const payload: ConnectionPayload = {
    user: connection.user.trim(),
    password: connection.password
  };

  const host = connection.host.trim();
  if (host) {
    payload.host = host;
  }

  if (typeof connection.port === 'number' && !Number.isNaN(connection.port)) {
    payload.port = connection.port;
  }

  const serviceName = connection.serviceName.trim();
  if (serviceName) {
    payload.serviceName = serviceName;
  }

  const connectString = connection.connectString.trim();
  if (connectString) {
    payload.connectString = connectString;
  }

  const rawOverrides = toRaw(connection.configOverrides);
  if (rawOverrides && Object.keys(rawOverrides).length > 0) {
    payload.configOverrides = JSON.parse(JSON.stringify(rawOverrides));
  }

  return payload;
}

function validateConnectionParameters() {
  const user = connection.user.trim();
  const password = connection.password;

  if (!user || !password) {
    appendLog(null, 'error', '请填写数据库的用户名和密码。');
    return false;
  }

  const hasBasicConnection =
    !!connection.host.trim() &&
    typeof connection.port === 'number' &&
    connection.port > 0 &&
    !!connection.serviceName.trim();
  const hasCustomConnect = !!connection.connectString.trim();

  if (!hasBasicConnection && !hasCustomConnect) {
    appendLog(null, 'error', '请完善主机、端口、服务名或提供完整的自定义连接字符串。');
    return false;
  }

  return true;
}

async function runExecution(items: ScriptItem[]) {
  if (items.length === 0 || isExecuting.value) {
    return;
  }

  if (!validateConnectionParameters()) {
    return;
  }

  const files = items.map((item) => item.path);
  executionQueue.value = [...files];

  scripts.value.forEach((item) => {
    if (files.includes(item.path)) {
      item.status = 'pending';
      item.message = '';
    }
  });

  appendLog(null, 'running', `开始执行 ${files.length} 个脚本...`);
  isExecuting.value = true;
  currentExecutingPath.value = null;

  try {
    const response = await window.api.executeScripts({
      files,
      connection: buildConnectionPayload()
    });

    const executionResults = Array.isArray(response?.results) ? response.results : [];

    executionResults.forEach((result) => {
      const target = scripts.value.find((item) => item.path === result.filePath);
      if (!target) return;
      target.status = result.status as ExecutionStatus;
      target.message = result.message;
    });

    if (!response?.success) {
      const message = response?.message || '执行过程中出现错误，请检查配置。';
      appendLog(null, 'error', message);
      if (executionResults.length === 0) {
        scripts.value.forEach((item) => {
          if (files.includes(item.path)) {
            item.status = 'error';
            item.message = message;
          }
        });
      }
    } else {
      appendLog(null, 'success', '脚本执行完成。');
    }
  } catch (error: any) {
    const message = error?.message || '执行过程中发生异常。';
    appendLog(null, 'error', message);
    scripts.value.forEach((item) => {
      if (files.includes(item.path)) {
        item.status = 'error';
        item.message = message;
      }
    });
  } finally {
    isExecuting.value = false;
    if (executionQueue.value.length > 0) {
      executionQueue.value = [];
    }
    currentExecutingPath.value = null;
  }
}

async function openFile(filePath: string) {
  await window.api.openFile(filePath);
}

function clearLogs() {
  executionLogs.value = [] as LogEntry[];
  logCounter = 0;
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

.button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

.button--ghost {
  background-color: transparent;
  border: 1px solid #e5e7eb;
}

.button--ghost:hover {
  background-color: rgba(148, 163, 184, 0.15);
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

.row--active {
  background-color: rgba(37, 99, 235, 0.12) !important;
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

.status[data-status='running'] {
  color: #2563eb;
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

.logs {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px 20px;
  background-color: #f9fafb;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.logs__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logs__header h3 {
  margin: 0;
  font-size: 16px;
  color: #0f172a;
}

.logs__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 280px;
  overflow-y: auto;
}

.logs__list li {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 12px;
  align-items: baseline;
  font-size: 13px;
  padding: 8px 12px;
  border-radius: 10px;
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
}

.logs__list li[data-status='success'] {
  border-color: rgba(22, 163, 74, 0.35);
}

.logs__list li[data-status='error'] {
  border-color: rgba(220, 38, 38, 0.35);
}

.logs__list li[data-status='running'] {
  border-color: rgba(37, 99, 235, 0.35);
}

.logs__time {
  font-family: 'Cascadia Code', 'Consolas', monospace;
  color: #64748b;
}

.logs__name {
  font-weight: 600;
  color: #0f172a;
  margin-right: 8px;
}

.logs__status {
  font-weight: 600;
  color: #2563eb;
  margin-right: 8px;
}

.logs__message {
  color: #475569;
  white-space: pre-wrap;
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
