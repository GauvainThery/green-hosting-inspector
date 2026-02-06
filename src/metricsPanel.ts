import * as vscode from 'vscode';
import {
  DomainCheckResult,
  EXCLUDE_PATTERNS,
  CODE_KEYWORDS,
  VALID_TLDS,
  FULL_URL_REGEX,
  DOMAIN_REGEX,
  isValidDomain,
} from './domainUtils';

// --- Types ---

interface DomainMetric {
  domain: string;
  green: boolean | null;
  hostedBy?: string;
  occurrences: number;
  files: string[];
}

interface WorkspaceMetrics {
  totalUrls: number;
  uniqueDomains: number;
  greenDomains: number;
  notVerifiedDomains: number;
  scannedFiles: number;
  domains: DomainMetric[];
}

export type BatchInspectFn = (
  domains: string[]
) => Promise<Map<string, DomainCheckResult>>;

// --- Constants ---

const FILE_GLOB =
  '**/*.{js,jsx,mjs,cjs,ts,tsx,py,java,cs,html,htm,css,json,xml,md,php,rb,go,rs,vue,svelte,scss,yaml,yml,sh,r,txt}';
const EXCLUDE_GLOB =
  '{**/node_modules/**,**/.git/**,**/dist/**,**/out/**,**/build/**,**/.next/**,**/coverage/**,**/.vscode/**,**/vendor/**,**/*.min.js,**/*.min.css,**/*.bundle.js,**/*.map}';
const MAX_FILES = 5000;
const MAX_FILE_SIZE = 512 * 1024; // 512 KB

// --- Domain extraction (text-only, no Range objects) ---

function extractDomainsFromText(text: string): string[] {
  const domains: string[] = [];
  const matchedRanges: [number, number][] = [];

  let match: RegExpExecArray | null;
  const fullUrlRegex = new RegExp(FULL_URL_REGEX);
  while ((match = fullUrlRegex.exec(text)) !== null) {
    const domain = match[1].toLowerCase();
    if (isValidDomain(domain)) {
      domains.push(domain);
      matchedRanges.push([match.index, match.index + match[0].length]);
    }
  }

  const domainRegex = new RegExp(DOMAIN_REGEX);
  while ((match = domainRegex.exec(text)) !== null) {
    const domain = match[1].toLowerCase();
    const tld = match[2].toLowerCase();
    const firstPart = domain.split('.')[0];

    if (CODE_KEYWORDS.has(firstPart)) { continue; }

    const pos = match.index;
    if (matchedRanges.some(([s, e]) => pos >= s && pos < e)) { continue; }

    const charBefore = pos > 0 ? text[pos - 1] : '';
    const charTwoBefore = pos > 1 ? text[pos - 2] : '';
    const charAfter = text[pos + match[0].length] || '';
    if (charBefore === '.' && /[a-zA-Z0-9_$]/.test(charTwoBefore)) { continue; }
    if (charAfter === '(') { continue; }

    if (isValidDomain(domain) && VALID_TLDS.has(tld)) {
      domains.push(domain);
    }
  }

  return domains;
}

// --- Webview Panel ---

