export type ScriptExecutionStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped';

export interface ScriptExecutionResult {
  filePath: string;
  status: Exclude<ScriptExecutionStatus, 'pending' | 'running'>;
  message: string;
}

export interface ScriptExecutionProgress {
  filePath: string | null;
  status: ScriptExecutionStatus;
  message: string;
}

export interface ScriptExecutionPayload {
  files: string[];
  connection: {
    user: string;
    password: string;
    host?: string;
    port?: number;
    serviceName?: string;
    connectString?: string;
    clientLibDir?: string;
    configOverrides?: Record<string, unknown>;
  };
}

declare global {
  interface Window {
    api: {
      selectDirectory: () => Promise<string | null>;
      searchFiles: (payload: { directory: string; keyword: string }) => Promise<
        Array<{ path: string; name: string; matches: number }>
      >;
      listScripts: (directory: string) => Promise<Array<{ path: string; name: string }>>;
      executeScripts: (payload: ScriptExecutionPayload) => Promise<{
        success: boolean;
        message: string;
        results: ScriptExecutionResult[];
      }>;
      openFile: (filePath: string) => Promise<boolean>;
      revealFile: (filePath: string) => Promise<boolean>;
      onScriptProgress: (callback: (payload: ScriptExecutionProgress) => void) => () => void;
    };
  }
}

export {};
