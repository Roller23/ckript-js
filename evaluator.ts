import { ExprType, Node, Statement, StmtType } from "./ast";
import { ErrorHandler } from "./error-handler";
import { Token, TokenType } from "./token";
import { Utils, VarType } from "./utils";
import { Call, CVM, Value, Variable } from "./vm";

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
type CallStack = {[key: string]: VariablePtr};

export class Evaluator {
  public static FLAG_OK: number = 0;
  public static FLAG_BREAK: number = 1;
  public static FLAG_CONTINUE: number = 2;
  public static FLAG_RETURN: number = 3;
  public static FLAG_ERROR: number = 4;
  public VM: CVM;
  public AST: Node;
  public stack: CallStack = {};
  constructor(AST: Node, VM: CVM) {
    this.VM = VM;
    this.AST = AST;
  }

  private throwError(cause: string) {
    ErrorHandler.throwError(`Runtime error: ${cause} on ${this.currentLine} in file ${this.currentSource}`);
  }

  private getHeapVal(ref: number): Value {
    // TODO
    return new Value(VarType.UNKNOWN);
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
      if (_var!.val.heapRef) {
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
    } else if (val.type === VarType.FLOAT || val.type === VarType.INT) {
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
    const stmt: Statement = statement.toStmt();
    this.currentLine = stmt.line;
    this.currentSource = stmt.source;
    if (stmt.type === StmtType.NONE) {
      return Evaluator.FLAG_OK;
    } else if (stmt.type === StmtType.EXPR) {
      if (stmt.expressions.length !== 1) return Evaluator.FLAG_OK;
      this.evaluateExpression(stmt.expressions[0]);
      return Evaluator.FLAG_OK;
    }
    return 0;
  }

  private static RpnOp(type: OperatorType, arg: any): RpnElement {
    return new RpnElement(ElementType.OPERATOR, new Operator(type, arg));
  }

  private static RpnVal(val: Value): RpnElement {
    return new RpnElement(ElementType.VALUE, val);
  }

  private nodeToElement(node: Node): RpnElement {
    const expr = node.toExpr();
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
    } else if (expr.type === ExprType.FLOAT_EXPR) {
      return Evaluator.RpnVal(new Value(VarType.FLOAT, expr.literal));
    } else if (expr.type === ExprType.NUM_EXPR) {
      return Evaluator.RpnVal(new Value(VarType.INT, expr.literal));
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
      let initialSize: Value = new Value(VarType.INT);
      let elementsCount: number = 0;
      if (expr.argsList.length !== 0 && expr.argsList[0].length !== 0) {
        elementsCount = expr.argsList.length;
      }
      initialSize.value = elementsCount;
      if (expr.arraySize.length > 0) {
        initialSize = this.evaluateExpression(expr.arraySize);
        if (initialSize.type !== VarType.INT) {
          this.throwError(`Number expected, but ${this.stringify(initialSize)} found`);
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
        // TODO????
        // val.arrayValues.resize????????????????????
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

  private flattenTree(res: RpnStack, expressionTree: Node[]): void {
    for (const node of expressionTree) {
      const expr = node.toExpr();
      if (expr.nodeExpressions.length !== 0) {
        this.flattenTree(res, expr.nodeExpressions);
      }
      if (expr.type !== ExprType.RPN) {
        res.push(this.nodeToElement(node));
      }
    }
  }

  private evaluateExpression(expressionTree: Node[], getRef: boolean = false): Value {
    let rpnStack: RpnStack = [];
    this.flattenTree(rpnStack, expressionTree);
    let resStack: RpnStack = [];
    for (const token of rpnStack) {
      if (token.type === ElementType.OPERATOR) {
        if (token.op.opType === OperatorType.BASIC) {
          if (Utils.opBinary(token.op.type)) {
            if (resStack.length < 2) {
              this.throwError(`Operator ${Token.getName(token.op.type)} expects two operands`);
            }
            const y: RpnElement = <RpnElement>resStack.pop();
            const x: RpnElement = <RpnElement>resStack.pop();
            // TODO
            if (token.op.type === TokenType.DOT) {
              // resStack.push(this.accessMember(x, y));
            }
          } else if (Utils.opUnary(token.op.type)) {

          }
        } else if (token.op.opType === OperatorType.FUNC) {

        } else if (token.op.opType === OperatorType.INDEX) {

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
    return new Value(VarType.UNKNOWN);
  }

  private insideFunc: boolean = false;
  private returnsRef: boolean = false;
  private nestedLoops: number = 0;
  private currentLine: number = 0;
  private currentSource: string = '';
  private returnValue: Value | null = null;
}