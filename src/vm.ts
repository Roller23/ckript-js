import { VarType } from "./utils"
import { FuncExpression, FuncParam, LiteralValue } from './ast'
import { Evaluator } from "./evaluator";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";

// 3rd party modules from npm
const readlineSync = require('readline-sync');
const fetch = require('sync-fetch');

export class Value {
  public type: VarType = VarType.UNKNOWN;
  public value: LiteralValue = undefined;
  public heapRef: number = -1;
  public thisRef: number = -1;
  public func: FuncExpression | null = null;
  public funcName: string = '';
  public members: FuncParam[] = [];
  public memberValues: {[key: string]: Value} = {};
  public arrayValues: Value[] = [];
  public arrayType: string = 'num';
  public className: string = '';
  public memberName: string = '';
  public referenceName: string = '';

  public isLvalue(): boolean {
    return this.referenceName.length !== 0;
  }

  public isInteger(): boolean {
    return this.type === VarType.NUM && Number.isInteger(this.value);
  }

  constructor(type: VarType, value?: LiteralValue) {
    this.type = type;
    if (value !== undefined) {
      this.value = value;
    }
  }
}

export class Variable {
  public type: string = '';
  public val: Value = new Value(VarType.UNKNOWN);
  public constant: boolean = false;

  public isAllocated(): boolean {
    return this.val.heapRef !== -1;
  }
}

export class Chunk {
  public data: Value;
  public heapRef: number = -1;
  public used: boolean = false;
  public marked: boolean = false;

  constructor (value: Value) {
    this.data = value;
  }
}

export class Cache {
  // might need some optimizations
  public refs: number[] = [];

  public push(ref: number): void {
    this.refs.push(ref);
  }

  public pop(): number {
    const ret: number | undefined = this.refs.pop();
    return ret === undefined ? -1 : ret;
  }
}

export class Heap {
  public chunks: Chunk[] = [];
  public cache: Cache = new Cache();

  public allocate(value: Value): Chunk {
    const index: number = this.cache.pop();
    if (index !== -1) {
      let chunk: Chunk = this.chunks[index];
      chunk.data = value;
      chunk.used = true;
      return chunk;
    }
    let newChunk: Chunk = new Chunk(value);
    this.chunks.push(newChunk);
    newChunk.used = true;
    newChunk.heapRef = this.chunks.length - 1;
    return newChunk;
  }

  public free(ref: number): void {
    let chunk: Chunk = this.chunks[ref];
    chunk.used = false;
    this.cache.push(ref);
  }
}

export class Call {
  public line: number;
  public name: string;
  public source: string;

  constructor(line: number, name: string, source: string) {
    this.line = line;
    this.name = name;
    this.source = source;
  }
}

export class StackTrace {
  public stack: Call[] = [];

  public push(name: string, line: number, source: string) {
    this.stack.push(new Call(line, name, source));
  }

  public pop(): void {
    this.stack.pop();
  }
}

interface NativeFunction {
  execute(args: Value[], ev: Evaluator): Value;
}

export class CVM {
  public heap: Heap = new Heap();
  public trace: StackTrace = new StackTrace();
  public activeEvaluators: Evaluator[] = [];
  public globals: {[key: string]: NativeFunction} = {
    print: new NativePrint(),
    println: new NativePrintln(),
    input: new NativeInput(),
    sizeof: new NativeSizeof(),
    to_str: new NativeTostr(),
    to_num: new NativeTonum(),
    exit: new NativeExit(),
    timestamp: new NativeTimestamp(),
    pow: new NativePow(),
    file_read: new NativeFileread(),
    file_write: new NativeFilewrite(),
    file_exists: new NativeFileexists(),
    file_remove: new NativeFileremove(),
    abs: new NativeAbs(),
    rand: new NativeRand(),
    contains: new NativeContains(),
    split: new NativeSplit(),
    substr: new NativeSubstr(),
    replace: new NativeReplace(),
    replace_all: new NativeReplaceall(),
    to_bytes: new NativeTobytes(),
    from_bytes: new NativeFrombytes(),
    bind: new NativeBind(),
    class_name: new NativeClassname(),
    array_type: new NativeArraytype(),
    stack_trace: new NativeStacktrace(),
    sleep: new NativeSleep(),
    sin: new NativeSin(),
    sinh: new NativeSinh(),
    cos: new NativeCos(),
    cosh: new NativeCosh(),
    tan: new NativeTan(),
    tanh: new NativeTanh(),
    sqrt: new NativeSqrt(),
    log: new NativeLog(),
    log10: new NativeLog10(),
    exp: new NativeExp(),
    floor: new NativeFloor(),
    ceil: new NativeCeil(),
    round: new NativeRound(),
    http: new NativeHttp(),
    same_ref: new NativeSameref()
  };

