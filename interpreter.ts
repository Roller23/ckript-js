import { Evaluator } from "./evaluator";
import { Lexer } from "./lexer";
import { Parser } from "./parser";
import { TokenType } from "./token";
import { VarType } from "./utils";
import { CVM, Variable } from "./vm";

import * as fs from 'fs';

export class Interpreter {
  public processString(str: string, args: string[] = []): void {
    const [AST, _] =  new Parser(new Lexer().tokenize(str), TokenType.NONE).parse();
    console.log(AST);
    const evaluator: Evaluator = new Evaluator(AST, new CVM());
    evaluator.stack.argv = new Variable();
    evaluator.stack.argv.val.arrayType = 'str';
    evaluator.stack.argv.val.type = VarType.ARR;
    for (let i = 0; i < args.length; i++) {
      evaluator.stack.argv.val.arrayValues[i].type = VarType.STR;
      evaluator.stack.argv.val.arrayValues[i].value = args[i];
    }
    evaluator.start();
  }

  public processFile(filename: string, args: string[] = []): void {
    this.processString(fs.readFileSync(filename, {encoding: 'utf-8'}), args);
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

process.exit(main(process.argv.slice(2)));