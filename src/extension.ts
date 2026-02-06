import * as vscode from 'vscode';
import { MetricsPanel } from './metricsPanel';
import {
  DomainCheckResult,
  SUPPORTED_LANGUAGES,
  EXCLUDE_PATTERNS,
  CODE_KEYWORDS,
  VALID_TLDS,
  FULL_URL_REGEX,
  DOMAIN_REGEX,
  isValidDomain,
} from './domainUtils';

interface GreenCheckResponse {
  green: boolean;
  hosted_by: string;
  [key: string]: any;
}

interface CacheEntry {
  green: boolean | null; // null = error/unknown
  hostedBy?: string;
  error?: string;
  timestamp: number;
}

interface UrlMatch {
  url: string;
  domain: string;
  range: vscode.Range;
}

let outputChannel: vscode.OutputChannel;
let globalState: vscode.Memento;

// In-memory cache (fast access)
let urlCache = new Map<string, CacheEntry>();

const CACHE_EXPIRY = 24 * 60 * 60 * 1000 * 7; // 1 week
const CACHE_STORAGE_KEY = 'greenHostingCache';

// Track which documents have been processed to avoid redundant API calls
// Store the decorations so we can reapply them when editor is reopened
interface DocumentCache {
  hash: number;
  version: number;
  greenRanges: { range: vscode.Range; hoverMessage: vscode.MarkdownString }[];
  notVerifiedRanges: { range: vscode.Range; hoverMessage: vscode.MarkdownString }[];
}
let processedDocuments = new Map<string, DocumentCache>();

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Green Hosting Inspector');
  globalState = context.globalState;

  // Restore cache from persistent storage
  restoreCacheFromStorage();

  // Green: verified green hosting - dot before URL
  let greenDecorationType = vscode.window.createTextEditorDecorationType({
    before: {
      contentText: '•',
      color: '#22c55e',
    },
  });

  // Not verified: no evidence of green hosting - dot before URL
  let notVerifiedDecorationType = vscode.window.createTextEditorDecorationType({
    before: {
      contentText: '•',
      color: '#eab308',
    },
  });

  const applyDecorations = async (editor: vscode.TextEditor) => {
    const document = editor.document;

    if (!SUPPORTED_LANGUAGES.has(document.languageId)) {
      return;
    }

    const text = document.getText();
    
    // Check if document has changed since last processing
    const docKey = document.uri.toString();
    const textHash = simpleHash(text);
    const cached = processedDocuments.get(docKey);
    
    if (cached && cached.hash === textHash && cached.version === document.version) {
      // Content unchanged - reapply cached decorations (they don't persist when editor closes)
      outputChannel.appendLine(`Reapplying cached decorations for ${document.fileName}`);
      editor.setDecorations(greenDecorationType, cached.greenRanges);
      editor.setDecorations(notVerifiedDecorationType, cached.notVerifiedRanges);
      return;
    }

    const urlMatches = extractUrlsWithRanges(document);
    
    // Get unique domains for API calls
    const uniqueDomains = [...new Set(urlMatches.map(m => m.domain))];

    outputChannel.appendLine(`Found ${urlMatches.length} URL occurrences (${uniqueDomains.length} unique domains) in ${document.fileName}`);
    
    if (urlMatches.length === 0) {
      editor.setDecorations(greenDecorationType, []);
      editor.setDecorations(notVerifiedDecorationType, []);
      processedDocuments.set(docKey, { hash: textHash, version: document.version, greenRanges: [], notVerifiedRanges: [] });
      return;
    }

    // Batch check all unique domains
    const domainResults = await batchInspectGreenHosting(uniqueDomains);

    const greenDecorations: vscode.DecorationOptions[] = [];
    const notVerifiedDecorations: vscode.DecorationOptions[] = [];

    for (const match of urlMatches) {
      const result = domainResults.get(match.domain);
      
      if (result?.green === true) {
        // Verified green hosting
        const hoverMsg = new vscode.MarkdownString();
        hoverMsg.isTrusted = true;
        hoverMsg.appendMarkdown(`**✅ Green Web Hosting Verified**\n\n`);
        hoverMsg.appendMarkdown(`**Domain:** \`${match.domain}\`\n\n`);
        if (result.hostedBy) {
          hoverMsg.appendMarkdown(`**Hosted by:** ${result.hostedBy}\n\n`);
        }
        hoverMsg.appendMarkdown(`This website is hosted on infrastructure that runs on renewable energy, verified by the Green Web Foundation.\n\n`);
        hoverMsg.appendMarkdown(`[Learn more about green hosting](https://www.thegreenwebfoundation.org/)`);
        
        greenDecorations.push({
          range: match.range,
          hoverMessage: hoverMsg,
        });
      } else {
        // Not verified (either false or null/error)
        const hoverMsg = new vscode.MarkdownString();
        hoverMsg.isTrusted = true;
        hoverMsg.appendMarkdown(`**No Evidence of Green Hosting**\n\n`);
        hoverMsg.appendMarkdown(`**Domain:** \`${match.domain}\`\n\n`);
        
        if (result?.error) {
          hoverMsg.appendMarkdown(`*Could not verify: ${result.error}*\n\n`);
        }
        
        hoverMsg.appendMarkdown(`The Green Web Foundation has no evidence that this domain is hosted on green infrastructure.\n\n`);
        hoverMsg.appendMarkdown(`This doesn't necessarily mean the hosting is not green — it may simply not be registered in the Green Web dataset.\n\n`);
        hoverMsg.appendMarkdown(`[Check on Green Web Foundation](https://www.thegreenwebfoundation.org/green-web-check/?url=${encodeURIComponent(match.domain)}) · `);
        hoverMsg.appendMarkdown(`[Find green hosting providers](https://www.thegreenwebfoundation.org/directory/)`);
        
        notVerifiedDecorations.push({
          range: match.range,
          hoverMessage: hoverMsg,
        });
      }
    }

    editor.setDecorations(notVerifiedDecorationType, notVerifiedDecorations);
    editor.setDecorations(greenDecorationType, greenDecorations);
    
    // Mark document as processed and store decorations for reapplication
    processedDocuments.set(docKey, {
      hash: textHash,
      version: document.version,
      greenRanges: greenDecorations.map(d => ({ range: d.range, hoverMessage: d.hoverMessage as vscode.MarkdownString })),
      notVerifiedRanges: notVerifiedDecorations.map(d => ({ range: d.range, hoverMessage: d.hoverMessage as vscode.MarkdownString })),
    });
    
    // Persist cache periodically
    saveCacheToStorage();
  };

  const onDidOpenTextDocument = vscode.workspace.onDidOpenTextDocument(
    async (document) => {
      // Only apply decorations to the active editor for this document
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document === document) {
        await applyDecorations(editor);
      }
    }
  );

  const onDidChangeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor(
    async (editor) => {
      if (editor) {
        await applyDecorations(editor);
      }
    }
  );

  let debounceTimeout: NodeJS.Timeout | undefined;
  const DEBOUNCE_DELAY = 1000;

  const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument(
    async (event) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && event.document === editor.document) {
        if (debounceTimeout) {
          clearTimeout(debounceTimeout);
        }
        debounceTimeout = setTimeout(async () => {
          const changes = event.contentChanges;
          if (changes.length > 0) {
            await applyDecorations(editor);
          }
        }, DEBOUNCE_DELAY);
      }
    }
  );

  context.subscriptions.push(onDidChangeTextDocument);
  context.subscriptions.push(onDidOpenTextDocument);
  context.subscriptions.push(onDidChangeActiveTextEditor);

  // Register show metrics command
  const showMetricsCommand = vscode.commands.registerCommand(
    'greenHostingInspector.showMetrics',
    () => {
      MetricsPanel.createOrShow(
        context.extensionUri,
        batchInspectGreenHosting,
        saveCacheToStorage,
        outputChannel,
      );
    }
  );
  context.subscriptions.push(showMetricsCommand);

  // Register clear cache command
  const clearCacheCommand = vscode.commands.registerCommand(
    'greenHostingInspector.clearCache',
    async () => {
      urlCache.clear();
      processedDocuments.clear();
      await globalState.update(CACHE_STORAGE_KEY, {});
      vscode.window.showInformationMessage('Green Hosting Inspector: Cache cleared!');
      
      // Re-apply decorations to current editor
      if (vscode.window.activeTextEditor) {
        await applyDecorations(vscode.window.activeTextEditor);
      }
    }
  );
  context.subscriptions.push(clearCacheCommand);
  
  // Apply decorations to currently active editor on activation
  if (vscode.window.activeTextEditor) {
    applyDecorations(vscode.window.activeTextEditor);
  }

  // Show welcome message with link to metrics dashboard
  vscode.window.showInformationMessage(
    '🌱 Green Hosting Inspector is active!',
    'View Repository Metrics'
  ).then(selection => {
    if (selection === 'View Repository Metrics') {
      vscode.commands.executeCommand('greenHostingInspector.showMetrics');
    }
  });
}

