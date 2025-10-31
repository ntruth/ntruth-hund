<template>
  <div
    ref="compareRoot"
    class="compare"
    @dragover.prevent="handleRootDragOver"
    @dragenter.prevent="handleRootDragEnter"
    @dragleave="handleRootDragLeave"
    @drop.prevent="handleGlobalDrop"
  >
    <div class="compare__controls">
      <div
        class="file-card"
        :class="{
          'file-card--disabled': leftState.loading,
          'file-card--drag': dragTarget === 'left'
        }"
        @dragover.prevent
        @dragenter.prevent="setDragTarget('left')"
        @dragleave="handleDragLeave"
        @drop.prevent="handleDrop($event, 'left')"
      >
        <header class="file-card__header">
          <div>
            <h2>源文件（左侧）</h2>
            <p class="file-card__hint">支持拖拽 SQL、PCK、XML、JSP、Java 等文本文件</p>
          </div>
          <button type="button" class="file-card__primary" @click="pickFile('left')">
            选择文件
          </button>
        </header>
        <div class="file-card__field">
          <label>文件路径</label>
          <div class="file-card__path">
            <input type="text" :value="leftState.path" placeholder="请选择需要对比的文件" readonly />
            <button type="button" class="file-card__action" @click="pickFile('left')">浏览</button>
          </div>
        </div>
        <div class="file-card__field file-card__field--inline">
          <label for="left-encoding">编码</label>
          <select id="left-encoding" v-model="leftState.selectedEncoding" @change="handleEncodingChange('left')">
            <option v-for="option in encodingOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
          <span v-if="leftEncodingLabel" class="file-card__status">{{ leftEncodingLabel }}</span>
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
        <p v-else-if="leftState.error" class="file-card__status file-card__status--error">{{ leftState.error }}</p>
      </div>

      <div
        class="file-card"
        :class="{
          'file-card--disabled': rightState.loading,
          'file-card--drag': dragTarget === 'right'
        }"
        @dragover.prevent
        @dragenter.prevent="setDragTarget('right')"
        @dragleave="handleDragLeave"
        @drop.prevent="handleDrop($event, 'right')"
      >
        <header class="file-card__header">
          <div>
            <h2>目标文件（右侧）</h2>
            <p class="file-card__hint">拖拽或选择需要对比 / 合并的目标文件</p>
          </div>
          <button type="button" class="file-card__primary" @click="pickFile('right')">选择文件</button>
        </header>
        <div class="file-card__field">
          <label>文件路径</label>
          <div class="file-card__path">
            <input type="text" :value="rightState.path" placeholder="请选择需要对比的文件" readonly />
            <button type="button" class="file-card__action" @click="pickFile('right')">浏览</button>
          </div>
        </div>
        <div class="file-card__field file-card__field--inline">
          <label for="right-encoding">编码</label>
          <select id="right-encoding" v-model="rightState.selectedEncoding" @change="handleEncodingChange('right')">
            <option v-for="option in encodingOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
          <span v-if="rightEncodingLabel" class="file-card__status">{{ rightEncodingLabel }}</span>
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
        <p v-else-if="rightState.error" class="file-card__status file-card__status--error">{{ rightState.error }}</p>
      </div>

      <div
        v-show="mode === 'merge'"
        class="file-card"
        :class="{
          'file-card--disabled': baseState.loading,
          'file-card--drag': dragTarget === 'base'
        }"
        @dragover.prevent
        @dragenter.prevent="setDragTarget('base')"
        @dragleave="handleDragLeave"
        @drop.prevent="handleDrop($event, 'base')"
      >
        <header class="file-card__header">
          <div>
            <h2>基线文件（合并基准）</h2>
            <p class="file-card__hint">三方合并时作为对照的基准版本</p>
          </div>
          <button type="button" class="file-card__primary" @click="pickFile('base')">选择文件</button>
        </header>
        <div class="file-card__field">
          <label>文件路径</label>
          <div class="file-card__path">
            <input type="text" :value="baseState.path" placeholder="请选择基线文件" readonly />
            <button type="button" class="file-card__action" @click="pickFile('base')">浏览</button>
          </div>
        </div>
        <div class="file-card__field file-card__field--inline">
          <label for="base-encoding">编码</label>
          <select id="base-encoding" v-model="baseState.selectedEncoding" @change="handleEncodingChange('base')">
            <option v-for="option in encodingOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
          <span v-if="baseEncodingLabel" class="file-card__status">{{ baseEncodingLabel }}</span>
        </div>
        <div class="file-card__actions">
          <button type="button" class="text-button" :disabled="!baseState.path" @click="openSide('base')">
            打开文件
          </button>
          <button type="button" class="text-button" :disabled="!baseState.path" @click="revealSide('base')">
            打开所在目录
          </button>
          <button type="button" class="text-button" :disabled="!baseState.path" @click="refreshSide('base')">
            重新加载
          </button>
        </div>
        <p v-if="baseState.loading" class="file-card__status">正在读取文件内容…</p>
        <p v-else-if="baseState.error" class="file-card__status file-card__status--error">{{ baseState.error }}</p>
      </div>
    </div>

    <div class="compare__toolbar">
      <div class="compare__modes">
        <button type="button" :class="{ active: mode === 'diff' }" @click="switchMode('diff')">双向对比</button>
        <button type="button" :class="{ active: mode === 'merge' }" @click="switchMode('merge')">三方合并</button>
      </div>
      <div class="compare__options">
        <label><input type="checkbox" v-model="ignoreOptions.ignoreWhitespace" /> 忽略空白</label>
        <label><input type="checkbox" v-model="ignoreOptions.ignoreCase" /> 忽略大小写</label>
        <label><input type="checkbox" v-model="ignoreOptions.ignoreComments" /> 忽略注释</label>
      </div>
      <div v-if="mode === 'diff' && diffHighlights" class="compare__summary">
        <span>左侧行数：{{ leftLineCount }}</span>
        <span>右侧行数：{{ rightLineCount }}</span>
        <span class="summary--added">新增：{{ diffHighlights.summary.added }}</span>
        <span class="summary--removed">删除：{{ diffHighlights.summary.removed }}</span>
        <span class="summary--changed">修改：{{ diffHighlights.summary.changed }}</span>
      </div>
      <div v-else-if="mode === 'merge' && readyForMerge" class="compare__summary">
        <span>基线行数：{{ baseLineCount }}</span>
        <span>源行数：{{ leftLineCount }}</span>
        <span>目标行数：{{ rightLineCount }}</span>
        <span class="summary--conflict">冲突：{{ unresolvedConflictCount }}</span>
      </div>
    </div>

    <div class="compare__workspace">
      <section v-show="mode === 'diff'" class="diff-workspace">
        <div v-if="!readyForDiff" class="workspace__placeholder">
          <p>请选择左、右两个文件，或拖拽文件到卡片中以查看差异。</p>
        </div>
        <div v-else class="diff-grid">
          <div
            class="diff-panel"
            :class="{ 'diff-panel--drag': dragTarget === 'left' }"
            @dragover.prevent="onPanelDragOver($event, 'left')"
            @dragenter.prevent="setDragTarget('left')"
            @dragleave="handleDragLeave"
            @drop.prevent="handleDrop($event, 'left')"
          >
            <header class="diff-panel__header">源文件</header>
            <div
              ref="leftEditorEl"
              class="diff-panel__editor"
              @dragover.prevent="onPanelDragOver($event, 'left')"
              @dragenter.prevent="setDragTarget('left')"
              @dragleave="handleDragLeave"
              @drop.prevent="handleDrop($event, 'left')"
            ></div>
          </div>
          <div
            class="diff-panel"
            :class="{ 'diff-panel--drag': dragTarget === 'right' }"
            @dragover.prevent="onPanelDragOver($event, 'right')"
            @dragenter.prevent="setDragTarget('right')"
            @dragleave="handleDragLeave"
            @drop.prevent="handleDrop($event, 'right')"
          >
            <header class="diff-panel__header">目标文件</header>
            <div
              ref="rightEditorEl"
              class="diff-panel__editor"
              @dragover.prevent="onPanelDragOver($event, 'right')"
              @dragenter.prevent="setDragTarget('right')"
              @dragleave="handleDragLeave"
              @drop.prevent="handleDrop($event, 'right')"
            ></div>
          </div>
        </div>
      </section>

      <section v-show="mode === 'merge'" class="merge-workspace">
        <div v-if="!readyForMerge" class="workspace__placeholder">
          <p>请选择基线、源文件与目标文件后即可执行三方合并。</p>
        </div>
        <div v-else class="merge-grid">
          <div
            class="merge-column"
            :class="{ 'merge-column--drag': dragTarget === 'base' }"
            @dragover.prevent="onPanelDragOver($event, 'base')"
            @dragenter.prevent="setDragTarget('base')"
            @dragleave="handleDragLeave"
            @drop.prevent="handleDrop($event, 'base')"
          >
            <header>基线文件</header>
            <div
              ref="baseEditorEl"
              class="merge-column__editor"
              @dragover.prevent="onPanelDragOver($event, 'base')"
              @dragenter.prevent="setDragTarget('base')"
              @dragleave="handleDragLeave"
              @drop.prevent="handleDrop($event, 'base')"
            ></div>
          </div>
          <div
            class="merge-column"
            :class="{ 'merge-column--drag': dragTarget === 'left' }"
            @dragover.prevent="onPanelDragOver($event, 'left')"
            @dragenter.prevent="setDragTarget('left')"
            @dragleave="handleDragLeave"
            @drop.prevent="handleDrop($event, 'left')"
          >
            <header>源文件（左）</header>
            <div
              ref="leftEditorEl"
              class="merge-column__editor merge-column__editor--shared"
              @dragover.prevent="onPanelDragOver($event, 'left')"
              @dragenter.prevent="setDragTarget('left')"
              @dragleave="handleDragLeave"
              @drop.prevent="handleDrop($event, 'left')"
            ></div>
          </div>
          <div
            class="merge-column"
            :class="{ 'merge-column--drag': dragTarget === 'right' }"
            @dragover.prevent="onPanelDragOver($event, 'right')"
            @dragenter.prevent="setDragTarget('right')"
            @dragleave="handleDragLeave"
            @drop.prevent="handleDrop($event, 'right')"
          >
            <header>目标文件（右）</header>
            <div
              ref="rightEditorEl"
              class="merge-column__editor merge-column__editor--shared"
              @dragover.prevent="onPanelDragOver($event, 'right')"
              @dragenter.prevent="setDragTarget('right')"
              @dragleave="handleDragLeave"
              @drop.prevent="handleDrop($event, 'right')"
            ></div>
          </div>
        </div>
        <div v-if="readyForMerge" class="merge-result">
          <header class="merge-result__header">
            <div>
              <h3>合并结果</h3>
              <p>直接在此处编辑即可手动处理冲突，或使用下方操作按钮快速合并</p>
            </div>
            <div class="merge-result__actions">
              <button type="button" class="text-button" @click="autoResolveConflicts" :disabled="!mergeConflicts.length">
                自动合并可识别的冲突
              </button>
              <button type="button" class="text-button" @click="resetMerge" :disabled="!mergeConflicts.length">
                重新计算合并
              </button>
            </div>
          </header>
          <div ref="resultEditorEl" class="merge-result__editor"></div>
        </div>
        <div v-if="mergeConflicts.length" class="conflict-list">
          <header class="conflict-list__header">
            <h4>待处理冲突（{{ unresolvedConflictCount }}）</h4>
            <p>可选择左侧或右侧内容，或手动修改后标记为已解决</p>
          </header>
          <div
            v-for="conflict in mergeConflicts"
            :key="conflict.id"
            class="conflict-item"
            :class="{ 'conflict-item--resolved': conflict.resolved }"
          >
            <div class="conflict-item__summary">
              <div>
                <strong>冲突位置：</strong>
                <span>合并结果第 {{ conflictDisplayRange(conflict) }} 行</span>
              </div>
              <div class="conflict-item__actions">
                <button type="button" @click="revealConflict(conflict)">定位</button>
                <button type="button" :disabled="conflict.resolved" @click="acceptConflict(conflict, 'left')">
                  接受左侧
                </button>
                <button type="button" :disabled="conflict.resolved" @click="acceptConflict(conflict, 'right')">
                  接受右侧
                </button>
                <button type="button" :disabled="conflict.resolved" @click="markConflictResolved(conflict)">
                  标记已解决
                </button>
              </div>
            </div>
            <details>
              <summary>查看详细差异</summary>
              <div class="conflict-item__content">
                <div>
                  <h5>左侧</h5>
                  <pre>{{ conflict.plan.leftLines.join('\n') || '（无变更）' }}</pre>
                </div>
                <div>
                  <h5>右侧</h5>
                  <pre>{{ conflict.plan.rightLines.join('\n') || '（无变更）' }}</pre>
                </div>
                <div>
                  <h5>基线</h5>
                  <pre>{{ conflict.plan.baseLines.join('\n') || '（无变更）' }}</pre>
                </div>
              </div>
            </details>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch, watchEffect } from 'vue';
