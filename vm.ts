import { VarType } from "./utils"
import { FuncExpression, FuncParam, LiteralValue } from './ast'
import { Evaluator } from "./evaluator";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";

const readlineSync = require('readline-sync');

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
  public arrayType: string = 'int';
  public className: string = '';
  public memberName: string = '';
  public referenceName: string = '';

  public isLvalue(): boolean {
    return this.referenceName.length !== 0;
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

type ValuePtr = Value | null;

export class Chunk {
  public data: ValuePtr = null;
  public heapRef: number = -1;
  public used: boolean = false;
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

  public allocate(): Chunk {
    const index: number = this.cache.pop();
    if (index !== -1) {
      let chunk: Chunk = this.chunks[index];
      chunk.used = true;
      return chunk;
    }
    let newChunk: Chunk = new Chunk();
    this.chunks.push(newChunk);
    newChunk.used = true;
    newChunk.data = new Value(VarType.UNKNOWN);
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
  public globals: {[key: string]: NativeFunction} = {
    ['print']: new NativePrint(),
    ['println']: new NativePrintln(),
    ['input']: new NativeInput(),
    ['sizeof']: new NativeSizeof(),
    ['to_str']: new NativeTostr(),
    ['to_int']: new NativeToint(),
    ['to_double']: new NativeTodouble(),
    ['exit']: new NativeExit(),
    ['timestamp']: new NativeTimestamp(),
    ['pow']: new NativePow(),
    ['file_read']: new NativeFileread(),
    ['file_write']: new NativeFilewrite(),
    ['file_exists']: new NativeFileexists(),
    ['file_remove']: new NativeFileremove(),
    ['abs']: new NativeAbs(),
    ['rand']: new NativeRand(),
    ['randf']: new NativeRandf(),
    ['contains']: new NativeContains(),
    ['split']: new NativeSplit(),
    ['substr']: new NativeSubstr(),
    ['to_bytes']: new NativeTobytes(),
    ['from_bytes']: new NativeFrombytes()
  };
  public stringify(val: Value): string {
    if (val.heapRef !== -1) {
      if (val.heapRef >= this.heap.chunks.length) return 'null';
      let ptr: ValuePtr = this.heap.chunks[val.heapRef].data;
      if (ptr === null) {
        return 'null';
      } else {
        return `ref to ${this.stringify(ptr)}`;
      }
    }
    if (val.type === VarType.STR) {
      return <string>val.value;
    } else if (val.type === VarType.INT) {
      return val.value!.toString();
    } else if (val.type === VarType.FLOAT) {
      return val.value!.toString();
    } else if (val.type === VarType.FUNC) {
      return 'function';
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
      ev.throwError(`size expects one argument (arr|str)`);
    }
    const arg: Value = args[0];
    if (arg.type === VarType.ARR) {
      return new Value(VarType.INT, arg.arrayValues.length);
    } else if (arg.type === VarType.STR) {
      return new Value(VarType.INT, (<string>arg.value).length);
    } else {
      ev.throwError(`Cannot get the size of ${ev.VM.stringify(arg)}`);
    }
    return new Value(VarType.INT, 0);
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

class NativeToint implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1) {
      ev.throwError(`to_int expects one argument (int|float|str|bool)`);
    }
    const arg: Value = args[0];
    if (arg.type === VarType.INT) {
      return arg;
    } else if (arg.type === VarType.FLOAT) {
      return new Value(VarType.INT, Math.floor(<number>arg.value));
    } else if (arg.type === VarType.STR) {
      const converted: number = Number(arg.value);
      if (!Number.isInteger(converted)) {
        ev.throwError(`'${arg.value}' cannot be converted to int`);
      }
      return new Value(VarType.INT, converted);
    } else if (arg.type === VarType.BOOL) {
      return new Value(VarType.INT, Number(arg.value));
    }
    ev.throwError(`${ev.VM.stringify(arg)} cannot be converted to int`);
    return new Value(VarType.INT, 0);
  }
}

class NativeTodouble implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1) {
      ev.throwError(`to_double expects one argument (int|float|str|bool)`);
    }
    const arg: Value = args[0];
    if (arg.type === VarType.INT) {
      return new Value(VarType.FLOAT, arg.value);
    } else if (arg.type === VarType.FLOAT) {
      return arg;
    } else if (arg.type === VarType.STR) {
      const converted: number = Number(arg.value);
      if (isNaN(converted)) {
        ev.throwError(`'${arg.value}' cannot be converted to double`);
      }
      return new Value(VarType.FLOAT, converted);
    } else if (arg.type === VarType.BOOL) {
      return new Value(VarType.FLOAT, Number(arg.value));
    }
    ev.throwError(`${ev.VM.stringify(arg)} cannot be converted to double`);
    return new Value(VarType.FLOAT, 0.0);
  }
}

