import {Token, TokenType} from './token'
import {ErrorHandler} from './error-handler'
import { existsSync, readFileSync } from 'fs';
import path from 'path';

export class Lexer {
  private tokens: Token[] = [];
  private deletedSpaces: number = 0;
  private prevDeletedSpaces: number = 0;
  private currentLine: number = 1;
  private baseDir: string = '';
  private baseName: string = '';
  private fullPath: string = '';
  private ptr: number = 0;
  private end: number = 0;
  private code: string = '';

  private static chars: string = ".,:;{}[]()~$#";
  private static chars2: string = "=+-*&|/<>!%^";

  private static allowedTokenKeys: string[] = [
    'function', 'class', 'array', 'return', 'if', 'else', 'for', 'while',
    'break', 'continue', 'alloc', 'ref', 'true', 'false', 'const'
  ]

  private static regexes: RegExp[] = [
    new RegExp(String.raw`\\n`),
    new RegExp(String.raw`\\t`),
    new RegExp(String.raw`\\a`),
    new RegExp(String.raw`\\r`),
    new RegExp(String.raw`\\b`),
    new RegExp(String.raw`\\v`)
  ]

  private static regexActual: string[] = [
    "\n", "\t", "\a", "\r", "\b", "\v"
  ]

  private static builtinTypes: string[] = [
    "num", "func", "str", "void",
    "obj", "arr", "bool"
  ];

  private static isWhitespace(char: string): boolean {
    return /\s/.test(char);
  }

  private static isAlpha(char: string): boolean {
    return /^[A-Z]$/i.test(char);
  }

  private static isAlnum(str: string): boolean {
    return /^[a-z0-9]+$/i.test(str);
  }

  private static isDigit(char: string): boolean {
    return /\d/.test(char);
  }

  private throwError(cause: string): void {
    ErrorHandler.throwError(`Token error: ${cause} (${this.baseName}:${this.currentLine})`);
  }

  private consumeWhitespace(): void {
    while (this.ptr !== this.end && Lexer.isWhitespace(this.code[this.ptr])) {
      this.deletedSpaces++;
      if (this.code[this.ptr++] == '\n') this.currentLine++;
    }
  }

  private addToken(type: TokenType, value: string): void {
    this.tokens.push(new Token(type, value, this.baseName, this.currentLine));
  }

