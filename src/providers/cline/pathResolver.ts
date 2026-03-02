import * as path from 'path';
import * as os from 'os';

const CLINE_EXTENSION_ID = 'saoudrizwan.claude-dev';

/**
 * Resolve Cline's globalStorage tasks directory.
 * Windows: %APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev\tasks
 * macOS: ~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/tasks
 * Linux: ~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/tasks
 */
export function getClineTasksDir(): string {
  const platform = os.platform();
  let base: string;
  if (platform === 'win32') {
    base = path.join(process.env.APPDATA || os.homedir(), 'Code', 'User', 'globalStorage', CLINE_EXTENSION_ID);
  } else if (platform === 'darwin') {
    base = path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'globalStorage', CLINE_EXTENSION_ID);
  } else {
    base = path.join(os.homedir(), '.config', 'Code', 'User', 'globalStorage', CLINE_EXTENSION_ID);
  }
  return path.join(base, 'tasks');
}

export const CLINE_HISTORY_FILENAME = 'api_conversation_history.json';
