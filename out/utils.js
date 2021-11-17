"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Utils = exports.VarType = void 0;
const ast_1 = require("./ast");
const token_1 = require("./token");
var VarType;
(function (VarType) {
    VarType[VarType["NUM"] = 0] = "NUM";
    VarType[VarType["STR"] = 1] = "STR";
    VarType[VarType["ARR"] = 2] = "ARR";
    VarType[VarType["OBJ"] = 3] = "OBJ";
    VarType[VarType["BOOL"] = 4] = "BOOL";
    VarType[VarType["FUNC"] = 5] = "FUNC";
    VarType[VarType["REF"] = 6] = "REF";
    VarType[VarType["ID"] = 7] = "ID";
    VarType[VarType["VOID"] = 8] = "VOID";
    VarType[VarType["CLASS"] = 9] = "CLASS";
    VarType[VarType["UNKNOWN"] = 10] = "UNKNOWN";
})(VarType = exports.VarType || (exports.VarType = {}));
class Utils {
    static hasKey(key) {
        return key in Utils.opPrecedence;
    }
    static opUnary(token) {
        return token === token_1.TokenType.OP_NOT || token === token_1.TokenType.OP_NEG;
    }
    static opBinary(token) {
        return Utils.hasKey(token) && !Utils.opUnary(token);
    }
    static getPrecedence(e) {
        if (e.type === ast_1.ExprType.FUNC_CALL || e.type === ast_1.ExprType.INDEX) {
            return 13;
        }
        if (Utils.opUnary(e.op))
            return 12;
        return Utils.opPrecedence[e.op];
    }
    static isRightAssoc(n) {
        let precedence = Utils.getPrecedence(n.toExpr());
        return precedence === 12 || precedence === 1;
    }
}
exports.Utils = Utils;
Utils.varLUT = {
    num: VarType.NUM,
    str: VarType.STR,
    arr: VarType.ARR,
    obj: VarType.OBJ,
    bool: VarType.BOOL,
    func: VarType.FUNC,
    class: VarType.CLASS,
    void: VarType.VOID
};
Utils.opPrecedence = {
    [token_1.TokenType.AND_ASSIGN]: 1,
    [token_1.TokenType.OR_ASSIGN]: 1,
    [token_1.TokenType.XOR_ASSIGN]: 1,
    [token_1.TokenType.OP_ASSIGN]: 1,
    [token_1.TokenType.PLUS_ASSIGN]: 1,
    [token_1.TokenType.MINUS_ASSIGN]: 1,
    [token_1.TokenType.MUL_ASSIGN]: 1,
    [token_1.TokenType.DIV_ASSIGN]: 1,
    [token_1.TokenType.MOD_ASSIGN]: 1,
    [token_1.TokenType.LSHIFT_ASSIGN]: 1,
    [token_1.TokenType.RSHIFT_ASSIGN]: 1,
    [token_1.TokenType.OP_OR]: 2,
    [token_1.TokenType.OP_AND]: 3,
    [token_1.TokenType.OP_OR_BIT]: 4,
    [token_1.TokenType.OP_XOR]: 5,
    [token_1.TokenType.OP_AND_BIT]: 6,
    [token_1.TokenType.OP_NOT_EQ]: 7,
    [token_1.TokenType.OP_EQ]: 7,
    [token_1.TokenType.OP_GT]: 8,
    [token_1.TokenType.OP_LT]: 8,
    [token_1.TokenType.OP_GT_EQ]: 8,
    [token_1.TokenType.OP_LT_EQ]: 8,
    [token_1.TokenType.LSHIFT]: 9,
    [token_1.TokenType.RSHIFT]: 9,
    [token_1.TokenType.OP_PLUS]: 10,
    [token_1.TokenType.OP_MINUS]: 10,
    [token_1.TokenType.OP_MUL]: 11,
    [token_1.TokenType.OP_DIV]: 11,
    [token_1.TokenType.OP_MOD]: 11,
    [token_1.TokenType.DOT]: 13,
    [token_1.TokenType.LEFT_BRACKET]: 13 // []
};
