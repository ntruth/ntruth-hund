import { diffChars, diffLines } from 'diff';

export interface IgnoreOptions {
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
  ignoreComments: boolean;
}

interface CommentConfig {
  line: string[];
  block: Array<{ start: string; end: string }>;
}

interface CommentState {
  activeBlock: string | null;
}

function getExtension(path?: string): string {
  if (!path) {
    return '';
  }
  const match = /\.([^.]+)$/i.exec(path.trim());
  return match ? match[1].toLowerCase() : '';
}

function resolveCommentConfig(ext: string): CommentConfig {
  switch (ext) {
    case 'sql':
    case 'pck':
      return {
        line: ['--'],
        block: [
          { start: '/*', end: '*/' }
        ]
      };
    case 'xml':
    case 'xhtml':
    case 'html':
    case 'jsp':
      return {
        line: ['//'],
        block: [
          { start: '/*', end: '*/' },
          { start: '<!--', end: '-->' }
        ]
      };
    case 'java':
    case 'js':
    case 'ts':
    case 'json':
      return {
        line: ['//'],
        block: [
          { start: '/*', end: '*/' }
        ]
      };
    default:
      return {
        line: ['//', '--', '#'],
        block: [
          { start: '/*', end: '*/' },
          { start: '<!--', end: '-->' }
        ]
      };
  }
}

function stripCommentsFromLine(
  line: string,
  config: CommentConfig,
  state: CommentState
): string {
  if (!line) {
    return '';
  }

  let result = '';
  let index = 0;
  let stringQuote: string | null = null;

  const advance = (step: number) => {
    index += step;
  };

  while (index < line.length) {
    const remaining = line.slice(index);

    if (state.activeBlock) {
      const endIndex = remaining.indexOf(state.activeBlock);
      if (endIndex === -1) {
        // Entire remainder is within block comment.
        return result;
      }
      advance(endIndex + state.activeBlock.length);
      state.activeBlock = null;
      continue;
    }

    const char = remaining[0];

    if (stringQuote) {
      result += char;
      advance(1);
      const prevChar = index > 0 ? line[index - 1] : '';
      if (char === stringQuote && prevChar !== '\\') {
        stringQuote = null;
      }
      continue;
    }

    if (char === '"' || char === '\'' || char === '`') {
      stringQuote = char;
      result += char;
      advance(1);
      continue;
    }

    let matched = false;

    for (const block of config.block) {
      if (block.start && remaining.startsWith(block.start)) {
        state.activeBlock = block.end;
        advance(block.start.length);
        matched = true;
        break;
      }
    }
    if (matched) {
      continue;
    }

    for (const marker of config.line) {
      if (marker && remaining.startsWith(marker)) {
        return result;
      }
    }

    result += char;
    advance(1);
  }

  return result;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, '');
}

export interface NormalizedDocument {
  rawLines: string[];
  normalizedLines: string[];
  normalizedText: string;
}

export function prepareDocument(
  text: string,
  options: IgnoreOptions,
  pathHint?: string
): NormalizedDocument {
  const normalizedText = text.replace(/\r\n/g, '\n');
  const rawLines = normalizedText.split('\n');
  const normalizedLines: string[] = [];

  const ext = getExtension(pathHint);
  const commentConfig = resolveCommentConfig(ext);
  const state: CommentState = { activeBlock: null };

  for (const rawLine of rawLines) {
    let working = rawLine;
    if (options.ignoreComments) {
      working = stripCommentsFromLine(working, commentConfig, state);
    }
    if (options.ignoreWhitespace) {
      working = normalizeWhitespace(working);
    }
    if (options.ignoreCase) {
      working = working.toLowerCase();
    }
    normalizedLines.push(working);
  }

  return {
    rawLines,
    normalizedLines,
    normalizedText: normalizedLines.join('\n')
  };
}

export interface LineHighlight {
  side: 'left' | 'right';
  line: number;
  type: 'added' | 'removed' | 'changed';
}

export interface CharHighlight {
  side: 'left' | 'right';
  line: number;
  startColumn: number;
  endColumn: number;
  type: 'added' | 'removed';
}

