export enum TokenType {
  OP_PLUS = '+'.charCodeAt(0), OP_MINUS = '-'.charCodeAt(0), OP_DIV = '/'.charCodeAt(0),
  OP_MUL = '*'.charCodeAt(0), OP_MOD = '%'.charCodeAt(0), OP_LT = '<'.charCodeAt(0),
  OP_GT = '>'.charCodeAt(0), OP_NOT = '!'.charCodeAt(0), OP_NEG = '~'.charCodeAt(0),
  OP_OR_BIT = '|'.charCodeAt(0), OP_AND_BIT = '&'.charCodeAt(0), OP_ASSIGN = '='.charCodeAt(0),
  OP_XOR = '^'.charCodeAt(0),

  DOT = '.'.charCodeAt(0), COMMA = ','.charCodeAt(0), COLON = ':'.charCodeAt(0),
  SEMI_COLON = ';'.charCodeAt(0), LEFT_BRACE = '{'.charCodeAt(0), LEFT_BRACKET = '['.charCodeAt(0),
  LEFT_PAREN = '('.charCodeAt(0), RIGHT_BRACE = '}'.charCodeAt(0), RIGHT_BRACKET = ']'.charCodeAt(0),
  RIGHT_PAREN = ')'.charCodeAt(0), SET = '$'.charCodeAt(0), SET_IDX = '#'.charCodeAt(0),

  FUNCTION = 130, RETURN, IF, ELSE, BREAK, CONTINUE,
  FOR, WHILE, ALLOC, TYPE, REF, CONST,

  STRING_LITERAL, NUMBER, ARRAY, CLASS,

  PLUS_ASSIGN, MINUS_ASSIGN, MUL_ASSIGN, DIV_ASSIGN, MOD_ASSIGN,
  LSHIFT_ASSIGN, RSHIFT_ASSIGN, AND_ASSIGN, OR_ASSIGN, XOR_ASSIGN,

  LSHIFT, RSHIFT,

  OP_AND, OP_OR, OP_EQ, OP_NOT_EQ, OP_GT_EQ, OP_LT_EQ,

  IDENTIFIER,

  FALSE, TRUE,

  UNKNOWN,

  NONE, GENERAL_EXPRESSION, GENERAL_STATEMENT
};

export class Token {
  public type: TokenType = TokenType.NONE;
  public value: string = '';
  public source: string = '';
  public line: number = 0;

  public getKeyName(): string {
    return Token.getKeyName(this.type);
  }

  public static getKeyName(type: TokenType): string {
    // use for debugging purposes only!
    for (const key of Object.keys(TokenType)) {
      if (TokenType[key as keyof typeof TokenType] === type) {
        return key;
      }
    }
    return 'TOKEN NAME ERROR!';
  }

  public getName(): string {
    return Token.getName(this.type);
  }

  private static nameLUT: {[key: number]: string} = {
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
  }

  public static getName(type: TokenType): string {
    return Token.nameLUT[type];
  }

  public static getDefault(): Token {
    return new Token(TokenType.NONE, '', '', 0);
  }

  public constructor(_type: TokenType, _value: string, _source: string, _line: number) {
    this.type = _type;
    this.value = _value;
    this.source = _source;
    this.line = _line;
  }
}