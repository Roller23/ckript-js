import { ClassStatement, Declaration, Expression, ExprType, FuncExpression, FuncParam, Node, Statement, StmtType } from "./ast";
import { ErrorHandler } from "./error-handler";
import { Token, TokenType } from "./token";
import { Utils, VarType } from "./utils";
import { CVM, Value, Variable } from "./vm";

enum OperatorType {
  BASIC, FUNC, INDEX, UNKNOWN
};

class Operator {
  public opType: OperatorType = OperatorType.UNKNOWN;
  public funcCall: Node[][] = [];
  public indexRpn: Node[] = [];
  public type: TokenType = TokenType.UNKNOWN;

  public constructor(opType: OperatorType, arg?: any) {
    this.opType = opType;
    if (this.opType === OperatorType.BASIC) {
      this.type = arg;
    } else if (this.opType === OperatorType.FUNC) {
      this.funcCall = arg;
    } else if (this.opType === OperatorType.INDEX) {
      this.indexRpn = arg;
    }
  }
}

enum ElementType {
  OPERATOR, VALUE, UNKNOWN
}

class RpnElement {
  public type: ElementType = ElementType.UNKNOWN;
  public op: Operator = new Operator(OperatorType.UNKNOWN);
  public value: Value = new Value(VarType.UNKNOWN);

  public constructor(type: ElementType, arg?: any) {
    this.type = type;
    if (this.type === ElementType.OPERATOR) {
      this.op = arg;
    } else if (this.type === ElementType.VALUE) {
      this.value = arg;
    }
  }
}

type RpnStack = RpnElement[];
type VariablePtr = Variable | null;
type CallStack = {[key: string]: Variable};

export class Evaluator {
  public static FLAG_OK: number = 0;
  public static FLAG_BREAK: number = 1;
  public static FLAG_CONTINUE: number = 2;
  public static FLAG_RETURN: number = 3;
  public static FLAG_ERROR: number = 4;
  public VM: CVM;
  public AST: Node;
  public stack: CallStack = {};

  private insideFunc: boolean = false;
  private returnsRef: boolean = false;
  private nestedLoops: number = 0;
  private currentLine: number = 0;
  private currentSource: string = '';
  private returnValue: Value | null = null;

  constructor(AST: Node, VM: CVM) {
    this.VM = VM;
    this.AST = AST;
  }

  public throwError(cause: string) {
    ErrorHandler.throwError(`Runtime error: ${cause} (${this.currentSource}:${this.currentLine})`);
  }

  private getHeapVal(ref: number): Value {
    if (ref < 0 || ref >= this.VM.heap.chunks.length) {
      this.throwError('Dereferencing a value that is not on the heap');
    }
    const ptr = this.VM.heap.chunks[ref].data;
    if (ptr === null) {
      this.throwError('Dereferencing a null pointer');
    }
    return ptr!;
  }

  private getReferenceByName(name: string): VariablePtr {
    if (name in this.VM.globals) {
      this.throwError('Trying to access a native function');
    }
    if (!(name in this.stack)) return null;
    return this.stack[name];
  }

  private getValue(el: RpnElement): Value {
    if (el.value.isLvalue()) {
      if (el.value.memberName.length !== 0) {
        return el.value;
      }
      let _var: VariablePtr = this.getReferenceByName(el.value.referenceName);
      if (_var === null) {
        this.throwError(`'${el.value.referenceName}' is not defined`);
      }
      if (_var!.val.heapRef !== -1) {
        return this.getHeapVal(_var!.val.heapRef);
      }
      return _var!.val;
    } else if (el.value.heapRef !== -1) {
      return this.getHeapVal(el.value.heapRef);
    } else {
      return el.value;
    }
  }

  private stringify(val: Value): string {
    if (val.heapRef !== -1) {
      return `reference to ${this.stringify(this.getHeapVal(val.heapRef))}`;
    } else if (val.type === VarType.STR) {
      return <string>val.value;
    } else if (val.type === VarType.BOOL) {
      return val.value ? 'true' : 'false';
    } else if (val.type === VarType.NUM) {
      return val.value!.toString();
    } else if (val.type === VarType.FUNC) {
      return 'function';
    } else if (val.type === VarType.CLASS) {
      return 'class';
    } else if (val.type === VarType.OBJ) {
      return 'object';
    } else if (val.type === VarType.ARR) {
      return 'array';
    } else if (val.type === VarType.VOID) {
      return 'void';
    } else if (val.type === VarType.UNKNOWN) {
      return 'null';
    } else if (val.type === VarType.ID) {
      return `variable (${val.referenceName})`;
    }
    return '';
  }

  private static primitiveTypes: VarType[] = [
    VarType.BOOL, VarType.NUM, VarType.STR
  ];

  private static makeCopy(val: Value): Value {
    if (Evaluator.primitiveTypes.includes(val.type)) {
      return new Value(val.type, val.value);
    } else if (val.type === VarType.ID) {
      let newVal: Value = new Value(VarType.ID);
      newVal.referenceName = val.referenceName;
      return newVal;
    } else if (val.type === VarType.REF) {
      let newVal: Value = new Value(VarType.REF);
      newVal.heapRef = val.heapRef;
      return newVal;
    } else if (val.type === VarType.ARR) {
      let newVal: Value = new Value(VarType.ARR);
      newVal.arrayType = val.arrayType;
      for (const arrayVal of val.arrayValues) {
        newVal.arrayValues.push(Evaluator.makeCopy(arrayVal));
      }
      return newVal;
    } else if (val.type === VarType.OBJ) {
      let newVal: Value = new Value(VarType.OBJ);
      newVal.memberName = val.memberName;
      newVal.className = val.className;
      Object.keys(val.memberValues).forEach((key: string) => {
        newVal.memberValues[key] = Evaluator.makeCopy(val.memberValues[key]);
      });
      return newVal;
    } else if (val.type === VarType.FUNC) {
      // TODO: functions might not need copying since they're immutable anyway
      let newVal: Value = new Value(VarType.FUNC);
      newVal.thisRef = val.thisRef;
      newVal.func = new FuncExpression();
      newVal.func.capturess = val.func!.capturess;
      newVal.func.retRef = val.func!.retRef;
      newVal.func.retType = val.func!.retType;
      newVal.func.instructions = val.func!.instructions; // no copy
      newVal.func.params = val.func!.params; // no copy
      return newVal;
    }
    return val; // Unknown, void, or class
  }