import monaco, { useMonacoTheme } from '../monaco';
import {
  computeDiffHighlights,
  planThreeWayMerge,
  prepareDocument,
  type DiffHighlights,
  type IgnoreOptions,
  type LineHighlight,
  type NormalizedDocument,
  type PlannedConflict
} from '../utils/diffHelpers';
import type { DiffEncodingOption, DiffFileLoadResult } from '../global.d';

const encodingOptions: Array<{ value: DiffEncodingOption; label: string }> = [
  { value: 'auto', label: '自动检测' },
  { value: 'utf8', label: 'UTF-8' },
  { value: 'gbk', label: 'GBK (简体中文)' },
  { value: 'utf16le', label: 'UTF-16 LE' },
  { value: 'utf16be', label: 'UTF-16 BE' }
];

const fileFilters = [
  { name: '脚本与文本', extensions: ['sql', 'pck', 'xml', 'jsp', 'java', 'js', 'json', 'txt'] },
  { name: '所有文件', extensions: ['*'] }
];

type CompareMode = 'diff' | 'merge';
type Side = 'left' | 'right';
type MergeSide = Side | 'base';

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

const mode = ref<CompareMode>('diff');
const ignoreOptions = reactive<IgnoreOptions>({
  ignoreWhitespace: false,
  ignoreCase: false,
  ignoreComments: false
});