export interface DiffHighlights {
  summary: {
    added: number;
    removed: number;
    changed: number;
  };
  lineHighlights: LineHighlight[];
  charHighlights: CharHighlight[];
}

function countLines(value: string): number {
  if (!value) {
    return 0;
  }
  let count = 0;
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] === '\n') {
      count += 1;
    }
  }
  // diffLines always appends a trailing newline to chunks except possibly the last one.
  return value.endsWith('\n') ? count : count + 1;
}

export function computeDiffHighlights(
  left: NormalizedDocument,
  right: NormalizedDocument
): DiffHighlights {
  const diff = diffLines(left.normalizedText, right.normalizedText, {
    newlineIsToken: true
  });

  const lineHighlights: LineHighlight[] = [];
  const charHighlights: CharHighlight[] = [];

  let leftIndex = 0;
  let rightIndex = 0;
  let pendingRemoved: Array<{ line: string; index: number }> = [];
  let pendingAdded: Array<{ line: string; index: number }> = [];
  let changedLines = 0;
  let addedLines = 0;
  let removedLines = 0;

  function flushPending() {
    if (!pendingRemoved.length && !pendingAdded.length) {
      return;
    }

    const max = Math.max(pendingRemoved.length, pendingAdded.length);
    for (let i = 0; i < max; i += 1) {
      const removedEntry = i < pendingRemoved.length ? pendingRemoved[i] : undefined;
      const addedEntry = i < pendingAdded.length ? pendingAdded[i] : undefined;

      if (removedEntry && addedEntry) {
        const charDiffs = diffChars(removedEntry.line, addedEntry.line);
        let leftPos = 1;
        let rightPos = 1;

        for (const part of charDiffs) {
          const length = part.value.length;
          if (part.removed) {
            charHighlights.push({
              side: 'left',
              line: removedEntry.index + 1,
              startColumn: leftPos,
              endColumn: leftPos + length,
              type: 'removed'
            });
            leftPos += length;
          } else if (part.added) {
            charHighlights.push({
              side: 'right',
              line: addedEntry.index + 1,
              startColumn: rightPos,
              endColumn: rightPos + length,
              type: 'added'
            });
            rightPos += length;
          } else {
            leftPos += length;
            rightPos += length;
          }
        }

        lineHighlights.push({ side: 'left', line: removedEntry.index + 1, type: 'changed' });
        lineHighlights.push({ side: 'right', line: addedEntry.index + 1, type: 'changed' });
        changedLines += 1;
      }
    }

    if (pendingRemoved.length > pendingAdded.length) {
      for (let i = pendingAdded.length; i < pendingRemoved.length; i += 1) {
        const entry = pendingRemoved[i];
        if (entry) {
          lineHighlights.push({ side: 'left', line: entry.index + 1, type: 'removed' });
        }
      }
    }

    if (pendingAdded.length > pendingRemoved.length) {
      for (let i = pendingRemoved.length; i < pendingAdded.length; i += 1) {
        const entry = pendingAdded[i];
        if (entry) {
          lineHighlights.push({ side: 'right', line: entry.index + 1, type: 'added' });
        }
      }
    }

    pendingRemoved = [];
    pendingAdded = [];
  }

  for (const part of diff) {
    const lineCount = countLines(part.value);
    if (part.added) {
      for (let i = 0; i < lineCount; i += 1) {
        if (rightIndex >= right.rawLines.length) {
          break;
        }
        pendingAdded.push({
          line: right.rawLines[rightIndex],
          index: rightIndex
        });
        rightIndex += 1;
        addedLines += 1;
      }
    } else if (part.removed) {
      for (let i = 0; i < lineCount; i += 1) {
        if (leftIndex >= left.rawLines.length) {
          break;
        }
        pendingRemoved.push({
          line: left.rawLines[leftIndex],
          index: leftIndex
        });
        leftIndex += 1;
        removedLines += 1;
      }
    } else {
      flushPending();
      leftIndex += lineCount;
      rightIndex += lineCount;
    }
  }

  flushPending();

  return {
    summary: {
      added: addedLines,
      removed: removedLines,
      changed: changedLines
    },
    lineHighlights,
    charHighlights
  };
}

