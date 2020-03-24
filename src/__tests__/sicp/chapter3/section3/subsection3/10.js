function memoize(f) {
    const table = make_table();
    return x => {
        const previously_computed_result 
            = lookup(x, table);
        if (previously_computed_result === undefined) {
            const result = f(x);
            insert(x, result, table);
            return result;
        } else {
            return previously_computed_result;
        }
    };
}
const memo_fib = memoize(n => n === 0
                              ? 0
                              : n === 1
                                ? 1
                                : memo_fib(n - 1) +
                                  memo_fib(n - 2)
                        );