const leftState = reactive<FileState>(createFileState());
const rightState = reactive<FileState>(createFileState());
const baseState = reactive<FileState>(createFileState());

const compareRoot = ref<HTMLDivElement | null>(null);
const leftEditorEl = ref<HTMLDivElement | null>(null);
const rightEditorEl = ref<HTMLDivElement | null>(null);
const baseEditorEl = ref<HTMLDivElement | null>(null);
const resultEditorEl = ref<HTMLDivElement | null>(null);

let leftEditor: monaco.editor.IStandaloneCodeEditor | null = null;
let rightEditor: monaco.editor.IStandaloneCodeEditor | null = null;
let baseEditor: monaco.editor.IStandaloneCodeEditor | null = null;
let resultEditor: monaco.editor.IStandaloneCodeEditor | null = null;

let leftModel: monaco.editor.ITextModel | null = null;
let rightModel: monaco.editor.ITextModel | null = null;
let baseModel: monaco.editor.ITextModel | null = null;
let resultModel: monaco.editor.ITextModel | null = null;

let leftScrollDisposable: monaco.IDisposable | null = null;
let rightScrollDisposable: monaco.IDisposable | null = null;

let leftDecorations: string[] = [];
let rightDecorations: string[] = [];
let conflictDecorationIds: string[] = [];
let conflictIdCounter = 0;

