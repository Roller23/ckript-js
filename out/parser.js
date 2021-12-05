"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = void 0;
const error_handler_1 = require("./error-handler");
const token_1 = require("./token");
const ast_1 = require("./ast");
const utils_1 = require("./utils");
class Parser {
    constructor(tokens, terminal) {
        this.tokens = [];
        this.prev = token_1.Token.getDefault();
        this.pos = 0;
        this.tokens = tokens;
        this.terminal = terminal;
        this.tokensCount = this.tokens.length;
        this.currToken = this.tokensCount ? this.tokens[0] : token_1.Token.getDefault();
    }
    throwError(cause, token) {
        error_handler_1.ErrorHandler.throwError(`Syntax error: ${cause} (${token.line}:${token.source})`);
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
    findBlockEnd() {
        return this.findEnclosingBrace(this.pos);
    }
    getManyStatements(node) {
        let res = [];
        while (true) {
            let statement = this.getStatement(node, this.terminal);
            if (statement.type === ast_1.NodeType.UNKNOWN)
                break;
            res.push(statement);
        }
        return res;
    }
    parseClassStmt() {
        let classExpr = new ast_1.Node(new ast_1.Statement(new ast_1.ClassStatement()));
        let stmt = classExpr.toStmt();
        stmt.line = this.currToken.line;
        stmt.source = this.currToken.source;
        this.advance(); // skip the class
        if (this.currToken.type !== token_1.TokenType.IDENTIFIER) {
            this.throwError(`invalid class declaration, expected an identifier, but ${this.currToken.getName()} found`, this.currToken);
        }
        stmt.classStmt.className = this.currToken.value;
        this.advance(); // skip the identifier
        if (this.currToken.type !== token_1.TokenType.LEFT_PAREN) {
            this.throwError(`invalid class declaration, expected '(', but ${this.currToken.getName()} found`, this.currToken);
        }
        this.advance(); // skip the (
        stmt.classStmt.members = this.parseFuncParams(true);
        this.advance(); // skip the )
        if (this.currToken.type !== token_1.TokenType.SEMI_COLON) {
            this.throwError(`invalid class declaration, expected ';', but ${this.currToken.getName()} found`, this.currToken);
        }
        this.advance(); // skip the ;
        return classExpr;
    }
    getStatement(prev, stop) {
        if (this.currToken.type === stop) {
            return prev;
        }
        else if (this.currToken.type === token_1.TokenType.CLASS) {
            return this.parseClassStmt();
        }
        else if (this.currToken.type === token_1.TokenType.SET) {
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
            let decl = varDecl.obj;
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
            this.advance(); // skip the alloc
            if (this.currToken.type !== token_1.TokenType.TYPE) {
                this.throwError(`invalid variable allocation. Expected a type, but ${this.currToken.getName()} found`, this.currToken);
            }
            return this.getStatement(prev, stop);
        }
        else if (this.currToken.type === token_1.TokenType.REF) {
            this.advance(); // skip the alloc
            if (this.currToken.type !== token_1.TokenType.TYPE) {
                this.throwError(`invalid variable reference. Expected a type, but ${this.currToken.getName()} found`, this.currToken);
            }
            return this.getStatement(prev, stop);
        }
        else if (this.currToken.type === token_1.TokenType.CONST) {
            this.advance(); // skip the const
            if (this.currToken.type !== token_1.TokenType.TYPE && this.currToken.type !== token_1.TokenType.ALLOC && this.currToken.type !== token_1.TokenType.REF) {
                this.throwError(`invalid constant variable declaration. Expected a type, alloc or ref, but ${this.currToken.getName()} found`, this.currToken);
            }
            return this.getStatement(prev, stop);
        }
        else if (this.currToken.type === token_1.TokenType.SEMI_COLON && prev.type === ast_1.NodeType.UNKNOWN) {
            let nopStmt = new ast_1.Node(new ast_1.Statement(ast_1.StmtType.NOP));
            let stmt = nopStmt.toStmt();
            stmt.line = this.currToken.line;
            stmt.source = this.currToken.source;
            this.advance(); // skip the ;
            return nopStmt;
        }
        else if (this.currToken.type === this.terminal) {
            return prev;
        }
        else {
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
    peek(stack) {
        return stack.length === 0 ? new ast_1.Node(null) : stack[stack.length - 1];
    }
    getExpression(stop1, stop2 = token_1.TokenType.NONE) {
        let queue = [];
        let stack = [];
        while (this.currToken.type !== stop1 && this.currToken.type !== stop2) {
            let tok = this.getExprNode();
            if (tok.toExpr().isEvaluable()) {
                queue.push(tok);
            }
            else if (tok.toExpr().isOperand()) {
                let top = this.peek(stack);
                while (top.type !== ast_1.NodeType.UNKNOWN && top.toExpr().isOperand()
                    &&
                        (utils_1.Utils.getPrecedence(top.toExpr()) > utils_1.Utils.getPrecedence(tok.toExpr())
                            ||
                                (utils_1.Utils.getPrecedence(top.toExpr()) === utils_1.Utils.getPrecedence(tok.toExpr())
                                    && !utils_1.Utils.isRightAssoc(tok)))
                    &&
                        (top.toExpr().type !== ast_1.ExprType.LPAREN)) {
                    queue.push(stack.pop());
                    top = this.peek(stack);
                }
                stack.push(tok);
            }
            else if (tok.toExpr().type === ast_1.ExprType.LPAREN) {
                stack.push(tok);
            }
        }
        while (this.peek(stack).type !== ast_1.NodeType.UNKNOWN) {
            queue.push(stack.pop());
        }
        return queue;
    }
    parseFuncParams(isClass = false) {
        let res = [];
        const stop = token_1.TokenType.RIGHT_PAREN;
        let paramNames = new Set();
        while (true) {
            this.failIfEOF(token_1.TokenType.TYPE);
            let isRef = false;
            if (this.currToken.type === token_1.TokenType.REF) {
                isRef = true;
                this.advance(); // skip the ref
                this.failIfEOF(token_1.TokenType.TYPE);
            }
            if (this.currToken.type !== token_1.TokenType.TYPE) {
                const msg = `invalid ${isClass ? 'class' : 'function'} declaration, expected a type, but ${this.currToken.getName()} found`;
                this.throwError(msg, this.currToken);
            }
            const type = this.currToken.value;
            this.advance(); // skip the type
            if (type === 'void') {
                if (isClass) {
                    this.throwError('invalid class declaration, cannot have void members', this.currToken);
                }
                if (res.length !== 0) {
                    this.throwError('invalid function expression, illegal void placement', this.currToken);
                }
                if (this.currToken.type !== token_1.TokenType.RIGHT_PAREN) {
                    this.throwError(`invalid function expression, expected ')', but ${this.currToken.getName()} found`, this.currToken);
                }
                return res;
            }
            this.failIfEOF(token_1.TokenType.IDENTIFIER);
            if (this.currToken.type !== token_1.TokenType.IDENTIFIER) {
                this.throwError(`invalid function declaration, expected an identifier, but ${this.currToken.getName()} found`, this.currToken);
            }
            if (paramNames.has(this.currToken.value)) {
                this.throwError(`invalid ${isClass ? 'class' : 'function'} declaration, duplicate parameter name '${this.currToken.value}'`, this.currToken);
            }
            paramNames.add(this.currToken.value);
            let param = new ast_1.FuncParam(type, this.currToken.value);
            param.isRef = isRef;
            res.push(param);
            this.advance();
            this.failIfEOF(stop);
            if (this.currToken.type === stop)
                break;
            this.advance(); // skip the sep
        }
        return res;
    }
    parseFuncExpression() {
        let func = new ast_1.Node(new ast_1.Expression(ast_1.ExprType.FUNC_EXPR));
        let expr = func.toExpr();
        expr.funcExpr = new ast_1.FuncExpression();
        this.advance(); // skip the function
        if (this.currToken.type === token_1.TokenType.OP_GT) {
            expr.funcExpr.capturess = true;
            this.advance(); // skip the >
        }
        if (this.currToken.type !== token_1.TokenType.LEFT_PAREN) {
            this.throwError(`invalid function declaration, expected '(', but ${this.currToken.getName()} found`, this.currToken);
        }
        this.advance(); // skip the (
        expr.funcExpr.params = this.parseFuncParams();
        this.advance();
        const returnsRef = this.currToken.type === token_1.TokenType.REF;
        if (returnsRef) {
            this.advance(); // skip the ref
        }
        if (this.currToken.type !== token_1.TokenType.TYPE) {
            this.throwError(`invalid function declaration, expected a type, but ${this.currToken.getName()} found`, this.currToken);
        }
        if (returnsRef && this.currToken.value === 'void') {
            this.throwError(`invalid function declaration, cannot return a reference to void`, this.currToken);
        }
        expr.funcExpr.retType = this.currToken.value;
        expr.funcExpr.retRef = returnsRef;
        this.advance(); // skip the type
        if (this.currToken.type !== token_1.TokenType.LEFT_BRACE) {
            this.throwError(`invalid function declaration, expected '{', but ${this.currToken.getName()} found`, this.currToken);
        }
        const funcEnd = this.findBlockEnd();
        let funcStart = this.tokens.slice(this.pos, this.pos + funcEnd + 1);
        let funcParser = new Parser(funcStart, token_1.TokenType.NONE);
        let [newAST, endPos] = funcParser.parse();
        this.pos += endPos;
        expr.funcExpr.instructions.push(newAST);
        this.advance();
        return func;
    }
    parseArrayExpression() {
        this.advance(); // skip the array
        let array = new ast_1.Node(new ast_1.Expression(ast_1.ExprType.ARRAY));
        if (this.currToken.type !== token_1.TokenType.LEFT_PAREN) {
            this.throwError(`invalid array expression, expected '(', but ${this.currToken.getName()} found`, this.currToken);
        }
        this.advance(); // skip the (
        let expr = array.toExpr();
        expr.argsList = this.getManyExpressions(token_1.TokenType.COMMA, token_1.TokenType.RIGHT_PAREN);
        this.advance(); // skip the )
        const hasSize = this.currToken.type === token_1.TokenType.LEFT_BRACKET;
        if (hasSize) {
            this.advance(); // skip the [
            expr.arraySize = this.getExpression(token_1.TokenType.RIGHT_BRACKET);
            this.advance(); // skip the ]
        }
        if (this.currToken.type === token_1.TokenType.REF) {
            expr.arrayHoldsRefs = true;
            this.advance(); // skip the ref
        }
        if (this.currToken.type !== token_1.TokenType.TYPE) {
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
    getExprNode() {
        this.failIfEOF(token_1.TokenType.GENERAL_EXPRESSION);
        if (this.currToken.type === token_1.TokenType.FUNCTION) {
            return this.parseFuncExpression();
        }
        else if (this.currToken.type === token_1.TokenType.ARRAY) {
            return this.parseArrayExpression();
        }
        else if (this.currToken.type === token_1.TokenType.IDENTIFIER) {
            let id = new ast_1.Node(new ast_1.Expression(ast_1.ExprType.IDENTIFIER_EXPR, this.currToken.value));
            this.advance();
            return id;
        }
        else if (this.currToken.type === token_1.TokenType.LEFT_PAREN) {
            if (this.prev.type === token_1.TokenType.RIGHT_PAREN || this.prev.type === token_1.TokenType.IDENTIFIER ||
                this.prev.type === token_1.TokenType.RIGHT_BRACKET || this.prev.type === token_1.TokenType.STRING_LITERAL) {
                let fc = [];
                let call = new ast_1.Node(new ast_1.Expression(ast_1.ExprType.FUNC_CALL, fc));
                this.advance(); // skip the (
                let expr = call.toExpr();
                expr.argsList = this.getManyExpressions(token_1.TokenType.COMMA, token_1.TokenType.RIGHT_PAREN);
                this.advance(); // skip the )
                return call;
            }
            else {
                this.advance(); // skip the (
                const rpn = this.getExpression(token_1.TokenType.RIGHT_PAREN);
                this.advance(); // skip the )
                return new ast_1.Node(new ast_1.Expression(ast_1.ExprType.RPN, rpn));
            }
        }
        else if (this.currToken.type === token_1.TokenType.LEFT_BRACKET) {
            this.advance(); // skip the [
            let rpn = this.getExpression(token_1.TokenType.RIGHT_BRACKET);
            this.advance(); // skip the ]
            let index = new ast_1.Node(new ast_1.Expression(ast_1.ExprType.INDEX, rpn));
            return index;
        }
        else if (this.currToken.type === token_1.TokenType.STRING_LITERAL) {
            let strLiteral = new ast_1.Node(new ast_1.Expression(ast_1.ExprType.STR_EXPR, this.currToken.value));
            this.advance();
            return strLiteral;
        }
        else if (utils_1.Utils.opUnary(this.currToken.type)) {
            const tokenType = this.currToken.type;
            this.advance(); // skip the op
            this.failIfEOF(token_1.TokenType.GENERAL_EXPRESSION);
            return new ast_1.Node(new ast_1.Expression(ast_1.ExprType.UNARY_OP, tokenType));
        }
        else if (utils_1.Utils.opBinary(this.currToken.type)) {
            const tokenType = this.currToken.type;
            this.advance(); // skip the op
            this.failIfEOF(token_1.TokenType.GENERAL_EXPRESSION);
            return new ast_1.Node(new ast_1.Expression(ast_1.ExprType.BINARY_OP, tokenType));
        }
        else if (this.currToken.type === token_1.TokenType.NUMBER) {
            const isNegative = this.currToken.value[0] === '-';
            let arg = Number(this.currToken.value.substr(isNegative ? 1 : 0));
            if (isNegative) {
                arg = -arg;
            }
            const numLiteral = new ast_1.Node(new ast_1.Expression(ast_1.ExprType.NUM_EXPR, arg));
            this.advance(); // skip the number
            return numLiteral;
        }
        else if (this.currToken.type === token_1.TokenType.TRUE || this.currToken.type === token_1.TokenType.FALSE) {
            const boolean = new ast_1.Node(new ast_1.Expression(ast_1.ExprType.BOOL_EXPR, this.currToken.type === token_1.TokenType.TRUE));
            this.advance(); // skip the boolean
            return boolean;
        }
        console.log(this.currToken);
        this.throwError(`expected an expression, but ${this.currToken.getName()} found`, this.currToken);
        return new ast_1.Node(null);
    }
    parse() {
        let block = new ast_1.Node(null);
        let instructions = this.getManyStatements(block);
        block.addChildren(instructions);
        return [block, this.pos];
    }
}
exports.Parser = Parser;
