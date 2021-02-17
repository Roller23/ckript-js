"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorHandler = void 0;
class ErrorHandler {
    static throwError(cause) {
        console.log(cause);
        process.exit(1);
    }
}
exports.ErrorHandler = ErrorHandler;
