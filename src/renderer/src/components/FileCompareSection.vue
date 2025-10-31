<template>
  <div class="compare">
    <div class="compare__controls">
      <div class="file-card">
        <div class="file-card__title">
          <h2>源文件（左侧）</h2>
          <button type="button" class="file-card__primary" @click="pickFile('left')">
            选择文件
          </button>
        </div>
        <div class="file-card__field">
          <label>文件路径</label>
          <div class="file-card__path">
            <input
              type="text"
              :value="leftState.path"
              placeholder="请选择需要对比的文件"
              readonly
            />
            <button type="button" class="file-card__action" @click="pickFile('left')">
              浏览
            </button>
          </div>
        </div>
        <div class="file-card__field file-card__field--inline">
          <label for="left-encoding">编码</label>
          <select
            id="left-encoding"
            v-model="leftState.selectedEncoding"
            @change="handleEncodingChange('left')"
          >
            <option v-for="option in encodingOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
          <span v-if="leftEncodingLabel" class="file-card__hint">{{ leftEncodingLabel }}</span>
        </div>
        <div class="file-card__actions">
          <button type="button" class="text-button" :disabled="!leftState.path" @click="openSide('left')">
            打开文件
          </button>
          <button type="button" class="text-button" :disabled="!leftState.path" @click="revealSide('left')">
            打开所在目录
          </button>
          <button type="button" class="text-button" :disabled="!leftState.path" @click="refreshSide('left')">
            重新加载
          </button>
        </div>
        <p v-if="leftState.loading" class="file-card__status">正在读取文件内容…</p>
        <p v-else-if="leftState.error" class="file-card__status file-card__status--error">
          {{ leftState.error }}
        </p>
      </div>

      <div class="file-card">
        <div class="file-card__title">
          <h2>目标文件（右侧）</h2>
          <button type="button" class="file-card__primary" @click="pickFile('right')">
            选择文件
          </button>
        </div>
        <div class="file-card__field">
          <label>文件路径</label>
          <div class="file-card__path">
            <input
              type="text"
              :value="rightState.path"
              placeholder="请选择需要对比的文件"
              readonly
            />
            <button type="button" class="file-card__action" @click="pickFile('right')">
              浏览
            </button>
          </div>
        </div>
        <div class="file-card__field file-card__field--inline">
          <label for="right-encoding">编码</label>
          <select
            id="right-encoding"
            v-model="rightState.selectedEncoding"
            @change="handleEncodingChange('right')"
          >
            <option v-for="option in encodingOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
          <span v-if="rightEncodingLabel" class="file-card__hint">{{ rightEncodingLabel }}</span>
        </div>
        <div class="file-card__actions">
          <button type="button" class="text-button" :disabled="!rightState.path" @click="openSide('right')">
            打开文件
          </button>
          <button type="button" class="text-button" :disabled="!rightState.path" @click="revealSide('right')">
            打开所在目录
          </button>
          <button type="button" class="text-button" :disabled="!rightState.path" @click="refreshSide('right')">
            重新加载
          </button>
        </div>
        <p v-if="rightState.loading" class="file-card__status">正在读取文件内容…</p>
        <p v-else-if="rightState.error" class="file-card__status file-card__status--error">
          {{ rightState.error }}
        </p>
      </div>
    </div>

    <div class="compare__result">
      <div class="compare__summary">
        <div class="summary__item">
          <span class="summary__label">左侧行数</span>
          <span class="summary__value">{{ leftLineCount }}</span>
        </div>
        <div class="summary__item">
          <span class="summary__label">右侧行数</span>
          <span class="summary__value">{{ rightLineCount }}</span>
        </div>
        <div class="summary__item">
          <span class="summary__label">新增</span>
          <span class="summary__value summary__value--added">{{ diffSummary.added }}</span>
        </div>
        <div class="summary__item">
          <span class="summary__label">删除</span>
          <span class="summary__value summary__value--removed">{{ diffSummary.removed }}</span>
        </div>
      </div>

      <div v-if="!hasSelections" class="compare__placeholder">
        请选择需要对比的两个文件，支持 SQL、PCK、JSP、Java、XML 等文本脚本，并可自动兼容 UTF-8/GBK 编码。
      </div>
      <div v-else-if="leftState.loading || rightState.loading" class="compare__placeholder">
        正在读取文件内容，请稍候…
      </div>
      <div
        v-else-if="leftState.error || rightState.error"
        class="compare__placeholder compare__placeholder--error"
      >
        <p v-if="leftState.error">左侧文件：{{ leftState.error }}</p>
        <p v-if="rightState.error">右侧文件：{{ rightState.error }}</p>
      </div>
      <div v-else class="diff-view">
        <div v-if="diffRows.length" class="diff-view__grid">
          <div class="diff-row diff-row--header">
            <div class="diff-cell diff-cell--line">左侧</div>
            <div class="diff-cell diff-cell--line">右侧</div>
            <div class="diff-cell diff-cell--content">差异内容</div>
          </div>
          <div
            v-for="(row, index) in diffRows"
            :key="`${index}-${row.leftLine ?? 'x'}-${row.rightLine ?? 'x'}-${row.type}`"
            class="diff-row"
            :class="{
              'diff-row--added': row.type === 'added',
              'diff-row--removed': row.type === 'removed'
            }"
          >
            <div class="diff-cell diff-cell--line">{{ row.leftLine ?? '' }}</div>
            <div class="diff-cell diff-cell--line">{{ row.rightLine ?? '' }}</div>
            <pre class="diff-cell diff-cell--content">{{ formatDiffText(row.text) }}</pre>
          </div>
        </div>
        <div v-else class="compare__placeholder">两个文件内容完全一致。</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue';
