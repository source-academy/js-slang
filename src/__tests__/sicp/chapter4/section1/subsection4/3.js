const primitive_functions = list(
       list("display",       display          ),
       list("error",         error            ),
       list("+",             (x, y) => x + y  ),
       list("-",             (x, y) => x - y  ),
       list("*",             (x, y) => x * y  ),
       list("/",             (x, y) => x / y  ),
       list("%",             (x, y) => x % y  ),
       list("===",           (x, y) => x === y),
       list("!==",           (x, y) => x !== y),
       list("<",             (x, y) => x <   y),
       list("<=",            (x, y) => x <=  y),
       list(">",             (x, y) => x >   y),
       list(">=",            (x, y) => x >=  y),
       list("!",              x     =>   !   x)
       );

primitive_functions;