  private setMember(members: string[], expression: Node[]): void {
    const base: string = members[0];
    let _var: VariablePtr = this.getReferenceByName(base);
    if (_var === null) {
      this.throwError(`'${base}' is not defined`);
    }
    let val: Value = _var!.val.heapRef !== -1 ? this.getHeapVal(_var!.val.heapRef) : _var?.val!;
    let references: Value[] = [val];
    let i: number = 0;
    let prev: string = members[0];
    for (const member of members) {
      if (i++ === 0) continue;
      let temp: Value = references[references.length - 1];
      temp = temp.heapRef !== -1 ? this.getHeapVal(temp.heapRef) : temp;
      if (temp.type !== VarType.OBJ) {
        this.throwError(`${this.stringify(temp)} is not an object`);
      }
      if (!(member in temp.memberValues)) {
        this.throwError(`${prev} has no member '${member}'`);
      }
      references.push(temp.memberValues[member]);
      prev = member;
    }
    const rvalue: Value = this.evaluateExpression(expression);
    let fin: Value = references[references.length - 1];
    fin = fin.heapRef !== -1 ? this.getHeapVal(fin.heapRef) : fin;
    if (fin.type !== rvalue.type) {
      this.throwError(`Cannot assign ${this.stringify(rvalue)}, incorrect type`);
    }
    Object.assign(fin, rvalue);
  }

  private setIndex(stmt: Statement): void {
    let arr: VariablePtr = this.getReferenceByName(stmt.objMembers[0]);
    if (arr === null) {
      this.throwError(`'${stmt.objMembers[0]}' is not defined`);
    }
    let val: Value = arr!.val.heapRef !== -1 ? this.getHeapVal(arr!.val.heapRef) : arr!.val;
    let references: Value[] = [val];
    for (const index of stmt.indexes) {
      let temp: Value = references[references.length - 1];
      temp = temp.heapRef !== -1 ? this.getHeapVal(temp.heapRef) : temp;
      if (temp.type !== VarType.ARR) {
        this.throwError(`${this.stringify(temp)} is not an array`);
      }
      const indexVal = this.evaluateExpression(index.toExpr().nodeExpressions); // not sure
      if (indexVal.type !== VarType.NUM || !Number.isInteger(indexVal.type)) {
        this.throwError(`Cannot access array with ${this.stringify(indexVal)}`);
      }
      if (<number>indexVal.value < 0 || <number>indexVal.value >= temp.arrayValues.length) {
        this.throwError(`Index [${indexVal.value}] out of range`);
      }
      references.push(temp.arrayValues[<number>indexVal.value]);
    }
    const rvalue: Value = this.evaluateExpression(stmt.expressions[0]);
    let fin: Value = references[references.length - 1];
    fin = fin.heapRef !== -1 ? this.getHeapVal(fin.heapRef) : fin;
    if (fin.type !== rvalue.type) {
      this.throwError(`Cannot assign ${this.stringify(rvalue)}, incorrect type`);
    }
    Object.assign(fin, rvalue);
  }

  private logicalNot(x: RpnElement): RpnElement {
    const xVal: Value = this.getValue(x);
    if (xVal.type === VarType.BOOL) {
      return Evaluator.RpnVal(new Value(VarType.BOOL, !xVal.value));
    }
    this.throwError(`Cannot perform logical not on ${this.stringify(xVal)}`);
    return new RpnElement(ElementType.UNKNOWN);
  }

  private bitwiseNot(x: RpnElement): RpnElement {
    const xVal: Value = this.getValue(x);
    if (xVal.type === VarType.NUM) {
      return Evaluator.RpnVal(new Value(VarType.NUM, ~(<number>xVal.value)));
    }
    this.throwError(`Cannot perform bitwise not on ${this.stringify(xVal)}`);
    return new RpnElement(ElementType.UNKNOWN);
  }

  private performAddition(x: RpnElement, y: RpnElement): RpnElement {
    const xVal: Value = this.getValue(x);
    const yVal: Value = this.getValue(y);
    if (xVal.type === VarType.ARR) {
      if (yVal.type === Utils.varLUT[xVal.arrayType]) {
        // TODO: fix arrays with refs
        let xValCpy: Value = Evaluator.makeCopy(xVal);
        xValCpy.arrayValues.push(Evaluator.makeCopy(yVal));
        return Evaluator.RpnVal(xValCpy);
      } else {
        this.throwError(`Cannot append ${this.stringify(yVal)} to an array of ${xVal.arrayType}s`);
      }
    } else if (yVal.type === VarType.ARR) {
      if (xVal.type === Utils.varLUT[yVal.arrayType]) {
        let yValCpy: Value = Evaluator.makeCopy(yVal);
        yValCpy.arrayValues.unshift(Evaluator.makeCopy(xVal));
        return Evaluator.RpnVal(yValCpy);
      } else {
        this.throwError(`Cannot prepend ${this.stringify(xVal)} to an array of ${yVal.arrayType}s`);
      }
    } else if (xVal.type === VarType.STR || yVal.type === VarType.STR) {
      let val: Value = new Value(VarType.STR);
      val.value = this.stringify(xVal) + this.stringify(yVal);
      return Evaluator.RpnVal(val);
    } else if (xVal.type === VarType.NUM && yVal.type === VarType.NUM) {
      let val: Value = new Value(VarType.NUM);
      val.value = <number>xVal.value + <number>yVal.value;
      return Evaluator.RpnVal(val);
    }
    this.throwError(`Cannot perform addition on ${this.stringify(xVal)} and ${this.stringify(yVal)}`);
    return Evaluator.RpnVal(new Value(VarType.UNKNOWN));
  }

  private performSubtraction(x: RpnElement, y: RpnElement): RpnElement {
    const xVal: Value = this.getValue(x);
    const yVal: Value = this.getValue(y);
    if (xVal.type === VarType.NUM && yVal.type === VarType.NUM) {
      let val: Value = new Value(VarType.NUM, <number>xVal.value - <number>yVal.value);
      return Evaluator.RpnVal(val);
    } else if (xVal.type === VarType.ARR && yVal.isInteger()) {
      let xValCpy: Value = Evaluator.makeCopy(xVal);
      if (<number>yVal.value < 0 || <number>yVal.value >= xValCpy.arrayValues.length) {
        this.throwError(`Cannot remove index [${yVal.value}] (out of range)`);
      }
      xValCpy.arrayValues.splice(<number>yVal.value, 1);
      return Evaluator.RpnVal(xValCpy);
    }
    this.throwError(`Cannot perform subtraction on ${this.stringify(xVal)} and ${this.stringify(yVal)}`);
    return Evaluator.RpnVal(new Value(VarType.UNKNOWN));
  }

