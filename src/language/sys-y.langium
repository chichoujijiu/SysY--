grammar SysY

hidden terminal WS: /\s+/;
hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;

// 字符串和字符常量优先
terminal CHAR_CONST: /'(\\.|[^\\'])'/;
terminal STR_CONST: /"(\\.|[^\\"])*"/;

// 浮点数优先于整数
terminal FLOAT_CONST: /[0-9]+\.[0-9]+([eE][-+]?[0-9]+)?|\.[0-9]+([eE][-+]?[0-9]+)?|[0-9]+[eE][-+]?[0-9]+/;

// 十六进制和八进制
terminal HEX_CONST: /0[xX][0-9A-Fa-f]+/;
terminal OCT_CONST: /0[0-7]+/;

// ID - 任何包含至少一个字母或下划线的字母数字序列
terminal ID: /[0-9]*[a-zA-Z_][a-zA-Z0-9_]*/;

// 十进制整数 - 纯数字
terminal INT_CONST: /[1-9][0-9]*|0/;

entry Model:
    compUnit+=CompUnit 
;

CompUnit:
    (declarations+=Decl | functions+=FuncDef)+
;

Decl:
    ConstDecl | VarDecl | StructDef
;

BType:
    btype += 'int' | 'float' | 'char'
;

StructDef:
    'struct' name+=ID '{' (vars+=VarDecl ';')* '}'

;

Type:
    BType | name+=ID
;

ConstDecl:
    'const' type+=Type (defs+=ConstDef (',' defs+=ConstDef)*) ';'
;

ConstDef:
    name+=ID ('[' dimensions+=ConstExp ']')* '=' value+=ConstInitVal
;

ConstInitVal:
    ConstExp
    | '{' (values+=ConstInitVal (',' values+=ConstInitVal)*)? '}'
    | callee+=ID '(' (args+=ConstInitVal (',' args+=ConstInitVal)*)? ')'
;

VarDecl:
    type+=Type (defs+=VarDef (',' defs+=VarDef)*) ';'
;

VarDef:
    name+=ID ('[' dimensions+=ConstExp ']')*
    | name+=ID ('[' dimensions+=ConstExp ']')* '=' value+=InitVal
;

InitVal:
    Exp
    | '{' (values+=InitVal (',' values+=InitVal)*)? '}'
;

FuncDef:
    returnType+=FuncType name+=ID '(' (params+=FuncFParams)? ')' body+=Block
;

FuncType:
    'void' | Type
;

FuncFParams:
    params+=FuncFParam (',' params+=FuncFParam)*
;

FuncFParam:
    type+=Type name+=ID ('[' ']' ('[' dimensions+=Exp ']')*)?
;

Block:
    '{' items+=BlockItem* '}'
;

BlockItem:
    Decl | Stmt
;

Stmt:
    lval+=LVal '=' exp+=Exp ';'         
    | exp+=Exp? ';'               
    | block+=Block                 
    | 'if' '(' cond+=Cond ')' then+=Stmt ('else' else+=Stmt)? 
    | 'while' '(' cond+=Cond ')' body+=Stmt
    | 'break' ';'        
    | 'continue' ';'         
    | 'return' exp+=Exp? ';'      
;

Exp:
    AddExp
;

Cond:
    LOrExp
;

LVal:
    first+=ID ('[' indices+=Exp ']')*  // 起始标识符（可能是数组访问）
    ('.' next+=ID ('[' indices+=Exp ']')*)*  // 后续的 .Ident 链
    //LVal	→	Ident {'[' Exp ']'} | LVal '.' Ident
;

PrimaryExp:
    '(' Exp ')'
    | LVal
    | Literal
;

Literal:
    value+=INT_CONST      //IntLiteral
    | value+=HEX_CONST    //HexLiteral
    | value+=OCT_CONST    //OctLiteral
    | value+=FLOAT_CONST  //FloatLiteral
    | value+=CHAR_CONST   //CharLiteral
    | value+=STR_CONST    //StrLiteral
;

UnaryExp:
    PrimaryExp
    | callee+=ID '(' (args+=FuncRParams)? ')'
    | op+=UnaryOp arg+=UnaryExp
;

UnaryOp:
    unaryOp+='+' | '-' | '!'
;

FuncRParams:
    args+=Exp (',' args+=Exp)*
;

MulExp:
    up1+= UnaryExp (op+=('*' | '/' | '%') up2+=UnaryExp)*
;

AddExp:
    mul1+=MulExp (op+=('+' | '−') mul2+=MulExp)*
;

RelExp:
    ad1+=AddExp (op+=('<' | '>' | '<=' | '>=') ad2+=AddExp)*
;

EqExp:
    re1+=RelExp (op+=('==' | '!=') re2+=RelExp)*
;

LAndExp:
    eq1+=EqExp (op+='&&' eq2+=EqExp)*
;

LOrExp:
    land+=LAndExp (op+='||' land2+=LAndExp)*
;

ConstExp:
    AddExp
;