const leftDoc = ref<NormalizedDocument | null>(null);
const rightDoc = ref<NormalizedDocument | null>(null);
const baseDoc = ref<NormalizedDocument | null>(null);
const diffHighlights = ref<DiffHighlights | null>(null);

interface MergeConflictEntry {
  id: number;
  plan: PlannedConflict;
  decorationId: string;
  resolved: boolean;
  resolution?: 'left' | 'right' | 'manual';
}

const mergeConflicts = reactive<MergeConflictEntry[]>([]);
const dragTarget = ref<MergeSide | null>(null);

const ignoreSnapshot = computed(
  () => `${ignoreOptions.ignoreWhitespace}|${ignoreOptions.ignoreCase}|${ignoreOptions.ignoreComments}`
);

const readyForDiff = computed(
  () =>
    Boolean(
      leftState.path &&
        rightState.path &&
        !leftState.loading &&
        !rightState.loading &&
        !leftState.error &&
        !rightState.error
    )
);

const readyForMerge = computed(
  () =>
    Boolean(
      mode.value === 'merge' &&
        leftState.path &&
        rightState.path &&
        baseState.path &&
        !leftState.loading &&
        !rightState.loading &&
        !baseState.loading &&
        !leftState.error &&
        !rightState.error &&
        !baseState.error
    )
);

const leftEncodingLabel = computed(() => formatEncodingLabel(leftState));
const rightEncodingLabel = computed(() => formatEncodingLabel(rightState));
const baseEncodingLabel = computed(() => formatEncodingLabel(baseState));

const leftLineCount = computed(() => countLines(leftState.content));
const rightLineCount = computed(() => countLines(rightState.content));
const baseLineCount = computed(() => countLines(baseState.content));

const unresolvedConflictCount = computed(
  () => mergeConflicts.filter((conflict) => !conflict.resolved).length
);

function formatEncodingLabel(state: FileState): string {
  const actual = state.encoding || state.detectedEncoding;
  if (!actual) {
    return '';
  }
  const upper = actual.toUpperCase();
  return state.selectedEncoding === 'auto' ? `${upper}（自动识别）` : upper;
}

function countLines(content: string): number {
  if (!content) {
    return 0;
  }
  return content.replace(/\r\n/g, '\n').split('\n').length;
}

function getLanguageFromPath(path: string): string {
  const extMatch = /\.([^.]+)$/i.exec(path || '');
  const ext = extMatch ? extMatch[1].toLowerCase() : '';
  switch (ext) {
    case 'sql':
    case 'pck':
      return 'sql';
    case 'xml':
      return 'xml';
    case 'jsp':
    case 'html':
    case 'htm':
      return 'html';
    case 'java':
      return 'java';
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'json':
      return 'json';
    case 'css':
      return 'css';
    default:
      return 'plaintext';
  }
}

function getState(side: MergeSide): FileState {
  if (side === 'left') {
    return leftState;
  }
  if (side === 'right') {
    return rightState;
  }
  return baseState;
}

function setDragTarget(side: MergeSide) {
  dragTarget.value = side;
}

function clearDragTarget() {
  dragTarget.value = null;
}

function handleDragLeave(event: DragEvent) {
  const current = event.currentTarget as HTMLElement | null;
  const related = event.relatedTarget as Node | null;
  if (!current || !related || !current.contains(related)) {
    clearDragTarget();
  }
}

function onPanelDragOver(event: DragEvent, side: MergeSide) {
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy';
  }
  if (dragTarget.value !== side) {
    dragTarget.value = side;
  }
}

async function pickFile(side: MergeSide) {
  const state = getState(side);
  const selected = await window.api.selectFile({
    defaultPath: state.path || undefined,
    filters: fileFilters
  });
  if (!selected) {
    return;
  }
  await assignFileToSide(side, selected);
}

async function assignFileToSide(side: MergeSide, path: string, encoding: DiffEncodingOption = 'auto') {
  const state = getState(side);
  state.path = path;
  state.selectedEncoding = encoding;
  await loadFile(side);
}

async function assignFilesFromDrop(
  fileList: FileList | File[] | undefined,
  preferredSide?: MergeSide
) {
  if (!fileList) {
    return;
  }
  type DroppedFile = File & { path?: string };
  const files = Array.from(fileList as ArrayLike<DroppedFile>).filter((file) => Boolean(file?.path));
  if (!files.length) {
    return;
  }

  const order: MergeSide[] = mode.value === 'merge' ? ['left', 'right', 'base'] : ['left', 'right'];
  let resolvedPreferred = preferredSide;
  if (resolvedPreferred === 'base' && mode.value !== 'merge') {
    resolvedPreferred = 'left';
  }
  if (resolvedPreferred) {
    const index = order.indexOf(resolvedPreferred);
    if (index > 0) {
      order.splice(index, 1);
      order.unshift(resolvedPreferred);
    } else if (index === -1) {
      order.unshift(resolvedPreferred);
    }
  }

  for (let i = 0; i < files.length && i < order.length; i += 1) {
    await assignFileToSide(order[i], files[i].path!);
  }
}

