import { MaybePromise } from 'langium';
import { CodeAction, CodeActionKind, CodeActionParams, Range, TextEdit, WorkspaceEdit } from 'vscode-languageserver';
import { CodeActionProvider } from 'langium/lsp';
import { LangiumDocument } from 'langium';
import { TextDocument } from 'vscode-languageserver-textdocument';

/**
 * SysY 函数重构服务
 * 提供抽取代码段为新函数的功能
 */
export class SysYFunctionRefactorProvider implements CodeActionProvider {

    getCodeActions(document: LangiumDocument, params: CodeActionParams): MaybePromise<CodeAction[]> {
        const result: CodeAction[] = [];
        
        // 检查是否有选中的文本范围
        if (this.hasValidSelection(params.range)) {
            const extractFunctionAction = this.createExtractFunctionAction(document, params.range);
            if (extractFunctionAction) {
                result.push(extractFunctionAction);
            }
        }
        
        return result;
    }

    /**
     * 检查是否有有效的选择范围
     */
    private hasValidSelection(range: Range): boolean {
        // 检查范围是否跨越多行或同行但有实际内容
        return range.start.line !== range.end.line || 
               range.start.character !== range.end.character;
    }

    /**
     * 创建抽取函数的代码操作
     */
    private createExtractFunctionAction(document: LangiumDocument, range: Range): CodeAction | null {
        const textDocument = document.textDocument;
        const selectedText = textDocument.getText(range);
        
        // 基本验证：确保选中的不是空文本
        if (!selectedText.trim()) {
            return null;
        }

        // 分析选中的代码段
        const analysis = this.analyzeSelectedCode(selectedText, textDocument, range);
        if (!analysis.isValidForExtraction) {
            return null;
        }

        const newFunctionName = 'extractedFunction';
        const edit = this.createExtractFunctionEdit(
            document, 
            range, 
            selectedText, 
            newFunctionName, 
            analysis
        );

        return {
            title: `抽取为新函数 '${newFunctionName}'`,
            kind: CodeActionKind.RefactorExtract,
            edit: edit,
            isPreferred: true
        };
    }

    /**
     * 分析选中的代码段，确定变量使用情况和是否适合抽取
     */
    private analyzeSelectedCode(selectedText: string, textDocument: TextDocument, range: Range): CodeAnalysis {
        const analysis: CodeAnalysis = {
            isValidForExtraction: false,
            usedVariables: [],
            definedVariables: [],
            hasReturnStatement: false,
            returnType: 'void'
        };

        // 检查是否包含完整的语句
        const trimmedText = selectedText.trim();
        if (!trimmedText.endsWith(';') && !trimmedText.endsWith('}')) {
            // 如果不是完整语句，检查是否是表达式
            if (!this.isValidExpression(trimmedText)) {
                return analysis;
            }
        }

        // 基本的变量分析
        analysis.usedVariables = this.extractUsedVariables(selectedText);
        analysis.definedVariables = this.extractDefinedVariables(selectedText);
        analysis.hasReturnStatement = /\breturn\b/.test(selectedText);
        
        // 确定返回类型
        if (analysis.hasReturnStatement) {
            analysis.returnType = this.inferReturnType(selectedText);
        }

        analysis.isValidForExtraction = true;
        return analysis;
    }

