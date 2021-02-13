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
    toDouble(val) {
        if (val.type === utils_1.VarType.FLOAT || val.type === utils_1.VarType.INT) {
            return val.value;
        }
        this.throwError(`Cannot convert ${this.stringify(val)} to double`);
        return 0;
    }
    static makeCopy(val) {
        if (Evaluator.primitiveTypes.includes(val.type)) {
            return new vm_1.Value(val.type, val.value);
        }
        else if (val.type === utils_1.VarType.ID) {
            let newVal = new vm_1.Value(utils_1.VarType.ID);
            newVal.referenceName = val.referenceName;
            return newVal;
        }
        else if (val.type === utils_1.VarType.REF) {
            let newVal = new vm_1.Value(utils_1.VarType.REF);
            newVal.heapRef = val.heapRef;
            return newVal;
        }
        else if (val.type === utils_1.VarType.ARR) {
            let newVal = new vm_1.Value(utils_1.VarType.ARR);
            newVal.arrayType = val.arrayType;
            for (const arrayVal of val.arrayValues) {
                newVal.arrayValues.push(Evaluator.makeCopy(arrayVal));
            }
            return newVal;
        }
        else if (val.type === utils_1.VarType.OBJ) {
            let newVal = new vm_1.Value(utils_1.VarType.OBJ);
            newVal.memberName = val.memberName;
            newVal.className = val.className;
            Object.keys(val.memberValues).forEach((key) => {
                newVal.memberValues[key] = Evaluator.makeCopy(val.memberValues[key]);
            });
            return newVal;
        }
        else if (val.type === utils_1.VarType.FUNC) {
            // TODO: functions might not need copying since they're immutable anyway
            let newVal = new vm_1.Value(utils_1.VarType.FUNC);
            newVal.thisRef = val.thisRef;
            newVal.func = new ast_1.FuncExpression();
            newVal.func.capturess = val.func.capturess;
            newVal.func.retRef = val.func.retRef;
            newVal.func.retType = val.func.retType;
            newVal.func.instructions = val.func.instructions; // no copy
            newVal.func.params = val.func.params; // no copy
            return newVal;
        }
        return val; // Unknown, void, or class
    }
    logicalNot(x) {
        const xVal = this.getValue(x);
        if (xVal.type === utils_1.VarType.BOOL) {
            return Evaluator.RpnVal(new vm_1.Value(utils_1.VarType.BOOL, !xVal.value));
        }
        this.throwError(`Cannot perform logical not on ${this.stringify(xVal)}`);
        return new RpnElement(ElementType.UNKNOWN);
    }
    bitwiseNot(x) {
        const xVal = this.getValue(x);
        if (xVal.type === utils_1.VarType.INT) {
            return Evaluator.RpnVal(new vm_1.Value(utils_1.VarType.INT, ~xVal.value));
        }
        this.throwError(`Cannot perform bitwise not on ${this.stringify(xVal)}`);
        return new RpnElement(ElementType.UNKNOWN);
    }
    deleteValue(x) {
        let val = x.value;
        let v = null;
        if (val.isLvalue()) {
            v = this.getReferenceByName(val.referenceName);
            if (v === null) {
                this.throwError(`${val.referenceName} is not defined`);
            }
            val = v.val;
        }
        if (val.heapRef === -1 || val.heapRef >= this.VM.heap.chunks.length) {
            this.throwError(`${x.value.referenceName} is not allocated on the heap`);
        }
        if (!this.VM.heap.chunks[val.heapRef].used) {
            this.throwError('Double delete');
        }
        this.VM.heap.free(val.heapRef);
        if (v !== null) {
            v.val.heapRef = -1;
        }
        return Evaluator.RpnVal(new vm_1.Value(utils_1.VarType.VOID));
    }
    performAddition(x, y) {
        const xVal = this.getValue(x);
        const yVal = this.getValue(y);
        if (xVal.type === utils_1.VarType.ARR) {
            if (yVal.type === utils_1.Utils.varLUT[xVal.arrayType]) {
                let xValCpy = Evaluator.makeCopy(xVal);
                xValCpy.arrayValues.push(Evaluator.makeCopy(yVal));
                return Evaluator.RpnVal(xValCpy);
            }
            else {
                this.throwError(`Cannot append ${this.stringify(yVal)} to an array of ${xVal.arrayType}s`);
            }
        }
        else if (yVal.type === utils_1.VarType.ARR) {
            if (xVal.type === utils_1.Utils.varLUT[yVal.arrayType]) {
                let yValCpy = Evaluator.makeCopy(yVal);
                yValCpy.arrayValues.unshift(Evaluator.makeCopy(xVal));
                return Evaluator.RpnVal(yValCpy);
            }
            else {
                this.throwError(`Cannot prepend ${this.stringify(xVal)} to an array of ${yVal.arrayType}s`);
            }
        }
        else if (xVal.type === utils_1.VarType.STR || yVal.type === utils_1.VarType.STR) {
            let val = new vm_1.Value(utils_1.VarType.STR);
            val.value = this.stringify(xVal) + this.stringify(yVal);
            return Evaluator.RpnVal(val);
        }
        else if (xVal.type === utils_1.VarType.INT && yVal.type === utils_1.VarType.INT) {
            let val = new vm_1.Value(utils_1.VarType.INT);
            val.value = xVal.value + yVal.value;
            return Evaluator.RpnVal(val);
        }
        else if (xVal.type === utils_1.VarType.FLOAT || yVal.type === utils_1.VarType.FLOAT) {
            let val = new vm_1.Value(utils_1.VarType.FLOAT);
            val.value = this.toDouble(xVal) + this.toDouble(yVal);
            return Evaluator.RpnVal(val);
        }
        this.throwError(`Cannot perform addition on ${this.stringify(xVal)} and ${this.stringify(yVal)}`);
        return Evaluator.RpnVal(new vm_1.Value(utils_1.VarType.UNKNOWN));
    }
    performSubtraction(x, y) {
        const xVal = this.getValue(x);
        const yVal = this.getValue(y);
        if (xVal.type === utils_1.VarType.INT && yVal.type === utils_1.VarType.INT) {
            let val = new vm_1.Value(utils_1.VarType.INT, xVal.value - yVal.value);
            return Evaluator.RpnVal(val);
        }
        else if (xVal.type === utils_1.VarType.ARR && yVal.type === utils_1.VarType.INT) {
            let xValCpy = Evaluator.makeCopy(xVal);
            if (yVal.value < 0 || yVal.value >= xValCpy.arrayValues.length) {
                this.throwError(`Cannot remove index [${yVal.value}] (out of range)`);
            }
            xValCpy.arrayValues.splice(yVal.value, 1);
            return Evaluator.RpnVal(xValCpy);
        }
        else if (xVal.type === utils_1.VarType.FLOAT || yVal.type === utils_1.VarType.FLOAT) {
            let val = new vm_1.Value(utils_1.VarType.FLOAT);
            val.value = this.toDouble(xVal) - this.toDouble(yVal);
            return Evaluator.RpnVal(val);
        }
        this.throwError(`Cannot perform subtraction on ${this.stringify(xVal)} and ${this.stringify(yVal)}`);
        return Evaluator.RpnVal(new vm_1.Value(utils_1.VarType.UNKNOWN));
    }
    performMultiplication(x, y) {
        const xVal = this.getValue(x);
        const yVal = this.getValue(y);
        if (xVal.type === utils_1.VarType.INT && yVal.type === utils_1.VarType.INT) {
            let val = new vm_1.Value(utils_1.VarType.INT, xVal.value * yVal.value);
            return Evaluator.RpnVal(val);
        }
        else if (xVal.type === utils_1.VarType.FLOAT || yVal.type === utils_1.VarType.FLOAT) {
            let val = new vm_1.Value(utils_1.VarType.FLOAT);
            val.value = this.toDouble(xVal) * this.toDouble(yVal);
            return Evaluator.RpnVal(val);
        }
        this.throwError(`Cannot perform multiplication on ${this.stringify(xVal)} and ${this.stringify(yVal)}`);
        return Evaluator.RpnVal(new vm_1.Value(utils_1.VarType.UNKNOWN));
    }
    performDivision(x, y) {
        const xVal = this.getValue(x);
        const yVal = this.getValue(y);
        if (xVal.type === utils_1.VarType.INT && yVal.type === utils_1.VarType.INT) {
            if (yVal.value === 0) {
                this.throwError('Cannot divide by zero');
            }
            let val = new vm_1.Value(utils_1.VarType.INT, xVal.value / yVal.value);
            return Evaluator.RpnVal(val);
        }
        else if (xVal.type === utils_1.VarType.FLOAT || yVal.type === utils_1.VarType.FLOAT) {
            let val = new vm_1.Value(utils_1.VarType.FLOAT);
            const f1 = this.toDouble(xVal);
            const f2 = this.toDouble(xVal);
            if (f2 === 0.0) {
                this.throwError('Cannot divide by zero');
            }
            val.value = f1 / f2;
            return Evaluator.RpnVal(val);
        }
        this.throwError(`Cannot perform division on ${this.stringify(xVal)} and ${this.stringify(yVal)}`);
        return Evaluator.RpnVal(new vm_1.Value(utils_1.VarType.UNKNOWN));
    }
    performModulo(x, y) {
        const xVal = this.getValue(x);
        const yVal = this.getValue(y);
        if (xVal.type === utils_1.VarType.INT && yVal.type === utils_1.VarType.INT) {
            if (yVal.value === 0) {
                this.throwError('Cannot divide by zero');
            }
            let val = new vm_1.Value(utils_1.VarType.INT, xVal.value % yVal.value);
            return Evaluator.RpnVal(val);
        }
        this.throwError(`Cannot perform modulo on ${this.stringify(xVal)} and ${this.stringify(yVal)}`);
        return Evaluator.RpnVal(new vm_1.Value(utils_1.VarType.UNKNOWN));
    }
    bitwiseAnd(x, y) {
        const xVal = this.getValue(x);
        const yVal = this.getValue(y);
        if (xVal.type === utils_1.VarType.INT && yVal.type === utils_1.VarType.INT) {
            let val = new vm_1.Value(utils_1.VarType.INT, xVal.value & yVal.value);
            return Evaluator.RpnVal(val);
        }
        this.throwError(`Cannot perform bitwise and on ${this.stringify(xVal)} and ${this.stringify(yVal)}`);
        return Evaluator.RpnVal(new vm_1.Value(utils_1.VarType.UNKNOWN));
    }
    bitwiseOr(x, y) {
        const xVal = this.getValue(x);
        const yVal = this.getValue(y);
        if (xVal.type === utils_1.VarType.INT && yVal.type === utils_1.VarType.INT) {
            let val = new vm_1.Value(utils_1.VarType.INT, xVal.value | yVal.value);
            return Evaluator.RpnVal(val);
        }
        this.throwError(`Cannot perform bitwise or on ${this.stringify(xVal)} and ${this.stringify(yVal)}`);
        return Evaluator.RpnVal(new vm_1.Value(utils_1.VarType.UNKNOWN));
    }
    shiftLeft(x, y) {
        const xVal = this.getValue(x);
        const yVal = this.getValue(y);
        if (xVal.type === utils_1.VarType.INT && yVal.type === utils_1.VarType.INT) {
            let val = new vm_1.Value(utils_1.VarType.INT, xVal.value << yVal.value);
            return Evaluator.RpnVal(val);
        }
        this.throwError(`Cannot perform shift left and on ${this.stringify(xVal)} and ${this.stringify(yVal)}`);
        return Evaluator.RpnVal(new vm_1.Value(utils_1.VarType.UNKNOWN));
    }
    shiftRight(x, y) {
        const xVal = this.getValue(x);
        const yVal = this.getValue(y);
        if (xVal.type === utils_1.VarType.INT && yVal.type === utils_1.VarType.INT) {
            let val = new vm_1.Value(utils_1.VarType.INT, xVal.value >> yVal.value);
            return Evaluator.RpnVal(val);
        }
        this.throwError(`Cannot perform bitwise shift right on ${this.stringify(xVal)} and ${this.stringify(yVal)}`);
        return Evaluator.RpnVal(new vm_1.Value(utils_1.VarType.UNKNOWN));
    }
    bitwiseXor(x, y) {
        const xVal = this.getValue(x);
        const yVal = this.getValue(y);
        if (xVal.type === utils_1.VarType.ARR && yVal.type === utils_1.VarType.ARR) {
            if (xVal.arrayType === yVal.arrayType) {
                let xValCpy = Evaluator.makeCopy(xVal);
                xValCpy.arrayValues.push(...Evaluator.makeCopy(yVal).arrayValues);
                return Evaluator.RpnVal(xValCpy);
            }
            else {
                this.throwError(`Cannot concatenate arrays of type ${xVal.arrayType} and ${yVal.arrayType}`);
            }
        }
        if (xVal.type === utils_1.VarType.INT && yVal.type === utils_1.VarType.INT) {
            let val = new vm_1.Value(utils_1.VarType.INT, xVal.value ^ yVal.value);
            return Evaluator.RpnVal(val);
        }
        this.throwError(`Cannot perform bitwise xor on ${this.stringify(xVal)} and ${this.stringify(yVal)}`);
        return Evaluator.RpnVal(new vm_1.Value(utils_1.VarType.UNKNOWN));
    }
    logicalAnd(x, y) {
        const xVal = this.getValue(x);
        const yVal = this.getValue(y);
        if (xVal.type === utils_1.VarType.BOOL && yVal.type === utils_1.VarType.BOOL) {
            let val = new vm_1.Value(utils_1.VarType.BOOL, xVal.value && yVal.value);
            return Evaluator.RpnVal(val);
        }
        this.throwError(`Cannot perform logical and on ${this.stringify(xVal)} and ${this.stringify(yVal)}`);
        return Evaluator.RpnVal(new vm_1.Value(utils_1.VarType.UNKNOWN));
    }
    logicalOr(x, y) {
        const xVal = this.getValue(x);
        const yVal = this.getValue(y);
        if (xVal.type === utils_1.VarType.BOOL && yVal.type === utils_1.VarType.BOOL) {
            let val = new vm_1.Value(utils_1.VarType.BOOL, xVal.value || yVal.value);
            return Evaluator.RpnVal(val);
        }
        this.throwError(`Cannot perform logical or on ${this.stringify(xVal)} and ${this.stringify(yVal)}`);
        return Evaluator.RpnVal(new vm_1.Value(utils_1.VarType.UNKNOWN));
    }
    assign(x, y) {
        if (!x.value.isLvalue()) {
            this.throwError('Cannot assign to an rvalue');
        }
        let _var = this.getReferenceByName(x.value.referenceName);
        if (_var === null) {
            this.throwError(`${x.value.referenceName} is not defined`);
        }
        if (_var.constant) {
            this.throwError(`Cannot reassign a constant variable (${x.value.referenceName})`);
        }
        let xValue = this.getValue(x);
        const yValue = this.getValue(y);
        if (xValue.type === utils_1.VarType.UNKNOWN) {
            this.throwError(`${xValue.referenceName} doesn't point to anything on the heap`);
        }
        if (xValue.type !== yValue.type) {
            this.throwError(`Cannot assign ${this.stringify(yValue)} to ${x.value.referenceName}`);
        }
        return Evaluator.RpnVal(Object.assign(xValue, Evaluator.makeCopy(yValue)));
    }
    plusAssign(x, y) {
        return this.assign(x, this.performAddition(x, y));
    }
    minusAssign(x, y) {
        return this.assign(x, this.performSubtraction(x, y));
    }
    mulAssign(x, y) {
        return this.assign(x, this.performMultiplication(x, y));
    }
    divAssign(x, y) {
        return this.assign(x, this.performDivision(x, y));
    }
    modAssign(x, y) {
        return this.assign(x, this.performModulo(x, y));
    }
    lshiftAssign(x, y) {
        return this.assign(x, this.shiftLeft(x, y));
    }
    rshiftAssign(x, y) {
        return this.assign(x, this.shiftRight(x, y));
    }
    andAssign(x, y) {
        return this.assign(x, this.bitwiseAnd(x, y));
    }
    orAssign(x, y) {
        return this.assign(x, this.bitwiseOr(x, y));
    }
    xorAssign(x, y) {
        return this.assign(x, this.bitwiseXor(x, y));
    }
    accessMember(x, y) {
        if (y.value.isLvalue()) {
            this.throwError('Object members can only be accessed with lvalues');
        }
        let obj = this.getValue(x);
        if (obj.type !== utils_1.VarType.OBJ) {
            this.throwError(`${this.stringify(obj)} is not an object`);
        }
        if (!(y.value.referenceName in obj.memberValues)) {
            const objectName = x.value.isLvalue() ? ` ${x.value.referenceName} ` : ' ';
            this.throwError(`Object${objectName}has no member named ${y.value.referenceName}`);
        }
        const val = obj.memberValues[y.value.referenceName];
        if (val.type === utils_1.VarType.FUNC) {
            val.funcName = y.value.referenceName;
        }
        return Evaluator.RpnVal(val);
    }
    accessIndex(arr, idx) {
        let array = this.getValue(arr);
        if (array.type !== utils_1.VarType.ARR) {
            this.throwError(`${this.stringify(array)} is not an array`);
        }
        const index = this.evaluateExpression(idx.op.indexRpn);
        if (index.type !== utils_1.VarType.INT) {
            this.throwError(`Index expected to be an int, but ${this.stringify(index)} found`);
        }
        if (index.value < 0 || index.value >= array.arrayValues.length) {
            this.throwError(`index [${index.value}] our of range`);
        }
        let res = array.arrayValues[index.value];
        return Evaluator.RpnVal(res);
    }
    compareEq(x, y) {
        const xVal = this.getValue(x);
        const yVal = this.getValue(y);
        if (xVal.type === utils_1.VarType.FLOAT || yVal.type === utils_1.VarType.FLOAT) {
            let val = new vm_1.Value(utils_1.VarType.BOOL);
            val.value = this.toDouble(xVal) === this.toDouble(yVal);
            return Evaluator.RpnVal(val);
        }
        else if ((xVal.type === utils_1.VarType.INT && yVal.type === utils_1.VarType.INT) ||
            (xVal.type === utils_1.VarType.STR && yVal.type === utils_1.VarType.STR) ||
            (xVal.type === utils_1.VarType.BOOL && yVal.type === utils_1.VarType.BOOL)) {
            let val = new vm_1.Value(utils_1.VarType.BOOL, xVal.value === yVal.value);
            return Evaluator.RpnVal(val);
        }
        this.throwError(`Cannot compare ${this.stringify(xVal)} to ${this.stringify(yVal)}`);
        return Evaluator.RpnVal(new vm_1.Value(utils_1.VarType.UNKNOWN));
    }
    compareNeq(x, y) {
        const el = this.compareEq(x, y);
        el.value.value = !el.value.value;
        return el;
    }
    compareGt(x, y) {
        const xVal = this.getValue(x);
        const yVal = this.getValue(y);
        if (xVal.type === utils_1.VarType.FLOAT || yVal.type === utils_1.VarType.FLOAT) {
            let val = new vm_1.Value(utils_1.VarType.BOOL);
            val.value = this.toDouble(xVal) > this.toDouble(yVal);
            return Evaluator.RpnVal(val);
        }
        else if (xVal.type === utils_1.VarType.INT && yVal.type === utils_1.VarType.INT) {
            let val = new vm_1.Value(utils_1.VarType.BOOL, xVal.value > yVal.value);
            return Evaluator.RpnVal(val);
        }
        this.throwError(`Cannot compare ${this.stringify(xVal)} to ${this.stringify(yVal)}`);
        return Evaluator.RpnVal(new vm_1.Value(utils_1.VarType.UNKNOWN));
    }
    compareLt(x, y) {
        return this.compareGt(y, x);
    }
    compareGtEq(x, y) {
        const gt = this.compareGt(x, y);
        const eq = this.compareEq(x, y);
        const val = new vm_1.Value(utils_1.VarType.BOOL, gt.value.value || eq.value.value);
        return Evaluator.RpnVal(val);
    }
    compareLtEq(x, y) {
        return this.compareGtEq(y, x);
    }
    registerClass(_class) {
        const v = this.getReferenceByName(_class.className);
        if (v !== null) {
            delete this.stack[_class.className];
        }
        let _var = (this.stack[_class.className] = new vm_1.Variable());
        _var.type = 'class';
        _var.val.type = utils_1.VarType.CLASS;
        _var.val.members = _class.members;
        _var.val.className = _class.className;
    }
    declareVariable(declaration) {
        const decl = declaration.toDecl();
        const varVal = this.evaluateExpression(decl.varExpression, decl.isReference);
        const varType = utils_1.Utils.varLUT[decl.varType];
        let exprType = varVal.type;
        if (decl.isReference) {
            exprType = this.getHeapVal(varVal.heapRef).type;
        }
        if (varType !== exprType) {
            this.throwError(`Cannot assign ${this.stringify(varVal)} to a variable of type ${decl.varType}`);
        }
        const v = this.getReferenceByName(decl.id);
        if (v === null) {
            delete this.stack[decl.id];
        }
        if (decl.isAllocated) {
            const chunk = this.VM.heap.allocate();
            let _var = (this.stack[decl.id] = new vm_1.Variable());
            _var.val.heapRef = chunk.heapRef;
            _var.type = decl.varType;
            _var.constant = decl.isConstant;
            chunk.data = varVal;
            if (varVal.type === utils_1.VarType.OBJ) {
                // TODO: bind 'this'
            }
            return;
        }
        let _var = (this.stack[decl.id] = new vm_1.Variable());
        _var.type = decl.varType;
        _var.val = varVal;
        _var.constant = decl.isConstant;
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
            const res = this.evaluateExpression(stmt.expressions[0]);
            console.log('expression result:', res.value);
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
                        if (token.op.type === token_1.TokenType.DOT) {
                            resStack.push(this.accessMember(x, y));
                        }
                        else if (token.op.type === token_1.TokenType.OP_PLUS) {
                            resStack.push(this.performAddition(x, y));
                        }
                        else if (token.op.type === token_1.TokenType.OP_MINUS) {
                            resStack.push(this.performSubtraction(x, y));
                        }
                        else if (token.op.type === token_1.TokenType.OP_MUL) {
                            resStack.push(this.performMultiplication(x, y));
                        }
                        else if (token.op.type === token_1.TokenType.OP_DIV) {
                            resStack.push(this.performDivision(x, y));
                        }
                        else if (token.op.type === token_1.TokenType.OP_MOD) {
                            resStack.push(this.performModulo(x, y));
                        }
                        else if (token.op.type === token_1.TokenType.OP_ASSIGN) {
                            resStack.push(this.assign(x, y));
                        }
                        else if (token.op.type === token_1.TokenType.OP_EQ) {
                            resStack.push(this.compareEq(x, y));
                        }
                        else if (token.op.type === token_1.TokenType.OP_NOT_EQ) {
                            resStack.push(this.compareNeq(x, y));
                        }
                        else if (token.op.type === token_1.TokenType.OP_GT) {
                            resStack.push(this.compareGt(x, y));
                        }
                        else if (token.op.type === token_1.TokenType.OP_LT) {
                            resStack.push(this.compareLt(x, y));
                        }
                        else if (token.op.type === token_1.TokenType.OP_GT_EQ) {
                            resStack.push(this.compareGtEq(x, y));
                        }
                        else if (token.op.type === token_1.TokenType.OP_LT_EQ) {
                            resStack.push(this.compareLtEq(x, y));
                        }
                        else if (token.op.type === token_1.TokenType.PLUS_ASSIGN) {
                            resStack.push(this.plusAssign(x, y));
                        }
                        else if (token.op.type === token_1.TokenType.MINUS_ASSIGN) {
                            resStack.push(this.minusAssign(x, y));
                        }
                        else if (token.op.type === token_1.TokenType.MUL_ASSIGN) {
                            resStack.push(this.mulAssign(x, y));
                        }
                        else if (token.op.type === token_1.TokenType.DIV_ASSIGN) {
                            resStack.push(this.divAssign(x, y));
                        }
                        else if (token.op.type === token_1.TokenType.OP_OR) {
                            resStack.push(this.logicalOr(x, y));
                        }
                        else if (token.op.type === token_1.TokenType.OP_AND) {
                            resStack.push(this.logicalAnd(x, y));
                        }
                        else if (token.op.type === token_1.TokenType.LSHIFT) {
                            resStack.push(this.shiftLeft(x, y));
                        }
                        else if (token.op.type === token_1.TokenType.RSHIFT) {
                            resStack.push(this.shiftRight(x, y));
                        }
                        else if (token.op.type === token_1.TokenType.OP_XOR) {
                            resStack.push(this.bitwiseXor(x, y));
                        }
                        else if (token.op.type === token_1.TokenType.OP_AND_BIT) {
                            resStack.push(this.bitwiseAnd(x, y));
                        }
                        else if (token.op.type === token_1.TokenType.OP_OR_BIT) {
                            resStack.push(this.bitwiseOr(x, y));
                        }
                        else if (token.op.type === token_1.TokenType.RSHIFT_ASSIGN) {
                            resStack.push(this.rshiftAssign(x, y));
                        }
                        else if (token.op.type === token_1.TokenType.LSHIFT_ASSIGN) {
                            resStack.push(this.lshiftAssign(x, y));
                        }
                        else if (token.op.type === token_1.TokenType.AND_ASSIGN) {
                            resStack.push(this.andAssign(x, y));
                        }
                        else if (token.op.type === token_1.TokenType.OR_ASSIGN) {
                            resStack.push(this.orAssign(x, y));
                        }
                        else if (token.op.type === token_1.TokenType.XOR_ASSIGN) {
                            resStack.push(this.xorAssign(x, y));
                        }
                        else {
                            this.throwError(`Unknown binary operator ${token_1.Token.getName(token.op.type)}`);
                        }
                    }
                    else if (utils_1.Utils.opUnary(token.op.type)) {
                        if (resStack.length < 1) {
                            this.throwError(`Operator ${token_1.Token.getName(token.op.type)} expects one operand`);
                        }
                        const x = resStack.pop();
                        // TODO
                    }
                }
                else if (token.op.opType === OperatorType.FUNC) {
                    // TODO
                }
                else if (token.op.opType === OperatorType.INDEX) {
                    // TODO
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
        return resVal;
    }
}
exports.Evaluator = Evaluator;
Evaluator.FLAG_OK = 0;
Evaluator.FLAG_BREAK = 1;
Evaluator.FLAG_CONTINUE = 2;
Evaluator.FLAG_RETURN = 3;
Evaluator.FLAG_ERROR = 4;
Evaluator.primitiveTypes = [
    utils_1.VarType.BOOL, utils_1.VarType.FLOAT, utils_1.VarType.INT, utils_1.VarType.STR
];