async function handleDrop(event: DragEvent, side: MergeSide) {
  event.stopPropagation();
  await assignFilesFromDrop(event.dataTransfer?.files, side);
  clearDragTarget();
}

async function handleGlobalDrop(event: DragEvent) {
  event.stopPropagation();
  await assignFilesFromDrop(event.dataTransfer?.files, dragTarget.value ?? inferSideFromPosition(event));
  clearDragTarget();
}

async function handleEncodingChange(side: MergeSide) {
  await loadFile(side);
}

function inferSideFromPosition(event: DragEvent): MergeSide {
  const root = compareRoot.value;
  if (!root) {
    return 'left';
  }
  const rect = root.getBoundingClientRect();
  const relativeX = event.clientX - rect.left;
  if (mode.value === 'merge') {
    const third = rect.width / 3;
    if (relativeX < third) {
      return 'base';
    }
    if (relativeX < third * 2) {
      return 'left';
    }
    return 'right';
  }
  return relativeX < rect.width / 2 ? 'left' : 'right';
}

function handleRootDragEnter(event: DragEvent) {
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy';
  }
  dragTarget.value = inferSideFromPosition(event);
}

function handleRootDragOver(event: DragEvent) {
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy';
  }
  dragTarget.value = inferSideFromPosition(event);
}

function handleRootDragLeave(event: DragEvent) {
  const current = event.currentTarget as HTMLElement | null;
  const related = event.relatedTarget as Node | null;
  if (!current || !related || !current.contains(related)) {
    clearDragTarget();
  }
}

async function loadFile(side: MergeSide) {
  const state = getState(side);
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
    const result: DiffFileLoadResult = await window.api.loadFileForDiff({
      path: state.path,
      encoding: state.selectedEncoding
    });
    if (state.loadRequestId !== requestId) {
      return;
    }
    if (!result.success || !result.content) {
      state.error = result.message || '读取文件失败';
      return;
    }
    state.content = result.content;
    state.encoding = result.encoding || '';
    state.detectedEncoding = result.detectedEncoding || '';
  } catch (error) {
    state.error = (error as Error).message;
  } finally {
    if (state.loadRequestId === requestId) {
      state.loading = false;
    }
  }
}

async function openSide(side: MergeSide) {
  const state = getState(side);
  if (!state.path) {
    return;
  }
  await window.api.openFile(state.path);
}

async function revealSide(side: MergeSide) {
  const state = getState(side);
  if (!state.path) {
    return;
  }
  await window.api.revealFile(state.path);
}

async function refreshSide(side: MergeSide) {
  await loadFile(side);
}

function switchMode(target: CompareMode) {
  mode.value = target;
  if (target === 'merge') {
    nextTick(() => {
      layoutEditors();
      attachScrollSync();
      if (readyForMerge.value) {
        applyMergePlan();
      }
    });
  } else {
    nextTick(() => {
      layoutEditors();
      attachScrollSync();
    });
  }
}

function layoutEditors() {
  leftEditor?.layout();
  rightEditor?.layout();
  baseEditor?.layout();
  resultEditor?.layout();
}

function attachScrollSync() {
  leftScrollDisposable?.dispose();
  rightScrollDisposable?.dispose();

  if (!leftEditor || !rightEditor) {
    return;
  }

  let syncingLeft = false;
  let syncingRight = false;

  leftScrollDisposable = leftEditor.onDidScrollChange((event) => {
    if (syncingLeft) {
      syncingLeft = false;
      return;
    }
    syncingRight = true;
    rightEditor.setScrollTop(event.scrollTop);
    rightEditor.setScrollLeft(event.scrollLeft);
  });

  rightScrollDisposable = rightEditor.onDidScrollChange((event) => {
    if (syncingRight) {
      syncingRight = false;
      return;
    }
    syncingLeft = true;
    leftEditor.setScrollTop(event.scrollTop);
    leftEditor.setScrollLeft(event.scrollLeft);
  });
}

function updateModel(side: MergeSide) {
  const state = getState(side);
  const language = getLanguageFromPath(state.path);
  const value = state.content || '';
  if (side === 'left') {
    if (!leftModel) {
      leftModel = monaco.editor.createModel(value, language);
      leftEditor?.setModel(leftModel);
    } else {
      if (leftModel.getLanguageId() !== language) {
        monaco.editor.setModelLanguage(leftModel, language);
      }
      leftModel.setValue(value);
    }
  } else if (side === 'right') {
    if (!rightModel) {
      rightModel = monaco.editor.createModel(value, language);
      rightEditor?.setModel(rightModel);
    } else {
      if (rightModel.getLanguageId() !== language) {
        monaco.editor.setModelLanguage(rightModel, language);
      }
      rightModel.setValue(value);
    }
  } else {
    if (!baseModel) {
      baseModel = monaco.editor.createModel(value, language);
      baseEditor?.setModel(baseModel);
    } else {
      if (baseModel.getLanguageId() !== language) {
        monaco.editor.setModelLanguage(baseModel, language);
      }
      baseModel.setValue(value);
    }
  }
}