  tokenize(code: string): Token[] {
    this.ptr = 0;
    this.end = code.length;
    this.code = code;
    while (this.ptr !== this.end) {
      this.deletedSpaces = 0;
      this.consumeWhitespace();
      if (this.ptr == this.end) break;
      let c: string = this.code[this.ptr];
      if (Lexer.chars.includes(c)) {
        this.addToken(c.charCodeAt(0) as TokenType, '');
      } else {
        c = this.code[this.ptr];
        if (Lexer.isAlpha(c) || c === '_') {
          let tokenString: string = c;
          while (++this.ptr !== this.end && (Lexer.isAlnum(this.code[this.ptr]) || this.code[this.ptr] === '_')) {
            tokenString += this.code[this.ptr];
          }
          this.ptr--;
          if (tokenString === 'include') {
            this.ptr++;
            this.consumeWhitespace();
            c = this.code[this.ptr];
            if (!(c === '"' || c === "'" || c === '`') || this.ptr === this.end || this.ptr + 1 === this.end) {
              this.throwError('Expected a string literal after include');
            }
            this.ptr++;
            let path: string = `${this.baseDir}/`;
            while (this.code[this.ptr] !== c && this.ptr !== this.end) {
              path += this.code[this.ptr++];
            }
            const [toks, err] = new Lexer().processFile(path);
            if (err) {
              this.throwError(`Couldn't include file ${path}`);
            }
            this.tokens.push(...toks);
          } else if (Lexer.allowedTokenKeys.includes(tokenString)) {
            const strTokenType: TokenType = TokenType[tokenString.toUpperCase() as keyof typeof TokenType];
            this.addToken(strTokenType, '');
          } else {
            if (!Lexer.builtinTypes.includes(tokenString)) {
              this.addToken(TokenType.IDENTIFIER, tokenString);
            } else {
              this.addToken(TokenType.TYPE, tokenString);
            }
          }
        } else if (c === '"' || c === '\'' || c === '`') {
          let str: string = '';
          this.ptr++;
          let mightNeedUnescape: boolean = false;
          while (this.code[this.ptr] !== c && this.ptr !== this.end) {
            const chr: string = this.code[this.ptr];
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
          this.addToken(TokenType.STRING_LITERAL, str);
        } else if (Lexer.isDigit(this.code[this.ptr])) {
          let numberStr: string = '';
          while (
            Lexer.isDigit(this.code[this.ptr]) ||
            this.code[this.ptr] === '.' ||
            this.code[this.ptr] === 'x' ||
            this.code[this.ptr] === 'b'
          ) {
            numberStr += this.code[this.ptr++];
          }
          this.ptr--;
          let negation: boolean = this.tokens.length !== 0 && this.tokens[this.tokens.length - 1].type === TokenType.OP_MINUS && !this.deletedSpaces;
          if (negation && !this.prevDeletedSpaces) {
            if (this.tokens.length !== 0) {
              const t: TokenType = this.tokens[this.tokens.length - 1].type;
              if (t === TokenType.IDENTIFIER || t === TokenType.NUMBER || t === TokenType.LEFT_PAREN) {
                negation = false;
              }
            }
          }
          if (negation) {
            numberStr = '-' + numberStr;
            this.tokens.pop();
          }
          const convertedNum: number = Number(numberStr);
          if (isNaN(convertedNum)) {
            this.throwError(`${numberStr} is not a number`);
          }
          this.addToken(TokenType.NUMBER, numberStr);
        } else if (Lexer.chars2.includes(c)) {
          let op: string = '';
          while (Lexer.chars2.includes(this.code[this.ptr])) {
            op += this.code[this.ptr++];
          }
          this.ptr--;
          if (op.length === 1) {
            this.addToken(c.charCodeAt(0) as TokenType, '');
          } else if (op.length > 1 && op.length < 4) {
            if (op === '//') {
              while (true) {
                if (this.code[this.ptr] === '\n') {
                  this.currentLine++;
                  break;
                }
                if (this.ptr === this.end) break;
                this.ptr++;
              }
              if (this.ptr === this.end) break;
            } else if (op === '==') {
              this.addToken(TokenType.OP_EQ, '');
            } else if (op === '!=') {
              this.addToken(TokenType.OP_NOT_EQ, '');
            } else if (op === '&&') {
              this.addToken(TokenType.OP_AND, '');
            } else if (op === '||') {
              this.addToken(TokenType.OP_OR, '');
            } else if (op === '>>') {
              this.addToken(TokenType.RSHIFT, '');
            } else if (op === '<<') {
              this.addToken(TokenType.LSHIFT, '');
            } else if (op === '>>=') {
              this.addToken(TokenType.RSHIFT_ASSIGN, '');
            } else if (op === '<<=') {
              this.addToken(TokenType.LSHIFT_ASSIGN, '');
            } else if (op === '+=') {
              this.addToken(TokenType.PLUS_ASSIGN, '');
            } else if (op === '-=') {
              this.addToken(TokenType.MINUS_ASSIGN, '');
            } else if (op === '*=') {
              this.addToken(TokenType.MUL_ASSIGN, '');
            } else if (op === '/=') {
              this.addToken(TokenType.DIV_ASSIGN, '');
            } else if (op === '|=') {
              this.addToken(TokenType.OR_ASSIGN, '');
            } else if (op === '&=') {
              this.addToken(TokenType.AND_ASSIGN, '');
            } else if (op === '^=') {
              this.addToken(TokenType.XOR_ASSIGN, '');
            } else if (op === '%=') {
              this.addToken(TokenType.MOD_ASSIGN, '');
            } else if (op === '>=') {
              this.addToken(TokenType.OP_GT_EQ, '');
            } else if (op === '<=') {
              this.addToken(TokenType.OP_LT_EQ, '');
            } else {
              this.throwError(`Unknown token ${op}`);
            }
          } else {
            this.throwError(`Unknown token ${op}`);
          }
        } else {
          this.throwError(`Unknown token ${c}`);
        }
      }
      this.prevDeletedSpaces = this.deletedSpaces;
      this.ptr++;
    }
    return this.tokens;
  }

  /**
   * @param filename input file
   * @returns a tuple with tokens and boolean indicating an error
   */

  public processFile(filename: string): [Token[], boolean] {
    if (!existsSync(filename)) {
      return [[], true];
    }
    this.fullPath = path.resolve(filename);
    this.baseName = path.basename(this.fullPath);
    this.baseDir = path.dirname(this.fullPath);
    const toks: Token[] = this.tokenize(readFileSync(filename, {encoding: 'utf-8'}));
    return [toks, false];
  }

}