"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Token = exports.TokenType = void 0;
var TokenType;
(function (TokenType) {
    TokenType[TokenType["OP_PLUS"] = '+'.charCodeAt(0)] = "OP_PLUS";
    TokenType[TokenType["OP_MINUS"] = '-'.charCodeAt(0)] = "OP_MINUS";
    TokenType[TokenType["OP_DIV"] = '/'.charCodeAt(0)] = "OP_DIV";
    TokenType[TokenType["OP_MUL"] = '*'.charCodeAt(0)] = "OP_MUL";
    TokenType[TokenType["OP_MOD"] = '%'.charCodeAt(0)] = "OP_MOD";
    TokenType[TokenType["OP_LT"] = '<'.charCodeAt(0)] = "OP_LT";
    TokenType[TokenType["OP_GT"] = '>'.charCodeAt(0)] = "OP_GT";
    TokenType[TokenType["OP_NOT"] = '!'.charCodeAt(0)] = "OP_NOT";
    TokenType[TokenType["OP_NEG"] = '~'.charCodeAt(0)] = "OP_NEG";
    TokenType[TokenType["OP_OR_BIT"] = '|'.charCodeAt(0)] = "OP_OR_BIT";
    TokenType[TokenType["OP_AND_BIT"] = '&'.charCodeAt(0)] = "OP_AND_BIT";
    TokenType[TokenType["OP_ASSIGN"] = '='.charCodeAt(0)] = "OP_ASSIGN";
    TokenType[TokenType["OP_XOR"] = '^'.charCodeAt(0)] = "OP_XOR";
    TokenType[TokenType["DOT"] = '.'.charCodeAt(0)] = "DOT";
    TokenType[TokenType["COMMA"] = ','.charCodeAt(0)] = "COMMA";
    TokenType[TokenType["COLON"] = ':'.charCodeAt(0)] = "COLON";
    TokenType[TokenType["SEMI_COLON"] = ';'.charCodeAt(0)] = "SEMI_COLON";
    TokenType[TokenType["LEFT_BRACE"] = '{'.charCodeAt(0)] = "LEFT_BRACE";
    TokenType[TokenType["LEFT_BRACKET"] = '['.charCodeAt(0)] = "LEFT_BRACKET";
    TokenType[TokenType["LEFT_PAREN"] = '('.charCodeAt(0)] = "LEFT_PAREN";
    TokenType[TokenType["RIGHT_BRACE"] = '}'.charCodeAt(0)] = "RIGHT_BRACE";
    TokenType[TokenType["RIGHT_BRACKET"] = ']'.charCodeAt(0)] = "RIGHT_BRACKET";
    TokenType[TokenType["RIGHT_PAREN"] = ')'.charCodeAt(0)] = "RIGHT_PAREN";
    TokenType[TokenType["SET"] = '$'.charCodeAt(0)] = "SET";
    TokenType[TokenType["SET_IDX"] = '#'.charCodeAt(0)] = "SET_IDX";
    TokenType[TokenType["FUNCTION"] = 130] = "FUNCTION";
    TokenType[TokenType["RETURN"] = 131] = "RETURN";
    TokenType[TokenType["IF"] = 132] = "IF";
    TokenType[TokenType["ELSE"] = 133] = "ELSE";
    TokenType[TokenType["BREAK"] = 134] = "BREAK";
    TokenType[TokenType["CONTINUE"] = 135] = "CONTINUE";
    TokenType[TokenType["FOR"] = 136] = "FOR";
    TokenType[TokenType["WHILE"] = 137] = "WHILE";
    TokenType[TokenType["ALLOC"] = 138] = "ALLOC";
    TokenType[TokenType["TYPE"] = 139] = "TYPE";
    TokenType[TokenType["REF"] = 140] = "REF";
    TokenType[TokenType["CONST"] = 141] = "CONST";
    TokenType[TokenType["STRING_LITERAL"] = 142] = "STRING_LITERAL";
    TokenType[TokenType["NUMBER"] = 143] = "NUMBER";
    TokenType[TokenType["ARRAY"] = 144] = "ARRAY";
    TokenType[TokenType["CLASS"] = 145] = "CLASS";
    TokenType[TokenType["PLUS_ASSIGN"] = 146] = "PLUS_ASSIGN";
    TokenType[TokenType["MINUS_ASSIGN"] = 147] = "MINUS_ASSIGN";
    TokenType[TokenType["MUL_ASSIGN"] = 148] = "MUL_ASSIGN";
    TokenType[TokenType["DIV_ASSIGN"] = 149] = "DIV_ASSIGN";
    TokenType[TokenType["MOD_ASSIGN"] = 150] = "MOD_ASSIGN";
    TokenType[TokenType["LSHIFT_ASSIGN"] = 151] = "LSHIFT_ASSIGN";
    TokenType[TokenType["RSHIFT_ASSIGN"] = 152] = "RSHIFT_ASSIGN";
    TokenType[TokenType["AND_ASSIGN"] = 153] = "AND_ASSIGN";
    TokenType[TokenType["OR_ASSIGN"] = 154] = "OR_ASSIGN";
    TokenType[TokenType["XOR_ASSIGN"] = 155] = "XOR_ASSIGN";
    TokenType[TokenType["LSHIFT"] = 156] = "LSHIFT";
    TokenType[TokenType["RSHIFT"] = 157] = "RSHIFT";
    TokenType[TokenType["OP_AND"] = 158] = "OP_AND";
    TokenType[TokenType["OP_OR"] = 159] = "OP_OR";
    TokenType[TokenType["OP_EQ"] = 160] = "OP_EQ";
    TokenType[TokenType["OP_NOT_EQ"] = 161] = "OP_NOT_EQ";
    TokenType[TokenType["OP_GT_EQ"] = 162] = "OP_GT_EQ";
    TokenType[TokenType["OP_LT_EQ"] = 163] = "OP_LT_EQ";
    TokenType[TokenType["IDENTIFIER"] = 164] = "IDENTIFIER";
    TokenType[TokenType["FALSE"] = 165] = "FALSE";
    TokenType[TokenType["TRUE"] = 166] = "TRUE";
    TokenType[TokenType["UNKNOWN"] = 167] = "UNKNOWN";
    TokenType[TokenType["NONE"] = 168] = "NONE";
    TokenType[TokenType["GENERAL_EXPRESSION"] = 169] = "GENERAL_EXPRESSION";
    TokenType[TokenType["GENERAL_STATEMENT"] = 170] = "GENERAL_STATEMENT";
})(TokenType = exports.TokenType || (exports.TokenType = {}));
;
class Token {
    constructor(_type, _value, _source, _line) {
        this.type = TokenType.NONE;
        this.value = '';
        this.source = '';
        this.line = 0;
        this.type = _type;
        this.value = _value;
        this.source = _source;
        this.line = _line;
    }
    getKeyName() {
        return Token.getKeyName(this.type);
    }
    static getKeyName(type) {
        // use for debugging purposes only!
        for (const key of Object.keys(TokenType)) {
            if (TokenType[key] === type) {
                return key;
            }
        }
        return 'TOKEN NAME ERROR!';
    }
    getName() {
        return Token.getName(this.type);
    }
    static getName(type) {
        return Token.nameLUT[type];
    }
    static getDefault() {
        return new Token(TokenType.NONE, '', '', 0);
    }
}
exports.Token = Token;
Token.nameLUT = {
    [TokenType.FUNCTION]: 'function',
    [TokenType.RETURN]: 'return',
    [TokenType.IF]: 'if',
    [TokenType.ELSE]: 'else',
    [TokenType.FOR]: 'for',
    [TokenType.WHILE]: 'while',
    [TokenType.BREAK]: 'break',
    [TokenType.CONTINUE]: 'continue',
    [TokenType.ALLOC]: 'alloc',
    [TokenType.TYPE]: 'type',
    [TokenType.REF]: 'ref',
    [TokenType.CONST]: 'const',
    [TokenType.STRING_LITERAL]: 'string',
    [TokenType.NUMBER]: 'number',
    [TokenType.ARRAY]: 'array',
    [TokenType.CLASS]: 'class',
    [TokenType.OP_EQ]: '==',
    [TokenType.OP_NOT_EQ]: '!=',
    [TokenType.OP_GT_EQ]: '>=',
    [TokenType.OP_LT_EQ]: '<=',
    [TokenType.OP_AND]: '&&',
    [TokenType.OP_OR]: '||',
    [TokenType.LSHIFT]: '<<',
    [TokenType.RSHIFT]: '>>',
    [TokenType.LSHIFT_ASSIGN]: '<<=',
    [TokenType.RSHIFT_ASSIGN]: '>>=',
    [TokenType.PLUS_ASSIGN]: '+=',
    [TokenType.MINUS_ASSIGN]: '-=',
    [TokenType.MUL_ASSIGN]: '*=',
    [TokenType.DIV_ASSIGN]: '/=',
    [TokenType.OR_ASSIGN]: '|=',
    [TokenType.AND_ASSIGN]: '&=',
    [TokenType.XOR_ASSIGN]: '^=',
    [TokenType.MOD_ASSIGN]: '%=',
    [TokenType.IDENTIFIER]: 'identifier',
    [TokenType.FALSE]: 'false',
    [TokenType.TRUE]: 'true',
    [TokenType.UNKNOWN]: 'unknown token',
    [TokenType.NONE]: 'empty token',
    [TokenType.GENERAL_EXPRESSION]: 'expression',
    [TokenType.GENERAL_STATEMENT]: 'statement',
    [TokenType.OP_PLUS]: '+',
    [TokenType.OP_MINUS]: '-',
    [TokenType.OP_DIV]: '/',
    [TokenType.OP_MUL]: '*',
    [TokenType.OP_MOD]: '%',
    [TokenType.OP_LT]: '<',
    [TokenType.OP_GT]: '>',
    [TokenType.OP_NOT]: '!',
    [TokenType.OP_NEG]: '~',
    [TokenType.OP_OR_BIT]: '|',
    [TokenType.OP_AND_BIT]: '&',
    [TokenType.OP_XOR]: '^',
    [TokenType.OP_ASSIGN]: '=',
    [TokenType.DOT]: '.',
    [TokenType.COMMA]: ',',
    [TokenType.COLON]: ':',
    [TokenType.SEMI_COLON]: ';',
    [TokenType.LEFT_BRACE]: '{',
    [TokenType.LEFT_BRACKET]: '[',
    [TokenType.LEFT_PAREN]: '(',
    [TokenType.RIGHT_BRACE]: '}',
    [TokenType.RIGHT_BRACKET]: ']',
    [TokenType.RIGHT_PAREN]: ')',
    [TokenType.SET]: '$',
    [TokenType.SET_IDX]: '#'
};
