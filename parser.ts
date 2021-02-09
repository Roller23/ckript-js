import {ErrorHandler} from './error-handler';
import {Token, TokenType} from './token'
import {Declaration, DeclType, ExprType, Node, NodeType, Statement, StmtType} from './ast'
import { Lexer } from './lexer';

export class Parser {
  // utils
  private tokens: Token[] = [];
  private prev: Token = Token.getDefault();
  private currToken: Token;
  private pos: number = 0;
  private tokensCount: number;
  private terminal: TokenType;
  private static baseLUT: {[key: number]: number} = {
    [TokenType.BINARY]: 2,
    [TokenType.DECIMAL]: 10,
    [TokenType.HEX]: 16
  };

  private throwError(cause: string, token: Token): void {
    ErrorHandler.throwError(`Syntax error: ${cause} on line ${token.line} in file ${token.source}`);
  }

  private failIfEOF(expected: TokenType): void {
    if (this.currToken.type === TokenType.NONE) {
      this.throwError(`Reached end of file but ${Token.getName(expected)} expected`, this.currToken);
    }
  }

  private advance(): void {
    this.pos++;
    this.prev = this.tokens[this.pos - 1];
    if (this.pos < this.tokensCount) {
      this.currToken = this.tokens[this.pos];
    } else {
      this.currToken = Token.getDefault();
      this.pos--;
    }
  }

  private retreat(): void {
    if (this.pos === 0) return;
    this.pos--;
    this.currToken = this.tokens[this.pos];
    this.prev = this.pos > 0 ? this.tokens[this.pos - 1] : Token.getDefault();
  }

  private lookahead(offset: number): Token {
    if (this.pos + offset < 0) return Token.getDefault();
    if (this.pos + offset >= this.tokens.length) return Token.getDefault();
    return this.tokens[this.pos + offset];
  }

  private findEnclosingBrace(startPos: number, braces: number = 0): number {
    let i: number = 0;
    const size: number = this.tokens.length;
    while (true) {
      if (size === i + startPos) {
        this.throwError('Invalid function declaration, no enclosing brace found', this.tokens[startPos + i - 1]);
      }
      if (this.tokens[startPos + i].type === TokenType.LEFT_BRACE) {
        braces++;
      }
      if (this.tokens[startPos + i].type === TokenType.RIGHT_BRACE) {
        braces--;
        if (braces === 0) {
          return i;
        }
      }
      i++;
    }
  }

  private findEnclosingParen() {
    let startPos: number = this.pos;
    let i: number = 0;
    const size: number = this.tokens.length;
    let lparen: number = 1;
    while (true) {
      if (size === i) {
        this.throwError('Invalid expression, no enclosing parenthesis found', this.tokens[startPos + i - 1]);
      }
      if (this.tokens[startPos + i].type === TokenType.LEFT_PAREN) {
        lparen++;
      }
      if (this.tokens[startPos + i].type === TokenType.LEFT_PAREN) {
        lparen--;
        if (lparen === 0) {
          return i;
        }
      }
      i++;
    }
  }

  private findEnclosingEnd(): number {
    return this.findEnclosingBrace(this.pos);
  }

  private getManyStatements(node: Node, stop: TokenType): Node[] {
    let res: Node[] = [];
    while (true) {
      let statement: Node = this.getStatement(node, this.terminal);
      if (statement.type === NodeType.UNKNOWN) break;
      res.push(statement);
    }
    return res;
  }

