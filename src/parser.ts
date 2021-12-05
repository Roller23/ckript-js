import {ErrorHandler} from './error-handler';
import {Token, TokenType} from './token'
import {ClassStatement, Declaration, DeclType, Expression, ExprType, FuncExpression, FuncParam, Node, NodeType, Statement, StmtType} from './ast'
import { Utils } from './utils';

export class Parser {
  private tokens: Token[] = [];
  private prev: Token = Token.getDefault();
  private currToken: Token;
  private pos: number = 0;
  private tokensCount: number;
  private terminal: TokenType;

  private throwError(cause: string, token: Token): void {
    ErrorHandler.throwError(`Syntax error: ${cause} (${token.line}:${token.source})`);
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

  private findBlockEnd(): number {
    return this.findEnclosingBrace(this.pos);
  }

  private getManyStatements(node: Node): Node[] {
    let res: Node[] = [];
    while (true) {
      let statement: Node = this.getStatement(node, this.terminal);
      if (statement.type === NodeType.UNKNOWN) break;
      res.push(statement);
    }
    return res;
  }

  private parseClassStmt(): Node {
    let classExpr: Node = new Node(new Statement(new ClassStatement()));
    let stmt = classExpr.toStmt();
    stmt.line = this.currToken.line;
    stmt.source = this.currToken.source;
    this.advance(); // skip the class
    if (this.currToken.type !== TokenType.IDENTIFIER) {
      this.throwError(`invalid class declaration, expected an identifier, but ${this.currToken.getName()} found`, this.currToken);
    }
    stmt.classStmt!.className = this.currToken.value;
    this.advance(); // skip the identifier
    if (this.currToken.type !== TokenType.LEFT_PAREN) {
      this.throwError(`invalid class declaration, expected '(', but ${this.currToken.getName()} found`, this.currToken);
    }
    this.advance(); // skip the (
    stmt.classStmt!.members = this.parseFuncParams(true);
    this.advance(); // skip the )
    if (this.currToken.type !== TokenType.SEMI_COLON) {
      this.throwError(`invalid class declaration, expected ';', but ${this.currToken.getName()} found`, this.currToken);
    }
    this.advance(); // skip the ;
    return classExpr;
  }

  private getStatement(prev: Node, stop: TokenType): Node {
    if (this.currToken.type === stop) {
      return prev;
    } else if (this.currToken.type === TokenType.CLASS) {
      return this.parseClassStmt();
    } else if (this.currToken.type === TokenType.SET) {
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
      let returnStmt: Node = new Node(new Statement(StmtType.RETURN));
      let stmt = returnStmt.toStmt();
      stmt.line = this.currToken.line;
      stmt.source = this.currToken.source;
      this.advance(); // skip the return
      stmt.expressions.push(this.getExpression(TokenType.SEMI_COLON));
      this.advance(); // skip the semicolon
      return returnStmt;
    } else if (this.currToken.type === TokenType.BREAK) {
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
      let decl = varDecl.obj as Declaration;
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
      this.advance(); // skip the alloc
      if (this.currToken.type !== TokenType.TYPE) {
        this.throwError(`invalid variable allocation. Expected a type, but ${this.currToken.getName()} found`, this.currToken);
      }
      return this.getStatement(prev, stop);
    } else if (this.currToken.type === TokenType.REF) {
      this.advance(); // skip the alloc
      if (this.currToken.type !== TokenType.TYPE) {
        this.throwError(`invalid variable reference. Expected a type, but ${this.currToken.getName()} found`, this.currToken);
      }
      return this.getStatement(prev, stop);
    } else if (this.currToken.type === TokenType.CONST) {
      this.advance(); // skip the const
      if (this.currToken.type !== TokenType.TYPE && this.currToken.type !== TokenType.ALLOC && this.currToken.type !== TokenType.REF) {
        this.throwError(`invalid constant variable declaration. Expected a type, alloc or ref, but ${this.currToken.getName()} found`, this.currToken);
      }
      return this.getStatement(prev, stop);
    } else if (this.currToken.type === TokenType.SEMI_COLON && prev.type === NodeType.UNKNOWN) {
      let nopStmt: Node = new Node(new Statement(StmtType.NOP));
      let stmt = nopStmt.toStmt();
      stmt.line = this.currToken.line;
      stmt.source = this.currToken.source;
      this.advance(); // skip the ;
      return nopStmt;
    } else if (this.currToken.type === this.terminal) {
      return prev;
    } else {
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

  private peek(stack: Node[]): Node {
    return stack.length === 0 ? new Node(null) : stack[stack.length - 1];
  }

  private getExpression(stop1: TokenType, stop2: TokenType = TokenType.NONE): Node[] {
    let queue: Node[] = [];
    let stack: Node[] = [];
    while (this.currToken.type !== stop1 && this.currToken.type !== stop2) {
      let tok: Node = this.getExprNode();
      if (tok.toExpr().isEvaluable()) {
        queue.push(tok);
      } else if (tok.toExpr().isOperand()) {
        let top: Node = this.peek(stack);
        while (
          top.type !== NodeType.UNKNOWN && top.toExpr().isOperand()
          &&
            (Utils.getPrecedence(top.toExpr()) > Utils.getPrecedence(tok.toExpr())
            ||
              (Utils.getPrecedence(top.toExpr()) === Utils.getPrecedence(tok.toExpr())
                && !Utils.isRightAssoc(tok)
              )
            )
          &&
            (top.toExpr().type !== ExprType.LPAREN)
        ) {
          queue.push(<Node>stack.pop());
          top = this.peek(stack);
        }
        stack.push(tok);
      } else if (tok.toExpr().type === ExprType.LPAREN) {
        stack.push(tok);
      }
    }
    while (this.peek(stack).type !== NodeType.UNKNOWN) {
      queue.push(<Node>stack.pop());
    }
    return queue;
  }

  private parseFuncParams(isClass: boolean = false): FuncParam[] {
    let res: FuncParam[] = [];
    const stop: TokenType = TokenType.RIGHT_PAREN;
    let paramNames: Set<string> = new Set();
    while (true) {
      this.failIfEOF(TokenType.TYPE);
      let isRef: boolean = false;
      if (this.currToken.type === TokenType.REF) {
        isRef = true;
        this.advance(); // skip the ref
        this.failIfEOF(TokenType.TYPE);
      }
      if (this.currToken.type !== TokenType.TYPE) {
        const msg = `invalid ${isClass ? 'class' : 'function'} declaration, expected a type, but ${this.currToken.getName()} found`;
        this.throwError(msg, this.currToken);
      }
      const type: string = this.currToken.value;
      this.advance(); // skip the type
      if (type === 'void') {
        if (isClass) {
          this.throwError('invalid class declaration, cannot have void members', this.currToken);
        }
        if (res.length !== 0) {
          this.throwError('invalid function expression, illegal void placement', this.currToken);
        }
        if (this.currToken.type !== TokenType.RIGHT_PAREN) {
          this.throwError(`invalid function expression, expected ')', but ${this.currToken.getName()} found`, this.currToken);
        }
        return res;
      }
      this.failIfEOF(TokenType.IDENTIFIER);
      if (this.currToken.type !== TokenType.IDENTIFIER) {
        this.throwError(`invalid function declaration, expected an identifier, but ${this.currToken.getName()} found`, this.currToken);
      }
      if (paramNames.has(this.currToken.value)) {
        this.throwError(`invalid ${isClass ? 'class' : 'function'} declaration, duplicate parameter name '${this.currToken.value}'`, this.currToken);
      }
      paramNames.add(this.currToken.value);
      let param: FuncParam = new FuncParam(type, this.currToken.value);
      param.isRef = isRef;
      res.push(param);
      this.advance();
      this.failIfEOF(stop);
      if (this.currToken.type === stop) break;
      this.advance(); // skip the sep
    }
    return res;
  }

  private parseFuncExpression(): Node {
    let func: Node = new Node(new Expression(ExprType.FUNC_EXPR));
    let expr = func.toExpr();
    expr.funcExpr = new FuncExpression();
    this.advance(); // skip the function
    if (this.currToken.type === TokenType.OP_GT) {
      expr.funcExpr.capturess = true;
      this.advance(); // skip the >
    }
    if (this.currToken.type !== TokenType.LEFT_PAREN) {
      this.throwError(`invalid function declaration, expected '(', but ${this.currToken.getName()} found`, this.currToken);
    }
    this.advance(); // skip the (
    expr.funcExpr.params = this.parseFuncParams();
    this.advance();
    const returnsRef: boolean = this.currToken.type === TokenType.REF;
    if (returnsRef) {
      this.advance(); // skip the ref
    }
    if (this.currToken.type !== TokenType.TYPE) {
      this.throwError(`invalid function declaration, expected a type, but ${this.currToken.getName()} found`, this.currToken)
    }
    if (returnsRef && this.currToken.value === 'void') {
      this.throwError(`invalid function declaration, cannot return a reference to void`, this.currToken)
    }
    expr.funcExpr.retType = this.currToken.value;
    expr.funcExpr.retRef = returnsRef;
    this.advance(); // skip the type
    if (this.currToken.type !== TokenType.LEFT_BRACE) {
      this.throwError(`invalid function declaration, expected '{', but ${this.currToken.getName()} found`, this.currToken)
    }
    const funcEnd: number = this.findBlockEnd();
    let funcStart: Token[] = this.tokens.slice(this.pos, this.pos + funcEnd + 1);
    let funcParser: Parser = new Parser(funcStart, TokenType.NONE);
    let [newAST, endPos] = funcParser.parse();
    this.pos += endPos;
    expr.funcExpr.instructions.push(newAST);
    this.advance();
    return func;
  }

  private parseArrayExpression(): Node {
    this.advance(); // skip the array
    let array: Node = new Node(new Expression(ExprType.ARRAY));
    if (this.currToken.type !== TokenType.LEFT_PAREN) {
      this.throwError(`invalid array expression, expected '(', but ${this.currToken.getName()} found`, this.currToken);
    }
    this.advance(); // skip the (
    let expr = array.toExpr();
    expr.argsList = this.getManyExpressions(TokenType.COMMA, TokenType.RIGHT_PAREN);
    this.advance(); // skip the )
    const hasSize: boolean = this.currToken.type === TokenType.LEFT_BRACKET;
    if (hasSize) {
      this.advance(); // skip the [
      expr.arraySize = this.getExpression(TokenType.RIGHT_BRACKET);
      this.advance(); // skip the ]
    }
    if (this.currToken.type === TokenType.REF) {
      expr.arrayHoldsRefs = true;
      this.advance(); // skip the ref
    }
    if (this.currToken.type !== TokenType.TYPE) {
      this.throwError(`invalid array expression, expected a type, but ${this.currToken.getName()} found`, this.currToken);
    }
    if (this.currToken.value === 'void') {
      this.throwError('invalid array expression, cannot hold void values', this.currToken);
    }
    if (hasSize && ['obj', 'arr', 'func'].includes(this.currToken.value)) {
      this.throwError(`invalid array expression, cannot define initial size for an array of ${this.currToken.value}`, this.currToken);
    }
    expr.arrayType = this.currToken.value;
    this.advance(); // skip the type
    return array;
  }

  private getExprNode(): Node {
    this.failIfEOF(TokenType.GENERAL_EXPRESSION);
    if (this.currToken.type === TokenType.FUNCTION) {
      return this.parseFuncExpression();
    } else if (this.currToken.type === TokenType.ARRAY) {
      return this.parseArrayExpression();
    } else if (this.currToken.type === TokenType.IDENTIFIER) {
      let id: Node = new Node(new Expression(ExprType.IDENTIFIER_EXPR, this.currToken.value));
      this.advance();
      return id;
    } else if (this.currToken.type === TokenType.LEFT_PAREN) {
      if (this.prev.type === TokenType.RIGHT_PAREN || this.prev.type === TokenType.IDENTIFIER ||
        this.prev.type === TokenType.RIGHT_BRACKET || this.prev.type === TokenType.STRING_LITERAL) {
          let fc: Node[] = [];
          let call: Node = new Node(new Expression(ExprType.FUNC_CALL, fc));
          this.advance(); // skip the (
          let expr = call.toExpr();
          expr.argsList = this.getManyExpressions(TokenType.COMMA, TokenType.RIGHT_PAREN);
          this.advance(); // skip the )
          return call;
        } else {
          this.advance(); // skip the (
          const rpn: Node[] = this.getExpression(TokenType.RIGHT_PAREN);
          this.advance(); // skip the )
          return new Node(new Expression(ExprType.RPN, rpn));
        }
    } else if (this.currToken.type === TokenType.LEFT_BRACKET) {
      this.advance(); // skip the [
      let rpn: Node[] = this.getExpression(TokenType.RIGHT_BRACKET);
      this.advance(); // skip the ]
      let index: Node = new Node(new Expression(ExprType.INDEX, rpn));
      return index;
    } else if (this.currToken.type === TokenType.STRING_LITERAL) {
      let strLiteral: Node = new Node(new Expression(ExprType.STR_EXPR, this.currToken.value));
      this.advance();
      return strLiteral;
    } else if (Utils.opUnary(this.currToken.type)) {
      const tokenType: TokenType = this.currToken.type;
      this.advance(); // skip the op
      this.failIfEOF(TokenType.GENERAL_EXPRESSION);
      return new Node(new Expression(ExprType.UNARY_OP, tokenType));
    } else if (Utils.opBinary(this.currToken.type)) {
      const tokenType: TokenType = this.currToken.type;
      this.advance(); // skip the op
      this.failIfEOF(TokenType.GENERAL_EXPRESSION);
      return new Node(new Expression(ExprType.BINARY_OP, tokenType));
    } else if (this.currToken.type === TokenType.NUMBER) {
      const isNegative: boolean = this.currToken.value[0] === '-';
      let arg: number = Number(this.currToken.value.substr(isNegative ? 1 : 0));
      if (isNegative) {
        arg = -arg;
      }
      const numLiteral: Node = new Node(new Expression(ExprType.NUM_EXPR, arg));
      this.advance(); // skip the number
      return numLiteral;
    } else if (this.currToken.type === TokenType.TRUE || this.currToken.type === TokenType.FALSE) {
      const boolean: Node = new Node(new Expression(ExprType.BOOL_EXPR, this.currToken.type === TokenType.TRUE));
      this.advance(); // skip the boolean
      return boolean;
    }
    console.log(this.currToken);
    this.throwError(`expected an expression, but ${this.currToken.getName()} found`, this.currToken);
    return new Node(null);
  }

  public parse(): [Node, number] {
    let block: Node = new Node(null);
    let instructions: Node[] = this.getManyStatements(block);
    block.addChildren(instructions);
    return [block, this.pos];
  }

  public constructor(tokens: Token[], terminal: TokenType) {
    this.tokens = tokens;
    this.terminal = terminal;
    this.tokensCount = this.tokens.length;
    this.currToken = this.tokensCount ? this.tokens[0] : Token.getDefault();
  }
}