  private performMultiplication(x: RpnElement, y: RpnElement): RpnElement {
    const xVal: Value = this.getValue(x);
    const yVal: Value = this.getValue(y);
    if (xVal.type === VarType.NUM && yVal.type === VarType.NUM) {
      let val: Value = new Value(VarType.NUM, <number>xVal.value * <number>yVal.value);
      return Evaluator.RpnVal(val);
    }
    this.throwError(`Cannot perform multiplication on ${this.stringify(xVal)} and ${this.stringify(yVal)}`);
    return Evaluator.RpnVal(new Value(VarType.UNKNOWN));
  }

  private performDivision(x: RpnElement, y: RpnElement): RpnElement {
    const xVal: Value = this.getValue(x);
    const yVal: Value = this.getValue(y);
    if (xVal.type === VarType.NUM && yVal.type === VarType.NUM) {
      if (<number>yVal.value === 0) {
        this.throwError('Cannot divide by zero');
      }
      let val: Value = new Value(VarType.NUM, <number>xVal.value / <number>yVal.value);
      return Evaluator.RpnVal(val);
    }
    this.throwError(`Cannot perform division on ${this.stringify(xVal)} and ${this.stringify(yVal)}`);
    return Evaluator.RpnVal(new Value(VarType.UNKNOWN));
  }

  private performModulo(x: RpnElement, y: RpnElement): RpnElement {
    const xVal: Value = this.getValue(x);
    const yVal: Value = this.getValue(y);
    if (xVal.type === VarType.NUM && yVal.type === VarType.NUM) {
      if (<number>yVal.value === 0) {
        this.throwError('Cannot divide by zero');
      }
      let val: Value = new Value(VarType.NUM, <number>xVal.value % <number>yVal.value);
      return Evaluator.RpnVal(val);
    }
    this.throwError(`Cannot perform modulo on ${this.stringify(xVal)} and ${this.stringify(yVal)}`);
    return Evaluator.RpnVal(new Value(VarType.UNKNOWN));
  }

  private bitwiseAnd(x: RpnElement, y: RpnElement): RpnElement {
    const xVal: Value = this.getValue(x);
    const yVal: Value = this.getValue(y);
    if (xVal.type === VarType.NUM && yVal.type === VarType.NUM) {
      let val: Value = new Value(VarType.NUM, <number>xVal.value & <number>yVal.value);
      return Evaluator.RpnVal(val);
    }
    this.throwError(`Cannot perform bitwise and on ${this.stringify(xVal)} and ${this.stringify(yVal)}`);
    return Evaluator.RpnVal(new Value(VarType.UNKNOWN));
  }

  private bitwiseOr(x: RpnElement, y: RpnElement): RpnElement {
    const xVal: Value = this.getValue(x);
    const yVal: Value = this.getValue(y);
    if (xVal.type === VarType.NUM && yVal.type === VarType.NUM) {
      let val: Value = new Value(VarType.NUM, <number>xVal.value | <number>yVal.value);
      return Evaluator.RpnVal(val);
    }
    this.throwError(`Cannot perform bitwise or on ${this.stringify(xVal)} and ${this.stringify(yVal)}`);
    return Evaluator.RpnVal(new Value(VarType.UNKNOWN));
  }

  private shiftLeft(x: RpnElement, y: RpnElement): RpnElement {
    const xVal: Value = this.getValue(x);
    const yVal: Value = this.getValue(y);
    if (xVal.type === VarType.NUM && yVal.type === VarType.NUM) {
      let val: Value = new Value(VarType.NUM, <number>xVal.value << <number>yVal.value);
      return Evaluator.RpnVal(val);
    }
    this.throwError(`Cannot perform shift left and on ${this.stringify(xVal)} and ${this.stringify(yVal)}`);
    return Evaluator.RpnVal(new Value(VarType.UNKNOWN));
  }

  private shiftRight(x: RpnElement, y: RpnElement): RpnElement {
    const xVal: Value = this.getValue(x);
    const yVal: Value = this.getValue(y);
    if (xVal.type === VarType.NUM && yVal.type === VarType.NUM) {
      let val: Value = new Value(VarType.NUM, <number>xVal.value >> <number>yVal.value);
      return Evaluator.RpnVal(val);
    }
    this.throwError(`Cannot perform bitwise shift right on ${this.stringify(xVal)} and ${this.stringify(yVal)}`);
    return Evaluator.RpnVal(new Value(VarType.UNKNOWN));
  }

  private bitwiseXor(x: RpnElement, y: RpnElement): RpnElement {
    const xVal: Value = this.getValue(x);
    const yVal: Value = this.getValue(y);
    if (xVal.type === VarType.ARR && yVal.type === VarType.ARR) {
      if (xVal.arrayType === yVal.arrayType) {
        let xValCpy: Value = Evaluator.makeCopy(xVal);
        xValCpy.arrayValues.push(...Evaluator.makeCopy(yVal).arrayValues);
        return Evaluator.RpnVal(xValCpy);
      } else {
        this.throwError(`Cannot concatenate arrays of type ${xVal.arrayType} and ${yVal.arrayType}`);
      }
    }
    if (xVal.type === VarType.NUM && yVal.type === VarType.NUM) {
      let val: Value = new Value(VarType.NUM, <number>xVal.value ^ <number>yVal.value);
      return Evaluator.RpnVal(val);
    }
    this.throwError(`Cannot perform bitwise xor on ${this.stringify(xVal)} and ${this.stringify(yVal)}`);
    return Evaluator.RpnVal(new Value(VarType.UNKNOWN));
  }

  private logicalAnd(x: RpnElement, y: RpnElement): RpnElement {
    const xVal: Value = this.getValue(x);
    const yVal: Value = this.getValue(y);
    if (xVal.type === VarType.BOOL && yVal.type === VarType.BOOL) {
      let val: Value = new Value(VarType.BOOL, xVal.value && yVal.value);
      return Evaluator.RpnVal(val);
    }
    this.throwError(`Cannot perform logical and on ${this.stringify(xVal)} and ${this.stringify(yVal)}`);
    return Evaluator.RpnVal(new Value(VarType.UNKNOWN));
  }

