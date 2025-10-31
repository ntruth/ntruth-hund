import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution';
import 'monaco-editor/esm/vs/basic-languages/xml/xml.contribution';
import 'monaco-editor/esm/vs/basic-languages/java/java.contribution';
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution';
import 'monaco-editor/esm/vs/basic-languages/html/html.contribution';
import 'monaco-editor/esm/vs/basic-languages/css/css.contribution';

const workers: Record<string, () => Worker> = {
  json: () => new jsonWorker(),
  css: () => new cssWorker(),
  scss: () => new cssWorker(),
  less: () => new cssWorker(),
  html: () => new htmlWorker(),
  handlebars: () => new htmlWorker(),
  razor: () => new htmlWorker(),
  javascript: () => new tsWorker(),
  typescript: () => new tsWorker(),
  default: () => new editorWorker()
};

if (typeof self !== 'undefined') {
  (self as unknown as { MonacoEnvironment?: monaco.Environment }).MonacoEnvironment = {
    getWorker(_, label) {
      const factory = workers[label] ?? workers.default;
      return factory();
    }
  };
}

let themeInitialized = false;

function ensureTheme() {
  if (themeInitialized) {
    return;
  }
  monaco.editor.defineTheme('ntruth-diff', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: '', foreground: '1f2937', background: 'ffffff' }
    ],
    colors: {
      'editorLineNumber.foreground': '#9ca3af',
      'editorLineNumber.activeForeground': '#2563eb',
      'editorGutter.background': '#f9fafb',
      'editor.background': '#ffffff'
    }
  });
  themeInitialized = true;
}

export function useMonacoTheme() {
  ensureTheme();
  monaco.editor.setTheme('ntruth-diff');
}

export default monaco;
