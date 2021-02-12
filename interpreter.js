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
        evaluator.stack.argv = new vm_1.Variable();
        evaluator.stack.argv.val.arrayType = 'str';
        evaluator.stack.argv.val.type = utils_1.VarType.ARR;
        for (let i = 0; i < args.length; i++) {
            evaluator.stack.argv.val.arrayValues[i].type = utils_1.VarType.STR;
            evaluator.stack.argv.val.arrayValues[i].value = args[i];
        }
        evaluator.start();
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
