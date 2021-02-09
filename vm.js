"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NativePrint = exports.CVM = exports.StackTrace = exports.Call = exports.Heap = exports.Cache = exports.Chunk = exports.Variable = exports.Value = void 0;
const utils_1 = require("./utils");
class Value {
    constructor(type) {
        this.type = utils_1.VarType.UNKNOWN;
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
            ['println']: new NativePrint()
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
    execute(args, VM, ev) {
        if (args.length === 0) {
            throw new Error('lel!');
        }
        let i = 0;
        const endIndex = args.length - 1;
        for (const arg of args) {
            process.stdout.write(`${VM.stringify(arg)}${i !== endIndex ? ' ' : ''}`);
        }
        return new Value(utils_1.VarType.VOID);
    }
}
exports.NativePrint = NativePrint;
