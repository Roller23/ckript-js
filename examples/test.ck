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

alloc num a = 4;
alloc num b = 4;
alloc num c = 4;
alloc num d = 4;

println(same_ref(a, a));

alloc str g = "Hello";

func changeMe = function(ref str greeting) void {
  greeting += " there";
};


changeMe(g);

println("Greeting @1"(g));

println(replace("Hello world", "llo wor", ""));