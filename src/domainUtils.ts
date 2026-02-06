// Shared domain validation and extraction utilities

export interface DomainCheckResult {
  green: boolean | null;
  hostedBy?: string;
  error?: string;
}

export const SUPPORTED_LANGUAGES = new Set([
  'javascript',
  'javascriptreact',
  'typescript',
  'typescriptreact',
  'python',
  'java',
  'csharp',
  'html',
  'css',
  'scss',
  'sass',
  'less',
  'json',
  'jsonc',
  'xml',
  'yaml',
  'markdown',
  'php',
  'ruby',
  'go',
  'rust',
  'vue',
  'svelte',
  'astro',
  'handlebars',
  'ejs',
  'twig',
  'razor',
  'blade',
  'dockerfile',
  'shellscript',
  'r',
  'plaintext',
]);

export const EXCLUDE_PATTERNS = new Set([
  // File extensions
  'js', 'ts', 'tsx', 'jsx', 'css', 'scss', 'sass', 'less', 'html', 'htm',
  'json', 'xml', 'yaml', 'yml', 'md', 'txt', 'csv', 'svg', 'png', 'jpg',
  'jpeg', 'gif', 'ico', 'woff', 'woff2', 'ttf', 'eot', 'pdf', 'zip', 'tar',
  'gz', 'rar', '7z', 'exe', 'dll', 'so', 'dylib', 'py', 'rb', 'php', 'java',
  'go', 'rs', 'c', 'cpp', 'h', 'hpp', 'cs', 'swift', 'kt', 'sh', 'bash',
  'zsh', 'fish', 'ps1', 'bat', 'cmd', 'env', 'lock', 'log', 'map', 'vue',
  'svelte', 'astro', 'prisma', 'graphql', 'sql', 'db', 'sqlite', 'config',
  // Common patterns that look like domains but aren't
  'localhost', 'example.com', 'example.org', 'example.net', 'test.com',
  'package.json', 'package-lock.json', 'tsconfig.json', 'webpack.config',
  'babel.config', 'eslint.config', 'prettier.config', 'jest.config',
]);

export const CODE_KEYWORDS = new Set([
  // JavaScript/TypeScript keywords and objects
  'this', 'self', 'super', 'import', 'export', 'require', 'module', 'exports',
  'console', 'logger', 'log', 'debug', 'error', 'warn', 'info', 'trace',
  'window', 'document', 'navigator', 'location', 'history', 'screen',
  'process', 'global', 'globalThis', 'Buffer',
  'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Symbol',
  'Date', 'Promise', 'Proxy', 'Reflect', 'Map', 'Set', 'WeakMap', 'WeakSet',
  'Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError',
  'Function', 'RegExp', 'Int8Array', 'Uint8Array', 'Float32Array', 'Float64Array',
  'Intl', 'Atomics', 'SharedArrayBuffer', 'DataView', 'ArrayBuffer',
  // Common variable names
  'app', 'server', 'client', 'db', 'database', 'api', 'router', 'route',
  'req', 'res', 'request', 'response', 'ctx', 'context', 'config', 'options',
  'props', 'state', 'store', 'dispatch', 'action', 'reducer', 'selector',
  'component', 'element', 'node', 'event', 'handler', 'callback', 'listener',
  'util', 'utils', 'helper', 'helpers', 'service', 'services', 'controller',
  'model', 'schema', 'type', 'types', 'interface', 'enum',
  // Python
  'print', 'len', 'str', 'int', 'float', 'list', 'dict', 'tuple', 'set',
  'cls', 'kwargs', 'args',
  // Testing
  'describe', 'it', 'test', 'expect', 'assert', 'mock', 'spy', 'jest', 'vi',
  // React/Vue/Angular
  'React', 'Vue', 'Angular', 'Component', 'Directive', 'Pipe', 'Injectable',
  'useState', 'useEffect', 'useRef', 'useMemo', 'useCallback', 'useContext',
]);

export const VALID_TLDS = new Set([
  'com', 'org', 'net', 'io', 'co', 'dev', 'app', 'ai', 'cloud', 'tech',
  'edu', 'gov', 'mil', 'int', 'eu', 'uk', 'de', 'fr', 'it', 'es', 'nl',
  'be', 'ch', 'at', 'au', 'ca', 'us', 'jp', 'cn', 'kr', 'in', 'br', 'ru',
  'pl', 'se', 'no', 'dk', 'fi', 'cz', 'pt', 'ie', 'nz', 'za', 'mx', 'ar',
  'cl', 'co', 'pe', 've', 'info', 'biz', 'pro', 'museum', 'aero',
  'jobs', 'mobi', 'travel', 'xxx', 'asia', 'cat', 'coop', 'tel', 'post',
  'me', 'tv', 'cc', 'ws', 'fm', 'am', 'ly', 'gl', 'gg', 'to', 'is', 'it',
  'st', 'su', 'ac', 'sh', 'cx', 'nu', 'tk', 'cf', 'ga', 'gq', 'ml',
]);

// Regex for full URLs (with protocol)
export const FULL_URL_REGEX = /https?:\/\/(?:www\.)?([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,})(?:\/[^\s"'`<>)\]]*)?/gi;

// Regex for domains without protocol (can appear anywhere in text)
export const DOMAIN_REGEX = /(?<![a-zA-Z0-9@/_])(?:www\.)?([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.([a-zA-Z]{2,}))(?:\/[^\s"'`<>)\]]*)?(?![a-zA-Z0-9_])/gi;

export function isValidDomain(domain: string): boolean {
  const lower = domain.toLowerCase();
  
  if (lower.includes('localhost') || /^\d+\.\d+\.\d+\.\d+/.test(domain)) {
    return false;
  }
  
  if (EXCLUDE_PATTERNS.has(lower)) {
    return false;
  }
  
  const parts = lower.split('.');
  const tld = parts[parts.length - 1];
  
  if (!VALID_TLDS.has(tld)) {
    return false;
  }
  
  for (const part of parts) {
    if (EXCLUDE_PATTERNS.has(part) && parts.length <= 2) {
      return false;
    }
  }
  
  return domain.length >= 4;
}