interface Edit {
  baseStart: number;
  baseEnd: number;
  newLines: string[];
  newNormalized: string[];
}

function computeEdits(base: NormalizedDocument, branch: NormalizedDocument): Edit[] {
  const baseLines = base.normalizedLines;
  const branchLines = branch.normalizedLines;
  const n = baseLines.length;
  const m = branchLines.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      if (baseLines[i] === branchLines[j]) {
        lcs[i][j] = lcs[i + 1][j + 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }
  }

  const edits: Edit[] = [];
  let i = 0;
  let j = 0;

  while (i < n || j < m) {
    if (i < n && j < m && baseLines[i] === branchLines[j]) {
      i += 1;
      j += 1;
      continue;
    }

    const start = i;
    const newLines: string[] = [];
    const newNormalized: string[] = [];

    while (i < n || j < m) {
      if (j < m && (i >= n || lcs[i][j + 1] >= (lcs[i + 1]?.[j] ?? 0))) {
        newLines.push(branch.rawLines[j]);
        newNormalized.push(branchLines[j]);
        j += 1;
      } else if (i < n) {
        i += 1;
      } else {
        break;
      }

      if (i < n && j < m && baseLines[i] === branchLines[j]) {
        break;
      }
    }

    edits.push({
      baseStart: start,
      baseEnd: i,
      newLines,
      newNormalized
    });
  }

  return edits;
}

type MergeSegment =
  | {
      type: 'common';
      baseStart: number;
      baseEnd: number;
      lines: string[];
    }
  | {
      type: 'left';
      baseStart: number;
      baseEnd: number;
      leftLines: string[];
    }
  | {
      type: 'right';
      baseStart: number;
      baseEnd: number;
      rightLines: string[];
    }
  | {
      type: 'conflict';
      baseStart: number;
      baseEnd: number;
      leftLines: string[];
      leftNormalized: string[];
      rightLines: string[];
      rightNormalized: string[];
    };

function mergeEdits(
  base: NormalizedDocument,
  left: Edit[],
  right: Edit[]
): MergeSegment[] {
  const segments: MergeSegment[] = [];
  const baseLen = base.rawLines.length;

  let baseIndex = 0;
  let leftIndex = 0;
  let rightIndex = 0;

  const nextLeft = () => left[leftIndex];
  const nextRight = () => right[rightIndex];

  while (baseIndex < baseLen || leftIndex < left.length || rightIndex < right.length) {
    const leftEdit = nextLeft();
    const rightEdit = nextRight();
    const nextLeftStart = leftEdit ? leftEdit.baseStart : Infinity;
    const nextRightStart = rightEdit ? rightEdit.baseStart : Infinity;
    const nextStart = Math.min(nextLeftStart, nextRightStart, baseLen);

    if (baseIndex < nextStart) {
      segments.push({
        type: 'common',
        baseStart: baseIndex,
        baseEnd: nextStart,
        lines: base.rawLines.slice(baseIndex, nextStart)
      });
      baseIndex = nextStart;
      continue;
    }

    if (leftEdit && leftEdit.baseStart === baseIndex && rightEdit && rightEdit.baseStart === baseIndex) {
      const baseEnd = Math.max(leftEdit.baseEnd, rightEdit.baseEnd);
      segments.push({
        type: 'conflict',
        baseStart: baseIndex,
        baseEnd,
        leftLines: leftEdit.newLines,
        leftNormalized: leftEdit.newNormalized,
        rightLines: rightEdit.newLines,
        rightNormalized: rightEdit.newNormalized
      });
      baseIndex = baseEnd;
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }

    if (leftEdit && leftEdit.baseStart === baseIndex) {
      segments.push({
        type: 'left',
        baseStart: baseIndex,
        baseEnd: leftEdit.baseEnd,
        leftLines: leftEdit.newLines
      });
      baseIndex = leftEdit.baseEnd;
      leftIndex += 1;
      continue;
    }

    if (rightEdit && rightEdit.baseStart === baseIndex) {
      segments.push({
        type: 'right',
        baseStart: baseIndex,
        baseEnd: rightEdit.baseEnd,
        rightLines: rightEdit.newLines
      });
      baseIndex = rightEdit.baseEnd;
      rightIndex += 1;
      continue;
    }

    if (baseIndex >= baseLen) {
      if (leftEdit && leftEdit.baseStart === baseLen) {
        segments.push({
          type: 'left',
          baseStart: baseLen,
          baseEnd: baseLen,
          leftLines: leftEdit.newLines
        });
        leftIndex += 1;
        continue;
      }
      if (rightEdit && rightEdit.baseStart === baseLen) {
        segments.push({
          type: 'right',
          baseStart: baseLen,
          baseEnd: baseLen,
          rightLines: rightEdit.newLines
        });
        rightIndex += 1;
        continue;
      }
      break;
    }

    // Fallback: advance to avoid infinite loops.
    segments.push({
      type: 'common',
      baseStart: baseIndex,
      baseEnd: baseIndex + 1,
      lines: base.rawLines.slice(baseIndex, baseIndex + 1)
    });
    baseIndex += 1;
  }

  if (baseIndex < baseLen) {
    segments.push({
      type: 'common',
      baseStart: baseIndex,
      baseEnd: baseLen,
      lines: base.rawLines.slice(baseIndex)
    });
  }

  return segments;
}

