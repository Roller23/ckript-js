import { ExprType, Node, Statement, StmtType } from "./ast";
import { TokenType } from "./token";
import { VarType } from "./utils";
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
  constructor(AST: Node, VM: CVM) {
    this.VM = VM;
    this.AST = AST;
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

  private static RpnOp(type: OperatorType, arg: any) {
    return new RpnElement(ElementType.OPERATOR, new Operator(type, arg));
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
    } else {
      // TODO
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
    
    return new Value(VarType.UNKNOWN);
  }

  private insideFunc: boolean = false;
  private returnsRef: boolean = false;
  private nestedLoops: number = 0;
  private currentLine: number = 0;
  private currentSource: string = '';
  private returnValue: Value | null = null;
}