function updateResultModel(languageHint: string) {
  const language = getLanguageFromPath(languageHint);
  if (!resultModel) {
    resultModel = monaco.editor.createModel('', language);
    resultEditor?.setModel(resultModel);
  } else {
    if (resultModel.getLanguageId() !== language) {
      monaco.editor.setModelLanguage(resultModel, language);
    }
  }
}

function clearDiffDecorations() {
  if (leftEditor && leftDecorations.length) {
    leftDecorations = leftEditor.deltaDecorations(leftDecorations, []);
  }
  if (rightEditor && rightDecorations.length) {
    rightDecorations = rightEditor.deltaDecorations(rightDecorations, []);
  }
}

function applyDiffDecorations(highlights: DiffHighlights) {
  if (!leftEditor || !rightEditor || !leftModel || !rightModel) {
    return;
  }

  const lineClassMap: Record<LineHighlight['type'], string> = {
    added: 'diff-line-added',
    removed: 'diff-line-removed',
    changed: 'diff-line-changed'
  };

  const charClassMap = {
    added: 'diff-char-added',
    removed: 'diff-char-removed'
  } as const;

  const leftLineDecorations = highlights.lineHighlights
    .filter((line) => line.side === 'left')
    .map((line) => {
      const maxColumn = Math.max(leftModel.getLineMaxColumn(line.line), 1);
      return {
        range: new monaco.Range(line.line, 1, line.line, maxColumn),
        options: {
          isWholeLine: true,
          className: lineClassMap[line.type],
          linesDecorationsClassName: `diff-gutter diff-gutter--${line.type}`
        }
      } satisfies monaco.editor.IModelDeltaDecoration;
    });

  const rightLineDecorations = highlights.lineHighlights
    .filter((line) => line.side === 'right')
    .map((line) => {
      const maxColumn = Math.max(rightModel.getLineMaxColumn(line.line), 1);
      return {
        range: new monaco.Range(line.line, 1, line.line, maxColumn),
        options: {
          isWholeLine: true,
          className: lineClassMap[line.type],
          linesDecorationsClassName: `diff-gutter diff-gutter--${line.type}`
        }
      } satisfies monaco.editor.IModelDeltaDecoration;
    });

  const leftCharDecorations = highlights.charHighlights
    .filter((char) => char.side === 'left' && char.endColumn > char.startColumn)
    .map((char) => ({
      range: new monaco.Range(char.line, char.startColumn, char.line, char.endColumn),
      options: {
        inlineClassName: charClassMap[char.type]
      }
    }) satisfies monaco.editor.IModelDeltaDecoration);

  const rightCharDecorations = highlights.charHighlights
    .filter((char) => char.side === 'right' && char.endColumn > char.startColumn)
    .map((char) => ({
      range: new monaco.Range(char.line, char.startColumn, char.line, char.endColumn),
      options: {
        inlineClassName: charClassMap[char.type]
      }
    }) satisfies monaco.editor.IModelDeltaDecoration);

  leftDecorations = leftEditor.deltaDecorations(leftDecorations, [
    ...leftLineDecorations,
    ...leftCharDecorations
  ]);
  rightDecorations = rightEditor.deltaDecorations(rightDecorations, [
    ...rightLineDecorations,
    ...rightCharDecorations
  ]);
}

function applyMergePlan() {
  if (!readyForMerge.value || !resultEditor || !resultModel) {
    if (resultModel) {
      resultModel.setValue('');
    }
    clearConflictDecorations();
    mergeConflicts.splice(0, mergeConflicts.length);
    return;
  }

  if (!baseDoc.value || !leftDoc.value || !rightDoc.value) {
    return;
  }

  const plan = planThreeWayMerge(baseDoc.value, leftDoc.value, rightDoc.value);
  const mergedText = plan.mergedLines.join('\n');
  resultModel.setValue(mergedText);
  clearConflictDecorations();
  mergeConflicts.splice(0, mergeConflicts.length);

  if (!plan.conflicts.length) {
    return;
  }

  const decorations: monaco.editor.IModelDeltaDecoration[] = [];
  const entries: MergeConflictEntry[] = [];

  for (const conflict of plan.conflicts) {
    const startLine = Math.max(conflict.outputStart + 1, 1);
    const endLine = Math.max(conflict.outputEnd, startLine);
    const maxColumn = resultModel.getLineMaxColumn(endLine) || 1;
    decorations.push({
      range: new monaco.Range(startLine, 1, endLine, maxColumn),
      options: {
        isWholeLine: true,
        className: 'merge-conflict-line',
        linesDecorationsClassName: 'merge-conflict-gutter'
      }
    });
    entries.push({
      id: ++conflictIdCounter,
      plan: conflict,
      decorationId: '',
      resolved: false
    });
  }

  const ids = resultEditor.deltaDecorations(conflictDecorationIds, decorations);
  conflictDecorationIds = ids;
  entries.forEach((entry, index) => {
    entry.decorationId = ids[index];
  });
  mergeConflicts.splice(0, mergeConflicts.length, ...entries);
}