// Simple hash function for change detection
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
}

// Restore cache from VS Code's persistent storage
function restoreCacheFromStorage() {
  try {
    const stored = globalState.get<Record<string, CacheEntry>>(CACHE_STORAGE_KEY);
    if (stored) {
      const now = Date.now();
      let restoredCount = 0;
      for (const [key, value] of Object.entries(stored)) {
        // Only restore non-expired entries
        if (now - value.timestamp < CACHE_EXPIRY) {
          urlCache.set(key, value);
          restoredCount++;
        }
      }
      outputChannel.appendLine(`Restored ${restoredCount} cached domain results from storage`);
    }
  } catch (error) {
    outputChannel.appendLine(`Failed to restore cache: ${error}`);
  }
}

// Save cache to VS Code's persistent storage
function saveCacheToStorage() {
  try {
    const cacheObject: Record<string, CacheEntry> = {};
    urlCache.forEach((value, key) => {
      cacheObject[key] = value;
    });
    globalState.update(CACHE_STORAGE_KEY, cacheObject);
  } catch (error) {
    outputChannel.appendLine(`Failed to save cache: ${error}`);
  }
}

// Batch check multiple domains at once
async function batchInspectGreenHosting(
  domains: string[]
): Promise<Map<string, DomainCheckResult>> {
  const results = new Map<string, DomainCheckResult>();
  const now = Date.now();
  const domainsToCheck: string[] = [];

  // First, check cache for all domains
  for (const domain of domains) {
    if (urlCache.has(domain)) {
      const cached = urlCache.get(domain)!;
      if (now - cached.timestamp < CACHE_EXPIRY) {
        outputChannel.appendLine(`Cache hit for domain: ${domain}`);
        results.set(domain, { green: cached.green, hostedBy: cached.hostedBy, error: cached.error });
        continue;
      } else {
        urlCache.delete(domain);
      }
    }
    domainsToCheck.push(domain);
  }

  if (domainsToCheck.length === 0) {
    return results;
  }

  outputChannel.appendLine(`Checking ${domainsToCheck.length} domains via API in parallel...`);

  // Check domains in parallel
  const promises = domainsToCheck.map(async (domain) => {
    try {
      const result = await checkSingleDomain(domain);
      return { domain, result };
    } catch (e) {
      const domainError = e instanceof Error ? e.message : String(e);
      outputChannel.appendLine(`Error checking ${domain}: ${domainError}`);
      return { domain, result: { green: null as boolean | null, error: domainError } };
    }
  });

  const responses = await Promise.all(promises);
  
  for (const { domain, result } of responses) {
    results.set(domain, result);
    urlCache.set(domain, { ...result, timestamp: now });
  }

  return results;
}

