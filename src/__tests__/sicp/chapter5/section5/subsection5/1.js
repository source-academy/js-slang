compile(parse("                \
function factorial(n) {        \
    return n === 1             \
        ? 1"                   \
        : n * factorial(n - 1);\
}                              "),
       "val",
       "next");