function clearConflictDecorations() {
  if (resultEditor && conflictDecorationIds.length) {
    conflictDecorationIds = resultEditor.deltaDecorations(conflictDecorationIds, []);
  }
}

function acceptConflict(conflict: MergeConflictEntry, side: 'left' | 'right') {
  if (!resultEditor || !resultModel || !conflict.decorationId) {
    return;
  }
  const range = resultModel.getDecorationRange(conflict.decorationId);
  if (!range) {
    return;
  }
  const replacementLines = side === 'left' ? conflict.plan.leftLines : conflict.plan.rightLines;
  const text = replacementLines.join('\n');
  resultEditor.pushUndoStop();
  resultEditor.executeEdits('merge-accept', [
    {
      range,
      text,
      forceMoveMarkers: true
    }
  ]);
  resultEditor.pushUndoStop();
  resultEditor.revealRangeInCenter(range);
  conflictDecorationIds = resultEditor.deltaDecorations([conflict.decorationId], []);
  conflict.decorationId = '';
  conflict.resolved = true;
  conflict.resolution = side;
}

function revealConflict(conflict: MergeConflictEntry) {
  if (!resultEditor || !resultModel) {
    return;
  }
  const range = conflict.decorationId ? resultModel.getDecorationRange(conflict.decorationId) : null;
  if (!range) {
    return;
  }
  resultEditor.revealRangeInCenter(range);
  resultEditor.setPosition({ lineNumber: range.startLineNumber, column: 1 });
}

function markConflictResolved(conflict: MergeConflictEntry) {
  if (!resultEditor || !resultModel || !conflict.decorationId) {
    return;
  }
  conflictDecorationIds = resultEditor.deltaDecorations([conflict.decorationId], []);
  conflict.decorationId = '';
  conflict.resolved = true;
  conflict.resolution = 'manual';
}

function autoResolveConflicts() {
  for (const conflict of mergeConflicts) {
    if (conflict.resolved) {
      continue;
    }
    const decision = chooseAutoResolution(conflict.plan);
    if (decision) {
      acceptConflict(conflict, decision);
    }
  }
}

function chooseAutoResolution(plan: PlannedConflict): 'left' | 'right' | null {
  const leftText = plan.leftNormalized.join('\n');
  const rightText = plan.rightNormalized.join('\n');
  const baseText = plan.baseNormalized.join('\n');

  if (leftText === rightText) {
    return 'left';
  }
  if (leftText === baseText && rightText !== baseText) {
    return 'right';
  }
  if (rightText === baseText && leftText !== baseText) {
    return 'left';
  }
  return null;
}

function resetMerge() {
  if (!readyForMerge.value) {
    return;
  }
  applyMergePlan();
}

function conflictDisplayRange(conflict: MergeConflictEntry): string {
  const start = Math.max(conflict.plan.outputStart + 1, 1);
  const end = Math.max(conflict.plan.outputEnd, start);
  return start === end ? `${start}` : `${start}-${end}`;
}

watch(
  () => [leftState.content, leftState.path, ignoreSnapshot.value],
  () => {
    leftDoc.value = prepareDocument(leftState.content || '', ignoreOptions, leftState.path);
    updateModel('left');
    if (mode.value === 'merge' && readyForMerge.value) {
      applyMergePlan();
    }
  }
);

watch(
  () => [rightState.content, rightState.path, ignoreSnapshot.value],
  () => {
    rightDoc.value = prepareDocument(rightState.content || '', ignoreOptions, rightState.path);
    updateModel('right');
    updateResultModel(rightState.path || leftState.path || baseState.path);
    if (mode.value === 'merge' && readyForMerge.value) {
      applyMergePlan();
    }
  }
);

watch(
  () => [baseState.content, baseState.path, ignoreSnapshot.value],
  () => {
    baseDoc.value = prepareDocument(baseState.content || '', ignoreOptions, baseState.path);
    updateModel('base');
    if (mode.value === 'merge' && readyForMerge.value) {
      applyMergePlan();
    }
  }
);

watchEffect(() => {
  if (!readyForDiff.value || !leftDoc.value || !rightDoc.value) {
    diffHighlights.value = null;
    clearDiffDecorations();
    return;
  }
  const highlights = computeDiffHighlights(leftDoc.value, rightDoc.value);
  diffHighlights.value = highlights;
  applyDiffDecorations(highlights);
});

onMounted(() => {
  useMonacoTheme();
  const commonOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
    readOnly: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    fontSize: 14,
    lineNumbersMinChars: 3,
    glyphMargin: false
  };
  if (leftEditorEl.value) {
    leftEditor = monaco.editor.create(leftEditorEl.value, commonOptions);
  }
  if (rightEditorEl.value) {
    rightEditor = monaco.editor.create(rightEditorEl.value, commonOptions);
  }
  if (baseEditorEl.value) {
    baseEditor = monaco.editor.create(baseEditorEl.value, commonOptions);
  }
  if (resultEditorEl.value) {
    resultEditor = monaco.editor.create(resultEditorEl.value, {
      ...commonOptions,
      readOnly: false,
      renderValidationDecorations: 'on'
    });
  }
  updateModel('left');
  updateModel('right');
  updateModel('base');
  updateResultModel(rightState.path || leftState.path || baseState.path);
  attachScrollSync();
  layoutEditors();
});