  private logicalOr(x: RpnElement, y: RpnElement): RpnElement {
    const xVal: Value = this.getValue(x);
    const yVal: Value = this.getValue(y);
    if (xVal.type === VarType.BOOL && yVal.type === VarType.BOOL) {
      let val: Value = new Value(VarType.BOOL, xVal.value || yVal.value);
      return Evaluator.RpnVal(val);
    }
    this.throwError(`Cannot perform logical or on ${this.stringify(xVal)} and ${this.stringify(yVal)}`);
    return Evaluator.RpnVal(new Value(VarType.UNKNOWN));
  }

  private assign(x: RpnElement, y: RpnElement): RpnElement {
    if (!x.value.isLvalue()) {
      this.throwError('Cannot assign to an rvalue');
    }
    let _var: VariablePtr = this.getReferenceByName(x.value.referenceName);
    if (_var === null) {
      this.throwError(`${x.value.referenceName} is not defined`);
    }
    if (_var!.constant) {
      this.throwError(`Cannot reassign a constant variable (${x.value.referenceName})`);
    }
    let xValue: Value = this.getValue(x);
    const yValue: Value = this.getValue(y);
    if (xValue.type === VarType.UNKNOWN) {
      this.throwError(`${xValue.referenceName} doesn't point to anything on the heap`);
    }
    if (xValue.type !== yValue.type) {
      this.throwError(`Cannot assign ${this.stringify(yValue)} to ${x.value.referenceName}`);
    }
    return Evaluator.RpnVal(Object.assign(xValue, Evaluator.makeCopy(yValue)));
  }

  private plusAssign(x: RpnElement, y: RpnElement): RpnElement {
    return this.assign(x, this.performAddition(x, y));
  }

  private minusAssign(x: RpnElement, y: RpnElement): RpnElement {
    return this.assign(x, this.performSubtraction(x, y));
  }

  private mulAssign(x: RpnElement, y: RpnElement): RpnElement {
    return this.assign(x, this.performMultiplication(x, y));
  }

  private divAssign(x: RpnElement, y: RpnElement): RpnElement {
    return this.assign(x, this.performDivision(x, y));
  }

  private modAssign(x: RpnElement, y: RpnElement): RpnElement {
    return this.assign(x, this.performModulo(x, y));
  }

  private lshiftAssign(x: RpnElement, y: RpnElement): RpnElement {
    return this.assign(x, this.shiftLeft(x, y));
  }

  private rshiftAssign(x: RpnElement, y: RpnElement): RpnElement {
    return this.assign(x, this.shiftRight(x, y));
  }

  private andAssign(x: RpnElement, y: RpnElement): RpnElement {
    return this.assign(x, this.bitwiseAnd(x, y));
  }

  private orAssign(x: RpnElement, y: RpnElement): RpnElement {
    return this.assign(x, this.bitwiseOr(x, y));
  }

  private xorAssign(x: RpnElement, y: RpnElement): RpnElement {
    return this.assign(x, this.bitwiseXor(x, y));
  }

  private accessMember(x: RpnElement, y: RpnElement): RpnElement {
    if (!y.value.isLvalue()) {
      this.throwError('Object members can only be accessed with lvalues');
    }
    let obj: Value = this.getValue(x);
    if (obj.type !== VarType.OBJ) {
      this.throwError(`${this.stringify(obj)} is not an object`);
    }
    if (!(y.value.referenceName in obj.memberValues)) {
      const objectName: string = x.value.isLvalue() ? ` ${x.value.referenceName} ` : ' ';
      this.throwError(`Object${objectName}has no member named ${y.value.referenceName}`);
    }
    const val: Value = obj.memberValues[y.value.referenceName];
    if (val.type === VarType.FUNC) {
      val.funcName = y.value.referenceName;
    }
    return Evaluator.RpnVal(val);
  } 

  private accessIndex(arr: RpnElement, idx: RpnElement): RpnElement {
    let array: Value = this.getValue(arr);
    if (array.type !== VarType.ARR) {
      this.throwError(`${this.stringify(array)} is not an array`);
    }
    const index: Value = this.evaluateExpression(idx.op.indexRpn);
    if (!index.isInteger()) {
      this.throwError(`Index expected to be an integer, but ${this.stringify(index)} found`);
    }
    if (<number>index.value < 0 || <number>index.value >= array.arrayValues.length) {
      this.throwError(`index [${index.value}] out of range`);
    }
    let res: Value = array.arrayValues[<number>index.value];
    return Evaluator.RpnVal(res);
  }

  private compareEq(x: RpnElement, y: RpnElement): RpnElement {
    const xVal: Value = this.getValue(x);
    const yVal: Value = this.getValue(y);
    if ((xVal.type === VarType.NUM && yVal.type === VarType.NUM) ||
        (xVal.type === VarType.STR && yVal.type === VarType.STR) ||
        (xVal.type === VarType.BOOL && yVal.type === VarType.BOOL)) {
      let val: Value = new Value(VarType.BOOL, xVal.value === yVal.value);
      return Evaluator.RpnVal(val);
    }
    this.throwError(`Cannot compare ${this.stringify(xVal)} to ${this.stringify(yVal)}`);
    return Evaluator.RpnVal(new Value(VarType.UNKNOWN));
  }

  private compareNeq(x: RpnElement, y: RpnElement): RpnElement {
    const el: RpnElement = this.compareEq(x, y);
    el.value.value = !el.value.value;
    return el;
  }

  private compareGt(x: RpnElement, y: RpnElement): RpnElement {
    const xVal: Value = this.getValue(x);
    const yVal: Value = this.getValue(y);
    if (xVal.type === VarType.NUM && yVal.type === VarType.NUM) {
      let val: Value = new Value(VarType.BOOL, <number>xVal.value > <number>yVal.value);
      return Evaluator.RpnVal(val);
    }
    this.throwError(`Cannot compare ${this.stringify(xVal)} to ${this.stringify(yVal)}`);
    return Evaluator.RpnVal(new Value(VarType.UNKNOWN));
  }

  private compareLt(x: RpnElement, y: RpnElement): RpnElement {
    return this.compareGt(y, x);
  }

  private compareGtEq(x: RpnElement, y: RpnElement): RpnElement {
    const gt: RpnElement = this.compareGt(x, y);
    const eq: RpnElement = this.compareEq(x, y);
    const val: Value = new Value(VarType.BOOL, gt.value.value || eq.value.value);
    return Evaluator.RpnVal(val);
  }

  private compareLtEq(x: RpnElement, y: RpnElement): RpnElement {
    return this.compareGtEq(y, x);
  }

