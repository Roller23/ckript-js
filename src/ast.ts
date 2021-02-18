import {TokenType} from './token'

export enum NodeType {
  EXPR, STMT, DECL, UNKNOWN
}

export enum DeclType {
  VAR_DECL, NONE
}

export enum StmtType {
  IF, RETURN, WHILE, FOR, COMPOUND, EXPR, UNKNOWN, NOP, DECL, CLASS,
  BREAK, CONTINUE, SET, SET_IDX, NONE
}

export enum ExprType {
  BINARY_OP, UNARY_OP, FUNC_CALL, FUNC_EXPR, NUM_EXPR, STR_EXPR,
  IDENTIFIER_EXPR, BOOL_EXPR, NOP, RPN, LPAREN, RPAREN, INDEX, ARRAY, NONE
}

export type LiteralValue = number | string | boolean | undefined;

export class Expression {
  public nodeType: NodeType = NodeType.EXPR;
  public type: ExprType = ExprType.NONE;
  public literal: LiteralValue = undefined;
  public funcExpr: FuncExpression | null = null;
  public arrayType: string = '';
  public arrayHoldsRefs: boolean = false;
  public nodeExpressions: Node[] = [];
  public argsList: Node[][] = [];
  public arraySize: Node[] = [];
  public op: TokenType = TokenType.NONE;
  public isOperand(): boolean {
    return this.type === ExprType.BINARY_OP || this.type === ExprType.UNARY_OP ||
           this.type === ExprType.FUNC_CALL || this.type === ExprType.INDEX;
  }
  public isParen(): boolean {
    return this.type === ExprType.LPAREN || this.type === ExprType.RPAREN;
  }
  public isEvaluable(): boolean {
    return !this.isOperand() && !this.isParen();
  }
  public constructor(type: ExprType, arg?: any) {
    this.type = type;
    if (this.type === ExprType.UNARY_OP || this.type === ExprType.BINARY_OP) {
      this.op = arg;
    } else if (this.type === ExprType.RPN) {
      this.nodeExpressions = arg;
    } else if (this.type === ExprType.INDEX) {
      this.op = TokenType.LEFT_BRACKET;
      this.nodeExpressions = arg;
    } else if (this.type === ExprType.BOOL_EXPR) {
      this.literal = arg;
    } else if (this.type === ExprType.FUNC_EXPR) {
      this.funcExpr = arg;
    } else if (this.type === ExprType.FUNC_CALL) {
      this.argsList = arg;
    } else if (this.type === ExprType.STR_EXPR) {
      this.literal = arg;
    } else if (this.type === ExprType.IDENTIFIER_EXPR) {
      this.literal = arg;
    } else if (this.type === ExprType.NUM_EXPR) {
      this.literal = arg;
    }
  }
}

export class FuncExpression {
  public params: FuncParam[] = [];
  public retType: string = 'void';
  public retRef: boolean = false;
  public capturess: boolean = false;
  public instructions: Node[] = [];
}

export class FuncParam {
  public typeName: string = 'num';
  public paramName: string = '';
  public isRef: boolean = false;
  public constructor(type: string, name: string) {
    this.typeName = type;
    this.paramName = name;
  }
}

export class ClassStatement {
  public className: string = '';
  public members: FuncParam[] = [];
}

export class Statement {
  public nodeType: NodeType = NodeType.STMT;
  public type: StmtType = StmtType.NONE;
  public expressions: Node[][] = [];
  public statements: Node[] = [];
  public indexes: Node[] = [];
  public classStmt: ClassStatement | null;
  public objMembers: string[] = [];
  public line: number = 0;
  public source: string = '';

  public constructor(arg: StmtType | ClassStatement) {
    if (arg instanceof ClassStatement) {
      this.type = StmtType.CLASS;
      this.classStmt = arg;
    } else {
      this.type = arg;
      this.classStmt = null;
    }
  }
}

export class Declaration {
  public nodeType: NodeType = NodeType.DECL;
  public type: DeclType = DeclType.NONE;
  public varType: string = '';
  public id: string = '';
  public isConstant: boolean = false;
  public isAllocated: boolean = false;
  public isReference: boolean = false;
  public varExpression: Node[] = [];
  public constructor(type: DeclType) {
    this.type = type;
  }
}

export type NodeObj = Expression | Statement | Declaration | null;

export class Node {
  public type: NodeType = NodeType.UNKNOWN;
  public obj: NodeObj;
  public children: Node[] = [];
  public constructor(obj: NodeObj) {
    this.obj = obj;
    if (this.obj !== null) {
      this.type = this.obj.nodeType;
    }
  }
  public addChildren(children: Node[]): void {
    this.children.push(...children);
  }

  public toStmt(): Statement {
    return <Statement>this.obj
  }

  public toExpr(): Expression {
    return <Expression>this.obj
  }

  public toDecl(): Declaration {
    return <Declaration>this.obj
  }

}