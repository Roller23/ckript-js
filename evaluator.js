"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Evaluator = void 0;
const ast_1 = require("./ast");
const token_1 = require("./token");
const utils_1 = require("./utils");
const vm_1 = require("./vm");
var OperatorType;
(function (OperatorType) {
    OperatorType[OperatorType["BASIC"] = 0] = "BASIC";
    OperatorType[OperatorType["FUNC"] = 1] = "FUNC";
    OperatorType[OperatorType["INDEX"] = 2] = "INDEX";
    OperatorType[OperatorType["UNKNOWN"] = 3] = "UNKNOWN";
})(OperatorType || (OperatorType = {}));
;
class Operator {
    constructor(opType, arg) {
        this.opType = OperatorType.UNKNOWN;
        this.funcCall = [];
        this.indexRpn = [];
        this.type = token_1.TokenType.UNKNOWN;
        this.opType = opType;
        if (this.opType === OperatorType.BASIC) {
            this.type = arg;
        }
        else if (this.opType === OperatorType.FUNC) {
            this.funcCall = arg;
        }
        else if (this.opType === OperatorType.INDEX) {
            this.indexRpn = arg;
        }
    }
}
var ElementType;
(function (ElementType) {
    ElementType[ElementType["OPERATOR"] = 0] = "OPERATOR";
    ElementType[ElementType["VALUE"] = 1] = "VALUE";
    ElementType[ElementType["UNKNOWN"] = 2] = "UNKNOWN";
})(ElementType || (ElementType = {}));
class RpnElement {
    constructor(type, arg) {
        this.type = ElementType.UNKNOWN;
        this.op = new Operator(OperatorType.UNKNOWN);
        this.value = new vm_1.Value(utils_1.VarType.UNKNOWN);
        this.type = type;
        if (this.type === ElementType.OPERATOR) {
            this.op = arg;
        }
        else if (this.type === ElementType.VALUE) {
            this.value = arg;
        }
    }
}
class Evaluator {
    constructor(AST, VM) {
        this.stack = {};
        this.insideFunc = false;
        this.returnsRef = false;
        this.nestedLoops = 0;
        this.currentLine = 0;
        this.currentSource = '';
        this.returnValue = null;
        this.VM = VM;
        this.AST = AST;
    }
    start() {
        for (const statement of this.AST.children) {
            const flag = this.executeStatement(statement);
            if (flag === Evaluator.FLAG_RETURN)
                break;
        }
        if (this.returnValue === null) {
            this.returnValue = new vm_1.Value(utils_1.VarType.VOID);
        }
    }
    executeStatement(statement) {
        const stmt = statement.toStmt();
        this.currentLine = stmt.line;
        this.currentSource = stmt.source;
        if (stmt.type === ast_1.StmtType.NONE) {
            return Evaluator.FLAG_OK;
        }
        else if (stmt.type === ast_1.StmtType.EXPR) {
            if (stmt.expressions.length !== 1)
                return Evaluator.FLAG_OK;
            this.evaluateExpression(stmt.expressions[0]);
            return Evaluator.FLAG_OK;
        }
        return 0;
    }
    static RpnOp(type, arg) {
        return new RpnElement(ElementType.OPERATOR, new Operator(type, arg));
    }
    nodeToElement(node) {
        const expr = node.toExpr();
        if (expr.isOperand()) {
            if (expr.type === ast_1.ExprType.FUNC_CALL) {
                return Evaluator.RpnOp(OperatorType.FUNC, expr.argsList);
            }
            else if (expr.type === ast_1.ExprType.INDEX) {
                return Evaluator.RpnOp(OperatorType.INDEX, expr.nodeExpressions);
            }
            else {
                return Evaluator.RpnOp(OperatorType.BASIC, expr.op);
            }
        }
        else {
            // TODO
        }
        return new RpnElement(ElementType.UNKNOWN);
    }
    flattenTree(res, expressionTree) {
        for (const node of expressionTree) {
            const expr = node.toExpr();
            if (expr.nodeExpressions.length !== 0) {
                this.flattenTree(res, expr.nodeExpressions);
            }
            if (expr.type !== ast_1.ExprType.RPN) {
                res.push(this.nodeToElement(node));
            }
        }
    }
    evaluateExpression(expressionTree, getRef = false) {
        let rpnStack = [];
        this.flattenTree(rpnStack, expressionTree);
        let resStack = [];
        return new vm_1.Value(utils_1.VarType.UNKNOWN);
    }
}
exports.Evaluator = Evaluator;
Evaluator.FLAG_OK = 0;
Evaluator.FLAG_BREAK = 1;
Evaluator.FLAG_CONTINUE = 2;
Evaluator.FLAG_RETURN = 3;
Evaluator.FLAG_ERROR = 4;