onBeforeUnmount(() => {
  leftModel?.dispose();
  rightModel?.dispose();
  baseModel?.dispose();
  resultModel?.dispose();
  leftEditor?.dispose();
  rightEditor?.dispose();
  baseEditor?.dispose();
  resultEditor?.dispose();
  leftScrollDisposable?.dispose();
  rightScrollDisposable?.dispose();
});
</script>

<style scoped>
.compare {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.compare__controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.file-card {
  background: #f8fafc;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid transparent;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.file-card--drag {
  border-color: #2563eb;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.15);
}

.file-card--disabled {
  opacity: 0.85;
}

.file-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.file-card__header h2 {
  margin: 0;
  font-size: 18px;
  color: #1f2937;
}

.file-card__hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6b7280;
}

.file-card__primary {
  border: none;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #ffffff;
  border-radius: 999px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 6px 15px rgba(37, 99, 235, 0.28);
}

.file-card__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.file-card__field label {
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
}

.file-card__field select,
.file-card__path input {
  border-radius: 10px;
  border: 1px solid #d1d5db;
  padding: 8px 12px;
  font-size: 14px;
  background: #ffffff;
  color: #111827;
}

.file-card__field--inline {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.file-card__path {
  display: flex;
  gap: 8px;
}

.file-card__path input {
  flex: 1;
}

.file-card__action {
  border: none;
  background: #e5e7eb;
  border-radius: 8px;
  padding: 8px 14px;
  cursor: pointer;
  color: #1f2937;
}

.file-card__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.text-button {
  border: none;
  background: transparent;
  color: #2563eb;
  cursor: pointer;
  font-weight: 600;
}

.file-card__status {
  font-size: 12px;
  color: #2563eb;
}

.file-card__status--error {
  color: #dc2626;
}

.compare__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  justify-content: space-between;
}

.compare__modes {
  display: flex;
  gap: 12px;
}

.compare__modes button {
  padding: 8px 18px;
  border-radius: 999px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  cursor: pointer;
  font-weight: 600;
}

.compare__modes button.active {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.2);
}

.compare__options {
  display: flex;
  gap: 12px;
  color: #4b5563;
  font-size: 14px;
}

.compare__summary {
  display: flex;
  gap: 16px;
  font-size: 14px;
  align-items: center;
}

.compare__summary span {
  color: #1f2937;
}

.summary--added {
  color: #16a34a;
}

.summary--removed {
  color: #dc2626;
}

.summary--changed {
  color: #d97706;
}

.summary--conflict {
  color: #dc2626;
  font-weight: 600;
}

.compare__workspace {
  background: #ffffff;
  border-radius: 18px;
  padding: 20px;
  box-shadow: inset 0 1px 0 rgba(148, 163, 184, 0.12), 0 18px 40px rgba(15, 23, 42, 0.08);
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.workspace__placeholder {
  border: 2px dashed #d1d5db;
  border-radius: 16px;
  padding: 36px;
  text-align: center;
  color: #6b7280;
  font-size: 14px;
}

.diff-workspace,
.merge-workspace {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.diff-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}

.diff-panel {
  display: flex;
  flex-direction: column;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  overflow: hidden;
  background: #fdfdfd;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.diff-panel--drag {
  border-color: #2563eb;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.18);
}

.diff-panel__header {
  padding: 12px 16px;
  font-weight: 600;
  border-bottom: 1px solid #e5e7eb;
  background: linear-gradient(120deg, rgba(37, 99, 235, 0.08), rgba(37, 99, 235, 0.16));
}

.diff-panel__editor {
  min-height: 420px;
}

.merge-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.merge-column {
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  overflow: hidden;
  background: #f9fafb;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.merge-column--drag {
  border-color: #2563eb;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.18);
}

.merge-column header {
  padding: 12px 16px;
  font-weight: 600;
  border-bottom: 1px solid #e5e7eb;
}

.merge-column__editor {
  min-height: 260px;
}

.merge-column__editor--shared {
  min-height: 0;
  height: 260px;
}

.merge-result {
  display: flex;
  flex-direction: column;
  gap: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 16px;
  background: #fefefe;
}

.merge-result__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.merge-result__header h3 {
  margin: 0;
  font-size: 18px;
}

.merge-result__header p {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 13px;
}

.merge-result__actions {
  display: flex;
  gap: 12px;
}

.merge-result__editor {
  min-height: 360px;
}

.conflict-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.conflict-list__header h4 {
  margin: 0;
  font-size: 16px;
}

.conflict-item {
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #ffffff;
}

.conflict-item--resolved {
  border-color: #86efac;
  background: rgba(22, 163, 74, 0.05);
}

.conflict-item__summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.conflict-item__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.conflict-item__content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  background: #f8fafc;
  border-radius: 12px;
  padding: 12px;
}

.conflict-item__content pre {
  margin: 0;
  font-family: 'Fira Code', 'SFMono-Regular', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 12px;
  white-space: pre-wrap;
  background: #ffffff;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

@media (max-width: 768px) {
  .compare__controls {
    grid-template-columns: 1fr;
  }

  .compare__toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .compare__options {
    flex-wrap: wrap;
  }
}
</style>