export class MetricsPanel {
  public static currentPanel: MetricsPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly _extensionUri: vscode.Uri,
    private readonly _batchInspect: BatchInspectFn,
    private readonly _saveCacheToStorage: () => void,
    private readonly _outputChannel: vscode.OutputChannel,
  ) {
    this._panel = panel;
    this._panel.webview.html = this._getHtml();

    this._panel.webview.onDidReceiveMessage(
      async (msg) => {
        if (msg.command === 'ready' || msg.command === 'refresh') {
          await this._runScan();
        }
      },
      null,
      this._disposables,
    );

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    batchInspect: BatchInspectFn,
    saveCacheToStorage: () => void,
    outputChannel: vscode.OutputChannel,
  ) {
    const column = vscode.window.activeTextEditor?.viewColumn;

    if (MetricsPanel.currentPanel) {
      MetricsPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'greenHostingMetrics',
      'Green Hosting Metrics',
      column || vscode.ViewColumn.One,
      { enableScripts: true, localResourceRoots: [extensionUri] },
    );

    MetricsPanel.currentPanel = new MetricsPanel(
      panel, extensionUri, batchInspect, saveCacheToStorage, outputChannel,
    );
  }

  public dispose() {
    MetricsPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      this._disposables.pop()?.dispose();
    }
  }

  // --- Scan logic ---

  private async _runScan() {
    try {
      this._post({ command: 'scanning' });
      const metrics = await this._scanWorkspace();
      this._saveCacheToStorage();
      this._post({ command: 'results', data: metrics });
    } catch (err) {
      this._post({ command: 'error', message: String(err) });
    }
  }

  private async _scanWorkspace(): Promise<WorkspaceMetrics> {
    if (!vscode.workspace.workspaceFolders?.length) {
      throw new Error('No workspace folder is open.');
    }

    this._post({ command: 'progress', message: 'Finding files…' });
    const files = await vscode.workspace.findFiles(FILE_GLOB, EXCLUDE_GLOB, MAX_FILES);
    this._outputChannel.appendLine(`[Metrics] Found ${files.length} files to scan`);
    this._post({ command: 'progress', message: `Scanning ${files.length} files…` });

    const decoder = new TextDecoder('utf-8');
    const domainMap = new Map<string, { occurrences: number; files: Set<string> }>();
    let scannedFiles = 0;

    // Read files in parallel batches of 100
    for (let i = 0; i < files.length; i += 100) {
      const batch = files.slice(i, i + 100);
      const reads = batch.map(async (uri) => {
        try {
          const stat = await vscode.workspace.fs.stat(uri);
          if (stat.size > MAX_FILE_SIZE) { return; }
          const bytes = await vscode.workspace.fs.readFile(uri);
          const text = decoder.decode(bytes);
          const domains = extractDomainsFromText(text);
          const relativePath = vscode.workspace.asRelativePath(uri);
          return { domains, relativePath };
        } catch {
          return undefined;
        }
      });

      const results = await Promise.all(reads);
      for (const r of results) {
        if (!r) { continue; }
        scannedFiles++;
        for (const domain of r.domains) {
          const entry = domainMap.get(domain) ?? { occurrences: 0, files: new Set<string>() };
          entry.occurrences++;
          entry.files.add(r.relativePath);
          domainMap.set(domain, entry);
        }
      }
    }

    const uniqueDomains = [...domainMap.keys()];
    this._outputChannel.appendLine(`[Metrics] Found ${uniqueDomains.length} unique domains across ${scannedFiles} files`);
    this._post({ command: 'progress', message: `Checking ${uniqueDomains.length} domains…` });

    const apiResults = await this._batchInspect(uniqueDomains);

    let greenCount = 0;
    let notVerifiedCount = 0;
    const domainMetrics: DomainMetric[] = [];

    for (const [domain, info] of domainMap) {
      const result = apiResults.get(domain);
      const isGreen = result?.green === true;
      if (isGreen) { greenCount++; } else { notVerifiedCount++; }
      domainMetrics.push({
        domain,
        green: result?.green ?? null,
        hostedBy: result?.hostedBy,
        occurrences: info.occurrences,
        files: [...info.files],
      });
    }

    domainMetrics.sort((a, b) => {
      if (a.green === true && b.green !== true) { return -1; }
      if (a.green !== true && b.green === true) { return 1; }
      return b.occurrences - a.occurrences;
    });

    return {
      totalUrls: [...domainMap.values()].reduce((s, d) => s + d.occurrences, 0),
      uniqueDomains: uniqueDomains.length,
      greenDomains: greenCount,
      notVerifiedDomains: notVerifiedCount,
      scannedFiles,
      domains: domainMetrics,
    };
  }

  private _post(message: unknown) {
    this._panel.webview.postMessage(message);
  }

  // --- HTML ---

  private _getHtml(): string {
    const nonce = getNonce();

    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Green Hosting Metrics</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      padding: 24px;
    }
    .container { max-width: 920px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .header h1 { font-size: 1.35em; font-weight: 600; }
    .refresh-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none; border-radius: 4px;
      padding: 6px 14px; cursor: pointer; font-size: 0.85em;
    }
    .refresh-btn:hover { background: var(--vscode-button-hoverBackground); }
    .refresh-btn:disabled { opacity: 0.5; cursor: default; }

    .cards { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .card {
      flex: 1; min-width: 130px;
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-widget-border);
      border-radius: 8px; padding: 16px; text-align: center;
    }
    .card-value { font-size: 2em; font-weight: 700; line-height: 1.1; }
    .card-label { font-size: 0.82em; opacity: 0.7; margin-top: 6px; }
    .card.green .card-value { color: #22c55e; }
    .card.yellow .card-value { color: #eab308; }

    .bar-section { margin-bottom: 24px; }
    .bar-track { height: 10px; background: var(--vscode-widget-border); border-radius: 5px; overflow: hidden; }
    .bar-fill { height: 100%; background: #22c55e; border-radius: 5px; transition: width 0.4s ease; }
    .bar-label { font-size: 0.82em; opacity: 0.7; margin-top: 6px; text-align: right; }

    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { padding: 7px 12px; text-align: left; border-bottom: 1px solid var(--vscode-widget-border); font-size: 0.88em; }
    th { opacity: 0.65; font-weight: 600; text-transform: uppercase; font-size: 0.78em; letter-spacing: 0.03em; }
    .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
    .dot.green { background: #22c55e; }
    .dot.yellow { background: #eab308; }
    .domain-link { color: var(--vscode-textLink-foreground); text-decoration: none; }
    .domain-link:hover { text-decoration: underline; }
    .hosted-by { opacity: 0.7; }
    .files-list { font-size: 0.82em; opacity: 0.65; }

    .status-msg { text-align: center; padding: 60px 20px; opacity: 0.7; font-size: 1em; }
    .spinner { display: inline-block; width: 18px; height: 18px; border: 2px solid var(--vscode-widget-border); border-top-color: var(--vscode-textLink-foreground); border-radius: 50%; animation: spin 0.8s linear infinite; vertical-align: middle; margin-right: 8px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    
    .legend { margin-top: 24px; padding: 16px; background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-widget-border); border-radius: 8px; }
    .legend-title { font-size: 0.9em; font-weight: 600; margin-bottom: 10px; }
    .legend-item { display: flex; align-items: center; margin-bottom: 8px; font-size: 0.85em; }
    .legend-item:last-child { margin-bottom: 0; }
    .legend-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 8px; flex-shrink: 0; }
    .legend-text { opacity: 0.85; }
    
    .limits { margin-top: 16px; padding: 12px; background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-widget-border); border-radius: 8px; font-size: 0.8em; opacity: 0.7; }
    .limits-title { font-weight: 600; margin-bottom: 6px; }
    .limits-list { margin: 0; padding-left: 18px; }
    .limits-list li { margin-bottom: 3px; }
    
    .footer { margin-top: 20px; font-size: 0.8em; opacity: 0.5; text-align: center; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Green Hosting Metrics</h1>
      <button class="refresh-btn" id="refreshBtn" disabled>Refresh</button>
    </div>

    <div id="status" class="status-msg"><span class="spinner"></span> Initializing…</div>

    <div id="content" class="hidden">
      <div class="cards">
        <div class="card"><div class="card-value" id="totalUrls">-</div><div class="card-label">Total URLs</div></div>
        <div class="card"><div class="card-value" id="uniqueDomains">-</div><div class="card-label">Unique Domains</div></div>
        <div class="card green"><div class="card-value" id="greenCount">-</div><div class="card-label">Green Hosted</div></div>
        <div class="card yellow"><div class="card-value" id="notVerifiedCount">-</div><div class="card-label">Not Verified</div></div>
      </div>

      <div class="bar-section">
        <div class="bar-track"><div class="bar-fill" id="barFill" style="width:0%"></div></div>
        <div class="bar-label" id="barLabel"></div>
      </div>

      <table>
        <thead><tr><th></th><th>Domain</th><th>Hosted By</th><th>URLs</th><th>Files</th></tr></thead>
        <tbody id="domainBody"></tbody>
      </table>
      
      <div class="legend">
        <div class="legend-title">Legend</div>
        <div class="legend-item">
          <span class="legend-dot" style="background: #22c55e;"></span>
          <span class="legend-text"><strong>Green Hosted:</strong> Verified to run on renewable energy infrastructure by the Green Web Foundation</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot" style="background: #eab308;"></span>
          <span class="legend-text"><strong>Not Verified:</strong> No evidence of green hosting in the Green Web Foundation database (may still be green but not registered)</span>
        </div>
      </div>
      
      <div class="limits">
        <div class="limits-title">Scan Limits & Exclusions</div>
        <ul class="limits-list">
          <li>Maximum 5,000 files scanned per workspace</li>
          <li>Files larger than 512 KB are skipped</li>
          <li>Excluded folders: node_modules, .git, dist, out, build, .next, coverage, .vscode, vendor</li>
          <li>Excluded files: *.min.js, *.min.css, *.bundle.js, *.map</li>
        </ul>
      </div>
      
      <div class="footer" id="footer"></div>
    </div>
  </div>

  <script nonce="${nonce}">
    (function() {
      const vscode = acquireVsCodeApi();
      const statusEl = document.getElementById('status');
      const contentEl = document.getElementById('content');
      const refreshBtn = document.getElementById('refreshBtn');

      refreshBtn.addEventListener('click', () => {
        refreshBtn.disabled = true;
        vscode.postMessage({ command: 'refresh' });
      });

      window.addEventListener('message', e => {
        const msg = e.data;
        switch (msg.command) {
          case 'scanning':
            statusEl.classList.remove('hidden');
            contentEl.classList.add('hidden');
            statusEl.innerHTML = '<span class="spinner"></span> Scanning workspace…';
            refreshBtn.disabled = true;
            break;
          case 'progress':
            statusEl.innerHTML = '<span class="spinner"></span> ' + escapeHtml(msg.message);
            break;
          case 'results':
            renderResults(msg.data);
            break;
          case 'error':
            statusEl.classList.remove('hidden');
            contentEl.classList.add('hidden');
            statusEl.textContent = 'Error: ' + msg.message;
            refreshBtn.disabled = false;
            break;
        }
      });

      vscode.postMessage({ command: 'ready' });

      function renderResults(d) {
        document.getElementById('totalUrls').textContent = d.totalUrls;
        document.getElementById('uniqueDomains').textContent = d.uniqueDomains;
        document.getElementById('greenCount').textContent = d.greenDomains;
        document.getElementById('notVerifiedCount').textContent = d.notVerifiedDomains;

        const pct = d.uniqueDomains > 0 ? Math.round((d.greenDomains / d.uniqueDomains) * 100) : 0;
        document.getElementById('barFill').style.width = pct + '%';
        document.getElementById('barLabel').textContent = pct + '% of domains are green hosted';

        const tbody = document.getElementById('domainBody');
        tbody.innerHTML = '';
        for (const dm of d.domains) {
          const tr = document.createElement('tr');
          const isGreen = dm.green === true;
          tr.innerHTML =
            '<td><span class="dot ' + (isGreen ? 'green' : 'yellow') + '"></span></td>' +
            '<td><a class="domain-link" href="https://' + escapeHtml(dm.domain) + '" title="' + escapeHtml(dm.domain) + '">' + escapeHtml(dm.domain) + '</a></td>' +
            '<td class="hosted-by">' + (dm.hostedBy ? escapeHtml(dm.hostedBy) : '–') + '</td>' +
            '<td>' + dm.occurrences + '</td>' +
            '<td class="files-list" title="' + escapeHtml(dm.files.join('\\n')) + '">' + dm.files.length + ' file' + (dm.files.length !== 1 ? 's' : '') + '</td>';
          tbody.appendChild(tr);
        }

        document.getElementById('footer').textContent = 'Scanned ' + d.scannedFiles + ' files';
        statusEl.classList.add('hidden');
        contentEl.classList.remove('hidden');
        refreshBtn.disabled = false;
      }

      function escapeHtml(s) {
        return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      }
    })();
  </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}