  private allocatedChunks: number = 0;
  private chunksLimit: number = 5;

  public allocate(value: Value): Chunk {
    const chunk: Chunk = this.heap.allocate(value);
    this.allocatedChunks++;
    return chunk;
  }

  private markChunk(chunk: Chunk): void {
    if (chunk.marked) return;
    chunk.marked = true;
    if (chunk.data.type === VarType.ARR) {
      chunk.data.arrayValues.forEach((arrVal: Value) => {
        if (arrVal.heapRef !== -1) {
          this.markChunk(this.heap.chunks[arrVal.heapRef]);
        }
      });
    } else if (chunk.data.type === VarType.OBJ) {
      Object.values(chunk.data.memberValues).forEach((objVal: Value) => {
        if (objVal.heapRef !== -1) {
          this.markChunk(this.heap.chunks[objVal.heapRef]);
        }
      });
    }
  }

  private markAll(): void {
    for (const ev of this.activeEvaluators) {
      for (const _var of Object.values(ev.stack)) {
        if (_var.isAllocated()) {
          this.markChunk(this.heap.chunks[_var.val.heapRef]);
        } else if (_var.val.type === VarType.ARR) {
          _var.val.arrayValues.forEach((arrVal: Value) => {
            if (arrVal.heapRef !== -1) {
              this.markChunk(this.heap.chunks[arrVal.heapRef]);
            }
          });
        } else if (_var.val.type === VarType.OBJ) {
          Object.values(_var.val.memberValues).forEach((objVal: Value) => {
            if (objVal.heapRef !== -1) {
              this.markChunk(this.heap.chunks[objVal.heapRef]);
            }
          });
        }
      }
    }
  }

  private sweep(): number {
    let swept: number = 0;
    for (const chunk of this.heap.chunks) {
      if (!chunk.used) continue;
      if (!chunk.marked) {
        swept++;
        this.heap.free(chunk.heapRef);
      } else {
        chunk.marked = false;
      }
    }
    return swept;
  }

  private runGC(): number {
    this.markAll();
    return this.sweep();
  }

  public checkChunks(): void {
    if (this.allocatedChunks >= this.chunksLimit) {
      const freedChunks: number = this.runGC();
      this.allocatedChunks -= freedChunks;
      this.chunksLimit = this.allocatedChunks * 2;
    }
  }