class NativeExit implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1 || args[0].type !== VarType.INT) {
      ev.throwError(`exit expects one argument (int)`);
    }
    process.exit(<number>args[0].value);
  }
}

class NativeTimestamp implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 0) {
      ev.throwError(`timestamp expects no arguments`);
    }
    return new Value(VarType.INT, Date.now());
  }
}

class NativePow implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 2) {
      ev.throwError(`pow expects two arguments (int|double, int|double)`);
    }
    if (!(args[0].type === VarType.FLOAT || args[0].type === VarType.INT)
     || !(args[1].type === VarType.FLOAT || args[1].type === VarType.INT)) {
        ev.throwError("pow() arguments must be either int or double");
    }
    const arg1: number = <number>args[0].value;
    const arg2: number = <number>args[1].value;
    return new Value(VarType.FLOAT, Math.pow(arg1, arg2));
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
    if (args.length !== 1 || args[0].type !== VarType.INT && args[0].type !== VarType.FLOAT) {
      ev.throwError(`abs expects one argument (int|double)`);
    }
    return new Value(args[0].type, Math.abs(<number>args[0].value));
  }
}

class NativeRand implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 2 || args[0].type !== VarType.INT || args[1].type !== VarType.INT) {
      ev.throwError(`rand expects two arguments (int, int)`);
    }
    const min: number = Math.ceil(<number>args[0].value);
    const max: number = Math.floor(<number>args[1].value);
    const rnd: number = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Value(VarType.INT, rnd);
  }
}

class NativeRandf implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 2 || args[0].type !== VarType.FLOAT || args[1].type !== VarType.FLOAT) {
      ev.throwError(`randf expects two arguments (double, double)`);
    }
    const min: number = <number>args[0].value;
    const max: number = <number>args[1].value;
    const rnd: number = Math.random() * (min - max) + max;
    return new Value(VarType.FLOAT, rnd);
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
    if (args.length !== 3 || args[0].type !== VarType.STR || args[1].type !== VarType.INT || args[2].type !== VarType.INT) {
      ev.throwError(`substr expects two arguments (str, int, int)`);
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

class NativeTobytes implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1 || args[0].type !== VarType.STR) {
      ev.throwError(`to_bytes expects one argument (str)`);
    }
    let res: Value = new Value(VarType.ARR);
    res.arrayType = 'int';
    const buffer: number[] = [...Buffer.from(<string>args[0].value)];
    for (const byte of buffer) {
      res.arrayValues.push(new Value(VarType.INT, byte));
    }
    return res;
  }
}

class NativeFrombytes implements NativeFunction {
  public execute(args: Value[], ev: Evaluator): Value {
    if (args.length !== 1 || args[0].type !== VarType.ARR || args[0].arrayType !== 'int') {
      ev.throwError(`from_bytes expects one argument (arr<int>)`);
    }
    let bytes: number[] = [];
    for (const el of args[0].arrayValues) {
      bytes.push(<number>el.value);
    }
    return new Value(VarType.STR, String.fromCharCode(...bytes));
  }
}