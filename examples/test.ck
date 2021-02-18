alloc func test = function(void) void {
  alloc func newPerson = function(str name) obj {
    class Person(ref str name);
    alloc str _name = name;
    return Person(_name);
  };

  alloc obj A = newPerson('Jacek');
  alloc obj B = newPerson('Wiktor');
  alloc obj C = newPerson('Wiktor');
  alloc obj D = newPerson('Wiktor');
  alloc obj E = newPerson('Wiktor');
  alloc obj F = newPerson('Wiktor');
  alloc obj G = newPerson('Wiktor');

  println(A.name);
};

test();

alloc int a = 4;
alloc int b = 4;
alloc int c = 4;
alloc int d = 4;