export interface PlannedConflict {
  baseStart: number;
  baseEnd: number;
  baseLines: string[];
  baseNormalized: string[];
  leftLines: string[];
  leftNormalized: string[];
  rightLines: string[];
  rightNormalized: string[];
  outputStart: number;
  outputEnd: number;
}

export interface MergePlan {
  mergedLines: string[];
  conflicts: PlannedConflict[];
}

export function planThreeWayMerge(
  baseDoc: NormalizedDocument,
  leftDoc: NormalizedDocument,
  rightDoc: NormalizedDocument
): MergePlan {
  const leftEdits = computeEdits(baseDoc, leftDoc);
  const rightEdits = computeEdits(baseDoc, rightDoc);
  const segments = mergeEdits(baseDoc, leftEdits, rightEdits);

  const mergedLines: string[] = [];
  const conflicts: PlannedConflict[] = [];

  for (const segment of segments) {
    if (segment.type === 'common') {
      mergedLines.push(...segment.lines);
    } else if (segment.type === 'left') {
      mergedLines.push(...segment.leftLines);
    } else if (segment.type === 'right') {
      mergedLines.push(...segment.rightLines);
    } else if (segment.type === 'conflict') {
      const baseLines = baseDoc.rawLines.slice(segment.baseStart, segment.baseEnd);
      const baseNormalized = baseDoc.normalizedLines.slice(segment.baseStart, segment.baseEnd);

      const leftJoined = segment.leftNormalized.join('\n');
      const rightJoined = segment.rightNormalized.join('\n');

      if (leftJoined === rightJoined) {
        mergedLines.push(...segment.leftLines);
        continue;
      }

      if (segment.leftNormalized.length === 0 && segment.rightNormalized.length > 0) {
        mergedLines.push(...segment.rightLines);
        continue;
      }

      if (segment.rightNormalized.length === 0 && segment.leftNormalized.length > 0) {
        mergedLines.push(...segment.leftLines);
        continue;
      }

      const outputStart = mergedLines.length;
      conflicts.push({
        baseStart: segment.baseStart,
        baseEnd: segment.baseEnd,
        baseLines,
        baseNormalized,
        leftLines: segment.leftLines,
        leftNormalized: segment.leftNormalized,
        rightLines: segment.rightLines,
        rightNormalized: segment.rightNormalized,
        outputStart,
        outputEnd: outputStart + baseLines.length
      });
      mergedLines.push(...baseLines);
    }
  }

  return { mergedLines, conflicts };
}