    /**
     * 检查是否是有效的表达式
     */
    private isValidExpression(text: string): boolean {
        // 简单的表达式检查
        const expressionPattern = /^[a-zA-Z_][a-zA-Z0-9_]*(\[[^\]]+\])*(\.[a-zA-Z_][a-zA-Z0-9_]*(\[[^\]]+\])*)*(\s*[+\-*/=<>!&|]+\s*[a-zA-Z_0-9\[\].]+)*$/;
        return expressionPattern.test(text.trim());
    }

    /**
     * 提取使用的变量
     */
    private extractUsedVariables(code: string): string[] {
        const variables = new Set<string>();
        
        // 使用正则表达式匹配标识符
        const identifierRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
        let match;
        
        while ((match = identifierRegex.exec(code)) !== null) {
            const identifier = match[0];
            // 排除关键字
            if (!this.isKeyword(identifier)) {
                variables.add(identifier);
            }
        }
        
        return Array.from(variables);
    }

    /**
     * 提取定义的变量
     */
    private extractDefinedVariables(code: string): string[] {
        const variables: string[] = [];
        
        // 匹配变量声明
        const varDeclRegex = /\b(int|float|char)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
        let match;
        
        while ((match = varDeclRegex.exec(code)) !== null) {
            variables.push(match[2]);
        }
        
        return variables;
    }

    /**
     * 推断返回类型
     */
    private inferReturnType(code: string): string {
        const returnMatch = code.match(/return\s+([^;]+);/);
        if (!returnMatch) {
            return 'void';
        }
        
        const returnExpr = returnMatch[1].trim();
        
        // 简单的类型推断
        if (/^\d+$/.test(returnExpr)) {
            return 'int';
        } else if (/^\d+\.\d+$/.test(returnExpr)) {
            return 'float';
        } else if (/^'.*'$/.test(returnExpr)) {
            return 'char';
        }
        
        return 'int'; // 默认返回类型
    }

    /**
     * 检查是否是关键字
     */
    private isKeyword(identifier: string): boolean {
        const keywords = [
            'int', 'float', 'char', 'void', 'const', 'struct',
            'if', 'else', 'while', 'for', 'do', 'switch', 'case', 'default',
            'break', 'continue', 'return', 'sizeof'
        ];
        return keywords.includes(identifier);
    }

    /**
     * 创建抽取函数的编辑操作
     */
    private createExtractFunctionEdit(
        document: LangiumDocument,
        range: Range,
        selectedText: string,
        functionName: string,
        analysis: CodeAnalysis
    ): WorkspaceEdit {
        const textDocument = document.textDocument;
        const edits: TextEdit[] = [];

        // 1. 构建新函数的参数列表
        const parameters = this.buildParameterList(analysis.usedVariables, analysis.definedVariables);
        
        // 2. 构建新函数的定义
        const functionDefinition = this.buildFunctionDefinition(
            functionName,
            parameters,
            analysis.returnType,
            selectedText
        );

        // 3. 找到插入新函数的位置（当前函数之前）
        const insertPosition = this.findFunctionInsertPosition(textDocument, range);

        // 4. 添加新函数定义
        edits.push({
            range: { start: insertPosition, end: insertPosition },
            newText: functionDefinition + '\n\n'
        });

        // 5. 替换选中的代码为函数调用
        const functionCall = this.buildFunctionCall(functionName, analysis.usedVariables);
        edits.push({
            range: range,
            newText: functionCall
        });

        return {
            changes: {
                [document.uri.toString()]: edits
            }
        };
    }

    /**
     * 构建参数列表
     */
    private buildParameterList(usedVars: string[], definedVars: string[]): Parameter[] {
        const parameters: Parameter[] = [];
        
        // 对于使用的变量，作为输入参数
        for (const varName of usedVars) {
            if (!definedVars.includes(varName)) {
                parameters.push({
                    name: varName,
                    type: 'int', // 默认类型，实际中可以做更复杂的类型推断
                    isInput: true
                });
            }
        }
        
        return parameters;
    }

    /**
     * 构建函数定义
     */
    private buildFunctionDefinition(
        functionName: string,
        parameters: Parameter[],
        returnType: string,
        body: string
    ): string {
        const paramList = parameters.map(p => `${p.type} ${p.name}`).join(', ');
        
        let functionBody = body.trim();
        
        // 如果代码段不是完整的代码块，需要添加大括号
        if (!functionBody.startsWith('{')) {
            functionBody = `{\n    ${functionBody}\n}`;
        }

        return `${returnType} ${functionName}(${paramList}) ${functionBody}`;
    }

    /**
     * 构建函数调用
     */
    private buildFunctionCall(functionName: string, args: string[]): string {
        const argList = args.join(', ');
        return `${functionName}(${argList});`;
    }

    /**
     * 找到插入新函数的位置
     */
    private findFunctionInsertPosition(textDocument: TextDocument, currentRange: Range): { line: number, character: number } {
        const text = textDocument.getText();
        const lines = text.split('\n');
        
        // 向上查找，找到当前函数的开始位置
        let insertLine = 0;
        for (let i = currentRange.start.line; i >= 0; i--) {
            const line = lines[i];
            // 查找函数定义的模式
            if (/^\s*(int|float|char|void)\s+\w+\s*\([^)]*\)\s*\{/.test(line)) {
                insertLine = i;
                break;
            }
        }
        
        return { line: insertLine, character: 0 };
    }
}

/**
 * 代码分析结果接口
 */
interface CodeAnalysis {
    isValidForExtraction: boolean;
    usedVariables: string[];
    definedVariables: string[];
    hasReturnStatement: boolean;
    returnType: string;
}

/**
 * 参数接口
 */
interface Parameter {
    name: string;
    type: string;
    isInput: boolean;
} 