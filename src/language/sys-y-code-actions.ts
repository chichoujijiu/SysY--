import { MaybePromise } from 'langium';
import { CodeAction, CodeActionKind, CodeActionParams, Diagnostic, Range, TextEdit } from 'vscode-languageserver';
import { CodeActionProvider } from 'langium/lsp';
import { LangiumDocument } from 'langium';

/**
 * SysY 代码修复建议提供者
 * 为常见的语法错误和静态语义错误提供自动修复建议
 */
export class SysYCodeActionProvider implements CodeActionProvider {

    getCodeActions(document: LangiumDocument, params: CodeActionParams): MaybePromise<CodeAction[]> {
        const result: CodeAction[] = [];
        
        // 遍历范围内的所有诊断信息
        for (const diagnostic of params.context.diagnostics) {
            const actions = this.createCodeActionsForDiagnostic(document, diagnostic);
            result.push(...actions);
        }
        
        return result;
    }

    /**
     * 为特定的诊断信息创建修复建议
     */
    private createCodeActionsForDiagnostic(
        document: LangiumDocument, 
        diagnostic: Diagnostic
    ): CodeAction[] {
        const actions: CodeAction[] = [];
        const message = diagnostic.message;
        const diagnosticRange = diagnostic.range;

        // 1. 变量未定义错误的修复建议
        if (message.includes('未定义')) {
            const varMatch = message.match(/变量 '(\w+)' 未定义/);
            if (varMatch) {
                const varName = varMatch[1];
                actions.push({
                    title: `声明变量 'int ${varName};'`,
                    kind: CodeActionKind.QuickFix,
                    edit: {
                        changes: {
                            [document.uri.toString()]: [
                                this.createVariableDeclarationEdit(document, varName, 'int', diagnosticRange)
                            ]
                        }
                    }
                });
            }
        }

        // 2. 重复定义错误的修复建议
        else if (message.includes('重复的标识符')) {
            const identMatch = message.match(/重复的标识符 '(\w+)'/);
            if (identMatch) {
                const identName = identMatch[1];
                actions.push({
                    title: `重命名为 '${identName}2'`,
                    kind: CodeActionKind.QuickFix,
                    edit: {
                        changes: {
                            [document.uri.toString()]: [{
                                range: diagnosticRange,
                                newText: `${identName}2`
                            }]
                        }
                    }
                });
            }
        }

        // 3. 命名规范错误的修复建议
        else if (message.includes('不符合标识符规范')) {
            const nameMatch = message.match(/(?:函数名|变量名|常量名) '(\w+)' 不符合标识符规范/);
            if (nameMatch) {
                const invalidName = nameMatch[1];
                if (/^\d/.test(invalidName)) {
                    actions.push({
                        title: `修复为 '_${invalidName}'`,
                        kind: CodeActionKind.QuickFix,
                        edit: {
                            changes: {
                                [document.uri.toString()]: [{
                                    range: diagnosticRange,
                                    newText: `_${invalidName}`
                                }]
                            }
                        }
                    });
                }
            }
        }

        // 4. 连续运算符错误的修复建议
        else if (message.includes('连续的') && message.includes('运算符')) {
            if (message.includes('++')) {
                actions.push({
                    title: `添加括号 '+ (+...)'`,
                    kind: CodeActionKind.QuickFix,
                    edit: {
                        changes: {
                            [document.uri.toString()]: [{
                                range: diagnosticRange,
                                newText: `/* 请手动添加括号明确运算优先级 */`
                            }]
                        }
                    }
                });
            }
        }

        // 5. 常量表达式错误的修复建议
        else if (message.includes('常量') && message.includes('不能包含变量')) {
            const constVarMatch = message.match(/变量 '(\w+)'/);
            if (constVarMatch) {
                const varName = constVarMatch[1];
                actions.push({
                    title: `用常量值替换变量 '${varName}'`,
                    kind: CodeActionKind.QuickFix,
                    edit: {
                        changes: {
                            [document.uri.toString()]: [{
                                range: diagnosticRange,
                                newText: `0 /* 请替换为实际常量值 */`
                            }]
                        }
                    }
                });
            }
        }

        return actions;
    }

    /**
     * 创建变量声明的文本编辑
     */
    private createVariableDeclarationEdit(
        document: LangiumDocument,
        varName: string,
        type: string,
        errorRange: Range
    ): TextEdit {
        const text = document.textDocument.getText();
        const lines = text.split('\n');
        const errorLine = errorRange.start.line;

        // 查找当前函数的开始位置
        let functionStartLine = 0;
        for (let i = errorLine; i >= 0; i--) {
            if (lines[i].includes('{') && !lines[i].trim().startsWith('if') && !lines[i].trim().startsWith('while')) {
                functionStartLine = i + 1;
                break;
            }
        }

        // 在函数开始后插入变量声明
        const insertPosition = {
            line: functionStartLine,
            character: 0
        };

        const indent = lines[functionStartLine]?.match(/^\s*/)?.[0] || '    ';
        const declaration = `${indent}${type} ${varName}; // 自动声明\n`;

        return {
            range: {
                start: insertPosition,
                end: insertPosition
            },
            newText: declaration
        };
    }
} 