  public stringify(val: Value): string {
    if (val.heapRef !== -1) {
      if (val.heapRef >= this.heap.chunks.length) return 'null';
      let ptr: Value = this.heap.chunks[val.heapRef].data;
      return `ref to ${this.stringify(ptr)}`;
    }
    if (val.type === VarType.STR) {
      return <string>val.value;
    } else if (val.type === VarType.NUM) {
      return val.value!.toString();
    } else if (val.type === VarType.FUNC) {
      let str: string = 'function(';
      val.func!.params.forEach((param: FuncParam, i: number) => {
        str += param.typeName;
        if (i !== val.func!.params.length - 1) {
          str += ', ';
        }
      });
      if (val.func!.params.length === 0) {
        str += 'void';
      }
      str += ') ';
      if (val.func!.retRef) {
        str += 'ref '
      }
      str += val.func!.retType;
      return str;
    } else if (val.type === VarType.BOOL) {
      return val.value as boolean ? 'true' : 'false';
    } else if (val.type === VarType.CLASS) {
      return `class ${val.className}`;
    } else if (val.type === VarType.VOID) {
      return 'void';
    } else if (val.type === VarType.UNKNOWN) {
      return 'null';
    } else if (val.type === VarType.ARR) {
      let str: string = `array<${val.arrayType}>(`;
      let i: number = 0;
      val.arrayValues.forEach((el: Value) => {
        if (el.type === VarType.STR) str += '"';
        str += this.stringify(el);
        if (el.type === VarType.STR) str += '"';
        if (i !== val.arrayValues.length - 1) {
          str += ', ';
        }
        i++;
      });
      str += ')';
      return str;
    } else if (val.type === VarType.OBJ) {
      let str: string = `object<${val.className}>(`;
      let i: number = 0;
      const keys: string[] = Object.keys(val.memberValues);
      keys.forEach((key: string) => {
        str += `${key}: `;
        if (val.memberValues[key].type === VarType.STR) str += '"';
        str += this.stringify(val.memberValues[key]);
        if (val.memberValues[key].type === VarType.STR) str += '"';
        if (i !== keys.length - 1) {
          str += ', ';
        }
        i++;
      });
      str += ')';
      return str;
    }
    return '';
  }
}

class NativePrint implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length === 0) {
      ev.throwError('print expects at least one argument (any, any...)');
    }
    let i: number = 0;
    const endIndex: number = args.length - 1;
    for (const arg of args) {
      process.stdout.write(`${ev.VM.stringify(arg)}${i !== endIndex ? ' ' : ''}`);
    }
    return new Value(VarType.VOID);
  }
}

class NativePrintln implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length === 0) {
      ev.throwError('println expects at least one argument (any, any...)');
    }
    let i: number = 0;
    const endIndex: number = args.length - 1;
    for (const arg of args) {
      process.stdout.write(`${ev.VM.stringify(arg)}${i !== endIndex ? ' ' : ''}`);
    }
    process.stdout.write('\n');
    return new Value(VarType.VOID);
  }
}

class NativeInput implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length > 1) {
      ev.throwError(`input takes one optional argument (str)`);
    }
    if (args.length === 1 && args[0].type !== VarType.STR) {
      ev.throwError(`input optional argument must be a string`);
    }
    const question = args.length === 1 && args[0].type === VarType.STR ? args[0].value : '';
    return new Value(VarType.STR, readlineSync.question(question));
  }
}

class NativeSizeof implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1) {
      ev.throwError(`sizeof expects one argument (arr|str)`);
    }
    const arg: Value = args[0];
    if (arg.type === VarType.ARR) {
      return new Value(VarType.NUM, arg.arrayValues.length);
    } else if (arg.type === VarType.STR) {
      return new Value(VarType.NUM, (<string>arg.value).length);
    } else {
      ev.throwError(`Cannot get the size of ${ev.VM.stringify(arg)}`);
    }
    return new Value(VarType.NUM, 0);
  }
}

class NativeTostr implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1) {
      ev.throwError(`to_str expects one argument (any)`);
    }
    return new Value(VarType.STR, ev.VM.stringify(args[0]));
  }
}

class NativeTonum implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1) {
      ev.throwError(`to_int expects one argument (num|str|bool)`);
    }
    const arg: Value = args[0];
    if (arg.type === VarType.NUM) {
      return arg;
    } else if (arg.type === VarType.STR) {
      const converted: number = Number(arg.value);
      if (!Number.isInteger(converted)) {
        ev.throwError(`'${arg.value}' cannot be converted to num`);
      }
      return new Value(VarType.NUM, converted);
    } else if (arg.type === VarType.BOOL) {
      return new Value(VarType.NUM, Number(arg.value));
    }
    ev.throwError(`${ev.VM.stringify(arg)} cannot be converted to num`);
    return new Value(VarType.NUM, 0);
  }
}

