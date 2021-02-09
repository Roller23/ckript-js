"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = void 0;
const error_handler_1 = require("./error-handler");
const token_1 = require("./token");
const ast_1 = require("./ast");
const lexer_1 = require("./lexer");
class Parser {
    constructor(tokens, terminal) {
        // utils
        this.tokens = [];
        this.prev = token_1.Token.getDefault();
        this.pos = 0;
        this.tokens = tokens;
        this.terminal = terminal;
        this.tokensCount = this.tokens.length;
        this.currToken = this.tokensCount ? this.tokens[0] : token_1.Token.getDefault();
    }
    throwError(cause, token) {
        error_handler_1.ErrorHandler.throwError(`Syntax error: ${cause} on line ${token.line} in file ${token.source}`);
    }
    failIfEOF(expected) {
        if (this.currToken.type === token_1.TokenType.NONE) {
            this.throwError(`Reached end of file but ${token_1.Token.getName(expected)} expected`, this.currToken);
        }
    }
    advance() {
        this.pos++;
        this.prev = this.tokens[this.pos - 1];
        if (this.pos < this.tokensCount) {
            this.currToken = this.tokens[this.pos];
        }
        else {
            this.currToken = token_1.Token.getDefault();
            this.pos--;
        }
    }
    retreat() {
        if (this.pos === 0)
            return;
        this.pos--;
        this.currToken = this.tokens[this.pos];
        this.prev = this.pos > 0 ? this.tokens[this.pos - 1] : token_1.Token.getDefault();
    }
    lookahead(offset) {
        if (this.pos + offset < 0)
            return token_1.Token.getDefault();
        if (this.pos + offset >= this.tokens.length)
            return token_1.Token.getDefault();
        return this.tokens[this.pos + offset];
    }
    findEnclosingBrace(startPos, braces = 0) {
        let i = 0;
        const size = this.tokens.length;
        while (true) {
            if (size === i + startPos) {
                this.throwError('Invalid function declaration, no enclosing brace found', this.tokens[startPos + i - 1]);
            }
            if (this.tokens[startPos + i].type === token_1.TokenType.LEFT_BRACE) {
                braces++;
            }
            if (this.tokens[startPos + i].type === token_1.TokenType.RIGHT_BRACE) {
                braces--;
                if (braces === 0) {
                    return i;
                }
            }
            i++;
        }
    }
    findEnclosingParen() {
        let startPos = this.pos;
        let i = 0;
        const size = this.tokens.length;
        let lparen = 1;
        while (true) {
            if (size === i) {
                this.throwError('Invalid expression, no enclosing parenthesis found', this.tokens[startPos + i - 1]);
            }
            if (this.tokens[startPos + i].type === token_1.TokenType.LEFT_PAREN) {
                lparen++;
            }
            if (this.tokens[startPos + i].type === token_1.TokenType.LEFT_PAREN) {
                lparen--;
                if (lparen === 0) {
                    return i;
                }
            }
            i++;
        }
    }
    findEnclosingEnd() {
        return this.findEnclosingBrace(this.pos);
    }
    getManyStatements(node, stop) {
        let res = [];
        while (true) {
            let statement = this.getStatement(node, this.terminal);
            if (statement.type === ast_1.NodeType.UNKNOWN)
                break;
            res.push(statement);
        }
        return res;
    }
    getStatement(prev, stop) {
        if (this.currToken.type === stop) {
            return prev;
        }
        else if (this.currToken.type === token_1.TokenType.CLASS) {
            console.log('parsing class');
            // TODO
        }
        else if (this.currToken.type === token_1.TokenType.SET) {
            console.log('parsing set');
            let set = new ast_1.Node(new ast_1.Statement(ast_1.StmtType.SET));
            let stmt = set.toStmt();
            stmt.line = this.currToken.line;
            stmt.source = this.currToken.source;
            this.advance(); // skip the $
            if (this.currToken.type != token_1.TokenType.IDENTIFIER) {
                this.throwError(`invalid set statement. Expected an identifier, but ${this.currToken.getName()} found`, this.currToken);
            }
            stmt.objMembers.push(this.currToken.value);
            this.advance(); // skip the id
            while (true) {
                if (this.currToken.type !== token_1.TokenType.DOT) {
                    this.throwError(`invalid set statement. Expected '.', but ${this.currToken.getName()} found`, this.currToken);
                }
                this.advance(); // skip the dot
                if (this.currToken.type !== token_1.TokenType.IDENTIFIER) {
                    this.throwError(`invalid set statement. Expected an identifier, but ${this.currToken.getName()} found`, this.currToken);
                }
                stmt.objMembers.push(this.currToken.value);
                this.advance(); // skip the id
                if (this.currToken.type === token_1.TokenType.OP_ASSIGN)
                    break;
            }
            this.advance(); // skip the =
            stmt.expressions.push(this.getExpression(token_1.TokenType.SEMI_COLON));
            this.advance(); // skip the ;
            return set;
        }
        else if (this.currToken.type === token_1.TokenType.SET_IDX) {
            console.log('parsing set idx');
            let setIdx = new ast_1.Node(new ast_1.Statement(ast_1.StmtType.SET_IDX));
            let stmt = setIdx.toStmt();
            stmt.line = this.currToken.line;
            stmt.source = this.currToken.source;
            this.advance(); // skip the #
            if (this.currToken.type !== token_1.TokenType.IDENTIFIER) {
                this.throwError(`invalid set index statement. Expected an identifier, but ${this.currToken.getName()} found`, this.currToken);
            }
            stmt.objMembers.push(this.currToken.value);
            this.advance(); // skip the id
            while (true) {
                let idxExpr = this.getExprNode();
                if (idxExpr.toExpr().type !== ast_1.ExprType.INDEX) {
                    this.throwError(`invalid set index statement, expected an index expression`, this.currToken);
                }
                stmt.indexes.push(idxExpr);
                if (this.currToken.type === token_1.TokenType.OP_ASSIGN)
                    break;
            }
            this.advance(); // skip the =
            stmt.expressions.push(this.getExpression(token_1.TokenType.SEMI_COLON));
            this.advance(); // skip the ;
            return setIdx;
        }
        else if (this.currToken.type === token_1.TokenType.LEFT_BRACE) {
            console.log('parsing compound');
            let comp = new ast_1.Node(new ast_1.Statement(ast_1.StmtType.COMPOUND));
            let stmt = comp.toStmt();
            stmt.source = this.currToken.source;
            stmt.line = this.currToken.line;
            this.advance(); // skip the {
            const blockEnd = this.findEnclosingBrace(this.pos, 1);
            let blockStart = this.tokens.slice(this.pos, this.pos + blockEnd + 1);
            let blockParser = new Parser(blockStart, token_1.TokenType.RIGHT_BRACE);
            let [newAST, endPos] = blockParser.parse();
            this.pos += endPos;
            stmt.statements.push(newAST);
            this.advance(); // skip the }
            return comp;
        }
        else if (this.currToken.type === token_1.TokenType.IF) {
            console.log('parsing if');
            const line = this.currToken.line;
            const source = this.currToken.source;
            this.advance(); // skip the if
            if (this.currToken.type !== token_1.TokenType.LEFT_PAREN) {
                this.throwError(`invalid if statement. Expected '(' but ${this.currToken.getName()} found`, this.currToken);
            }
            let ifStmt = new ast_1.Node(new ast_1.Statement(ast_1.StmtType.IF));
            let stmt = ifStmt.toStmt();
            stmt.line = line;
            stmt.source = source;
            this.advance(); // skip the (
            stmt.expressions.push(this.getExpression(token_1.TokenType.RIGHT_PAREN));
            this.advance(); // skip the )
            stmt.statements.push(this.getStatement(prev, stop));
            if (this.currToken.type === token_1.TokenType.ELSE) {
                this.advance(); // skip else
                stmt.statements.push(this.getStatement(prev, stop));
            }
            return ifStmt;
        }
        else if (this.currToken.type === token_1.TokenType.WHILE) {
            console.log('parsing while');
            const line = this.currToken.line;
            const source = this.currToken.source;
            this.advance(); // skip the while
            if (this.currToken.type !== token_1.TokenType.LEFT_PAREN) {
                this.throwError(`invalid while statement. Expected '(' but ${this.currToken.getName()} found`, this.currToken);
            }
            let whileStmt = new ast_1.Node(new ast_1.Statement(ast_1.StmtType.WHILE));
            let stmt = whileStmt.toStmt();
            stmt.line = line;
            stmt.source = source;
            this.advance(); // skip the (
            stmt.expressions.push(this.getExpression(token_1.TokenType.RIGHT_PAREN));
            this.advance(); // skip the )
            stmt.statements.push(this.getStatement(prev, stop));
            return whileStmt;
        }
        else if (this.currToken.type === token_1.TokenType.FOR) {
            console.log('parsing for');
            const line = this.currToken.line;
            const source = this.currToken.source;
            this.advance(); // skip the for
            if (this.currToken.type !== token_1.TokenType.LEFT_PAREN) {
                this.throwError(`invalid for statement. Expected '(' but ${this.currToken.getName()} found`, this.currToken);
            }
            let forStmt = new ast_1.Node(new ast_1.Statement(ast_1.StmtType.FOR));
            let stmt = forStmt.toStmt();
            stmt.line = line;
            stmt.source = source;
            this.advance(); // skip the (
            stmt.expressions = this.getManyExpressions(token_1.TokenType.SEMI_COLON, token_1.TokenType.RIGHT_PAREN);
            this.advance(); // skip the )
            stmt.statements.push(this.getStatement(prev, stop));
            return forStmt;
        }
        else if (this.currToken.type === token_1.TokenType.RETURN) {
            console.log('parsing return');
            let returnStmt = new ast_1.Node(new ast_1.Statement(ast_1.StmtType.RETURN));
            let stmt = returnStmt.toStmt();
            stmt.line = this.currToken.line;
            stmt.source = this.currToken.source;
            this.advance(); // skip the return
            stmt.expressions.push(this.getExpression(token_1.TokenType.SEMI_COLON));
            this.advance(); // skip the semicolon
            return returnStmt;
        }
        else if (this.currToken.type === token_1.TokenType.BREAK) {
            console.log('parsing break');
            const line = this.currToken.line;
            const source = this.currToken.source;
            this.advance(); // skip the break
            if (this.currToken.type !== token_1.TokenType.SEMI_COLON) {
                this.throwError(`invalid break statement. Expected ';' but ${this.currToken.getName()} found`, this.currToken);
            }
            this.advance(); // skip the ;
            let continueStmt = new ast_1.Node(new ast_1.Statement(ast_1.StmtType.BREAK));
            let stmt = continueStmt.toStmt();
            stmt.line = line;
            stmt.source = source;
            return continueStmt;
        }
        else if (this.currToken.type === token_1.TokenType.CONTINUE) {
            console.log('parsing continue');
            const line = this.currToken.line;
            const source = this.currToken.source;
            this.advance(); // skip the continue
            if (this.currToken.type !== token_1.TokenType.SEMI_COLON) {
                this.throwError(`invalid continue statement. Expected ';' but ${this.currToken.getName()} found`, this.currToken);
            }
            this.advance(); // skip the ;
            let continueStmt = new ast_1.Node(new ast_1.Statement(ast_1.StmtType.CONTINUE));
            let stmt = continueStmt.toStmt();
            stmt.line = line;
            stmt.source = source;
            return continueStmt;
        }
        else if (this.currToken.type === token_1.TokenType.TYPE) {
            console.log('parsing type');
            if (this.currToken.value === 'void') {
                this.throwError(`invalid variable declaration. Cannot declare a void variable`, this.currToken);
            }
            const line = this.currToken.line;
            const source = this.currToken.source;
            const allocated = this.prev.type === token_1.TokenType.ALLOC;
            let constant = this.prev.type === token_1.TokenType.CONST;
            const reference = this.prev.type === token_1.TokenType.REF;
            if (allocated && this.lookahead(-2).type === token_1.TokenType.CONST) {
                constant = true;
            }
            let varDecl = new ast_1.Node(new ast_1.Declaration(ast_1.DeclType.VAR_DECL));
            let decl = varDecl.toDecl();
            decl.varType = this.currToken.value;
            this.advance(); // skip the variable type
            if (this.currToken.type !== token_1.TokenType.IDENTIFIER) {
                this.throwError(`invalid variable declaration. Expected an identifier, but ${this.currToken.getName()} found`, this.currToken);
            }
            decl.id = this.currToken.value;
            this.advance(); // skip the identifier
            if (this.currToken.type !== token_1.TokenType.OP_ASSIGN) {
                this.throwError(`invalid variable declaration. Expected '=', but ${this.currToken.getName()} found`, this.currToken);
            }
            this.advance(); // skip the =
            decl.varExpression = this.getExpression(token_1.TokenType.SEMI_COLON);
            decl.isAllocated = allocated;
            decl.isConstant = constant;
            decl.isReference = reference;
            let declStmt = new ast_1.Node(new ast_1.Statement(ast_1.StmtType.DECL));
            let stmt = declStmt.toStmt();
            stmt.statements.push(varDecl);
            stmt.line = line;
            stmt.source = source;
            this.advance(); // skip the semicolon
            return declStmt;
        }
        else if (this.currToken.type === token_1.TokenType.ALLOC) {
            console.log('parsing alloc');
            this.advance(); // skip the alloc
            if (this.currToken.type !== token_1.TokenType.TYPE) {
                this.throwError(`invalid variable allocation. Expected a type, but ${this.currToken.getName()} found`, this.currToken);
            }
            return this.getStatement(prev, stop);
        }
        else if (this.currToken.type === token_1.TokenType.REF) {
            console.log('parsing ref');
            this.advance(); // skip the alloc
            if (this.currToken.type !== token_1.TokenType.TYPE) {
                this.throwError(`invalid variable reference. Expected a type, but ${this.currToken.getName()} found`, this.currToken);
            }
            return this.getStatement(prev, stop);
        }
        else if (this.currToken.type === token_1.TokenType.CONST) {
            console.log('parsing const');
            this.advance(); // skip the const
            if (this.currToken.type !== token_1.TokenType.TYPE && this.currToken.type !== token_1.TokenType.ALLOC && this.currToken.type !== token_1.TokenType.REF) {
                this.throwError(`invalid constant variable declaration. Expected a type, alloc or ref, but ${this.currToken.getName()} found`, this.currToken);
            }
            return this.getStatement(prev, stop);
        }
        else if (this.currToken.type === token_1.TokenType.SEMI_COLON && prev.type === ast_1.NodeType.UNKNOWN) {
            console.log('parsing nop');
            let nopStmt = new ast_1.Node(new ast_1.Statement(ast_1.StmtType.NOP));
            let stmt = nopStmt.toStmt();
            stmt.line = this.currToken.line;
            stmt.source = this.currToken.source;
            this.advance(); // skip the ;
            return nopStmt;
        }
        else if (this.currToken.type === this.terminal) {
            console.log('reached terminal');
            return prev;
        }
        else {
            console.log('parsing expression statement');
            const line = this.currToken.line;
            const source = this.currToken.source;
            let expr = this.getExpression(token_1.TokenType.SEMI_COLON);
            let exprStmt = new ast_1.Node(new ast_1.Statement(ast_1.StmtType.EXPR));
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
    getManyExpressions(sep, stop) {
        let res = [];
        while (true) {
            this.failIfEOF(stop);
            res.push(this.getExpression(sep, stop));
            if (this.currToken.type === stop)
                break;
            this.advance();
            this.failIfEOF(stop);
        }
        return res;
    }
    getExpression(stop1, stop2 = token_1.TokenType.NONE) {
        return [];
    }
    getExprNode() {
        return new ast_1.Node(null);
    }
    parse() {
        let block = new ast_1.Node(null);
        let instructions = this.getManyStatements(block, this.terminal);
        block.addChildren(instructions);
        return [block, this.pos];
    }
}
exports.Parser = Parser;
Parser.baseLUT = {
    [token_1.TokenType.BINARY]: 2,
    [token_1.TokenType.DECIMAL]: 10,
    [token_1.TokenType.HEX]: 16
};
new Parser(new lexer_1.Lexer().tokenize(`if (true) {}`), token_1.TokenType.NONE).parse();