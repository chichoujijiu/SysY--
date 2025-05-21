import type { LanguageClientOptions, ServerOptions} from 'vscode-languageclient/node.js';
import * as vscode from 'vscode';
import * as path from 'node:path';
import { LanguageClient, TransportKind } from 'vscode-languageclient/node.js';
import { SysYHoverProvider } from './hover-provider.js';

let client: LanguageClient;

// This function is called when the extension is activated.
export function activate(context: vscode.ExtensionContext): void {
    client = startLanguageClient(context);
    
    // 注册悬停提供程序
    const hoverProvider = new SysYHoverProvider();
    context.subscriptions.push(
        vscode.languages.registerHoverProvider('sys-y', hoverProvider)
    );

    // 定义语义标记图例
    const legend = new vscode.SemanticTokensLegend(
        ['keyword', 'number', 'string'],  // tokenTypes
        ['declaration']                   // tokenModifiers
    );
    
    context.subscriptions.push(
        vscode.languages.registerDocumentSemanticTokensProvider(
            { language: 'sys-y' },
            {
                provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.SemanticTokens {
                    const builder = new vscode.SemanticTokensBuilder(legend);
                    const text = document.getText();
                    
                    // 添加关键字高亮
                    const keywordRegex = /\b(break|char|const|continue|else|float|if|int|return|struct|void|while)\b/g;
                    let match;
                    while ((match = keywordRegex.exec(text)) !== null) {
                        const pos = document.positionAt(match.index);
                        builder.push(pos.line, pos.character, match[0].length, 0, 0);
                    }
                    
                    // 添加数字高亮
                    const numberRegex = /\b\d+(\.\d+)?\b/g;
                    while ((match = numberRegex.exec(text)) !== null) {
                        const pos = document.positionAt(match.index);
                        builder.push(pos.line, pos.character, match[0].length, 1, 0);
                    }
                    
                    // 添加字符串高亮
                    const stringRegex = /"[^"\\]*(\\.[^"\\]*)*"/g;
                    while ((match = stringRegex.exec(text)) !== null) {
                        const pos = document.positionAt(match.index);
                        builder.push(pos.line, pos.character, match[0].length, 2, 0);
                    }
                    
                    return builder.build();
                }
            },
            legend
        )
    );
}

// This function is called when the extension is deactivated.
export function deactivate(): Thenable<void> | undefined {
    if (client) {
        return client.stop();
    }
    return undefined;
}

function startLanguageClient(context: vscode.ExtensionContext): LanguageClient {
    const serverModule = context.asAbsolutePath(path.join('out', 'language', 'main.cjs'));
    // The debug options for the server
    // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging.
    // By setting `process.env.DEBUG_BREAK` to a truthy value, the language server will wait until a debugger is attached.
    const debugOptions = { execArgv: ['--nolazy', `--inspect${process.env.DEBUG_BREAK ? '-brk' : ''}=${process.env.DEBUG_SOCKET || '6009'}`] };

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: '*', language: 'sys-y' }]
    };

    // Create the language client and start the client.
    const client = new LanguageClient(
        'sys-y',
        'SysY',
        serverOptions,
        clientOptions
    );

    // Start the client. This will also launch the server
    client.start();
    return client;
}