class NativeExit implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1 || !args[0].isInteger()) {
      ev.throwError(`exit expects one argument (integer)`);
    }
    process.exit(<number>args[0].value);
  }
}

class NativeTimestamp implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 0) {
      ev.throwError(`timestamp expects no arguments`);
    }
    return new Value(VarType.NUM, Date.now());
  }
}

class NativePow implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 2 || args[0].type !== VarType.NUM || args[1].type !== VarType.NUM) {
      ev.throwError(`pow expects two arguments (num, num)`);
    }
    const arg1: number = <number>args[0].value;
    const arg2: number = <number>args[1].value;
    return new Value(VarType.NUM, Math.pow(arg1, arg2));
  }
}

class NativeFileread implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1 || args[0].type !== VarType.STR) {
      ev.throwError(`file_read expects one argument (str)`);
    }
    const path: string = <string>args[0].value;
    if (!existsSync(path)) {
      ev.throwError(`Couldn't read ${path}`);
    }
    return new Value(VarType.STR, readFileSync(path, {encoding: 'utf8'}));
  }
}

class NativeFilewrite implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 2 || args[0].type !== VarType.STR || args[1].type !== VarType.STR) {
      ev.throwError(`file_write expects two arguments (str, str)`);
    }
    const path: string = <string>args[0].value;
    try {
      writeFileSync(path, <string>args[1].value, {encoding: 'utf8', flag: 'w'});
      return new Value(VarType.BOOL, true);
    } catch (e) {
      return new Value(VarType.BOOL, false);
    }
  }
}

class NativeFileexists implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1 || args[0].type !== VarType.STR) {
      ev.throwError(`file_exists(str) expects one argument`);
    }
    const path: string = <string>args[0].value;
    return new Value(VarType.BOOL, existsSync(path));
  }
}

class NativeFileremove implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1 || args[0].type !== VarType.STR) {
      ev.throwError(`file_remove expects one argument (str)`);
    }
    try {
      unlinkSync(<string>args[0].value);
      return new Value(VarType.BOOL, true);
    } catch (e) {
      return new Value(VarType.BOOL, false);
    }
  }
}

class NativeAbs implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1 || args[0].type !== VarType.NUM) {
      ev.throwError(`abs expects one argument (num)`);
    }
    return new Value(VarType.NUM, Math.abs(<number>args[0].value));
  }
}

class NativeRand implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 2 || args[0].type !== VarType.NUM || args[1].type !== VarType.NUM) {
      ev.throwError(`rand expects two arguments (num, num)`);
    }
    const min: number = <number>args[0].value;
    const max: number = <number>args[1].value;
    const rnd: number = Math.random() * (min - max) + max;
    return new Value(VarType.NUM, rnd);
  }
}

class NativeContains implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 2 || args[0].type !== VarType.STR || args[1].type !== VarType.STR) {
      ev.throwError(`contains expects two arguments (str, str)`);
    }
    const res: boolean = (<string>args[0].value).includes(<string>args[1].value);
    return new Value(VarType.BOOL, res);
  }
}

class NativeSubstr implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 3 || args[0].type !== VarType.STR || !args[1].isInteger() || !args[2].isInteger()) {
      ev.throwError(`substr expects two arguments (str, integer, integer)`);
    }
    const str = (<string>args[0].value).substr(<number>args[1].value, <number>args[2].value);
    return new Value(VarType.STR, str);
  }
}

class NativeSplit implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 2 || args[0].type !== VarType.STR || args[1].type !== VarType.STR) {
      ev.throwError(`split expects two arguments (str, str)`);
    }
    const strings = (<string>args[0].value).split(<string>args[1].value);
    let res: Value = new Value(VarType.ARR);
    res.arrayType = 'str';
    for (const str of strings) {
      res.arrayValues.push(new Value(VarType.STR, str));
    }
    return res;
  }
}