  private registerClass(_class: ClassStatement): void {
    const v: VariablePtr = this.getReferenceByName(_class.className);
    if (v !== null) {
      delete this.stack[_class.className];
    }
    let _var: VariablePtr = (this.stack[_class.className] = new Variable());
    _var.type = 'class';
    _var.val.type = VarType.CLASS;
    _var.val.members = _class.members;
    _var.val.className = _class.className;
  }

  private declareVariable(declaration: Node): void {
    const decl: Declaration = declaration.obj as Declaration;
    const varVal: Value = this.evaluateExpression(decl.varExpression, decl.isReference);
    const varType: VarType = Utils.varLUT[decl.varType];
    let exprType: VarType = varVal.type;
    if (decl.isReference) {
      exprType = this.getHeapVal(varVal.heapRef).type;
    }
    if (varType !== exprType) {
      this.throwError(`Cannot assign ${this.stringify(varVal)} to a variable of type ${decl.varType}`);
    }
    const v: VariablePtr = this.getReferenceByName(decl.id);
    if (v === null) {
      delete this.stack[decl.id];
    }
    if (decl.isAllocated) {
      const chunkRef: number = this.VM.allocate(varVal).heapRef;
      let _var: VariablePtr = (this.stack[decl.id] = new Variable());
      _var.val.heapRef = chunkRef;
      _var.type = decl.varType;
      _var.constant = decl.isConstant;
      if (varVal.type === VarType.OBJ) {
        this.VM.globals.bind.execute([_var.val], this);
      }
      this.VM.checkChunks();
      return;
    }
    let _var: VariablePtr = (this.stack[decl.id] = new Variable());
    _var.type = decl.varType;
    _var.val = varVal;
    _var.constant = decl.isConstant;
  }

  private constructObject(call: RpnElement, _class: RpnElement): RpnElement {
    let val: Value = new Value(VarType.OBJ);
    const classVal: Value = this.getValue(_class);
    let argsCounter: number = 0;
    for (const arg of call.op.funcCall) {
      if (arg.length !== 0) {
        argsCounter++;
      } else {
        this.throwError('Illegal class invocation, missing members');
      }
    }
    const membersCount: number = classVal.members.length;
    if (argsCounter !== membersCount) {
      this.throwError(`${_class.value.referenceName} has ${membersCount} members, ${argsCounter} given`);
    }
    val.className = _class.value.referenceName;
    let i: number = 0;
    for (const nodeList of call.op.funcCall) {
      const member: FuncParam = classVal.members[i];
      const argVal: Value = this.evaluateExpression(nodeList, member.isRef);
      let realVal: Value = argVal;
      let argType: VarType = argVal.type;
      if (argVal.heapRef !== -1) {
        realVal = this.getHeapVal(argVal.heapRef);
        argType = realVal.type;
      }
      if (member.isRef && argVal.heapRef === -1) {
        this.throwError(`Object argument ${i + 1} expected to be a reference, but value given`);
      }
      if (argType !== Utils.varLUT[member.typeName]) {
        this.throwError(`Argument ${i + 1} expected to be ${member.typeName}, but ${this.stringify(realVal)} given`);
      }
      argVal.memberName = member.paramName;
      val.memberValues[member.paramName] = argVal;
      i++;
    }
    return Evaluator.RpnVal(val);
  }

  private executeFunction(fn: RpnElement, call: RpnElement): RpnElement {
    const isGlobal = fn.value.referenceName in this.VM.globals;
    if (fn.value.isLvalue() && isGlobal) {
      let callArgs: Value[] = [];
      const needsRef: boolean = ['bind', 'same_ref'].includes(fn.value.referenceName);
      for (const nodeList of call.op.funcCall) {
        if (nodeList.length === 0) break;
        callArgs.push(this.evaluateExpression(nodeList, needsRef));
      }
      this.VM.trace.push(fn.value.referenceName, this.currentLine, this.currentSource);
      const returnVal: Value = this.VM.globals[fn.value.referenceName].execute(callArgs, this);
      this.VM.trace.pop();
      return Evaluator.RpnVal(returnVal);
    }
    let fnValue: Value = this.getValue(fn);
    if (fnValue.type === VarType.CLASS) {
      return this.constructObject(call, fn);
    }
    if (fnValue.type === VarType.STR) {
      let args: number = 0;
      for (const arg of call.op.funcCall) {
        if (arg.length !== 0) {
          args++;
        } else if (args !== 0) {
          this.throwError('Illegal string interpolation, missing arguments');
        }
      }
      let str: Value = Evaluator.makeCopy(fnValue);
      if (args == 0) return Evaluator.RpnVal(str);
      let argn: number = 1;
      for (const arg of call.op.funcCall) {
        const argVal: Value = this.evaluateExpression(arg);
        const find: string = '@' + argn;
        str.value = (<string>str.value).replace(new RegExp(find, 'g'), this.VM.stringify(argVal));
        argn++;
      }
      return Evaluator.RpnVal(str);
    }
    if (fnValue.type !== VarType.FUNC) {
      this.throwError(`${this.stringify(fnValue)} is not a function or a string`);
    }
    if (fnValue.func!.instructions.length === 0) {
      return Evaluator.RpnVal(new Value(VarType.UNKNOWN));
    }
    let argsCounter: number = 0;
    for (const arg of call.op.funcCall) {
      if (arg.length !== 0) {
        argsCounter++;
      } else if (argsCounter !== 0) {
        this.throwError('Illegal function invocation, missing arguments');
      }
    }
    if (argsCounter !== fnValue.func!.params.length) {
      this.throwError(`${this.stringify(fnValue)} expects ${fnValue.func!.params.length}, but ${argsCounter} given`);
    }
    let funcEvaluator: Evaluator = new Evaluator(fnValue.func!.instructions[0], this.VM);
    funcEvaluator.insideFunc = true;
    funcEvaluator.returnsRef = fnValue.func!.retRef;

    if (fnValue.func!.params.length !== 0) {
      let i: number = 0;
      for (const nodeList of call.op.funcCall) {
        const fnParam: FuncParam = fnValue.func!.params[i];
        const argVal: Value = this.evaluateExpression(nodeList, fnParam.isRef);
        if (fnParam.isRef && argVal.heapRef === -1) {
          this.throwError(`Argument ${i + 1} expected to be a reference, but value given`);
        }
        let argType: VarType = argVal.type;
        const expectedType = Utils.varLUT[fnParam.typeName];
        if (argType !== expectedType) {
          let realVal: Value = Evaluator.makeCopy(argVal);
          if (argVal.heapRef !== -1) {
            realVal = this.getHeapVal(argVal.heapRef);
            argType = realVal.type;
          }
          if (argType !== expectedType) {
            this.throwError(`Argument ${i + 1} expected to be ${fnParam.typeName}, but ${this.stringify(realVal)} given`);
          }
        }
        let _var: VariablePtr = (funcEvaluator.stack[fnParam.paramName] = new Variable());
        _var.type = fnParam.typeName;
        _var.val = argVal;
        i++;
      }
    }
    if (fn.value.isLvalue()) {
      funcEvaluator.stack[fn.value.referenceName] = this.stack[fn.value.referenceName];
    }
    if (fnValue.thisRef !== -1) {
      let _var: VariablePtr = (funcEvaluator.stack['this'] = new Variable());
      _var.type = 'obj';
      _var.val.heapRef = fnValue.thisRef;
    }
    if (fnValue.func!.capturess) {
      Object.keys(this.stack).forEach((key: string) => {
        if (key === 'this') return;
        if (fn.value.isLvalue() && key === fn.value.referenceName) return;
        let contains: boolean = false;
        for (const p of fnValue.func!.params) {
          if (p.paramName === key) {
            contains = true;
            break;
          }
        }
        if (contains) return;
        funcEvaluator.stack[key] = this.stack[key];
      });
    }
    const fnName: string = fn.value.isLvalue() ? fn.value.referenceName : fnValue.funcName;
    this.VM.trace.push(fnName, this.currentLine, this.currentSource);
    this.VM.activeEvaluators.push(funcEvaluator);
    funcEvaluator.start();
    this.VM.activeEvaluators.pop();
    if (fnValue.func!.retRef) {
      if (funcEvaluator.returnValue!.heapRef === -1) {
        this.throwError(`function returns a reference, but ${this.stringify(funcEvaluator.returnValue!)} was returned`);
        return Evaluator.RpnVal(new Value(VarType.UNKNOWN));
      }
      const heapVal: Value = this.getHeapVal(funcEvaluator.returnValue!.heapRef);
      if (heapVal.type !== Utils.varLUT[fnValue.func!.retType]) {
        this.throwError(`function return type is ref ${fnValue.func!.retType}, but ${this.stringify(funcEvaluator.returnValue!)} was returned`);
        return Evaluator.RpnVal(new Value(VarType.UNKNOWN));
      }
      this.VM.trace.pop();
      return Evaluator.RpnVal(funcEvaluator.returnValue!);
    }
    if (funcEvaluator.returnValue!.type !== Utils.varLUT[fnValue.func!.retType]) {
      this.throwError(`function return type is ${fnValue.func!.retType}, but ${this.stringify(funcEvaluator.returnValue!)} was returned`);
      return Evaluator.RpnVal(new Value(VarType.UNKNOWN));
    }
    this.VM.trace.pop();
    return Evaluator.RpnVal(funcEvaluator.returnValue!);
  }

