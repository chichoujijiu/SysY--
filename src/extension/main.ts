import type { LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node.js';
import * as vscode from 'vscode';
import * as path from 'node:path';
import { LanguageClient, TransportKind } from 'vscode-languageclient/node.js';
import { SysYHoverProvider } from './hover-provider.js';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext): void {
    client = startLanguageClient(context);

    // 注册悬停提供程序
    const hoverProvider = new SysYHoverProvider();
    context.subscriptions.push(
        vscode.languages.registerHoverProvider('sys-y', hoverProvider)
    );

    // 语义标记
    const legend = new vscode.SemanticTokensLegend(
        ['keyword', 'number', 'string'],
        ['declaration']
    );
    context.subscriptions.push(
        vscode.languages.registerDocumentSemanticTokensProvider(
            { language: 'sys-y' },
            {
                provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.SemanticTokens {
                    const builder = new vscode.SemanticTokensBuilder(legend);
                    const text = document.getText();
                    
                    // 关键字高亮
                    const keywordRegex = /\b(break|char|const|continue|else|float|if|int|return|struct|void|while)\b/g;
                    let match;
                    while ((match = keywordRegex.exec(text)) !== null) {
                        const pos = document.positionAt(match.index);
                        builder.push(pos.line, pos.character, match[0].length, 0, 0);
                    }
                    
                    // 数字高亮
                    const numberRegex = /\b\d+(\.\d+)?\b/g;
                    while ((match = numberRegex.exec(text)) !== null) {
                        const pos = document.positionAt(match.index);
                        builder.push(pos.line, pos.character, match[0].length, 1, 0);
                    }
                    
                    // 字符串高亮
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

export function deactivate(): Thenable<void> | undefined {
    return client?.stop();
}

function startLanguageClient(context: vscode.ExtensionContext): LanguageClient {
    const serverModule = context.asAbsolutePath(path.join('out', 'language', 'main.cjs'));
    const debugOptions = { 
        execArgv: ['--nolazy', `--inspect${process.env.DEBUG_BREAK ? '-brk' : ''}=${process.env.DEBUG_SOCKET || '6009'}`] 
    };

    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: '*', language: 'sys-y' }]
    };

    const client = new LanguageClient('sys-y', 'SysY', serverOptions, clientOptions);
    client.start();

    return client;
}