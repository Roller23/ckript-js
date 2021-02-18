"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Interpreter = void 0;
const evaluator_1 = require("./evaluator");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const token_1 = require("./token");
const utils_1 = require("./utils");
const vm_1 = require("./vm");
class Interpreter {
    processFile(filename, args = []) {
        const [tokens, err] = new lexer_1.Lexer().processFile(filename);
        if (err) {
            console.log(`Couldn't open file ${filename}`);
            process.exit(1);
        }
        const [AST] = new parser_1.Parser(tokens, token_1.TokenType.NONE).parse();
        const evaluator = new evaluator_1.Evaluator(AST, new vm_1.CVM());
        const val = (evaluator.stack.argv = new vm_1.Variable()).val;
        val.arrayType = 'str';
        val.type = utils_1.VarType.ARR;
        for (let i = 0; i < args.length; i++) {
            val.arrayValues.push(new vm_1.Value(utils_1.VarType.STR, args[i]));
        }
        evaluator.VM.activeEvaluators.push(evaluator);
        evaluator.start();
        evaluator.VM.activeEvaluators.pop();
    }
}
exports.Interpreter = Interpreter;
