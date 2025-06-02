import * as vscode from 'vscode';

export class SysYHoverProvider implements vscode.HoverProvider {
    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Hover | undefined> {
        const range = document.getWordRangeAtPosition(position);
        if (!range) {
            return undefined;
        }

        const word = document.getText(range);
        const line = document.lineAt(position.line).text;
        
        // 检查是否是关键字
        const keywords = ['break', 'char', 'const', 'continue', 'else', 'float', 'if', 'int', 'return', 'struct', 'void', 'while'];
        if (keywords.includes(word)) {
            return new vscode.Hover(`**关键字**: ${word}\n\n${this.getKeywordDescription(word)}`);
        }

        // 检查是否是函数调用
        if (line.includes(`${word}(`)) {
            return new vscode.Hover(`**函数**: ${word}\n\n这是一个函数调用`);
        }

        // 检查是否是变量声明
        if (line.includes(`int ${word}`) || line.includes(`char ${word}`) || line.includes(`float ${word}`)) {
            const type = line.match(/(int|char|float)\s+\*?\s*\w+/)?.[1] || 'unknown';
            return new vscode.Hover(`**变量声明**: ${word}\n**类型**: ${type}`);
        }

        // 默认变量信息
        return new vscode.Hover(`**标识符**: ${word}`);
    }

    private getKeywordDescription(keyword: string): string {
        const descriptions: { [key: string]: string } = {
            'int': '32位整数类型',
            'char': '字符类型',
            'float': '浮点数类型',
            'void': '空类型',
            'const': '常量修饰符',
            'if': '条件语句',
            'else': '条件语句的else分支',
            'while': '循环语句',
            'break': '跳出循环',
            'continue': '继续下一次循环',
            'return': '函数返回语句',
            'struct': '结构体类型'
        };
        return descriptions[keyword] || '语言关键字';
    }
}