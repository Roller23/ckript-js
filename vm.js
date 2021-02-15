"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CVM = exports.StackTrace = exports.Call = exports.Heap = exports.Cache = exports.Chunk = exports.Variable = exports.Value = void 0;
const utils_1 = require("./utils");
const fs_1 = require("fs");
const readlineSync = require('readline-sync');
class Value {
    constructor(type, value) {
        this.type = utils_1.VarType.UNKNOWN;
        this.value = undefined;
        this.heapRef = -1;
        this.thisRef = -1;
        this.func = null;
        this.funcName = '';
        this.members = [];
        this.memberValues = {};
        this.arrayValues = [];
        this.arrayType = 'int';
        this.className = '';
        this.memberName = '';
        this.referenceName = '';
        this.type = type;
        if (value !== undefined) {
            this.value = value;
        }
    }
    isLvalue() {
        return this.referenceName.length !== 0;
    }
}
exports.Value = Value;
class Variable {
    constructor() {
        this.type = '';
        this.val = new Value(utils_1.VarType.UNKNOWN);
        this.constant = false;
    }
    isAllocated() {
        return this.val.heapRef !== -1;
    }
}
exports.Variable = Variable;
class Chunk {
    constructor() {
        this.data = null;
        this.heapRef = -1;
        this.used = false;
    }
}
exports.Chunk = Chunk;
class Cache {
    constructor() {
        // might need some optimizations
        this.refs = [];
    }
    push(ref) {
        this.refs.push(ref);
    }
    pop() {
        const ret = this.refs.pop();
        return ret === undefined ? -1 : ret;
    }
}
exports.Cache = Cache;
class Heap {
    constructor() {
        this.chunks = [];
        this.cache = new Cache();
    }
    allocate() {
        const index = this.cache.pop();
        if (index !== -1) {
            let chunk = this.chunks[index];
            chunk.used = true;
            return chunk;
        }
        let newChunk = new Chunk();
        this.chunks.push(newChunk);
        newChunk.used = true;
        newChunk.data = new Value(utils_1.VarType.UNKNOWN);
        newChunk.heapRef = this.chunks.length - 1;
        return newChunk;
    }
    free(ref) {
        let chunk = this.chunks[ref];
        chunk.used = false;
        this.cache.push(ref);
    }
}
exports.Heap = Heap;
class Call {
    constructor(line, name, source) {
        this.line = line;
        this.name = name;
        this.source = source;
    }
}
exports.Call = Call;
class StackTrace {
    constructor() {
        this.stack = [];
    }
    push(name, line, source) {
        this.stack.push(new Call(line, name, source));
    }
    pop() {
        this.stack.pop();
    }
}
exports.StackTrace = StackTrace;
class CVM {
    constructor() {
        this.heap = new Heap();
        this.trace = new StackTrace();
        this.globals = {
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
            ['file_remove']: new NativeFileremove()
        };
    }
    stringify(val) {
        if (val.heapRef !== -1) {
            if (val.heapRef >= this.heap.chunks.length)
                return 'null';
            let ptr = this.heap.chunks[val.heapRef].data;
            if (ptr === null) {
                return 'null';
            }
            else {
                return `ref to ${this.stringify(ptr)}`;
            }
        }
        if (val.type === utils_1.VarType.STR) {
            return val.value;
        }
        else if (val.type === utils_1.VarType.INT) {
            return val.value.toString();
        }
        else if (val.type === utils_1.VarType.FLOAT) {
            return val.value.toString();
        }
        else if (val.type === utils_1.VarType.FUNC) {
            return 'function';
        }
        else if (val.type === utils_1.VarType.BOOL) {
            return val.value ? 'true' : 'false';
        }
        else if (val.type === utils_1.VarType.CLASS) {
            return `class ${val.className}`;
        }
        else if (val.type === utils_1.VarType.VOID) {
            return 'void';
        }
        else if (val.type === utils_1.VarType.UNKNOWN) {
            return 'null';
        }
        else if (val.type === utils_1.VarType.ARR) {
            let str = `array<${val.arrayType}>(`;
            let i = 0;
            val.arrayValues.forEach((el) => {
                if (el.type === utils_1.VarType.STR)
                    str += '"';
                str += this.stringify(el);
                if (el.type === utils_1.VarType.STR)
                    str += '"';
                if (i !== val.arrayValues.length - 1) {
                    str += ', ';
                }
                i++;
            });
            str += ')';
            return str;
        }
        else if (val.type === utils_1.VarType.OBJ) {
            let str = `object<${val.className}>(`;
            let i = 0;
            const keys = Object.keys(val.memberValues);
            keys.forEach((key) => {
                str += `${key}: `;
                if (val.memberValues[key].type === utils_1.VarType.STR)
                    str += '"';
                str += this.stringify(val.memberValues[key]);
                if (val.memberValues[key].type === utils_1.VarType.STR)
                    str += '"';
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
exports.CVM = CVM;
class NativePrint {
    execute(args, ev) {
        if (args.length === 0) {
            ev.throwError('print(any) expects at least one argument');
        }
        let i = 0;
        const endIndex = args.length - 1;
        for (const arg of args) {
            process.stdout.write(`${ev.VM.stringify(arg)}${i !== endIndex ? ' ' : ''}`);
        }
        return new Value(utils_1.VarType.VOID);
    }
}
class NativePrintln {
    execute(args, ev) {
        if (args.length === 0) {
            ev.throwError('println(any) expects at least one argument');
        }
        let i = 0;
        const endIndex = args.length - 1;
        for (const arg of args) {
            process.stdout.write(`${ev.VM.stringify(arg)}${i !== endIndex ? ' ' : ''}`);
        }
        process.stdout.write('\n');
        return new Value(utils_1.VarType.VOID);
    }
}
class NativeInput {
    execute(args, ev) {
        if (args.length > 1) {
            ev.throwError(`input(str?) takes one optional argument`);
        }
        if (args.length === 1 && args[0].type !== utils_1.VarType.STR) {
            ev.throwError(`input(str?) the optional argument must be a string`);
        }
        const question = args.length === 1 && args[0].type === utils_1.VarType.STR ? args[0].value : '';
        return new Value(utils_1.VarType.STR, readlineSync.question(question));
    }
}
class NativeSizeof {
    execute(args, ev) {
        if (args.length !== 1) {
            ev.throwError(`size(arr|str) expects one argument`);
        }
        const arg = args[0];
        if (arg.type === utils_1.VarType.ARR) {
            return new Value(utils_1.VarType.INT, arg.arrayValues.length);
        }
        else if (arg.type === utils_1.VarType.STR) {
            return new Value(utils_1.VarType.INT, arg.value.length);
        }
        else {
            ev.throwError(`Cannot get the size of ${ev.VM.stringify(arg)}`);
        }
        return new Value(utils_1.VarType.INT, 0);
    }
}
class NativeTostr {
    execute(args, ev) {
        if (args.length !== 1) {
            ev.throwError(`to_str(any) expects one argument`);
        }
        return new Value(utils_1.VarType.STR, ev.VM.stringify(args[0]));
    }
}
class NativeToint {
    execute(args, ev) {
        if (args.length !== 1) {
            ev.throwError(`to_int(int|float|str|bool) expects one argument`);
        }
        const arg = args[0];
        if (arg.type === utils_1.VarType.INT) {
            return arg;
        }
        else if (arg.type === utils_1.VarType.FLOAT) {
            return new Value(utils_1.VarType.INT, Math.floor(arg.value));
        }
        else if (arg.type === utils_1.VarType.STR) {
            const converted = Number(arg.value);
            if (!Number.isInteger(converted)) {
                ev.throwError(`'${arg.value}' cannot be converted to int`);
            }
            return new Value(utils_1.VarType.INT, converted);
        }
        else if (arg.type === utils_1.VarType.BOOL) {
            return new Value(utils_1.VarType.INT, Number(arg.value));
        }
        ev.throwError(`${ev.VM.stringify(arg)} cannot be converted to int`);
        return new Value(utils_1.VarType.INT, 0);
    }
}
class NativeTodouble {
    execute(args, ev) {
        if (args.length !== 1) {
            ev.throwError(`to_double(int|float|str|bool) expects one argument`);
        }
        const arg = args[0];
        if (arg.type === utils_1.VarType.INT) {
            return new Value(utils_1.VarType.FLOAT, arg.value);
        }
        else if (arg.type === utils_1.VarType.FLOAT) {
            return arg;
        }
        else if (arg.type === utils_1.VarType.STR) {
            const converted = Number(arg.value);
            if (isNaN(converted)) {
                ev.throwError(`'${arg.value}' cannot be converted to double`);
            }
            return new Value(utils_1.VarType.FLOAT, converted);
        }
        else if (arg.type === utils_1.VarType.BOOL) {
            return new Value(utils_1.VarType.FLOAT, Number(arg.value));
        }
        ev.throwError(`${ev.VM.stringify(arg)} cannot be converted to double`);
        return new Value(utils_1.VarType.FLOAT, 0.0);
    }
}
class NativeExit {
    execute(args, ev) {
        if (args.length !== 1 || args[0].type !== utils_1.VarType.INT) {
            ev.throwError(`exit(int) expects one argument`);
        }
        process.exit(args[0].value);
    }
}
class NativeTimestamp {
    execute(args, ev) {
        if (args.length !== 0) {
            ev.throwError(`timestamp() expects no arguments`);
        }
        return new Value(utils_1.VarType.INT, Date.now());
    }
}
class NativePow {
    execute(args, ev) {
        if (args.length !== 2) {
            ev.throwError(`pow(int|double, int|double) expects two arguments`);
        }
        if (!(args[0].type === utils_1.VarType.FLOAT || args[0].type === utils_1.VarType.INT)
            || !(args[1].type === utils_1.VarType.FLOAT || args[1].type === utils_1.VarType.INT)) {
            ev.throwError("pow() arguments must be either int or double");
        }
        const arg1 = args[0].value;
        const arg2 = args[1].value;
        return new Value(utils_1.VarType.FLOAT, Math.pow(arg1, arg2));
    }
}
class NativeFileread {
    execute(args, ev) {
        if (args.length !== 1 || args[0].type !== utils_1.VarType.STR) {
            ev.throwError(`file_read(str) expects one argument`);
        }
        const path = args[0].value;
        if (!fs_1.existsSync(path)) {
            ev.throwError(`Couldn't read ${path}`);
        }
        return new Value(utils_1.VarType.STR, fs_1.readFileSync(path, { encoding: 'utf8' }));
    }
}
class NativeFilewrite {
    execute(args, ev) {
        if (args.length !== 2 || args[0].type !== utils_1.VarType.STR || args[1].type !== utils_1.VarType.STR) {
            ev.throwError(`file_write(str, str) expects two arguments`);
        }
        const path = args[0].value;
        fs_1.writeFileSync(path, args[1].value, { encoding: 'utf8', flag: 'w' });
        return new Value(utils_1.VarType.BOOL, true);
    }
}
class NativeFileexists {
    execute(args, ev) {
        if (args.length !== 1 || args[0].type !== utils_1.VarType.STR) {
            ev.throwError(`file_exists(str) expects one argument`);
        }
        const path = args[0].value;
        return new Value(utils_1.VarType.BOOL, fs_1.existsSync(path));
    }
}
class NativeFileremove {
    execute(args, ev) {
        if (args.length !== 1 || args[0].type !== utils_1.VarType.STR) {
            ev.throwError(`file_remove(str) expects one argument`);
        }
        try {
            fs_1.unlinkSync(args[0].value);
            return new Value(utils_1.VarType.BOOL, true);
        }
        catch (e) {
            return new Value(utils_1.VarType.BOOL, false);
        }
    }
}
