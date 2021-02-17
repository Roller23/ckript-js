import { Interpreter } from "./interpreter";

function main(argv: string[]): number {
  if (argv.length === 0) {
    console.log('No input files');
    return 1;
  }
  new Interpreter().processFile(argv[0], argv.slice(1));
  return 0;
}

process.exitCode = main(process.argv.slice(2));