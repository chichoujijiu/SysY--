import * as vscode from 'vscode';
import { LangiumCoreServices } from 'langium';
import { SysYServices } from '../language/sys-y-module.js';
import { AstNode, CstNode, URI } from 'langium';
import { isLVal, isFuncDef, isVarDef, isConstDef } from '../language/generated/ast.js';

export class SysYHoverProvider implements vscode.HoverProvider {
    protected services?: LangiumCoreServices & SysYServices;

    constructor(services?: LangiumCoreServices & SysYServices) {
        this.services = services;
    }

    async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover | undefined> {
        if (!this.services) {
            return undefined;
        }

        const offset = document.offsetAt(position);
        const cstNode = await this.findCstNodeAtOffset(document, offset);
        
        if (!cstNode) {
            return undefined;
        }

        const astNode = cstNode.astNode;
        if (!astNode) {
            return undefined;
        }

        return this.createHover(astNode);
    }

    private async findCstNodeAtOffset(document: vscode.TextDocument, offset: number): Promise<CstNode | undefined> {
        if (!this.services) {
            return undefined;
        }

        const langiumDocument = await this.services.shared.workspace.LangiumDocuments.getOrCreateDocument(URI.parse(document.uri.toString()));
        if (!langiumDocument.parseResult.value.$cstNode) {
            return undefined;
        }

        return this.findCstNodeAtOffsetRecursive(langiumDocument.parseResult.value.$cstNode, offset);
    }

    private findCstNodeAtOffsetRecursive(node: CstNode | undefined, offset: number): CstNode | undefined {
        if (!node) {
            return undefined;
        }

        if (node.offset <= offset && offset <= node.end) {
            const children = (node as any).children || [];
            for (const child of children) {
                const found = this.findCstNodeAtOffsetRecursive(child, offset);
                if (found) {
                    return found;
                }
            }
            return node;
        }
        return undefined;
    }

    private createHover(node: AstNode): vscode.Hover | undefined {
        if (isLVal(node)) {
            // 变量引用
            const varInfo = this.getVariableInfo(node);
            if (varInfo) {
                return new vscode.Hover(
                    new vscode.MarkdownString(`**变量**: ${varInfo.name}\n**类型**: ${varInfo.type}`)
                );
            }
        } else if (isFuncDef(node)) {
            // 函数定义
            const funcNode = node as any; // 临时类型断言
            return new vscode.Hover(
                new vscode.MarkdownString(`**函数**: ${funcNode.name}\n**返回类型**: ${funcNode.funcType}`)
            );
        } else if (isVarDef(node)) {
            // 变量定义
            const varNode = node as any; // 临时类型断言
            return new vscode.Hover(
                new vscode.MarkdownString(`**变量定义**: ${varNode.name}\n**类型**: ${this.getTypeFromParent(node)}`)
            );
        } else if (isConstDef(node)) {
            // 常量定义
            const constNode = node as any; // 临时类型断言
            return new vscode.Hover(
                new vscode.MarkdownString(`**常量定义**: ${constNode.name}\n**类型**: ${this.getTypeFromParent(node)}`)
            );
        }
        return undefined;
    }

    private getVariableInfo(node: any): { name: string; type: string } | undefined {
        // 这里需要实现变量信息的查找逻辑
        // 可以通过作用域分析来获取变量的类型信息
        return {
            name: node.name,
            type: 'unknown' // 需要实现类型推导
        };
    }

    private getTypeFromParent(node: any): string {
        // 从父节点获取类型信息
        const parent = node.$container;
        if (parent && parent.type) {
            return parent.type;
        }
        return 'unknown';
    }
} 