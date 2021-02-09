"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Lexer = void 0;
const token_1 = require("./token");
const error_handler_1 = require("./error-handler");
class Lexer {
    constructor() {
        this.tokens = [];
        this.deletedSpaces = 0;
        this.prevDeletedSpaces = 0;
        this.currentLine = 0;
        this.sourceFile = '';
        this.ptr = 0;
        this.end = 0;
        this.code = '';
    }
    static isWhitespace(char) {
        return /\s/.test(char);
    }
    static isAlpha(char) {
        return /^[A-Z]$/i.test(char);
    }
    static isAlnum(str) {
        return /^[a-z0-9]+$/i.test(str);
    }
    static isDigit(char) {
        return /\d/.test(char);
    }
    throwError(cause) {
        error_handler_1.ErrorHandler.throwError(`Token error: ${cause} on line ${this.currentLine} in file ${this.sourceFile}`);
    }
    consumeWhitespace() {
        while (this.ptr !== this.end && Lexer.isWhitespace(this.code[this.ptr])) {
            this.deletedSpaces++;
            if (this.code[this.ptr++] == '\n')
                this.currentLine++;
        }
    }
    addToken(type, value) {
        this.tokens.push(new token_1.Token(type, value, '', this.currentLine));
        console.log('added', this.tokens[this.tokens.length - 1].getKeyName(), value);
    }
    tokenize(code) {
        this.ptr = 0;
        this.end = code.length;
        this.code = code;
        while (this.ptr !== this.end) {
            this.deletedSpaces = 0;
            this.consumeWhitespace();
            if (this.ptr == this.end)
                break;
            let c = this.code[this.ptr];
            if (Lexer.chars.includes(c)) {
                this.addToken(c.charCodeAt(0), '');
            }
            else {
                c = this.code[this.ptr];
                if (Lexer.isAlpha(c) || c === '_') {
                    let tokenString = c;
                    while (++this.ptr !== this.end && (Lexer.isAlnum(this.code[this.ptr]) || this.code[this.ptr] === '_')) {
                        tokenString += this.code[this.ptr];
                    }
                    this.ptr--;
                    const strTokenType = token_1.TokenType[tokenString.toUpperCase()];
                    if (strTokenType !== undefined) {
                        this.addToken(strTokenType, '');
                    }
                    else {
                        if (!Lexer.builtinTypes.includes(tokenString)) {
                            this.addToken(token_1.TokenType.IDENTIFIER, tokenString);
                        }
                        else {
                            this.addToken(token_1.TokenType.TYPE, tokenString);
                        }
                    }
                }
                else if (c === '"' || c === '\'' || c === '`') {
                    let str = '';
                    this.ptr++;
                    let mightNeedUnescape = false;
                    while (this.code[this.ptr] !== c && this.ptr !== this.end) {
                        const chr = this.code[this.ptr];
                        str += chr;
                        if (!mightNeedUnescape && chr === '\\') {
                            mightNeedUnescape = true;
                        }
                        this.ptr++;
                    }
                    if (mightNeedUnescape) {
                        for (let i = 0; i < Lexer.regexes.length; i++) {
                            str = str.replace(Lexer.regexes[i], Lexer.regexActual[i]);
                        }
                    }
                    this.addToken(token_1.TokenType.STRING_LITERAL, str);
                }
                else if (Lexer.isDigit(this.code[this.ptr])) {
                    let numberStr = '';
                    while (Lexer.isDigit(this.code[this.ptr]) ||
                        this.code[this.ptr] === '.' ||
                        this.code[this.ptr] === 'x' ||
                        this.code[this.ptr] === 'b') {
                        numberStr += this.code[this.ptr++];
                    }
                    this.ptr--;
                    let converted = false;
                    let negation = this.tokens.length !== 0 && this.tokens[this.tokens.length - 1].type === token_1.TokenType.OP_MINUS && !this.deletedSpaces;
                    if (negation && !this.prevDeletedSpaces) {
                        if (this.tokens.length !== 0) {
                            const t = this.tokens[this.tokens.length - 1].type;
                            if (t === token_1.TokenType.IDENTIFIER || t === token_1.TokenType.BINARY || t === token_1.TokenType.DECIMAL || t === token_1.TokenType.OCTAL || t === token_1.TokenType.FLOAT || t === token_1.TokenType.LEFT_PAREN) {
                                negation = false;
                            }
                        }
                    }
                    if (negation) {
                        numberStr = '-' + numberStr;
                        this.tokens.pop();
                    }
                    const convertedNum = Number(numberStr);
                    if (!isNaN(convertedNum)) {
                        converted = true;
                    }
                    if (numberStr.includes('x')) {
                        if (converted)
                            this.addToken(token_1.TokenType.HEX, numberStr);
                    }
                    else if (numberStr.includes('b') && numberStr.length > 2) {
                        if (converted)
                            this.addToken(token_1.TokenType.BINARY, numberStr);
                    }
                    else if (numberStr.includes('.')) {
                        if (converted)
                            this.addToken(token_1.TokenType.FLOAT, numberStr);
                    }
                    else {
                        if (converted)
                            this.addToken(token_1.TokenType.DECIMAL, numberStr);
                    }
                    if (!converted) {
                        throw new Error(numberStr + ' is not a number');
                    }
                }
                else if (Lexer.chars2.includes(c)) {
                    let op = '';
                    while (Lexer.chars2.includes(this.code[this.ptr])) {
                        op += this.code[this.ptr++];
                    }
                    this.ptr--;
                    if (op.length === 1) {
                        this.addToken(c.charCodeAt(0), '');
                    }
                    else if (op.length > 1 && op.length < 4) {
                        if (op === '//') {
                            while (true) {
                                if (this.code[this.ptr] === '\n') {
                                    this.currentLine++;
                                    break;
                                }
                                if (this.ptr === this.end)
                                    break;
                                this.ptr++;
                            }
                            if (this.ptr === this.end)
                                break;
                        }
                        else if (op === '==') {
                            this.addToken(token_1.TokenType.OP_EQ, '');
                        }
                        else if (op === '!=') {
                            this.addToken(token_1.TokenType.OP_NOT_EQ, '');
                        }
                        else if (op === '&&') {
                            this.addToken(token_1.TokenType.OP_AND, '');
                        }
                        else if (op === '||') {
                            this.addToken(token_1.TokenType.OP_OR, '');
                        }
                        else if (op === '>>') {
                            this.addToken(token_1.TokenType.RSHIFT, '');
                        }
                        else if (op === '<<') {
                            this.addToken(token_1.TokenType.LSHIFT, '');
                        }
                        else if (op === '>>=') {
                            this.addToken(token_1.TokenType.RSHIFT_ASSIGN, '');
                        }
                        else if (op === '<<=') {
                            this.addToken(token_1.TokenType.LSHIFT_ASSIGN, '');
                        }
                        else if (op === '+=') {
                            this.addToken(token_1.TokenType.PLUS_ASSIGN, '');
                        }
                        else if (op === '-=') {
                            this.addToken(token_1.TokenType.MINUS_ASSIGN, '');
                        }
                        else if (op === '*=') {
                            this.addToken(token_1.TokenType.MUL_ASSIGN, '');
                        }
                        else if (op === '/=') {
                            this.addToken(token_1.TokenType.DIV_ASSIGN, '');
                        }
                        else if (op === '|=') {
                            this.addToken(token_1.TokenType.OR_ASSIGN, '');
                        }
                        else if (op === '&=') {
                            this.addToken(token_1.TokenType.AND_ASSIGN, '');
                        }
                        else if (op === '^=') {
                            this.addToken(token_1.TokenType.XOR_ASSIGN, '');
                        }
                        else if (op === '%=') {
                            this.addToken(token_1.TokenType.MOD_ASSIGN, '');
                        }
                        else if (op === '>=') {
                            this.addToken(token_1.TokenType.OP_GT_EQ, '');
                        }
                        else if (op === '<=') {
                            this.addToken(token_1.TokenType.OP_LT_EQ, '');
                        }
                        else {
                            this.throwError(`Unknown token ${op}`);
                        }
                    }
                    else {
                        this.throwError(`Unknown token ${op}`);
                    }
                }
                else {
                    this.throwError(`Unknown token ${c}`);
                }
            }
            this.prevDeletedSpaces = this.deletedSpaces;
            this.ptr++;
        }
        return this.tokens;
    }
}
exports.Lexer = Lexer;
Lexer.chars = ".,:;{}[]()~$#";
Lexer.chars2 = "=+-*&|/<>!%^";
Lexer.regexes = [
    new RegExp(String.raw `\\n`),
    new RegExp(String.raw `\\t`),
    new RegExp(String.raw `\\a`),
    new RegExp(String.raw `\\r`),
    new RegExp(String.raw `\\b`),
    new RegExp(String.raw `\\v`)
];
Lexer.regexActual = [
    "\n", "\t", "\a", "\r", "\b", "\v"
];
Lexer.builtinTypes = [
    "int", "double",
    "func", "str", "void",
    "obj", "arr", "bool"
];