import {AstUtils  ,AstNode,  ValidationAcceptor, ValidationChecks } from 'langium';
import type { SysYAstType, CompUnit, FuncDef, VarDecl, ConstDecl, StructDef, FuncFParam, LVal,ConstExp } from './generated/ast.js';

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
    // 检查全局变量和常量声明
    const globalDecls = (node as any).declarations || [];
    for (const decl of globalDecls) {
        // 变量声明
        if (decl.$type === 'VarDecl') {
            const defs = (decl as any).defs || [];
            for (const def of defs) {
                const names: string[] = (def as any).name || [];
                for (const name of names) {
                    if (seenNames.has(name)) {
                        accept('error', `全局作用域中重复的标识符 '${name}'。`, { node: def, property: 'name' });
                    }
                    seenNames.add(name);
                }
            }
        }
        // 常量声明
        if (decl.$type === 'ConstDecl') {
            const defs = (decl as any).defs || [];
            for (const def of defs) {
                const names: string[] = (def as any).name || [];
                for (const name of names) {
                    if (seenNames.has(name)) {
                        accept('error', `全局作用域中重复的标识符 '${name}'。`, { node: def, property: 'name' });
                    }
                    seenNames.add(name);
                }
            }
        }
        // 结构体声明（可选，若结构体名也需唯一）
        if (decl.$type === 'StructDef') {
            const names: string[] = (decl as any).name || [];
            for (const name of names) {
                if (seenNames.has(name)) {
                    accept('error', `全局作用域中重复的标识符 '${name}'。`, { node: decl, property: 'name' });
                }
                seenNames.add(name);
            }
        }
    }
    // 检查全局函数定义
    const globalFuncs = (node as any).functions || [];
    for (const func of globalFuncs) {
        const names: string[] = (func as any).name || [];
        for (const name of names) {
            if (seenNames.has(name)) {
                accept('error', `全局作用域中重复的标识符 '${name}'。`, { node: func, property: 'name' });
            }
            seenNames.add(name);
        }
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
    const names = Array.isArray(node.name) ? node.name : [node.name];
    for (const name of names) {
    if (!/^[_A-Za-z][_A-Za-z0-9]*$/.test(name)) {
        accept('error', `函数名 '${name}' 不符合标识符规范（应以字母或下划线开头，后接字母、数字或下划线）。`, { node: node, property: 'name' });
    }
}
// 检查重复的参数名称
const paramNames = new Set<string>();
let params: FuncFParam[] = [];
if (Array.isArray(node.params) && node.params.length > 0) {
    // 收集所有参数列表中的参数
    for (const funcParams of node.params) {
        if (Array.isArray(funcParams.params)) {
            params = params.concat(funcParams.params);
        }
    }
}
for (const p of params) {
    const pname = Array.isArray(p.name) ? p.name[0] : p.name;
    if (paramNames.has(pname)) {
        accept('error', `函数 '${Array.isArray(node.name) ? node.name[0] : node.name}' 中重复的参数名 '${pname}'。`, { node: p, property: 'name' });
    }
    paramNames.add(pname);
}
        // 检查函数内的局部变量/常量声明是否重复
        const localNames = new Set<string>();
        
        // 获取函数体（Block）
        const body = Array.isArray(node.body) ? node.body[0] : node.body;
        if (body && body.items) {
            // 遍历Block中的所有items
            for (const item of body.items) {
                // 处理变量声明
                if (item.$type === 'VarDecl') {
                    const defs = item.defs || [];
                    for (const def of defs) {
                        const defName = Array.isArray(def.name) ? def.name[0] : def.name;
                        if (paramNames.has(defName) || localNames.has(defName)) {
                            accept('error', `函数 '${Array.isArray(node.name) ? node.name[0] : node.name}' 作用域中重复的标识符 '${defName}'。`, { node: def, property: 'name' });
                        }
                        localNames.add(defName);
                    }
                }
                // 处理常量声明
                else if (item.$type === 'ConstDecl') {
                    const defs = item.defs || [];
                    for (const def of defs) {
                        const defName = Array.isArray(def.name) ? def.name[0] : def.name;
                        if (paramNames.has(defName) || localNames.has(defName)) {
                            accept('error', `函数 '${Array.isArray(node.name) ? node.name[0] : node.name}' 作用域中重复的标识符 '${defName}'。`, { node: def, property: 'name' });
                        }
                        localNames.add(defName);
                    }
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
        // 处理VarDef数组
        const defs = (node as any).defs || [];
        for (const def of defs) {
            const name = Array.isArray(def.name) ? def.name[0] : def.name;
            // 变量名必须以字母或下划线开头
            if (!/^[_A-Za-z][_A-Za-z0-9]*$/.test(name)) {
                accept('error', `变量名 '${name}' 不符合标识符规范（应以字母或下划线开头，后接字母、数字或下划线）。`, { node: def, property: 'name' });
            }
            // 检查数组维度是否为简单的整数字面量
            const dims = def.dimensions || [];
            for (const dimExp of dims) {
                if (!isSimpleIntegerLiteral(dimExp)) {
                    accept('error', `数组维度必须是常量整型表达式。`, { node: dimExp });
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
        // 处理ConstDef数组
        const defs = (node as any).defs || [];
        for (const def of defs) {
            const name = Array.isArray(def.name) ? def.name[0] : def.name;
            // 常量名必须以字母或下划线开头
            if (!/^[_A-Za-z][_A-Za-z0-9]*$/.test(name)) {
                accept('error', `常量名 '${name}' 不符合标识符规范（应以字母或下划线开头，后接字母、数字或下划线）。`, { node: def, property: 'name' });
            }
            // 检查数组维度是否为简单的整数字面量
            const dims = def.dimensions || [];
            for (const dimExp of dims) {
                if (!isSimpleIntegerLiteral(dimExp)) {
                    accept('error', `数组维度必须是常量整型表达式。`, { node: dimExp });
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
        // 添加调试信息
        console.log('LVal 验证器被调用，节点:', node);
        
        // 获取变量名 - first 是一个数组，取第一个元素
        const firstArray = node.first;
        if (!firstArray || firstArray.length === 0) {
            console.log('firstArray 为空或长度为0');
            return;
        }
        const firstName = firstArray[0];
        console.log('变量名:', firstName);
        
        // 查找包含此 LVal 的函数
        let funcNode: any = null;
        let current: AstNode | undefined = node;
        while (current) {
            if (current.$type === 'FuncDef') {
                funcNode = current;
                break;
            }
            current = current.$container;
        }
        
        // 查找根节点（CompUnit）
        let rootNode: any = null;
        current = node;
        while (current) {
            if (current.$type === 'CompUnit') {
                rootNode = current;
                break;
            }
            current = current.$container;
        }
        
        let found = false;
        let declaredDims = 0;
        
        // 1. 检查函数参数
        if (funcNode && funcNode.params) {
            for (const funcParams of funcNode.params) {
                if (funcParams.params) {
                    for (const param of funcParams.params) {
                        const paramName = Array.isArray(param.name) ? param.name[0] : param.name;
                        if (paramName === firstName) {
                            found = true;
                            // 检查参数的维度
                            declaredDims = param.dimensions ? param.dimensions.length : 0;
                            // 如果参数声明中有 '[]'，也算一维
                            if (param.$cstNode?.text?.includes('[]')) {
                                declaredDims = 1;
                            }
                            break;
                        }
                    }
                }
                if (found) break;
            }
        }
        
        // 2. 检查函数局部变量
        if (!found && funcNode && funcNode.body) {
            const body = Array.isArray(funcNode.body) ? funcNode.body[0] : funcNode.body;
            if (body && body.items) {
                for (const item of body.items) {
                    if (item.$type === 'VarDecl' && item.defs) {
                        for (const def of item.defs) {
                            const defName = Array.isArray(def.name) ? def.name[0] : def.name;
                            if (defName === firstName) {
                                found = true;
                                declaredDims = def.dimensions ? def.dimensions.length : 0;
                                console.log('找到局部变量:', defName, '维度:', declaredDims);
                                break;
                            }
                        }
                    } else if (item.$type === 'ConstDecl' && item.defs) {
                        for (const def of item.defs) {
                            const defName = Array.isArray(def.name) ? def.name[0] : def.name;
                            if (defName === firstName) {
                                found = true;
                                declaredDims = def.dimensions ? def.dimensions.length : 0;
                                break;
                            }
                        }
                    }
                    if (found) break;
                }
            }
        }
        
        // 3. 检查全局变量和常量
        if (!found && rootNode && rootNode.declarations) {
            for (const decl of rootNode.declarations) {
                if (decl.$type === 'VarDecl' && decl.defs) {
                    for (const def of decl.defs) {
                        const defName = Array.isArray(def.name) ? def.name[0] : def.name;
                        if (defName === firstName) {
                            found = true;
                            declaredDims = def.dimensions ? def.dimensions.length : 0;
                            break;
                        }
                    }
                } else if (decl.$type === 'ConstDecl' && decl.defs) {
                    for (const def of decl.defs) {
                        const defName = Array.isArray(def.name) ? def.name[0] : def.name;
                        if (defName === firstName) {
                            found = true;
                            declaredDims = def.dimensions ? def.dimensions.length : 0;
                            break;
                        }
                    }
                }
                if (found) break;
            }
        }
        
        console.log('查找结果 - found:', found, 'declaredDims:', declaredDims);
        
        // 报告错误
        if (!found) {
            console.log('报告错误: 变量未定义');
            accept('error', `变量 '${firstName}' 未定义。`, { node: node, property: 'first' });
        } else {
            // 验证维度数量匹配
            const usedIndices = node.indices ? node.indices.length : 0;
            console.log('使用的维度:', usedIndices, '声明的维度:', declaredDims);
            if (usedIndices !== declaredDims) {
                console.log('报告错误: 维度不匹配');
                accept('error', `数组 '${firstName}' 使用 ${usedIndices} 维访问，但声明为 ${declaredDims} 维。`, { node: node });
            }
        }
    },

    /**
     * 检查语句，特别是赋值语句中的左值
     */
    Stmt: (node: any, accept: ValidationAcceptor): void => {
        // 检查赋值语句的格式：LVal '=' Exp ';'
        // 在语法中，这会生成包含 LVal 的节点
        // LVal 的验证会自动触发，这里主要确保赋值语句的结构正确
    },

    ConstExp: (node: ConstExp, accept: ValidationAcceptor) => {
            const visited = new Set<AstNode>();
            const checkNode = (n: AstNode, depth: number = 0) => {
                // 防止无限递归
                if (depth > 100) {
                    accept('error', '常量表达式嵌套过深', { node: n });
                    return;
                }
                
                // 避免重复检查同一节点
                if (visited.has(n)) {
                    return;
                }
                visited.add(n);
                
                if (n.$type === 'LVal') {
                    accept('error', '常量表达式不能包含变量', { node: n });
                    return;
                }
                
                // 手动遍历子节点
                for (const child of AstUtils.streamAst(n)) {
                    checkNode(child, depth + 1);
                }
            };
            checkNode(node);
        }
};

/**
 * 检查常量表达式是否为简单的整数字面量（不包含运算）
 */
function isSimpleIntegerLiteral(node: any): boolean {
    if (!node) return false;
    
    // 使用字符串化的方式检查是否包含运算符
    const checkForOperators = (n: AstNode): boolean => {
        let hasOperator = false;
        
        // 遍历AST节点
        for (const child of AstUtils.streamAst(n)) {
            // 检查是否有运算符属性
            if ((child as any).op && (child as any).op.length > 0) {
                hasOperator = true;
                break;
            }
            // 检查是否有函数调用
            if ((child as any).callee) {
                hasOperator = true;
                break;
            }
            // 检查是否有变量引用
            if (child.$type === 'LVal') {
                hasOperator = true;
                break;
            }
        }
        
        return hasOperator;
    };
    
    // 如果包含运算符或变量，则不是简单字面量
    if (checkForOperators(node)) {
        return false;
    }
    
    // 检查是否包含整数字面量
    let hasIntLiteral = false;
    for (const child of AstUtils.streamAst(node)) {
        if (child.$type === 'Literal' && (child as any).value) {
            hasIntLiteral = true;
            break;
        }
    }
    
    return hasIntLiteral;
}