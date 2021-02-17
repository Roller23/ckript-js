"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const interpreter_1 = require("./interpreter");
function main(argv) {
    if (argv.length === 0) {
        console.log('No input files');
        return 1;
    }
    new interpreter_1.Interpreter().processFile(argv[0], argv.slice(1));
    return 0;
}
process.exitCode = main(process.argv.slice(2));
