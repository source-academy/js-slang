function factorial(n) {
    function iter(product, counter) {
        return counter > n
            ? product
            : iter(product * counter, counter + 1);
    }

    return iter(1, 1);
}