  public start(): void {
    for (const statement of this.AST.children) {
      const flag: number = this.executeStatement(statement);
      if (flag === Evaluator.FLAG_RETURN) break;
    }
    if (this.returnValue === null) {
      this.returnValue = new Value(VarType.VOID);
    }
  }

  private executeStatement(statement: Node): number {
    const stmt: Statement = statement.obj as Statement;
    this.currentLine = stmt.line;
    this.currentSource = stmt.source;
    if (stmt.type === StmtType.NONE) {
      return Evaluator.FLAG_OK;
    } else if (stmt.type === StmtType.EXPR) {
      if (stmt.expressions.length !== 1) return Evaluator.FLAG_OK;
      this.evaluateExpression(stmt.expressions[0]);
      return Evaluator.FLAG_OK;
    } else if (stmt.type === StmtType.CLASS) {
      this.registerClass(stmt.classStmt!);
      return Evaluator.FLAG_OK;
    } else if (stmt.type === StmtType.SET) {
      if (stmt.expressions.length === 0) return Evaluator.FLAG_OK;
      this.setMember(stmt.objMembers, stmt.expressions[0]);
      return Evaluator.FLAG_OK;
    } else if (stmt.type === StmtType.SET_IDX) {
      this.setIndex(stmt);
      return Evaluator.FLAG_OK;
    } else if (stmt.type === StmtType.DECL) {
      if (stmt.statements.length !== 1) return Evaluator.FLAG_OK;
      this.declareVariable(stmt.statements[0]);
      return Evaluator.FLAG_OK;
    } else if (stmt.type === StmtType.COMPOUND) {
      if (stmt.statements.length === 0) return Evaluator.FLAG_OK;
      for (const s of stmt.statements[0].children) {
        const flag: number = this.executeStatement(s);
        if (flag) return flag;
      }
      return Evaluator.FLAG_OK;
    } else if (stmt.type === StmtType.BREAK) {
      if (!this.nestedLoops) {
        this.throwError('Break statement outside of loops is illegal');
      }
      return Evaluator.FLAG_BREAK;
    } else if (stmt.type === StmtType.CONTINUE) {
      if (!this.nestedLoops) {
        this.throwError('Continue statement outside of loops is illegal');
      }
      return Evaluator.FLAG_CONTINUE;
    } else if (stmt.type === StmtType.RETURN) {
      if (!this.insideFunc) {
        this.throwError('Return statement outside of functions is illegal');
      }
      const returnExpr: Node[] = stmt.expressions[0];
      if (stmt.expressions.length !== 0 && returnExpr.length !== 0) {
        this.returnValue = this.evaluateExpression(returnExpr, this.returnsRef);
      }
      return Evaluator.FLAG_RETURN;
    } else if (stmt.type === StmtType.WHILE) {
      if (stmt.statements.length === 0) return Evaluator.FLAG_OK;
      if (stmt.expressions[0].length === 0) {
        this.throwError('While expects an expression');
      }
      this.nestedLoops++;
      while (true) {
        const result: Value = this.evaluateExpression(stmt.expressions[0]);
        if (result.type !== VarType.BOOL) {
          this.throwError(`Expected a boolean value in while statement, found ${this.stringify(result)}`);
        }
        if (!result.value) break;
        const flag: number = this.executeStatement(stmt.statements[0]);
        if (flag === Evaluator.FLAG_BREAK) break;
        if (flag === Evaluator.FLAG_RETURN) return flag;
      }
      this.nestedLoops--;
      return Evaluator.FLAG_OK;
    } else if (stmt.type === StmtType.FOR) {
      if (stmt.expressions.length !== 3) {
        this.throwError(`For statement expects 3 expressions, ${stmt.expressions.length} given`);
      }
      if (stmt.statements.length === 0) return Evaluator.FLAG_OK;
      if (stmt.expressions[0].length !== 0) {
        this.evaluateExpression(stmt.expressions[0]);
      }
      this.nestedLoops++;
      const cond: Node[] = stmt.expressions[1];
      const autoTrue: boolean = cond.length === 0;
      while (true) {
        if (!autoTrue) {
          // console.log('for evaluates', cond)
          const result: Value = this.evaluateExpression(cond);
          if (result.type !== VarType.BOOL) {
            this.throwError(`Expected a boolean value in while statement, found ${this.stringify(result)}`);
          }
          if (!result.value) break;
        }
        const flag: number = this.executeStatement(stmt.statements[0]);
        if (flag === Evaluator.FLAG_BREAK) break;
        if (flag === Evaluator.FLAG_RETURN) return flag;
        const incrementExpr = stmt.expressions[2];
        if (incrementExpr.length !== 0) {
          this.evaluateExpression(incrementExpr);
        }
      }
      this.nestedLoops--;
      return Evaluator.FLAG_OK;
    } else if (stmt.type === StmtType.IF) {
      if (stmt.statements.length === 0) return Evaluator.FLAG_OK;
      if (stmt.expressions[0].length === 0) {
        this.throwError('If statement expects an expression');
      }
      const result: Value = this.evaluateExpression(stmt.expressions[0]);
      if (result.type !== VarType.BOOL) {
        this.throwError(`Expected a boolean value in if statement, found ${this.stringify(result)}`);
      }
      if (result.value) {
        const flag: number = this.executeStatement(stmt.statements[0]);
        if (flag) return flag;
      } else {
        if (stmt.statements.length === 2) {
          const flag: number = this.executeStatement(stmt.statements[1]);
        if (flag) return flag;
        }
      }
      return Evaluator.FLAG_OK;
    }
    this.throwError(`Unknown statement! (${stmt.type})`);
    return Evaluator.FLAG_ERROR;
  }

