func fib = function(int n) int {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
};

int i = 0;

for (; i <= 25; i += 1) {
 println(`fib(@1) = @2`(i, fib(i)));
}