func fib = function(num n) num {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
};

num i = 0;

for (; i <= 25; i += 1) {
  println('fib(@1) = @2'(i, fib(i)));
}