  private static RpnOp(type: OperatorType, arg: any): RpnElement {
    return new RpnElement(ElementType.OPERATOR, new Operator(type, arg));
  }

  private static RpnVal(val: Value): RpnElement {
    return new RpnElement(ElementType.VALUE, val);
  }

  private nodeToElement(node: Node): RpnElement {
    const expr = node.obj as Expression;
    if (expr.isOperand()) {
      if (expr.type === ExprType.FUNC_CALL) {
        return Evaluator.RpnOp(OperatorType.FUNC, expr.argsList);
      } else if (expr.type === ExprType.INDEX) {
        return Evaluator.RpnOp(OperatorType.INDEX, expr.nodeExpressions);
      } else {
        return Evaluator.RpnOp(OperatorType.BASIC, expr.op);
      }
    } else if (expr.type === ExprType.BOOL_EXPR) {
      return Evaluator.RpnVal(new Value(VarType.BOOL, expr.literal));
    } else if (expr.type === ExprType.STR_EXPR) {
      return Evaluator.RpnVal(new Value(VarType.STR, expr.literal));
    } else if (expr.type === ExprType.NUM_EXPR) {
      return Evaluator.RpnVal(new Value(VarType.NUM, expr.literal));
    } else if (expr.type === ExprType.IDENTIFIER_EXPR) {
      let res: RpnElement = Evaluator.RpnVal(new Value(VarType.ID));
      res.value.referenceName = <string>expr.literal;
      return res;
    } else if (expr.type === ExprType.FUNC_EXPR) {
      // TODO: Check if this is correct
      let res: RpnElement = Evaluator.RpnVal(new Value(VarType.FUNC));
      res.value.func = expr.funcExpr;
      return res;
    } else if (expr.type === ExprType.ARRAY) {
      let val: Value = new Value(VarType.ARR);
      let initialSize: Value = new Value(VarType.NUM);
      let elementsCount: number = 0;
      if (expr.argsList.length !== 0 && expr.argsList[0].length !== 0) {
        elementsCount = expr.argsList.length;
      }
      initialSize.value = elementsCount;
      if (expr.arraySize.length > 0) {
        if (['func', 'obj', 'arr'].includes(expr.arrayType)) {
          this.throwError(`Array of type ${expr.arrayType} cannot have initial size`);
        }
        initialSize = this.evaluateExpression(expr.arraySize);
        if (!initialSize.isInteger()) {
          this.throwError(`Integer expected, but ${this.stringify(initialSize)} found`);
        }
        if (<number>initialSize.value < 0) {
          this.throwError('Array size cannot be negative');
        }
        if (<number>initialSize.value < elementsCount) {
          initialSize.value = elementsCount;
        }
      }
      val.arrayType = expr.arrayType;
      if (initialSize.value !== 0) {
        val.arrayValues.length = <number>initialSize.value;
        for (let i = 0; i < initialSize.value!; i++) {
          val.arrayValues[i] = new Value(VarType.UNKNOWN);
        }
      }
      const arrType: VarType = Utils.varLUT[expr.arrayType];
      for (let v of val.arrayValues) v.type = arrType;
      let i: number = 0;
      for (const nodeList of expr.argsList) {
        if (nodeList.length === 0) {
          if (i === 0) {
            break;
          } else {
            this.throwError('Empty array element');
          }
        }
        val.arrayValues[i] = this.evaluateExpression(nodeList, expr.arrayHoldsRefs);
        let currEl: Value = val.arrayValues[i];
        if (expr.arrayHoldsRefs && currEl.heapRef === -1) {
          this.throwError('Array holds references, but null or value given');
        }
        if (expr.arrayHoldsRefs) {
          if (arrType !== this.getHeapVal(currEl.heapRef).type) {
            this.throwError(`Cannot add ${this.stringify(currEl)} to an array of ref ${expr.arrayType}s`);
          }
        } else if (currEl.type !== arrType) {
          this.throwError(`Cannot add ${this.stringify(currEl)} to an array of ${expr.arrayType}s`);
        }
        i++;
      }
      return Evaluator.RpnVal(val);
    } else {
      this.throwError('Unidentified expression type!');
    }
    return new RpnElement(ElementType.UNKNOWN);
  }