class NativeReplace implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 3 || args[0].type !== VarType.STR || args[1].type !== VarType.STR || args[2].type !== VarType.STR) {
      ev.throwError(`replace expects three arguments (str, str, str)`);
    }
    const str = args[0].value as string;
    const searchVal = args[1].value as string;
    const replaceVal = args[2].value as string;
    return new Value(VarType.STR, str.replace(searchVal, replaceVal));
  }
}

class NativeReplaceall implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 3 || args[0].type !== VarType.STR || args[1].type !== VarType.STR || args[2].type !== VarType.STR) {
      ev.throwError(`replace_all expects three arguments (str, str, str)`);
    }
    const str = args[0].value as string;
    const searchVal = args[1].value as string;
    const replaceVal = args[2].value as string;
    return new Value(VarType.STR, str.replaceAll(searchVal, replaceVal));
  }
}

class NativeTobytes implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1 || args[0].type !== VarType.STR) {
      ev.throwError(`to_bytes expects one argument (str)`);
    }
    let res: Value = new Value(VarType.ARR);
    res.arrayType = 'num';
    const buffer: number[] = [...Buffer.from(<string>args[0].value)];
    for (const byte of buffer) {
      res.arrayValues.push(new Value(VarType.NUM, byte));
    }
    return res;
  }
}

class NativeFrombytes implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1 || args[0].type !== VarType.ARR || args[0].arrayType !== 'num') {
      ev.throwError(`from_bytes expects one argument (arr<num>)`);
    }
    let bytes: number[] = [];
    for (const el of args[0].arrayValues) {
      if (!el.isInteger()) {
        ev.throwError(`from_bytes expects an array of integers`);
      }
      bytes.push(<number>el.value);
    }
    return new Value(VarType.STR, String.fromCharCode(...bytes));
  }
}

class NativeBind implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1 || args[0].heapRef === -1) {
      ev.throwError(`bind expects one argument (ref obj)`);
    }
    const ref: number = args[0].heapRef;
    if (ref < 0 || ref >= ev.VM.heap.chunks.length) {
      ev.throwError('Dereferencing a value that is not on the heap');
    }
    const val: Value = ev.VM.heap.chunks[ref].data;
    if (val.type !== VarType.OBJ) {
      ev.throwError(`Only a reference to object can be bound`);
    }
    Object.keys(val.memberValues).forEach((key: string) => {
      let v: Value = val.memberValues[key];
      if (v.heapRef !== -1) {
        v = ev.VM.heap.chunks[v.heapRef].data;
      }
      if (v === null) {
        ev.throwError(`Dereferencing a null pointer`);
      }
      if (v!.type === VarType.FUNC) {
        v!.thisRef = ref;
      }
    });
    return new Value(VarType.VOID);
  }
}

class NativeClassname implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1 || args[0].type !== VarType.OBJ) {
      ev.throwError('class_name expects one argument (obj)');
    }
    return new Value(VarType.STR, args[0].className);
  }
}

class NativeArraytype implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1 || args[0].type !== VarType.ARR) {
      ev.throwError('array_type expects one argument (arr)');
    }
    return new Value(VarType.STR, args[0].arrayType);
  }
}

class NativeStacktrace implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 0) {
      ev.throwError('stack_trace expects no arguments');
    }
    const limit: number = 100;
    let printed: number = 0;
    for (const crumb of ev.VM.trace.stack.reverse()) {
      if (printed > limit) {
        process.stdout.write(`    and ${ev.VM.trace.stack.length - printed} more\n`);
      }
      const name: string = !crumb.name ? '<anonymous function>' : `function '${crumb.name}'`;
      process.stdout.write(`  in ${name} called on line ${crumb.line}`);
      if (crumb.source) {
        process.stdout.write(` in file ${crumb.source}`);
      }
      process.stdout.write('\n');
      printed++;
    }
    ev.VM.trace.stack.reverse();
    return new Value(VarType.VOID);
  }
}

