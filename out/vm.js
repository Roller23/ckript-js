"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CVM = exports.StackTrace = exports.Call = exports.Heap = exports.Cache = exports.Chunk = exports.Variable = exports.Value = void 0;
const utils_1 = require("./utils");
const fs_1 = require("fs");
// 3rd party modules from npm
const readlineSync = require('readline-sync');
const fetch = require('sync-fetch');
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
            print: new NativePrint(),
            println: new NativePrintln(),
            input: new NativeInput(),
            sizeof: new NativeSizeof(),
            to_str: new NativeTostr(),
            to_int: new NativeToint(),
            to_double: new NativeTodouble(),
            exit: new NativeExit(),
            timestamp: new NativeTimestamp(),
            pow: new NativePow(),
            file_read: new NativeFileread(),
            file_write: new NativeFilewrite(),
            file_exists: new NativeFileexists(),
            file_remove: new NativeFileremove(),
            abs: new NativeAbs(),
            rand: new NativeRand(),
            randf: new NativeRandf(),
            contains: new NativeContains(),
            split: new NativeSplit(),
            substr: new NativeSubstr(),
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
            http: new NativeHttp()
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
            ev.throwError('print expects at least one argument (any, any...)');
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
            ev.throwError('println expects at least one argument (any, any...)');
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
            ev.throwError(`input takes one optional argument (str)`);
        }
        if (args.length === 1 && args[0].type !== utils_1.VarType.STR) {
            ev.throwError(`input optional argument must be a string`);
        }
        const question = args.length === 1 && args[0].type === utils_1.VarType.STR ? args[0].value : '';
        return new Value(utils_1.VarType.STR, readlineSync.question(question));
    }
}
class NativeSizeof {
    execute(args, ev) {
        if (args.length !== 1) {
            ev.throwError(`size expects one argument (arr|str)`);
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
            ev.throwError(`to_str expects one argument (any)`);
        }
        return new Value(utils_1.VarType.STR, ev.VM.stringify(args[0]));
    }
}
class NativeToint {
    execute(args, ev) {
        if (args.length !== 1) {
            ev.throwError(`to_int expects one argument (int|float|str|bool)`);
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
            ev.throwError(`to_double expects one argument (int|float|str|bool)`);
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
            ev.throwError(`exit expects one argument (int)`);
        }
        process.exit(args[0].value);
    }
}
class NativeTimestamp {
    execute(args, ev) {
        if (args.length !== 0) {
            ev.throwError(`timestamp expects no arguments`);
        }
        return new Value(utils_1.VarType.INT, Date.now());
    }
}
class NativePow {
    execute(args, ev) {
        if (args.length !== 2) {
            ev.throwError(`pow expects two arguments (int|double, int|double)`);
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
            ev.throwError(`file_read expects one argument (str)`);
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
            ev.throwError(`file_write expects two arguments (str, str)`);
        }
        const path = args[0].value;
        try {
            fs_1.writeFileSync(path, args[1].value, { encoding: 'utf8', flag: 'w' });
            return new Value(utils_1.VarType.BOOL, true);
        }
        catch (e) {
            return new Value(utils_1.VarType.BOOL, false);
        }
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
            ev.throwError(`file_remove expects one argument (str)`);
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
class NativeAbs {
    execute(args, ev) {
        if (args.length !== 1 || args[0].type !== utils_1.VarType.INT && args[0].type !== utils_1.VarType.FLOAT) {
            ev.throwError(`abs expects one argument (int|double)`);
        }
        return new Value(args[0].type, Math.abs(args[0].value));
    }
}
class NativeRand {
    execute(args, ev) {
        if (args.length !== 2 || args[0].type !== utils_1.VarType.INT || args[1].type !== utils_1.VarType.INT) {
            ev.throwError(`rand expects two arguments (int, int)`);
        }
        const min = Math.ceil(args[0].value);
        const max = Math.floor(args[1].value);
        const rnd = Math.floor(Math.random() * (max - min + 1)) + min;
        return new Value(utils_1.VarType.INT, rnd);
    }
}
class NativeRandf {
    execute(args, ev) {
        if (args.length !== 2 || args[0].type !== utils_1.VarType.FLOAT || args[1].type !== utils_1.VarType.FLOAT) {
            ev.throwError(`randf expects two arguments (double, double)`);
        }
        const min = args[0].value;
        const max = args[1].value;
        const rnd = Math.random() * (min - max) + max;
        return new Value(utils_1.VarType.FLOAT, rnd);
    }
}
class NativeContains {
    execute(args, ev) {
        if (args.length !== 2 || args[0].type !== utils_1.VarType.STR || args[1].type !== utils_1.VarType.STR) {
            ev.throwError(`contains expects two arguments (str, str)`);
        }
        const res = args[0].value.includes(args[1].value);
        return new Value(utils_1.VarType.BOOL, res);
    }
}
class NativeSubstr {
    execute(args, ev) {
        if (args.length !== 3 || args[0].type !== utils_1.VarType.STR || args[1].type !== utils_1.VarType.INT || args[2].type !== utils_1.VarType.INT) {
            ev.throwError(`substr expects two arguments (str, int, int)`);
        }
        const str = args[0].value.substr(args[1].value, args[2].value);
        return new Value(utils_1.VarType.STR, str);
    }
}
class NativeSplit {
    execute(args, ev) {
        if (args.length !== 2 || args[0].type !== utils_1.VarType.STR || args[1].type !== utils_1.VarType.STR) {
            ev.throwError(`split expects two arguments (str, str)`);
        }
        const strings = args[0].value.split(args[1].value);
        let res = new Value(utils_1.VarType.ARR);
        res.arrayType = 'str';
        for (const str of strings) {
            res.arrayValues.push(new Value(utils_1.VarType.STR, str));
        }
        return res;
    }
}
class NativeTobytes {
    execute(args, ev) {
        if (args.length !== 1 || args[0].type !== utils_1.VarType.STR) {
            ev.throwError(`to_bytes expects one argument (str)`);
        }
        let res = new Value(utils_1.VarType.ARR);
        res.arrayType = 'int';
        const buffer = [...Buffer.from(args[0].value)];
        for (const byte of buffer) {
            res.arrayValues.push(new Value(utils_1.VarType.INT, byte));
        }
        return res;
    }
}
class NativeFrombytes {
    execute(args, ev) {
        if (args.length !== 1 || args[0].type !== utils_1.VarType.ARR || args[0].arrayType !== 'int') {
            ev.throwError(`from_bytes expects one argument (arr<int>)`);
        }
        let bytes = [];
        for (const el of args[0].arrayValues) {
            bytes.push(el.value);
        }
        return new Value(utils_1.VarType.STR, String.fromCharCode(...bytes));
    }
}
class NativeBind {
    execute(args, ev) {
        if (args.length !== 1 || args[0].heapRef === -1) {
            ev.throwError(`bind expects one argument (ref obj)`);
        }
        const ref = args[0].heapRef;
        if (ref < 0 || ref >= ev.VM.heap.chunks.length) {
            ev.throwError('Dereferencing a value that is not on the heap');
        }
        const ptr = ev.VM.heap.chunks[ref].data;
        if (ptr === null) {
            ev.throwError(`Dereferencing a null pointer`);
        }
        if (ptr.type !== utils_1.VarType.OBJ) {
            ev.throwError(`Only a reference to object can be bound`);
        }
        Object.keys(ptr.memberValues).forEach((key) => {
            let v = ptr.memberValues[key];
            if (v.heapRef !== -1) {
                v = ev.VM.heap.chunks[v.heapRef].data;
            }
            if (v === null) {
                ev.throwError(`Dereferencing a null pointer`);
            }
            if (v.type === utils_1.VarType.FUNC) {
                v.thisRef = ref;
            }
        });
        return new Value(utils_1.VarType.VOID);
    }
}
class NativeClassname {
    execute(args, ev) {
        if (args.length !== 1 || args[0].type !== utils_1.VarType.OBJ) {
            ev.throwError('class_name expects one argument (obj)');
        }
        return new Value(utils_1.VarType.STR, args[0].className);
    }
}
class NativeArraytype {
    execute(args, ev) {
        if (args.length !== 1 || args[0].type !== utils_1.VarType.ARR) {
            ev.throwError('array_type expects one argument (arr)');
        }
        return new Value(utils_1.VarType.STR, args[0].arrayType);
    }
}
class NativeStacktrace {
    execute(args, ev) {
        if (args.length !== 0) {
            ev.throwError('stack_trace expects no arguments');
        }
        const limit = 100;
        let printed = 0;
        for (const crumb of ev.VM.trace.stack.reverse()) {
            if (printed > limit) {
                process.stdout.write(`    and ${ev.VM.trace.stack.length - printed} more\n`);
            }
            const name = !crumb.name ? '<anonymous function>' : `function '${crumb.name}'`;
            process.stdout.write(`  in ${name} called on line ${crumb.line}`);
            if (crumb.source) {
                process.stdout.write(` in file ${crumb.source}`);
            }
            process.stdout.write('\n');
            printed++;
        }
        ev.VM.trace.stack.reverse();
        return new Value(utils_1.VarType.VOID);
    }
}
class NativeHttp {
    execute(args, ev) {
        if (args.length !== 2 || args[0].type !== utils_1.VarType.STR || args[1].type !== utils_1.VarType.STR) {
            ev.throwError('http expects two arguments (str, str)');
        }
        const method = args[0].value.toUpperCase();
        if (!(method === 'POST' || method === 'GET')) {
            ev.throwError(`First argument must be a request method ('POST'|'GET')`);
        }
        try {
            const response = fetch(args[1].value, {
                method: method
            }).text();
            return new Value(utils_1.VarType.STR, response);
        }
        catch (e) {
            return new Value(utils_1.VarType.STR, '');
        }
    }
}
class NativeSleep {
    execute(args, ev) {
        if (args.length !== 1 || args[0].type !== utils_1.VarType.INT) {
            ev.throwError('sleep expects one argument (int)');
        }
        if (args[0].value < 0) {
            ev.throwError(`Sleep time must be greater than -1`);
        }
        // there's no other way to synchronously sleep without async/await
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, args[0].value);
        return new Value(utils_1.VarType.VOID);
    }
}
class NativeSin {
    execute(args, ev) {
        if (args.length !== 1 || args[0].type !== utils_1.VarType.INT && args[0].type !== utils_1.VarType.FLOAT) {
            ev.throwError('sin expects one argument (double|int)');
        }
        return new Value(utils_1.VarType.FLOAT, Math.sin(args[0].value));
    }
}
class NativeSinh {
    execute(args, ev) {
        if (args.length !== 1 || args[0].type !== utils_1.VarType.INT && args[0].type !== utils_1.VarType.FLOAT) {
            ev.throwError('sinh expects one argument (double|int)');
        }
        return new Value(utils_1.VarType.FLOAT, Math.sinh(args[0].value));
    }
}
class NativeCos {
    execute(args, ev) {
        if (args.length !== 1 || args[0].type !== utils_1.VarType.INT && args[0].type !== utils_1.VarType.FLOAT) {
            ev.throwError('cos expects one argument (double|int)');
        }
        return new Value(utils_1.VarType.FLOAT, Math.cos(args[0].value));
    }
}
class NativeCosh {
    execute(args, ev) {
        if (args.length !== 1 || args[0].type !== utils_1.VarType.INT && args[0].type !== utils_1.VarType.FLOAT) {
            ev.throwError('cosh expects one argument (double|int)');
        }
        return new Value(utils_1.VarType.FLOAT, Math.cosh(args[0].value));
    }
}
class NativeTan {
    execute(args, ev) {
        if (args.length !== 1 || args[0].type !== utils_1.VarType.INT && args[0].type !== utils_1.VarType.FLOAT) {
            ev.throwError('tan expects one argument (double|int)');
        }
        return new Value(utils_1.VarType.FLOAT, Math.tan(args[0].value));
    }
}
class NativeTanh {
    execute(args, ev) {
        if (args.length !== 1 || args[0].type !== utils_1.VarType.INT && args[0].type !== utils_1.VarType.FLOAT) {
            ev.throwError('tanh expects one argument (double|int)');
        }
        return new Value(utils_1.VarType.FLOAT, Math.tanh(args[0].value));
    }
}
class NativeSqrt {
    execute(args, ev) {
        if (args.length !== 1 || args[0].type !== utils_1.VarType.INT && args[0].type !== utils_1.VarType.FLOAT) {
            ev.throwError('sqrt expects one argument (double|int)');
        }
        return new Value(utils_1.VarType.FLOAT, Math.sqrt(args[0].value));
    }
}
class NativeLog {
    execute(args, ev) {
        if (args.length !== 1 || args[0].type !== utils_1.VarType.INT && args[0].type !== utils_1.VarType.FLOAT) {
            ev.throwError('log expects one argument (double|int)');
        }
        return new Value(utils_1.VarType.FLOAT, Math.log(args[0].value));
    }
}
class NativeLog10 {
    execute(args, ev) {
        if (args.length !== 1 || args[0].type !== utils_1.VarType.INT && args[0].type !== utils_1.VarType.FLOAT) {
            ev.throwError('log10 expects one argument (double|int)');
        }
        return new Value(utils_1.VarType.FLOAT, Math.log10(args[0].value));
    }
}
class NativeExp {
    execute(args, ev) {
        if (args.length !== 1 || args[0].type !== utils_1.VarType.INT && args[0].type !== utils_1.VarType.FLOAT) {
            ev.throwError('exp expects one argument (double|int)');
        }
        return new Value(utils_1.VarType.FLOAT, Math.exp(args[0].value));
    }
}
class NativeFloor {
    execute(args, ev) {
        if (args.length !== 1 || args[0].type !== utils_1.VarType.INT && args[0].type !== utils_1.VarType.FLOAT) {
            ev.throwError('floor expects one argument (double|int)');
        }
        return new Value(utils_1.VarType.FLOAT, Math.floor(args[0].value));
    }
}
class NativeCeil {
    execute(args, ev) {
        if (args.length !== 1 || args[0].type !== utils_1.VarType.INT && args[0].type !== utils_1.VarType.FLOAT) {
            ev.throwError('ceil expects one argument (double|int)');
        }
        return new Value(utils_1.VarType.FLOAT, Math.ceil(args[0].value));
    }
}
class NativeRound {
    execute(args, ev) {
        if (args.length !== 1 || args[0].type !== utils_1.VarType.INT && args[0].type !== utils_1.VarType.FLOAT) {
            ev.throwError('round expects one argument (double|int)');
        }
        return new Value(utils_1.VarType.FLOAT, Math.round(args[0].value));
    }
}