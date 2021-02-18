"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Node = exports.Declaration = exports.Statement = exports.ClassStatement = exports.FuncParam = exports.FuncExpression = exports.Expression = exports.ExprType = exports.StmtType = exports.DeclType = exports.NodeType = void 0;
const token_1 = require("./token");
var NodeType;
(function (NodeType) {
    NodeType[NodeType["EXPR"] = 0] = "EXPR";
    NodeType[NodeType["STMT"] = 1] = "STMT";
    NodeType[NodeType["DECL"] = 2] = "DECL";
    NodeType[NodeType["UNKNOWN"] = 3] = "UNKNOWN";
})(NodeType = exports.NodeType || (exports.NodeType = {}));
var DeclType;
(function (DeclType) {
    DeclType[DeclType["VAR_DECL"] = 0] = "VAR_DECL";
    DeclType[DeclType["NONE"] = 1] = "NONE";
})(DeclType = exports.DeclType || (exports.DeclType = {}));
var StmtType;
(function (StmtType) {
    StmtType[StmtType["IF"] = 0] = "IF";
    StmtType[StmtType["RETURN"] = 1] = "RETURN";
    StmtType[StmtType["WHILE"] = 2] = "WHILE";
    StmtType[StmtType["FOR"] = 3] = "FOR";
    StmtType[StmtType["COMPOUND"] = 4] = "COMPOUND";
    StmtType[StmtType["EXPR"] = 5] = "EXPR";
    StmtType[StmtType["UNKNOWN"] = 6] = "UNKNOWN";
    StmtType[StmtType["NOP"] = 7] = "NOP";
    StmtType[StmtType["DECL"] = 8] = "DECL";
    StmtType[StmtType["CLASS"] = 9] = "CLASS";
    StmtType[StmtType["BREAK"] = 10] = "BREAK";
    StmtType[StmtType["CONTINUE"] = 11] = "CONTINUE";
    StmtType[StmtType["SET"] = 12] = "SET";
    StmtType[StmtType["SET_IDX"] = 13] = "SET_IDX";
    StmtType[StmtType["NONE"] = 14] = "NONE";
})(StmtType = exports.StmtType || (exports.StmtType = {}));
var ExprType;
(function (ExprType) {
    ExprType[ExprType["BINARY_OP"] = 0] = "BINARY_OP";
    ExprType[ExprType["UNARY_OP"] = 1] = "UNARY_OP";
    ExprType[ExprType["FUNC_CALL"] = 2] = "FUNC_CALL";
    ExprType[ExprType["FUNC_EXPR"] = 3] = "FUNC_EXPR";
    ExprType[ExprType["NUM_EXPR"] = 4] = "NUM_EXPR";
    ExprType[ExprType["STR_EXPR"] = 5] = "STR_EXPR";
    ExprType[ExprType["IDENTIFIER_EXPR"] = 6] = "IDENTIFIER_EXPR";
    ExprType[ExprType["BOOL_EXPR"] = 7] = "BOOL_EXPR";
    ExprType[ExprType["NOP"] = 8] = "NOP";
    ExprType[ExprType["RPN"] = 9] = "RPN";
    ExprType[ExprType["LPAREN"] = 10] = "LPAREN";
    ExprType[ExprType["RPAREN"] = 11] = "RPAREN";
    ExprType[ExprType["INDEX"] = 12] = "INDEX";
    ExprType[ExprType["ARRAY"] = 13] = "ARRAY";
    ExprType[ExprType["NONE"] = 14] = "NONE";
})(ExprType = exports.ExprType || (exports.ExprType = {}));
class Expression {
    constructor(type, arg) {
        this.nodeType = NodeType.EXPR;
        this.type = ExprType.NONE;
        this.literal = undefined;
        this.funcExpr = null;
        this.arrayType = '';
        this.arrayHoldsRefs = false;
        this.nodeExpressions = [];
        this.argsList = [];
        this.arraySize = [];
        this.op = token_1.TokenType.NONE;
        this.type = type;
        if (this.type === ExprType.UNARY_OP || this.type === ExprType.BINARY_OP) {
            this.op = arg;
        }
        else if (this.type === ExprType.RPN) {
            this.nodeExpressions = arg;
        }
        else if (this.type === ExprType.INDEX) {
            this.op = token_1.TokenType.LEFT_BRACKET;
            this.nodeExpressions = arg;
        }
        else if (this.type === ExprType.BOOL_EXPR) {
            this.literal = arg;
        }
        else if (this.type === ExprType.FUNC_EXPR) {
            this.funcExpr = arg;
        }
        else if (this.type === ExprType.FUNC_CALL) {
            this.argsList = arg;
        }
        else if (this.type === ExprType.STR_EXPR) {
            this.literal = arg;
        }
        else if (this.type === ExprType.IDENTIFIER_EXPR) {
            this.literal = arg;
        }
        else if (this.type === ExprType.NUM_EXPR) {
            this.literal = arg;
        }
    }
    isOperand() {
        return this.type === ExprType.BINARY_OP || this.type === ExprType.UNARY_OP ||
            this.type === ExprType.FUNC_CALL || this.type === ExprType.INDEX;
    }
    isParen() {
        return this.type === ExprType.LPAREN || this.type === ExprType.RPAREN;
    }
    isEvaluable() {
        return !this.isOperand() && !this.isParen();
    }
}
exports.Expression = Expression;
class FuncExpression {
    constructor() {
        this.params = [];
        this.retType = 'void';
        this.retRef = false;
        this.capturess = false;
        this.instructions = [];
    }
}
exports.FuncExpression = FuncExpression;
class FuncParam {
    constructor(type, name) {
        this.typeName = 'num';
        this.paramName = '';
        this.isRef = false;
        this.typeName = type;
        this.paramName = name;
    }
}
exports.FuncParam = FuncParam;
class ClassStatement {
    constructor() {
        this.className = '';
        this.members = [];
    }
}
exports.ClassStatement = ClassStatement;
class Statement {
    constructor(arg) {
        this.nodeType = NodeType.STMT;
        this.type = StmtType.NONE;
        this.expressions = [];
        this.statements = [];
        this.indexes = [];
        this.objMembers = [];
        this.line = 0;
        this.source = '';
        if (arg instanceof ClassStatement) {
            this.type = StmtType.CLASS;
            this.classStmt = arg;
        }
        else {
            this.type = arg;
            this.classStmt = null;
        }
    }
}
exports.Statement = Statement;
class Declaration {
    constructor(type) {
        this.nodeType = NodeType.DECL;
        this.type = DeclType.NONE;
        this.varType = '';
        this.id = '';
        this.isConstant = false;
        this.isAllocated = false;
        this.isReference = false;
        this.varExpression = [];
        this.type = type;
    }
}
exports.Declaration = Declaration;
class Node {
    constructor(obj) {
        this.type = NodeType.UNKNOWN;
        this.children = [];
        this.obj = obj;
        if (this.obj !== null) {
            this.type = this.obj.nodeType;
        }
    }
    addChildren(children) {
        this.children.push(...children);
    }
    toStmt() {
        return this.obj;
    }
    toExpr() {
        return this.obj;
    }
    toDecl() {
        return this.obj;
    }
}
exports.Node = Node;
