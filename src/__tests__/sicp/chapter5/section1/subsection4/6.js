function expt(b, n) {	  
    function expt_iter(counter, product) {
        return counter === 0
            ? product
            : expt_iter(counter - 1, b * product);
    }
    return expt_iter(n, 1);
}