import { diffLines } from 'diff';
import type { DiffEncodingOption, DiffFileLoadResult } from '../global.d';

type Side = 'left' | 'right';

interface FileState {
  path: string;
  selectedEncoding: DiffEncodingOption;
  encoding: string;
  detectedEncoding: string;
  content: string;
  loading: boolean;
  error: string;
  loadRequestId: number;
}

interface DiffRow {
  type: 'added' | 'removed' | 'unchanged';
  leftLine: number | null;
  rightLine: number | null;
  text: string;
}

const encodingOptions: Array<{ value: DiffEncodingOption; label: string }> = [
  { value: 'auto', label: '自动检测' },
  { value: 'utf8', label: 'UTF-8' },
  { value: 'gbk', label: 'GBK (简体中文)' },
  { value: 'utf16le', label: 'UTF-16 LE' },
  { value: 'utf16be', label: 'UTF-16 BE' }
];

const fileFilters = [
  { name: '脚本与文本', extensions: ['sql', 'pck', 'xml', 'jsp', 'java', 'txt', 'json', 'log'] },
  { name: '所有文件', extensions: ['*'] }
];

function createFileState(): FileState {
  return {
    path: '',
    selectedEncoding: 'auto',
    encoding: '',
    detectedEncoding: '',
    content: '',
    loading: false,
    error: '',
    loadRequestId: 0
  };
}

const leftState = reactive<FileState>(createFileState());
const rightState = reactive<FileState>(createFileState());

const hasSelections = computed(() => Boolean(leftState.path && rightState.path));

const readyForDiff = computed(
  () =>
    hasSelections.value &&
    !leftState.loading &&
    !rightState.loading &&
    !leftState.error &&
    !rightState.error
);

function normalizeNewlines(content: string): string {
  return content.replace(/\r\n/g, '\n');
}