  private flattenTree(res: RpnStack, expressionTree: Node[]): RpnStack {
    for (const node of expressionTree) {
      const expr = node.obj as Expression;
      const isRpn: boolean = expr.type === ExprType.RPN;
      if (expr.nodeExpressions.length !== 0 && isRpn) {
        // TODO: this if might be wrong
        this.flattenTree(res, expr.nodeExpressions);
      }
      if (!isRpn) {
        res.push(this.nodeToElement(node));
      }
    }
    return res;
  }

  private evaluateExpression(expressionTree: Node[], getRef: boolean = false): Value {
    let rpnStack: RpnStack = this.flattenTree([], expressionTree);
    let resStack: RpnStack = [];
    for (const token of rpnStack) {
      if (token.type === ElementType.OPERATOR) {
        if (token.op.opType === OperatorType.BASIC) {
          if (Utils.opBinary(token.op.type)) {
            if (resStack.length < 2) {
              this.throwError(`Operator ${Token.getName(token.op.type)} expects two operands`);
            }
            const y: RpnElement = resStack.pop()!;
            const x: RpnElement = resStack.pop()!;
            if (token.op.type === TokenType.DOT) {
              resStack.push(this.accessMember(x, y));
            } else if (token.op.type === TokenType.OP_PLUS) {
              resStack.push(this.performAddition(x, y));
            } else if (token.op.type === TokenType.OP_MINUS) {
              resStack.push(this.performSubtraction(x, y));
            } else if (token.op.type === TokenType.OP_MUL) {
              resStack.push(this.performMultiplication(x, y));
            } else if (token.op.type === TokenType.OP_DIV) {
              resStack.push(this.performDivision(x, y));
            } else if (token.op.type === TokenType.OP_MOD) {
              resStack.push(this.performModulo(x, y));
            } else if (token.op.type === TokenType.OP_ASSIGN) {
              resStack.push(this.assign(x, y));
            } else if (token.op.type === TokenType.OP_EQ) {
              resStack.push(this.compareEq(x, y));
            } else if (token.op.type === TokenType.OP_NOT_EQ) {
              resStack.push(this.compareNeq(x, y));
            } else if (token.op.type === TokenType.OP_GT) {
              resStack.push(this.compareGt(x, y));
            } else if (token.op.type === TokenType.OP_LT) {
              resStack.push(this.compareLt(x, y));
            } else if (token.op.type === TokenType.OP_GT_EQ) {
              resStack.push(this.compareGtEq(x, y));
            } else if (token.op.type === TokenType.OP_LT_EQ) {
              resStack.push(this.compareLtEq(x, y));
            } else if (token.op.type === TokenType.PLUS_ASSIGN) {
              resStack.push(this.plusAssign(x, y));
            } else if (token.op.type === TokenType.MINUS_ASSIGN) {
              resStack.push(this.minusAssign(x, y));
            } else if (token.op.type === TokenType.MUL_ASSIGN) {
              resStack.push(this.mulAssign(x, y));
            } else if (token.op.type === TokenType.DIV_ASSIGN) {
              resStack.push(this.divAssign(x, y));
            } else if (token.op.type === TokenType.OP_OR) {
              resStack.push(this.logicalOr(x, y));
            } else if (token.op.type === TokenType.OP_AND) {
              resStack.push(this.logicalAnd(x, y));
            } else if (token.op.type === TokenType.LSHIFT) {
              resStack.push(this.shiftLeft(x, y));
            } else if (token.op.type === TokenType.RSHIFT) {
              resStack.push(this.shiftRight(x, y));
            } else if (token.op.type === TokenType.OP_XOR) {
              resStack.push(this.bitwiseXor(x, y));
            } else if (token.op.type === TokenType.OP_AND_BIT) {
              resStack.push(this.bitwiseAnd(x, y));
            } else if (token.op.type === TokenType.OP_OR_BIT) {
              resStack.push(this.bitwiseOr(x, y));
            } else if (token.op.type === TokenType.RSHIFT_ASSIGN) {
              resStack.push(this.rshiftAssign(x, y));
            } else if (token.op.type === TokenType.LSHIFT_ASSIGN) {
              resStack.push(this.lshiftAssign(x, y));
            } else if (token.op.type === TokenType.AND_ASSIGN) {
              resStack.push(this.andAssign(x, y));
            } else if (token.op.type === TokenType.OR_ASSIGN) {
              resStack.push(this.orAssign(x, y));
            } else if (token.op.type === TokenType.XOR_ASSIGN) {
              resStack.push(this.xorAssign(x, y));
            } else if (token.op.type === TokenType.MOD_ASSIGN) {
              resStack.push(this.modAssign(x, y));
            } else {
              this.throwError(`Unknown binary operator ${Token.getName(token.op.type)}`);
            }
          } else if (Utils.opUnary(token.op.type)) {
            if (resStack.length < 1) {
              this.throwError(`Operator ${Token.getName(token.op.type)} expects one operand`);
            }
            const x: RpnElement = resStack.pop()!;
            if (token.op.type === TokenType.OP_NOT) {
              resStack.push(this.logicalNot(x));
            } else if (token.op.type === TokenType.OP_NEG) {
              resStack.push(this.bitwiseNot(x));
            } else {
              this.throwError(`Uknkown unary operator ${Token.getName(token.op.type)}`);
            }
          }
        } else if (token.op.opType === OperatorType.FUNC) {
          const fn: RpnElement = resStack.pop()!;
          resStack.push(this.executeFunction(fn, token));
        } else if (token.op.opType === OperatorType.INDEX) {
          const arr: RpnElement = resStack.pop()!;
          resStack.push(this.accessIndex(arr, token));
        }
      } else {
        resStack.push(token);
      }
    }
    let resVal: Value = resStack[0].value;
    if (getRef) {
      if (resVal.isLvalue()) {
        let _var: VariablePtr = this.getReferenceByName(resVal.referenceName);
        if (_var === null) {
          this.throwError(`'${resVal.referenceName}' is not defined`);
        }
        if (_var!.val.heapRef !== -1) {
          return _var!.val;
        } else {
          this.throwError('Expression expected to be a reference');
        }
      } else if (resVal.heapRef !== -1) {
        return resVal;
      } else {
        this.throwError('Expression expected to be a reference');
      }
    }
    if (resVal.isLvalue() || resVal.heapRef > -1) {
      return this.getValue(Evaluator.RpnVal(resVal));
    }
    return resVal;
  }
}