async function checkSingleDomain(domain: string): Promise<DomainCheckResult> {
  const apiUrl = `https://api.thegreenwebfoundation.org/api/v3/greencheck/${encodeURIComponent(domain)}`;
  
  outputChannel.appendLine(`Checking domain: ${domain}`);
  outputChannel.appendLine(`API URL: ${apiUrl}`);
  
  const response = await fetch(apiUrl);
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Rate limited - too many requests');
    }
    throw new Error(`API error (HTTP ${response.status})`);
  }
  
  const data = (await response.json()) as GreenCheckResponse;
  outputChannel.appendLine(`API Response for ${domain}: green=${data.green}, hosted_by=${data.hosted_by}`);
  return { green: data.green, hostedBy: data.hosted_by };
}

/**
 * Extract URLs from text and return their positions in the document.
 * This regex handles:
 * - Full URLs: https://example.com/path, http://www.example.com
 * - Protocol-relative URLs: //example.com/path
 * - Bare domains in strings: "example.com", 'api.example.com'
 * - URLs in comments, strings, HTML attributes, etc.
 */
function extractUrlsWithRanges(document: vscode.TextDocument): UrlMatch[] {
  const text = document.getText();
  const matches: UrlMatch[] = [];

  // Process full URLs
  let match: RegExpExecArray | null;
  const fullUrlRegex = new RegExp(FULL_URL_REGEX);
  while ((match = fullUrlRegex.exec(text)) !== null) {
    const fullUrl = match[0];
    const domain = match[1].toLowerCase();
    
    if (isValidDomain(domain)) {
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + fullUrl.length);
      matches.push({
        url: fullUrl,
        domain: domain,
        range: new vscode.Range(startPos, endPos),
      });
    }
  }

  // Process domains in strings (no protocol)
  let domainMatch: RegExpExecArray | null;
  const domainRegex = new RegExp(DOMAIN_REGEX);
  while ((domainMatch = domainRegex.exec(text)) !== null) {
    const fullMatch = domainMatch[0];
    const domain = domainMatch[1].toLowerCase();
    const tld = domainMatch[2].toLowerCase();
    const domainParts = domain.split('.');
    const firstPart = domainParts[0];
    
    // Skip if the first part of the domain is a known code keyword
    // e.g., "logger.info", "this.service", "console.log"
    if (CODE_KEYWORDS.has(firstPart)) {
      continue;
    }
    
    // Skip if this looks like a code construct:
    // 1. Preceded by identifier character + dot (e.g., myLogger.info, app.get)
    // 2. Followed by opening parenthesis (method call)
    const charBefore = domainMatch.index > 0 ? text[domainMatch.index - 1] : '';
    const charTwoBefore = domainMatch.index > 1 ? text[domainMatch.index - 2] : '';
    const charAfter = text[domainMatch.index + fullMatch.length] || '';
    
    // Check if preceded by "identifier." pattern (variable.method)
    // e.g., "myLogger.info" -> char before 'i' is '.', char two before is 'r' (alphanumeric)
    if (charBefore === '.' && /[a-zA-Z0-9_$]/.test(charTwoBefore)) {
      continue;
    }
    
    // Check if followed by ( - indicates method call (e.g., "app.listen()")
    if (charAfter === '(') {
      continue;
    }
    
    // Check if this domain was already matched as a full URL
    const alreadyMatched = matches.some(m => {
      const mStart = document.offsetAt(m.range.start);
      const mEnd = document.offsetAt(m.range.end);
      return (domainMatch!.index >= mStart && domainMatch!.index < mEnd);
    });
    
    if (!alreadyMatched && isValidDomain(domain) && VALID_TLDS.has(tld)) {
      // Include the full match (www. + domain + optional path)
      const startPos = document.positionAt(domainMatch.index);
      const endPos = document.positionAt(domainMatch.index + fullMatch.length);
      matches.push({
        url: fullMatch,
        domain: domain,
        range: new vscode.Range(startPos, endPos),
      });
    }
  }

  return matches;
}

export function deactivate() {}