  private getStatement(prev: Node, stop: TokenType): Node {
    if (this.currToken.type === stop) {
      return prev;
    } else if (this.currToken.type === TokenType.CLASS) {
      console.log('parsing class');
      // TODO
    } else if (this.currToken.type === TokenType.SET) {
      console.log('parsing set');
      let set: Node = new Node(new Statement(StmtType.SET));
      let stmt = set.toStmt();
      stmt.line = this.currToken.line;
      stmt.source = this.currToken.source;
      this.advance(); // skip the $
      if (this.currToken.type != TokenType.IDENTIFIER) {
        this.throwError(`invalid set statement. Expected an identifier, but ${this.currToken.getName()} found`, this.currToken);
      }
      stmt.objMembers.push(this.currToken.value);
      this.advance(); // skip the id
      while (true) {
        if (this.currToken.type !== TokenType.DOT) {
          this.throwError(`invalid set statement. Expected '.', but ${this.currToken.getName()} found`, this.currToken);
        }
        this.advance(); // skip the dot
        if (this.currToken.type !== TokenType.IDENTIFIER) {
          this.throwError(`invalid set statement. Expected an identifier, but ${this.currToken.getName()} found`, this.currToken);
        }
        stmt.objMembers.push(this.currToken.value);
        this.advance(); // skip the id
        if (this.currToken.type === TokenType.OP_ASSIGN) break;
      }
      this.advance(); // skip the =
      stmt.expressions.push(this.getExpression(TokenType.SEMI_COLON));
      this.advance(); // skip the ;
      return set;
    } else if (this.currToken.type === TokenType.SET_IDX) {
      console.log('parsing set idx')
      let setIdx: Node = new Node(new Statement(StmtType.SET_IDX));
      let stmt = setIdx.toStmt();
      stmt.line = this.currToken.line;
      stmt.source = this.currToken.source;
      this.advance(); // skip the #
      if (this.currToken.type !== TokenType.IDENTIFIER) {
        this.throwError(`invalid set index statement. Expected an identifier, but ${this.currToken.getName()} found`, this.currToken);
      }
      stmt.objMembers.push(this.currToken.value);
      this.advance(); // skip the id
      while (true) {
        let idxExpr: Node = this.getExprNode();
        if (idxExpr.toExpr().type  !== ExprType.INDEX) {
          this.throwError(`invalid set index statement, expected an index expression`, this.currToken);
        }
        stmt.indexes.push(idxExpr);
        if (this.currToken.type === TokenType.OP_ASSIGN) break;
      }
      this.advance(); // skip the =
      stmt.expressions.push(this.getExpression(TokenType.SEMI_COLON));
      this.advance(); // skip the ;
      return setIdx;
    } else if (this.currToken.type === TokenType.LEFT_BRACE) {
      console.log('parsing compound')
      let comp: Node = new Node(new Statement(StmtType.COMPOUND));
      let stmt = comp.toStmt();
      stmt.source = this.currToken.source;
      stmt.line = this.currToken.line;
      this.advance(); // skip the {
      const blockEnd: number = this.findEnclosingBrace(this.pos, 1);
      let blockStart: Token[] = this.tokens.slice(this.pos, this.pos + blockEnd + 1);
      let blockParser: Parser = new Parser(blockStart, TokenType.RIGHT_BRACE);
      let [newAST, endPos] = blockParser.parse();
      this.pos += endPos;
      stmt.statements.push(newAST);
      this.advance(); // skip the }
      return comp;
    } else if (this.currToken.type === TokenType.IF) {
      console.log('parsing if')
      const line: number = this.currToken.line;
      const source: string = this.currToken.source;
      this.advance(); // skip the if
      if (this.currToken.type !== TokenType.LEFT_PAREN) {
        this.throwError(`invalid if statement. Expected '(' but ${this.currToken.getName()} found`, this.currToken);
      }
      let ifStmt: Node = new Node(new Statement(StmtType.IF));
      let stmt = ifStmt.toStmt();
      stmt.line = line;
      stmt.source = source;
      this.advance(); // skip the (
      stmt.expressions.push(this.getExpression(TokenType.RIGHT_PAREN));
      this.advance(); // skip the )
      stmt.statements.push(this.getStatement(prev, stop));
      if (this.currToken.type === TokenType.ELSE) {
        this.advance(); // skip else
        stmt.statements.push(this.getStatement(prev, stop));
      }
      return ifStmt;
    } else if (this.currToken.type === TokenType.WHILE) {
      console.log('parsing while');
      const line: number = this.currToken.line;
      const source: string = this.currToken.source;
      this.advance(); // skip the while
      if (this.currToken.type !== TokenType.LEFT_PAREN) {
        this.throwError(`invalid while statement. Expected '(' but ${this.currToken.getName()} found`, this.currToken);
      }
      let whileStmt: Node = new Node(new Statement(StmtType.WHILE));
      let stmt = whileStmt.toStmt();
      stmt.line = line;
      stmt.source = source;
      this.advance(); // skip the (
      stmt.expressions.push(this.getExpression(TokenType.RIGHT_PAREN));
      this.advance(); // skip the )
      stmt.statements.push(this.getStatement(prev, stop));
      return whileStmt;
    } else if (this.currToken.type === TokenType.FOR) {
      console.log('parsing for');
      const line: number = this.currToken.line;
      const source: string = this.currToken.source;
      this.advance(); // skip the for
      if (this.currToken.type !== TokenType.LEFT_PAREN) {
        this.throwError(`invalid for statement. Expected '(' but ${this.currToken.getName()} found`, this.currToken);
      }
      let forStmt: Node = new Node(new Statement(StmtType.FOR));
      let stmt = forStmt.toStmt();
      stmt.line = line;
      stmt.source = source;
      this.advance(); // skip the (
      stmt.expressions = this.getManyExpressions(TokenType.SEMI_COLON, TokenType.RIGHT_PAREN);
      this.advance(); // skip the )
      stmt.statements.push(this.getStatement(prev, stop));
      return forStmt;
    } else if (this.currToken.type === TokenType.RETURN) {
      console.log('parsing return');
      let returnStmt: Node = new Node(new Statement(StmtType.RETURN));
      let stmt = returnStmt.toStmt();
      stmt.line = this.currToken.line;
      stmt.source = this.currToken.source;
      this.advance(); // skip the return
      stmt.expressions.push(this.getExpression(TokenType.SEMI_COLON));
      this.advance(); // skip the semicolon
      return returnStmt;
    } else if (this.currToken.type === TokenType.BREAK) {
      console.log('parsing break');
      const line: number = this.currToken.line;
      const source: string = this.currToken.source;
      this.advance(); // skip the break
      if (this.currToken.type !== TokenType.SEMI_COLON) {
        this.throwError(`invalid break statement. Expected ';' but ${this.currToken.getName()} found`, this.currToken);
      }
      this.advance(); // skip the ;
      let continueStmt: Node = new Node(new Statement(StmtType.BREAK));
      let stmt = continueStmt.toStmt();
      stmt.line = line;
      stmt.source = source;
      return continueStmt;
    } else if (this.currToken.type === TokenType.CONTINUE) {
      console.log('parsing continue');
      const line: number = this.currToken.line;
      const source: string = this.currToken.source;
      this.advance(); // skip the continue
      if (this.currToken.type !== TokenType.SEMI_COLON) {
        this.throwError(`invalid continue statement. Expected ';' but ${this.currToken.getName()} found`, this.currToken);
      }
      this.advance(); // skip the ;
      let continueStmt: Node = new Node(new Statement(StmtType.CONTINUE));
      let stmt = continueStmt.toStmt();
      stmt.line = line;
      stmt.source = source;
      return continueStmt;
    } else if (this.currToken.type === TokenType.TYPE) {
      console.log('parsing type');
      if (this.currToken.value === 'void') {
        this.throwError(`invalid variable declaration. Cannot declare a void variable`, this.currToken);
      }
      const line: number = this.currToken.line;
      const source: string = this.currToken.source;
      const allocated: boolean = this.prev.type === TokenType.ALLOC;
      let constant: boolean = this.prev.type === TokenType.CONST;
      const reference: boolean = this.prev.type === TokenType.REF;
      if (allocated && this.lookahead(-2).type === TokenType.CONST) {
        constant = true;
      }
      let varDecl: Node = new Node(new Declaration(DeclType.VAR_DECL));
      let decl = varDecl.toDecl();
      decl.varType = this.currToken.value;
      this.advance(); // skip the variable type
      if (this.currToken.type !== TokenType.IDENTIFIER) {
        this.throwError(`invalid variable declaration. Expected an identifier, but ${this.currToken.getName()} found`, this.currToken);
      }
      decl.id = this.currToken.value;
      this.advance(); // skip the identifier
      if (this.currToken.type !== TokenType.OP_ASSIGN) {
        this.throwError(`invalid variable declaration. Expected '=', but ${this.currToken.getName()} found`, this.currToken);
      }
      this.advance(); // skip the =
      decl.varExpression = this.getExpression(TokenType.SEMI_COLON);
      decl.isAllocated = allocated;
      decl.isConstant = constant;
      decl.isReference = reference;
      let declStmt: Node = new Node(new Statement(StmtType.DECL));
      let stmt = declStmt.toStmt();
      stmt.statements.push(varDecl);
      stmt.line = line;
      stmt.source = source;
      this.advance(); // skip the semicolon
      return declStmt;
    } else if (this.currToken.type === TokenType.ALLOC) {
      console.log('parsing alloc');
      this.advance(); // skip the alloc
      if (this.currToken.type !== TokenType.TYPE) {
        this.throwError(`invalid variable allocation. Expected a type, but ${this.currToken.getName()} found`, this.currToken);
      }
      return this.getStatement(prev, stop);
    } else if (this.currToken.type === TokenType.REF) {
      console.log('parsing ref');
      this.advance(); // skip the alloc
      if (this.currToken.type !== TokenType.TYPE) {
        this.throwError(`invalid variable reference. Expected a type, but ${this.currToken.getName()} found`, this.currToken);
      }
      return this.getStatement(prev, stop);
    } else if (this.currToken.type === TokenType.CONST) {
      console.log('parsing const');
      this.advance(); // skip the const
      if (this.currToken.type !== TokenType.TYPE && this.currToken.type !== TokenType.ALLOC && this.currToken.type !== TokenType.REF) {
        this.throwError(`invalid constant variable declaration. Expected a type, alloc or ref, but ${this.currToken.getName()} found`, this.currToken);
      }
      return this.getStatement(prev, stop);
    } else if (this.currToken.type === TokenType.SEMI_COLON && prev.type === NodeType.UNKNOWN) {
      console.log('parsing nop');
      let nopStmt: Node = new Node(new Statement(StmtType.NOP));
      let stmt = nopStmt.toStmt();
      stmt.line = this.currToken.line;
      stmt.source = this.currToken.source;
      this.advance(); // skip the ;
      return nopStmt;
    } else if (this.currToken.type === this.terminal) {
      console.log('reached terminal')
      return prev;
    } else {
      console.log('parsing expression statement');
      const line: number = this.currToken.line;
      const source: string = this.currToken.source;
      let expr: Node[] = this.getExpression(TokenType.SEMI_COLON);
      let exprStmt: Node = new Node(new Statement(StmtType.EXPR));
      let stmt = exprStmt.toStmt();
      stmt.expressions.push(expr);
      stmt.line = line;
      stmt.source = source;
      this.advance(); // skip the ;
      return exprStmt;
    }
    this.throwError(`unrecognized token ${this.currToken.getName()}`, this.currToken);
    return prev;
  }

  private getManyExpressions(sep: TokenType, stop: TokenType): Node[][] {
    let res: Node[][] = [];
    while (true) {
      this.failIfEOF(stop);
      res.push(this.getExpression(sep, stop));
      if (this.currToken.type === stop) break;
      this.advance();
      this.failIfEOF(stop);
    }
    return res;
  }

  private getExpression(stop1: TokenType, stop2: TokenType = TokenType.NONE): Node[] {

    return [];
  }

  private getExprNode(): Node {
    
    return new Node(null);
  }

  public parse(): [Node, number] {
    let block: Node = new Node(null);
    let instructions: Node[] = this.getManyStatements(block, this.terminal);
    block.addChildren(instructions);
    return [block, this.pos];
  }

  public constructor(tokens: Token[], terminal: TokenType, /** utils */) {
    this.tokens = tokens;
    this.terminal = terminal;
    this.tokensCount = this.tokens.length;
    this.currToken = this.tokensCount ? this.tokens[0] : Token.getDefault();
  }
}

new Parser(new Lexer().tokenize(`if (true) {}`), TokenType.NONE).parse();