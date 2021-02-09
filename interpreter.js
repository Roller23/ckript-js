"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Interpreter = void 0;
const evaluator_1 = require("./evaluator");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const token_1 = require("./token");
const utils_1 = require("./utils");
const vm_1 = require("./vm");
const fs = __importStar(require("fs"));
class Interpreter {
    processString(str, args = []) {
        const [AST, _] = new parser_1.Parser(new lexer_1.Lexer().tokenize(str), token_1.TokenType.NONE).parse();
        console.log(AST);
        const evaluator = new evaluator_1.Evaluator(AST, new vm_1.CVM());
        evaluator.stack.argv = new vm_1.Variable();
        evaluator.stack.argv.val.arrayType = 'str';
        evaluator.stack.argv.val.type = utils_1.VarType.ARR;
        for (let i = 0; i < args.length; i++) {
            evaluator.stack.argv.val.arrayValues[i].type = utils_1.VarType.STR;
            evaluator.stack.argv.val.arrayValues[i].value = args[i];
        }
        evaluator.start();
    }
    processFile(filename, args = []) {
        this.processString(fs.readFileSync(filename, { encoding: 'utf-8' }), args);
    }
}
exports.Interpreter = Interpreter;
function main(argv) {
    if (argv.length === 0) {
        console.log('No input files');
        return 1;
    }
    new Interpreter().processFile(argv[0], argv.slice(1));
    return 0;
}
process.exit(main(process.argv.slice(2)));
