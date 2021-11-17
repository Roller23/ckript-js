import { Expression, ExprType, Node } from "./ast";
import { TokenType } from "./token";

export enum VarType {
  NUM, STR, ARR, OBJ, BOOL, FUNC, REF, ID, VOID, CLASS, UNKNOWN
}

export class Utils {

  public static varLUT: {[key: string]: VarType} = {
    num: VarType.NUM,
    str: VarType.STR,
    arr: VarType.ARR,
    obj: VarType.OBJ,
    bool: VarType.BOOL,
    func: VarType.FUNC,
    class: VarType.CLASS,
    void: VarType.VOID
  };

  public static opPrecedence: {[key: number]: number} = {
    [TokenType.AND_ASSIGN]: 1, // &=
    [TokenType.OR_ASSIGN]: 1, // |=
    [TokenType.XOR_ASSIGN]: 1, // ^=
    [TokenType.OP_ASSIGN]: 1, // =
    [TokenType.PLUS_ASSIGN]: 1, // +=
    [TokenType.MINUS_ASSIGN]: 1, // -=
    [TokenType.MUL_ASSIGN]: 1, // *=
    [TokenType.DIV_ASSIGN]: 1, // /=
    [TokenType.MOD_ASSIGN]: 1, // %=
    [TokenType.LSHIFT_ASSIGN]: 1, // <<=
    [TokenType.RSHIFT_ASSIGN ]: 1, // >>=
    [TokenType.OP_OR]: 2, // ||
    [TokenType.OP_AND]: 3, // &&
    [TokenType.OP_OR_BIT]: 4, // |
    [TokenType.OP_XOR]: 5, // ^
    [TokenType.OP_AND_BIT]: 6, // &
    [TokenType.OP_NOT_EQ]: 7, // !=
    [TokenType.OP_EQ]: 7, // ==
    [TokenType.OP_GT]: 8, // >
    [TokenType.OP_LT]: 8, // <
    [TokenType.OP_GT_EQ]: 8, // >=
    [TokenType.OP_LT_EQ]: 8, // <=
    [TokenType.LSHIFT]: 9, // <<
    [TokenType.RSHIFT]: 9, // >>
    [TokenType.OP_PLUS]: 10, // +
    [TokenType.OP_MINUS]: 10, // -
    [TokenType.OP_MUL]: 11, // *
    [TokenType.OP_DIV]: 11, // /
    [TokenType.OP_MOD]: 11, // %
    [TokenType.DOT]: 13, // .
    [TokenType.LEFT_BRACKET]: 13 // []
  };

  public static hasKey(key: TokenType): boolean {
    return key in Utils.opPrecedence;
  }

  public static opUnary(token: TokenType): boolean {
    return token === TokenType.OP_NOT || token === TokenType.OP_NEG;
  }

  public static opBinary(token: TokenType): boolean {
    return Utils.hasKey(token) && !Utils.opUnary(token);
  }

  public static getPrecedence(e: Expression): number {
    if (e.type === ExprType.FUNC_CALL || e.type === ExprType.INDEX) {
      return 13;
    }
    if (Utils.opUnary(e.op)) return 12;
    return Utils.opPrecedence[e.op];
  }

  public static isRightAssoc(n: Node): boolean {
    let precedence: number = Utils.getPrecedence(n.toExpr());
    return precedence === 12 || precedence === 1;
  }

}