import { MaybePromise } from 'langium';
import { CodeAction, CodeActionKind, CodeActionParams, Diagnostic, Range, TextEdit } from 'vscode-languageserver';
import { CodeActionProvider } from 'langium/lsp';
import { LangiumDocument } from 'langium';

/**
 * SysY 代码修复建议提供者
 * 为所有语法错误和静态语义错误提供全面的自动修复建议
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
                
                // 选项1: 声明为int类型
                actions.push({
                    title: `声明整型变量 'int ${varName};'`,
                    kind: CodeActionKind.QuickFix,
                    edit: {
                        changes: {
                            [document.uri.toString()]: [
                                this.createVariableDeclarationEdit(document, varName, 'int', diagnosticRange)
                            ]
                        }
                    }
                });

                // 选项2: 声明为float类型
                actions.push({
                    title: `声明浮点型变量 'float ${varName};'`,
                    kind: CodeActionKind.QuickFix,
                    edit: {
                        changes: {
                            [document.uri.toString()]: [
                                this.createVariableDeclarationEdit(document, varName, 'float', diagnosticRange)
                            ]
                        }
                    }
                });

                // 选项3: 声明为字符类型
                actions.push({
                    title: `声明字符型变量 'char ${varName};'`,
                    kind: CodeActionKind.QuickFix,
                    edit: {
                        changes: {
                            [document.uri.toString()]: [
                                this.createVariableDeclarationEdit(document, varName, 'char', diagnosticRange)
                            ]
                        }
                    }
                });
            }
        }

        // 2. 重复定义错误的修复建议
        else if (message.includes('重复的标识符') || message.includes('重复的参数名') || message.includes('重复字段名')) {
            const identMatch = message.match(/(?:重复的标识符|重复的参数名|重复字段名) '(\w+)'/);
            if (identMatch) {
                const identName = identMatch[1];
                
                // 选项1: 添加数字后缀
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

                // 选项2: 添加下划线后缀
                actions.push({
                    title: `重命名为 '${identName}_alt'`,
                    kind: CodeActionKind.QuickFix,
                    edit: {
                        changes: {
                            [document.uri.toString()]: [{
                                range: diagnosticRange,
                                newText: `${identName}_alt`
                            }]
                        }
                    }
                });

                // 选项3: 删除重复声明（如果适用）
                if (message.includes('重复的标识符')) {
                    actions.push({
                        title: `删除重复的声明`,
                        kind: CodeActionKind.QuickFix,
                        edit: {
                            changes: {
                                [document.uri.toString()]: [
                                    this.createDeleteLineEdit(document, diagnosticRange)
                                ]
                            }
                        }
                    });
                }
            }
        }

        // 3. 命名规范错误的修复建议
        else if (message.includes('不符合标识符规范')) {
            const nameMatch = message.match(/(?:函数名|变量名|常量名) '(\w+)' 不符合标识符规范/);
            if (nameMatch) {
                const invalidName = nameMatch[1];
                
                // 如果以数字开头，添加下划线前缀
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

                    // 或者将数字移到后面
                    const nameWithoutDigits = invalidName.replace(/^\d+/, '');
                    const leadingDigits = invalidName.match(/^\d+/)?.[0] || '';
                    if (nameWithoutDigits) {
                        actions.push({
                            title: `修复为 '${nameWithoutDigits}${leadingDigits}'`,
                            kind: CodeActionKind.QuickFix,
                            edit: {
                                changes: {
                                    [document.uri.toString()]: [{
                                        range: diagnosticRange,
                                        newText: `${nameWithoutDigits}${leadingDigits}`
                                    }]
                                }
                            }
                        });
                    }
                }
            }
        }

        // 4. 数组维度不匹配错误的修复建议
        else if (message.includes('维访问') || message.includes('维度')) {
            const dimensionMatch = message.match(/数组 '(\w+)' 使用 (\d+) 维访问，但声明为 (\d+) 维/);
            if (dimensionMatch) {
                const arrayName = dimensionMatch[1];
                const usedDims = parseInt(dimensionMatch[2]);
                const declaredDims = parseInt(dimensionMatch[3]);
                
                if (usedDims < declaredDims) {
                    // 添加缺失的索引
                    const missingIndices = '[0]'.repeat(declaredDims - usedDims);
                    actions.push({
                        title: `添加缺失的数组索引: ${arrayName}${missingIndices}`,
                        kind: CodeActionKind.QuickFix,
                        edit: {
                            changes: {
                                [document.uri.toString()]: [{
                                    range: diagnosticRange,
                                    newText: `${arrayName}${missingIndices}`
                                }]
                            }
                        }
                    });
                } else if (usedDims > declaredDims) {
                    // 移除多余的索引
                    actions.push({
                        title: `移除多余的数组索引`,
                        kind: CodeActionKind.QuickFix,
                        edit: {
                            changes: {
                                [document.uri.toString()]: [{
                                    range: diagnosticRange,
                                    newText: `${arrayName} /* 请手动调整索引数量 */`
                                }]
                            }
                        }
                    });
                }
            }
        }

        // 5. 数组维度必须是常量错误的修复建议
        else if (message.includes('数组维度必须是常量')) {
            actions.push({
                title: `替换为常量值 [5]`,
                kind: CodeActionKind.QuickFix,
                edit: {
                    changes: {
                        [document.uri.toString()]: [{
                            range: diagnosticRange,
                            newText: `5 /* 请替换为实际需要的常量值 */`
                        }]
                    }
                }
            });

            actions.push({
                title: `使用预定义常量 [SIZE]`,
                kind: CodeActionKind.QuickFix,
                edit: {
                    changes: {
                        [document.uri.toString()]: [
                            // 在文件开头添加常量定义
                            {
                                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                                newText: `const int SIZE = 10; // 数组大小常量\n`
                            },
                            // 替换当前位置
                            {
                                range: diagnosticRange,
                                newText: `SIZE`
                            }
                        ]
                    }
                }
            });
        }

        // 6. 连续运算符错误的修复建议
        else if (message.includes('连续的') && message.includes('运算符')) {
            // 通用的删除多余运算符选项
            actions.push({
                title: `删除多余的运算符`,
                kind: CodeActionKind.QuickFix,
                edit: {
                    changes: {
                        [document.uri.toString()]: [{
                            range: diagnosticRange,
                            newText: ``
                        }]
                    }
                }
            });
        }

        // 7. 一元表达式连续运算符错误的修复建议
        else if (message.includes('过多的连续一元运算符') || message.includes('连续的相同一元运算符')) {
            actions.push({
                title: `删除多余的运算符`,
                kind: CodeActionKind.QuickFix,
                edit: {
                    changes: {
                        [document.uri.toString()]: [{
                            range: diagnosticRange,
                            newText: ``
                        }]
                    }
                }
            });
        }

        // 8. 常量表达式错误的修复建议
        else if (message.includes('常量') && (message.includes('不能包含变量') || message.includes('常量表达式不能包含变量'))) {
            const constVarMatch = message.match(/变量 '(\w+)'/);
            if (constVarMatch) {
                const varName = constVarMatch[1];
                
                // 选项1: 用字面量替换
                actions.push({
                    title: `用常量值 0 替换变量 '${varName}'`,
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

                // 选项2: 将变量改为常量
                actions.push({
                    title: `将变量 '${varName}' 改为常量`,
                    kind: CodeActionKind.QuickFix,
                    edit: {
                        changes: {
                            [document.uri.toString()]: [
                                this.createVariableToConstEdit(document, varName)
                            ]
                        }
                    }
                });
            } else {
                // 通用常量修复
                actions.push({
                    title: `替换为常量值 10`,
                    kind: CodeActionKind.QuickFix,
                    edit: {
                        changes: {
                            [document.uri.toString()]: [{
                                range: diagnosticRange,
                                newText: `10`
                            }]
                        }
                    }
                });
            }
        }

        // 9. 无用变量错误的修复建议
        else if (message.includes('声明后从未使用') || message.includes('被赋值但从未读取') || message.includes('有初始值但从未使用')) {
            const varMatch = message.match(/(?:全局变量|变量) '(\w+)'/);
            if (varMatch) {
                const varName = varMatch[1];
                const isGlobal = message.includes('全局变量');
                
                // 删除变量声明
                actions.push({
                    title: `删除无用${isGlobal ? '全局' : ''}变量 '${varName}'`,
                    kind: CodeActionKind.QuickFix,
                    edit: {
                        changes: {
                            [document.uri.toString()]: [
                                this.createDeleteLineEdit(document, diagnosticRange)
                            ]
                        }
                    }
                });
            }
        }

        // 10. 提供通用的"添加注释"选项
        if (actions.length === 0) {
            actions.push({
                title: `添加TODO注释`,
                kind: CodeActionKind.QuickFix,
                edit: {
                    changes: {
                        [document.uri.toString()]: [{
                            range: diagnosticRange,
                            newText: `/* TODO: 修复错误 - ${message} */`
                        }]
                    }
                }
            });
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

    /**
     * 创建删除行的文本编辑
     */
    private createDeleteLineEdit(document: LangiumDocument, range: Range): TextEdit {
        const lineToDelete = range.start.line;
        
        return {
            range: {
                start: { line: lineToDelete, character: 0 },
                end: { line: lineToDelete + 1, character: 0 }
            },
            newText: ''
        };
    }

    /**
     * 创建将变量改为常量的文本编辑
     */
    private createVariableToConstEdit(document: LangiumDocument, varName: string): TextEdit {
        const text = document.textDocument.getText();
        const lines = text.split('\n');
        
        // 查找变量声明行
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes(`int ${varName}`) && !line.includes('const')) {
                const varDeclMatch = line.match(/(\s*)(int\s+)(\w+)(\s*=\s*\d+)?/);
                if (varDeclMatch) {
                    const indent = varDeclMatch[1];
                    const newDecl = `${indent}const int ${varName} = 10; // 改为常量\n`;
                    
                    return {
                        range: {
                            start: { line: i, character: 0 },
                            end: { line: i + 1, character: 0 }
                        },
                        newText: newDecl
                    };
                }
            }
        }
        
        // 如果找不到声明，返回空编辑
        return {
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
            newText: ''
        };
    }
} 