function splitDiffLines(value: string): string[] {
  if (!value) {
    return [];
  }
  const lines = normalizeNewlines(value).split('\n');
  if (lines.length && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}

const rawDiff = computed(() => {
  if (!readyForDiff.value) {
    return [];
  }
  return diffLines(leftState.content ?? '', rightState.content ?? '', {
    newlineIsToken: true
  });
});

const diffRows = computed<DiffRow[]>(() => {
  if (!readyForDiff.value) {
    return [];
  }
  const rows: DiffRow[] = [];
  let leftLine = 1;
  let rightLine = 1;

  for (const part of rawDiff.value) {
    const lines = splitDiffLines(part.value);
    if (lines.length === 0) {
      continue;
    }

    for (const line of lines) {
      if (part.added) {
        rows.push({
          type: 'added',
          leftLine: null,
          rightLine,
          text: line
        });
        rightLine += 1;
      } else if (part.removed) {
        rows.push({
          type: 'removed',
          leftLine,
          rightLine: null,
          text: line
        });
        leftLine += 1;
      } else {
        rows.push({
          type: 'unchanged',
          leftLine,
          rightLine,
          text: line
        });
        leftLine += 1;
        rightLine += 1;
      }
    }
  }

  return rows;
});

const diffSummary = computed(() => {
  if (!readyForDiff.value) {
    return { added: 0, removed: 0 };
  }
  let added = 0;
  let removed = 0;
  for (const part of rawDiff.value) {
    const count = splitDiffLines(part.value).length;
    if (part.added) {
      added += count;
    } else if (part.removed) {
      removed += count;
    }
  }
  return { added, removed };
});

function countLines(content: string): number {
  if (!content) {
    return 0;
  }
  return normalizeNewlines(content).split('\n').length;
}

const leftLineCount = computed(() => (readyForDiff.value ? countLines(leftState.content) : 0));
const rightLineCount = computed(() => (readyForDiff.value ? countLines(rightState.content) : 0));

const leftEncodingLabel = computed(() => formatEncodingLabel(leftState));
const rightEncodingLabel = computed(() => formatEncodingLabel(rightState));

function formatEncodingLabel(state: FileState): string {
  const actual = state.encoding || state.detectedEncoding;
  if (!actual) {
    return '';
  }
  const upper = actual.toUpperCase();
  return state.selectedEncoding === 'auto' ? `${upper}（自动识别）` : upper;
}

function formatDiffText(text: string): string {
  return text === '' ? ' ' : text;
}

async function loadFile(side: Side) {
  const state = side === 'left' ? leftState : rightState;
  if (!state.path) {
    state.content = '';
    state.encoding = '';
    state.detectedEncoding = '';
    state.error = '';
    return;
  }

  const requestId = state.loadRequestId + 1;
  state.loadRequestId = requestId;
  state.loading = true;
  state.error = '';

  try {
    const result = await window.api.loadFileForDiff({
      path: state.path,
      encoding: state.selectedEncoding
    });
    if (state.loadRequestId !== requestId) {
      return;
    }
    if (!result || !result.success) {
      state.content = '';
      state.encoding = result?.encoding ?? '';
      state.detectedEncoding = result?.detectedEncoding ?? '';
      state.error = result?.message || '无法读取文件内容';
      return;
    }
    applyLoadResult(state, result);
  } catch (error) {
    if (state.loadRequestId === requestId) {
      state.content = '';
      state.encoding = '';
      state.detectedEncoding = '';
      state.error = error instanceof Error ? error.message : String(error);
    }
  } finally {
    if (state.loadRequestId === requestId) {
      state.loading = false;
    }
  }
}

function applyLoadResult(state: FileState, result: DiffFileLoadResult) {
  state.content = result.content ?? '';
  state.encoding = result.encoding ?? '';
  state.detectedEncoding = result.detectedEncoding ?? result.encoding ?? '';
  state.error = '';
}

async function pickFile(side: Side) {
  const state = side === 'left' ? leftState : rightState;
  const filePath = await window.api.selectFile({
    defaultPath: state.path || undefined,
    filters: fileFilters
  });
  if (!filePath) {
    return;
  }
  state.path = filePath;
  await loadFile(side);
}

function handleEncodingChange(side: Side) {
  void loadFile(side);
}

function refreshSide(side: Side) {
  void loadFile(side);
}

async function openSide(side: Side) {
  const state = side === 'left' ? leftState : rightState;
  if (!state.path) {
    return;
  }
  await window.api.openFile(state.path);
}

async function revealSide(side: Side) {
  const state = side === 'left' ? leftState : rightState;
  if (!state.path) {
    return;
  }
  await window.api.revealFile(state.path);
}
</script>

<style scoped>
.compare {
  display: flex;
  flex-direction: column;
  gap: 24px;
  height: 100%;
}

.compare__controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 24px;
}

