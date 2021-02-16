import { Evaluator } from "./evaluator";
import { Lexer } from "./lexer";
import { Parser } from "./parser";
import { TokenType } from "./token";
import { VarType } from "./utils";
import { CVM, Value, Variable } from "./vm";

export class Interpreter {

  public processFile(filename: string, args: string[] = []): void {
    const [tokens, err] = new Lexer().processFile(filename);
    if (err) {
      console.log(`Couldn't open file ${filename}`);
      process.exit(1);
    }
    const [AST] = new Parser(tokens, TokenType.NONE).parse();
    const evaluator: Evaluator = new Evaluator(AST, new CVM());
    const val: Value = (evaluator.stack.argv = new Variable()).val;
    val.arrayType = 'str';
    val.type = VarType.ARR;
    for (let i = 0; i < args.length; i++) {
      val.arrayValues.push(new Value(VarType.STR, args[i]));
    }
    evaluator.start();
  }
}

function main(argv: string[]): number {
  if (argv.length === 0) {
    console.log('No input files');
    return 1;
  }
  new Interpreter().processFile(argv[0], argv.slice(1));
  return 0;
}

process.exitCode = main(process.argv.slice(2));