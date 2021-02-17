export class ErrorHandler {
  public static throwError(cause: string): void {
    console.log(cause);
    process.exit(1);
  }
}