.file-card {
  background: #f9fafb;
  border-radius: 16px;
  padding: 20px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(15, 23, 42, 0.08);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.file-card__title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.file-card__title h2 {
  margin: 0;
  font-size: 18px;
  color: #0f172a;
}

.file-card__primary {
  background-color: #1f6feb;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}

.file-card__primary:hover {
  background-color: #1d4ed8;
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.35);
}

.file-card__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-card__field label {
  font-size: 14px;
  color: #4b5563;
}

.file-card__field--inline {
  flex-direction: row;
  align-items: center;
  gap: 12px;
}

.file-card__path {
  display: flex;
  gap: 8px;
  align-items: center;
}

.file-card__path input {
  flex: 1;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.16);
  background-color: #ffffff;
  font-size: 14px;
  color: #111827;
}

.file-card__path input::placeholder {
  color: #9ca3af;
}

.file-card__action {
  background-color: #e5e7eb;
  border: none;
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.file-card__action:hover {
  background-color: #d1d5db;
}

.file-card select {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.16);
  background-color: #ffffff;
  font-size: 14px;
  color: #111827;
}

.file-card__hint {
  font-size: 13px;
  color: #6b7280;
}

.file-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.text-button {
  border: none;
  background: transparent;
  color: #1f6feb;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
}

.text-button:disabled {
  color: #9ca3af;
  cursor: not-allowed;
}

.file-card__status {
  margin: 0;
  font-size: 13px;
  color: #4b5563;
}

.file-card__status--error {
  color: #dc2626;
}

.compare__result {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

.compare__summary {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.summary__item {
  min-width: 140px;
  padding: 12px 16px;
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.03) 100%);
  border: 1px solid rgba(37, 99, 235, 0.15);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary__label {
  font-size: 13px;
  color: #4b5563;
}

.summary__value {
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
}

.summary__value--added {
  color: #15803d;
}

.summary__value--removed {
  color: #dc2626;
}

.compare__placeholder {
  padding: 32px;
  border-radius: 16px;
  border: 1px dashed rgba(15, 23, 42, 0.15);
  color: #4b5563;
  text-align: center;
  background: rgba(249, 250, 251, 0.8);
}

.compare__placeholder--error {
  color: #b91c1c;
  background: rgba(254, 226, 226, 0.7);
  border-color: rgba(248, 113, 113, 0.6);
}

.diff-view {
  flex: 1;
  min-height: 0;
  border-radius: 16px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.diff-view__grid {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
}

.diff-row {
  display: grid;
  grid-template-columns: 80px 80px 1fr;
  align-items: stretch;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.diff-row:last-child {
  border-bottom: none;
}

.diff-row--header {
  background: rgba(15, 23, 42, 0.05);
  font-weight: 600;
  color: #111827;
}

.diff-row--added {
  background: rgba(220, 252, 231, 0.9);
}

.diff-row--removed {
  background: rgba(254, 226, 226, 0.9);
}

.diff-cell {
  padding: 8px 12px;
  font-size: 13px;
  border-right: 1px solid rgba(15, 23, 42, 0.06);
  display: flex;
  align-items: flex-start;
}

.diff-cell:last-child {
  border-right: none;
}

.diff-cell--line {
  font-family: 'Fira Code', 'JetBrains Mono', Consolas, 'Courier New', monospace;
  color: #6b7280;
  justify-content: center;
}

.diff-cell--content {
  width: 100%;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'Fira Code', 'JetBrains Mono', Consolas, 'Courier New', monospace;
  color: #111827;
}

@media (max-width: 1024px) {
  .diff-row {
    grid-template-columns: 60px 60px 1fr;
  }
}
</style>
