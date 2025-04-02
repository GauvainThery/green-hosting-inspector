import * as vscode from 'vscode';

interface GreenCheckResponse {
  green: boolean;
  hosted_by: string;
  [key: string]: any;
}

let outputChannel: vscode.OutputChannel;

let urlCache = new Map<
  string,
  { green: boolean; hostedBy?: string; timestamp: number }
>();

const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Green Hosting Inspector');
  outputChannel.show();

  let greenDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(144, 238, 144, 0.5)',
    color: 'black',
  });

  let nonGreenDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 99, 71, 0.5)',
    color: 'white',
  });

  const applyDecorations = async (editor: vscode.TextEditor) => {
    const document = editor.document;

    const supportedLanguages = [
      'javascript',
      'typescript',
      'python',
      'java',
      'csharp',
      'html',
      'css',
    ];
    if (!supportedLanguages.includes(document.languageId)) {
      return;
    }

    outputChannel.appendLine(
      `Checking document: ${document.fileName}, Language: ${document.languageId}`
    );

    const text = document.getText();

    // Extract URLs from the text
    const urls = Array.from(new Set(extractUrls(text)));

    const greenDecorations: { range: vscode.Range; hoverMessage?: string }[] =
      [];
    const nonGreenDecorations: {
      range: vscode.Range;
      hoverMessage?: string;
    }[] = [];

    for (const url of urls) {
      try {
        const { green, hostedBy } = await inspectGreenHosting(url);
        outputChannel.appendLine(
          `URL: ${url}, Green Hosted: ${green}, Hosted By: ${
            hostedBy || 'Unknown'
          }`
        );

        // Find the range of the URL in the document
        const urlRegex = new RegExp(url, 'g');
        let match;
        while ((match = urlRegex.exec(text)) !== null) {
          const startPos = document.positionAt(match.index);
          const endPos = document.positionAt(match.index + match[0].length);
          const range = new vscode.Range(startPos, endPos);

          if (green) {
            greenDecorations.push({
              range,
              hoverMessage: hostedBy
                ? `Green hosted by: ${hostedBy}`
                : 'Green hosting provider unknown',
            });
          } else {
            nonGreenDecorations.push({
              range,
              hoverMessage:
                'As far as we know, this URL is not hosted on a green hosting provider.',
            });
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error checking URL ${url}: ${JSON.stringify(error)}`
        );
      }
    }

    // Apply decorations
    editor.setDecorations(greenDecorationType, greenDecorations);
    editor.setDecorations(nonGreenDecorationType, nonGreenDecorations);
  };

  const command = vscode.commands.registerCommand(
    'extension.inspectGreenHosting',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        await applyDecorations(editor);
      } else {
        vscode.window.showErrorMessage('No active editor found.');
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

  context.subscriptions.push(command, onDidChangeTextDocument);
}

async function inspectGreenHosting(
  url: string
): Promise<{ green: boolean; hostedBy?: string }> {
  const now = Date.now();

  // Check if the URL is cached and still valid
  if (urlCache.has(url)) {
    const cached = urlCache.get(url)!;
    if (now - cached.timestamp < CACHE_EXPIRY) {
      outputChannel.appendLine(`Cache hit for URL: ${url}`);
      return { green: cached.green, hostedBy: cached.hostedBy };
    } else {
      outputChannel.appendLine(`Cache expired for URL: ${url}`);
      urlCache.delete(url); // Remove expired cache
    }
  }

  const apiUrl = `https://api.thegreenwebfoundation.org/api/v3/greencheck/${encodeURIComponent(
    url
  )}`;
  outputChannel.appendLine(`Checking URL: ${apiUrl}`);

  let data: GreenCheckResponse;
  try {
    const response = await fetch(apiUrl);
    data = (await response.json()) as GreenCheckResponse;
  } catch (error) {
    outputChannel.appendLine(`Error: ${JSON.stringify(error)}`);
    return { green: false };
  }

  // Cache the result with a timestamp
  const result = {
    green: data.green,
    hostedBy: data.hosted_by,
    timestamp: now,
  };
  urlCache.set(url, result);

  return { green: data.green, hostedBy: data.hosted_by };
}

function extractUrls(text: string): string[] {
  // Regex to match URLs encapsulated in quotes (", ', or `) with query parameters and fragments
  const urlRegex =
    /["'`](https?:\/\/[a-zA-Z0-9-]+\.[a-zA-Z]{2,}([^\s"'`]*))["'`]/g;

  const matches = [];
  let match;

  // Extract all matches
  while ((match = urlRegex.exec(text)) !== null) {
    matches.push(match[1]); // Capture the URL inside the quotes
  }

  return matches
    .map((url) => {
      try {
        const hostname = new URL(url).hostname;
        return hostname.replace(/^www\./, '');
      } catch {
        return url.replace(/^www\./, '');
      }
    })
    .filter((url) => {
      if (url.includes('localhost')) return false;
      const ipRegex = /^(https?:\/\/)?(\d{1,3}\.){3}\d{1,3}/;
      return !ipRegex.test(url);
    });
}

export function deactivate() {}
