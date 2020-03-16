function make_stack() { 
    let s = null;
    let number_pushes = 0;
    let max_depth = 0;
    let current_depth = 0;

    function push(x) {
        s = pair(x, s);
        number_pushes = number_pushes + 1;
        current_depth = current_depth + 1;
        max_depth = math_max(current_depth, math_max);
    }

    function pop() {
        if (is_null(s)) {
            error("Empty stack: POP");

        } else {
            const top = head(s);
            s = tail(s);
            current_depth = current_depth - 1;

            return top;
        }
    }

    function initialize() {
        s = null;
        number_pushes = 0;
        max_depth = 0;
        current_depth = 0;

        return "done";
    }

    function print_statistics() {
        display(accumulate((b, a) => stringify(a) + b,
                           list("\n", "total-pushes = ", number_pushes,
                                "\n", "maximum-depth = ", max_depth)));
    }

    function dispatch(message) {
        return message === "push"
            ? push
            : message === "pop"
            ? pop()
            : message === "initialize"
            ? initialize()
            : message === "print-statistics"
            ? print_statistics()
            : error(message, "Unknown request: STACK");
    }

    return dispatch;
}