class NativeHttp implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 2 || args[0].type !== VarType.STR || args[1].type !== VarType.STR) {
      ev.throwError('http expects two arguments (str, str)');
    }
    const method: string = (<string>args[0].value).toUpperCase();
    try {
      const response: string = fetch(args[1].value, {method}).text();
      return new Value(VarType.STR, response);
    } catch (e) {
      return new Value(VarType.STR, '');
    }
  }
}

class NativeSleep implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1 || !args[0].isInteger()) {
      ev.throwError('sleep expects one argument (integer)');
    }
    if (args[0].value! < 0) {
      ev.throwError(`Sleep time must be greater than -1`);
    }
    // there's no other way to synchronously sleep without async/await
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, <number>args[0].value);
    return new Value(VarType.VOID);
  }
}

class NativeSin implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1 || args[0].type !== VarType.NUM) {
      ev.throwError('sin expects one argument (num)');
    }
    return new Value(VarType.NUM, Math.sin(<number>args[0].value));
  }
}

class NativeSinh implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1 || args[0].type !== VarType.NUM) {
      ev.throwError('sinh expects one argument (num)');
    }
    return new Value(VarType.NUM, Math.sinh(<number>args[0].value));
  }
}

class NativeCos implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1 || args[0].type !== VarType.NUM) {
      ev.throwError('cos expects one argument (num)');
    }
    return new Value(VarType.NUM, Math.cos(<number>args[0].value));
  }
}

class NativeCosh implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1 || args[0].type !== VarType.NUM) {
      ev.throwError('cosh expects one argument (num)');
    }
    return new Value(VarType.NUM, Math.cosh(<number>args[0].value));
  }
}

class NativeTan implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1 || args[0].type !== VarType.NUM) {
      ev.throwError('tan expects one argument (num)');
    }
    return new Value(VarType.NUM, Math.tan(<number>args[0].value));
  }
}

class NativeTanh implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1 || args[0].type !== VarType.NUM) {
      ev.throwError('tanh expects one argument (num)');
    }
    return new Value(VarType.NUM, Math.tanh(<number>args[0].value));
  }
}

class NativeSqrt implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1 || args[0].type !== VarType.NUM) {
      ev.throwError('sqrt expects one argument (num)');
    }
    return new Value(VarType.NUM, Math.sqrt(<number>args[0].value));
  }
}

class NativeLog implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1 || args[0].type !== VarType.NUM) {
      ev.throwError('log expects one argument (num)');
    }
    return new Value(VarType.NUM, Math.log(<number>args[0].value));
  }
}

class NativeLog10 implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1 || args[0].type !== VarType.NUM) {
      ev.throwError('log10 expects one argument (num)');
    }
    return new Value(VarType.NUM, Math.log10(<number>args[0].value));
  }
}

class NativeExp implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1 || args[0].type !== VarType.NUM) {
      ev.throwError('exp expects one argument (num)');
    }
    return new Value(VarType.NUM, Math.exp(<number>args[0].value));
  }
}

class NativeFloor implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1 || args[0].type !== VarType.NUM) {
      ev.throwError('floor expects one argument (num)');
    }
    return new Value(VarType.NUM, Math.floor(<number>args[0].value));
  }
}

class NativeCeil implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1 || args[0].type !== VarType.NUM) {
      ev.throwError('ceil expects one argument (num)');
    }
    return new Value(VarType.NUM, Math.ceil(<number>args[0].value));
  }
}

class NativeRound implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1 || args[0].type !== VarType.NUM) {
      ev.throwError('round expects one argument (num)');
    }
    return new Value(VarType.NUM, Math.round(<number>args[0].value));
  }
}

class NativeSameref implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 2) {
      ev.throwError('same_ref expects two arguments (ref, ref)')
    }
    if (args[0].heapRef === -1) {
      ev.throwError('same_ref: first argument is not a reference');
    }
    if (args[1].heapRef === -1) {
      ev.throwError('same_ref: second argument is not a reference');
    }
    return new Value(VarType.BOOL, args[0].heapRef === args[1].heapRef);
  }
}