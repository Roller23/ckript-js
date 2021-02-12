"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Evaluator = void 0;
const ast_1 = require("./ast");
const error_handler_1 = require("./error-handler");
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
    throwError(cause) {
        error_handler_1.ErrorHandler.throwError(`Runtime error: ${cause} on ${this.currentLine} in file ${this.currentSource}`);
    }
    getHeapVal(ref) {
        // TODO
        return new vm_1.Value(utils_1.VarType.UNKNOWN);
    }
    getReferenceByName(name) {
        if (name in this.VM.globals) {
            this.throwError('Trying to access a native function');
        }
        if (!(name in this.stack))
            return null;
        return this.stack[name];
    }
    getValue(el) {
        if (el.value.isLvalue()) {
            if (el.value.memberName.length !== 0) {
                return el.value;
            }
            let _var = this.getReferenceByName(el.value.referenceName);
            if (_var === null) {
                this.throwError(`'${el.value.referenceName}' is not defined`);
            }
            if (_var.val.heapRef) {
                return this.getHeapVal(_var.val.heapRef);
            }
            return _var.val;
        }
        else if (el.value.heapRef !== -1) {
            return this.getHeapVal(el.value.heapRef);
        }
        else {
            return el.value;
        }
    }
    stringify(val) {
        if (val.heapRef !== -1) {
            return `reference to ${this.stringify(this.getHeapVal(val.heapRef))}`;
        }
        else if (val.type === utils_1.VarType.STR) {
            return val.value;
        }
        else if (val.type === utils_1.VarType.BOOL) {
            return val.value ? 'true' : 'false';
        }
        else if (val.type === utils_1.VarType.FLOAT || val.type === utils_1.VarType.INT) {
            return val.value.toString();
        }
        else if (val.type === utils_1.VarType.FUNC) {
            return 'function';
        }
        else if (val.type === utils_1.VarType.CLASS) {
            return 'class';
        }
        else if (val.type === utils_1.VarType.OBJ) {
            return 'object';
        }
        else if (val.type === utils_1.VarType.ARR) {
            return 'array';
        }
        else if (val.type === utils_1.VarType.VOID) {
            return 'void';
        }
        else if (val.type === utils_1.VarType.UNKNOWN) {
            return 'null';
        }
        else if (val.type === utils_1.VarType.ID) {
            return `variable (${val.referenceName})`;
        }
        return '';
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
    static RpnVal(val) {
        return new RpnElement(ElementType.VALUE, val);
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
        else if (expr.type === ast_1.ExprType.BOOL_EXPR) {
            return Evaluator.RpnVal(new vm_1.Value(utils_1.VarType.BOOL, expr.literal));
        }
        else if (expr.type === ast_1.ExprType.STR_EXPR) {
            return Evaluator.RpnVal(new vm_1.Value(utils_1.VarType.STR, expr.literal));
        }
        else if (expr.type === ast_1.ExprType.FLOAT_EXPR) {
            return Evaluator.RpnVal(new vm_1.Value(utils_1.VarType.FLOAT, expr.literal));
        }
        else if (expr.type === ast_1.ExprType.NUM_EXPR) {
            return Evaluator.RpnVal(new vm_1.Value(utils_1.VarType.INT, expr.literal));
        }
        else if (expr.type === ast_1.ExprType.IDENTIFIER_EXPR) {
            let res = Evaluator.RpnVal(new vm_1.Value(utils_1.VarType.ID));
            res.value.referenceName = expr.literal;
            return res;
        }
        else if (expr.type === ast_1.ExprType.FUNC_EXPR) {
            // TODO: Check if this is correct
            let res = Evaluator.RpnVal(new vm_1.Value(utils_1.VarType.FUNC));
            res.value.func = expr.funcExpr;
            return res;
        }
        else if (expr.type === ast_1.ExprType.ARRAY) {
            let val = new vm_1.Value(utils_1.VarType.ARR);
            let initialSize = new vm_1.Value(utils_1.VarType.INT);
            let elementsCount = 0;
            if (expr.argsList.length !== 0 && expr.argsList[0].length !== 0) {
                elementsCount = expr.argsList.length;
            }
            initialSize.value = elementsCount;
            if (expr.arraySize.length > 0) {
                initialSize = this.evaluateExpression(expr.arraySize);
                if (initialSize.type !== utils_1.VarType.INT) {
                    this.throwError(`Number expected, but ${this.stringify(initialSize)} found`);
                }
                if (initialSize.value < 0) {
                    this.throwError('Array size cannot be negative');
                }
                if (initialSize.value < elementsCount) {
                    initialSize.value = elementsCount;
                }
            }
            val.arrayType = expr.arrayType;
            if (initialSize.value !== 0) {
                // TODO????
                // val.arrayValues.resize????????????????????
            }
            const arrType = utils_1.Utils.varLUT[expr.arrayType];
            for (let v of val.arrayValues)
                v.type = arrType;
            let i = 0;
            for (const nodeList of expr.argsList) {
                if (nodeList.length === 0) {
                    if (i === 0) {
                        break;
                    }
                    else {
                        this.throwError('Empty array element');
                    }
                }
                val.arrayValues[i] = this.evaluateExpression(nodeList, expr.arrayHoldsRefs);
                let currEl = val.arrayValues[i];
                if (expr.arrayHoldsRefs && currEl.heapRef === -1) {
                    this.throwError('Array holds references, but null or value given');
                }
                if (expr.arrayHoldsRefs) {
                    if (arrType !== this.getHeapVal(currEl.heapRef).type) {
                        this.throwError(`Cannot add ${this.stringify(currEl)} to an array of ref ${expr.arrayType}s`);
                    }
                }
                else if (currEl.type !== arrType) {
                    this.throwError(`Cannot add ${this.stringify(currEl)} to an array of ${expr.arrayType}s`);
                }
                i++;
            }
            return Evaluator.RpnVal(val);
        }
        else {
            this.throwError('Unidentified expression type!');
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
        for (const token of rpnStack) {
            if (token.type === ElementType.OPERATOR) {
                if (token.op.opType === OperatorType.BASIC) {
                    if (utils_1.Utils.opBinary(token.op.type)) {
                        if (resStack.length < 2) {
                            this.throwError(`Operator ${token_1.Token.getName(token.op.type)} expects two operands`);
                        }
                        const y = resStack.pop();
                        const x = resStack.pop();
                        // TODO
                        if (token.op.type === token_1.TokenType.DOT) {
                            // resStack.push(this.accessMember(x, y));
                        }
                    }
                    else if (utils_1.Utils.opUnary(token.op.type)) {
                    }
                }
                else if (token.op.opType === OperatorType.FUNC) {
                }
                else if (token.op.opType === OperatorType.INDEX) {
                }
            }
            else {
                resStack.push(token);
            }
        }
        let resVal = resStack[0].value;
        if (getRef) {
            if (resVal.isLvalue()) {
                let _var = this.getReferenceByName(resVal.referenceName);
                if (_var === null) {
                    this.throwError(`'${resVal.referenceName}' is not defined`);
                }
                if (_var.val.heapRef !== -1) {
                    return _var.val;
                }
                else {
                    this.throwError('Expression expected to be a reference');
                }
            }
            else if (resVal.heapRef !== -1) {
                return resVal;
            }
            else {
                this.throwError('Expression expected to be a reference');
            }
        }
        if (resVal.isLvalue() || resVal.heapRef > -1) {
            return this.getValue(Evaluator.RpnVal(resVal));
        }
        return new vm_1.Value(utils_1.VarType.UNKNOWN);
    }
}
exports.Evaluator = Evaluator;
Evaluator.FLAG_OK = 0;
Evaluator.FLAG_BREAK = 1;
Evaluator.FLAG_CONTINUE = 2;
Evaluator.FLAG_RETURN = 3;
Evaluator.FLAG_ERROR = 4;
