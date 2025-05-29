import { ValidationAcceptor, ValidationChecks } from 'langium';
import type { SysYAstType, CompUnit, FuncDef, VarDecl, ConstDecl, StructDef, FuncFParam, LVal } from './generated/ast.js';

/**
 * 对SysY AST节点进行验证的检查集合。
 */

export const validationChecks: ValidationChecks<SysYAstType> = {
    /**
     * 检查全局作用域中的重复定义（变量、常量和函数）。
     * 示例
     * int a;  // OK
     * int a;  // Error: 重复的标识符'a'
     * int main() {}  // OK
     * int main() {}  // Error: 重复的标识符'main'
     */
    CompUnit: (node: CompUnit, accept: ValidationAcceptor): void => {
        const seenNames = new Set<string>();
        // 检查全局作用域的变量和常量声明
        const globalDecls = (node as any).decls || [];
        for (const decl of globalDecls) {
            // 处理具有名称的声明
            if ('name' in decl) {
                const name: string = (decl as any).name;
                if (seenNames.has(name)) {
                    accept('error', `全局作用域中重复的标识符 '${name}'。`, { node: decl, property: 'name' });
                }
                seenNames.add(name);
            }
            // 处理包含多个变量的声明（如VarDef数组）
            if (Array.isArray((decl as any).vars)) {
                for (const vd of (decl as any).vars) {
                    const name: string = (vd as any).name;
                    if (seenNames.has(name)) {
                        accept('error', `全局作用域中重复的标识符 '${name}'。`, { node: vd, property: 'name' });
                    }
                    seenNames.add(name);
                }
            }
        }
        // 检查全局函数定义的重复名称
        const globalFuncs = (node as any).funcDefs || (node as any).functions || [];
        for (const func of globalFuncs) {
            const name: string = (func as any).name;
            if (seenNames.has(name)) {
                accept('error', `全局作用域中重复的标识符 '${name}'。`, { node: func, property: 'name' });
            }
            seenNames.add(name);
        }
    },

    /**
     * 检查函数级别的约束：命名规范和参数/变量重复。
     * 示例
     * int 1func() {}    // Error: 必须以字母开头
     * void foo(int a, int a) {}  // Error: 重复参数名'a'
     * void bar() { int a; int a; }  // Error: 重复标识符'a'
     */
    FuncDef: (node: FuncDef, accept: ValidationAcceptor): void => {
        // 函数名必须以字母开头
        if (!/^[A-Za-z]/.test('${node.name}')) {
            accept('error', `函数名 '${node.name}' 必须以字母开头。`, { node: node, property: 'name' });
        }
        // 检查重复的参数名称
        const paramNames = new Set<string>();
        const params: FuncFParam[] = (node as any).params || (node as any).parameters || [];
        for (const p of params) {
            const pname = (p as any).name;
            if (paramNames.has(pname)) {
                accept('error', `函数 '${node.name}' 中重复的参数名 '${pname}'。`, { node: p, property: 'name' });
            }
            paramNames.add(pname);
        }
        // 检查函数内的局部变量/常量声明是否重复
        const localDecls = (node as any).block?.decls || (node as any).body?.decls || (node as any).decls || [];
        const localNames = new Set<string>();
        for (const decl of localDecls) {
            if ('name' in decl) {
                const name: string = (decl as any).name;
                if (paramNames.has(name) || localNames.has(name)) {
                    accept('error', `函数 '${node.name}' 作用域中重复的标识符 '${name}'。`, { node: decl, property: 'name' });
                }
                localNames.add(name);
            }
            if (Array.isArray((decl as any).vars)) {
                for (const vd of (decl as any).vars) {
                    const name: string = (vd as any).name;
                    if (paramNames.has(name) || localNames.has(name)) {
                        accept('error', `函数 '${node.name}' 作用域中重复的标识符 '${name}'。`, { node: vd, property: 'name' });
                    }
                    localNames.add(name);
                }
            }
        }
    },

    /**
     * 检查变量声明：命名规范和数组维度。
     * int 3var;          // Error: 变量名以数字开头
     * int arr[1+2];      // Error: 维度必须为常量表达式
     * int arr[3][n];     // Error: 维度必须为常量表达式（n非常量）
     */
    VarDecl: (node: VarDecl, accept: ValidationAcceptor): void => {
        // 处理单一声明的情况
        if ('name' in node) {
            const name = (node as any).name;
            // 变量名必须以字母开头
            if (!/^[A-Za-z]/.test(name)) {
                accept('error', `变量名 '${name}' 必须以字母开头。`, { node: node, property: 'name' });
            }
            // 检查每个维度表达式是否为常量整型（假设数值字面量有'value'属性）
            const dims = (node as any).dims || (node as any).dimensions || [];
            for (const dimExp of dims) {
                if ((dimExp as any).value === undefined || isNaN(Number((dimExp as any).value))) {
                    accept('error', `数组维度必须是常量整型表达式。`, { node: dimExp });
                }
            }
        }
        // 处理多变量声明的情况（VarDef数组）
        if (Array.isArray((node as any).vars)) {
            for (const vd of (node as any).vars) {
                const name = vd.name;
                if (!/^[A-Za-z]/.test(name)) {
                    accept('error', `变量名 '${name}' 必须以字母开头。`, { node: vd, property: 'name' });
                }
                const dims = (vd as any).dims || (vd as any).dimensions || [];
                for (const dimExp of dims) {
                    if ((dimExp as any).value === undefined || isNaN(Number((dimExp as any).value))) {
                        accept('error', `数组维度必须是常量整型表达式。`, { node: dimExp });
                    }
                }
            }
        }
    },

    /**
     * 检查常量声明：命名规范和数组维度（必须为常量）。
     * const int 5c = 10;     // Error: 常量名以数字开头
     * const int MATRIX[2][x] = {{1,2}};  // Error: x非常量
     */
    ConstDecl: (node: ConstDecl, accept: ValidationAcceptor): void => {
        // 处理单一声明的情况
        if ('name' in node) {
            const name = (node as any).name;
            if (!/^[A-Za-z]/.test(name)) {
                accept('error', `常量名 '${name}' 必须以字母开头。`, { node: node, property: 'name' });
            }
            const dims = (node as any).dims || (node as any).dimensions || [];
            for (const dimExp of dims) {
                if ((dimExp as any).value === undefined || isNaN(Number((dimExp as any).value))) {
                    accept('error', `数组维度必须是常量整型表达式。`, { node: dimExp });
                }
            }
        }
        // 处理多常量声明的情况
        if (Array.isArray((node as any).consts)) {
            for (const cd of (node as any).consts) {
                const name = cd.name;
                if (!/^[A-Za-z]/.test(name)) {
                    accept('error', `常量名 '${name}' 必须以字母开头。`, { node: cd, property: 'name' });
                }
                const dims = (cd as any).dims || (cd as any).dimensions || [];
                for (const dimExp of dims) {
                    if ((dimExp as any).value === undefined || isNaN(Number((dimExp as any).value))) {
                        accept('error', `数组维度必须是常量整型表达式。`, { node: dimExp });
                    }
                }
            }
        }
    },

    /**
     * 检查结构体字段：同一结构体内无重复字段名。
     * * 示例：
     * struct Person {
     *     int age;
     *     int age;  // Error: 重复字段名'age'
     * };
     */
    StructDef: (node: StructDef, accept: ValidationAcceptor): void => {
        // 假设StructDef表示包含字段的结构体定义
        const seen = new Set<string>();
        const fields: any[] = (node as any).fields || (node as any).vars || [];
        for (const field of fields) {
            const fname = (field as any).name;
            if (seen.has(fname)) {
                accept('error', `结构体 '${(node as any).name}' 中存在重复字段名 '${fname}'。`, { node: field, property: 'name' });
            }
            seen.add(fname);
        }
    },

    /**
     * 检查LVal（变量或数组访问）：确保变量已定义且维度匹配。
     * 示例：
     * int main() {
     *     a = 5;          // Error: 'a'未定义
     *     int arr[3][4];
     *     arr[1][2][3];   // Error: 3维访问但声明为2维
     * }
     */
    LVal: (node: LVal, accept: ValidationAcceptor): void => {
        const name: string = (node as any).name;
        // 查找最近的函数作用域
        let current: any = node;
        let funcNode: any = null;
        while (current && current.$container) {
            if ((current as any).params || (current as any).parameters) {
                funcNode = current;
                break;
            }
            current = current.$container;
        }
        let declaredDims = 0;
        let found = false;
        // 检查函数参数
        if (funcNode) {
            const funcParams: any[] = (funcNode as any).params || (funcNode as any).parameters || [];
            for (const p of funcParams) {
                if ((p as any).name === name) {
                    found = true;
                    declaredDims = 0;  // 参数视为标量
                    break;
                }
            }
        }
        // 检查局部声明
        if (!found && funcNode) {
            const localDecls = (funcNode as any).block?.decls || (funcNode as any).body?.decls || (funcNode as any).decls || [];
            for (const decl of localDecls) {
                if ('name' in decl && (decl as any).name === name) {
                    found = true;
                    const dims = (decl as any).dims || (decl as any).dimensions || [];
                    declaredDims = dims.length;
                    break;
                }
                if (Array.isArray((decl as any).vars)) {
                    for (const vd of (decl as any).vars) {
                        if ((vd as any).name === name) {
                            found = true;
                            const dims = (vd as any).dims || (vd as any).dimensions || [];
                            declaredDims = dims.length;
                            break;
                        }
                    }
                }
                if (found) break;
            }
        }
        // 检查全局声明
        if (!found) {
            const rootDecls = (current as any).decls || (current as any).compUnit?.decls || [];
            // 全局变量检查
            for (const decl of rootDecls) {
                if ('name' in decl && (decl as any).name === name) {
                    found = true;
                    const dims = (decl as any).dims || (decl as any).dimensions || [];
                    declaredDims = dims.length;
                    break;
                }
                if (Array.isArray((decl as any).vars)) {
                    for (const vd of (decl as any).vars) {
                        if ((vd as any).name === name) {
                            found = true;
                            const dims = (vd as any).dims || (vd as any).dimensions || [];
                            declaredDims = dims.length;
                            break;
                        }
                    }
                }
                if (found) break;
            }
            // 全局常量检查
            if (!found) {
                for (const decl of rootDecls) {
                    if (Array.isArray((decl as any).consts)) {
                        for (const cd of (decl as any).consts) {
                            if ((cd as any).name === name) {
                                found = true;
                                const dims = (cd as any).dims || (cd as any).dimensions || [];
                                declaredDims = dims.length;
                                break;
                            }
                        }
                    }
                    if (found) break;
                }
            }
        }
        if (!found) {
            accept('error', `变量 '${name}' 未定义。`, { node: node });
        } else {
            // 验证维度数量匹配
            const indices = (node as any).indices || [];
            const usedIndices = indices.length;
            if (usedIndices !== declaredDims) {
                accept('error', `数组 '${name}' 使用 ${usedIndices} 维访问，但声明为 ${declaredDims} 维。`, { node: node });
            }
        }
    }
};