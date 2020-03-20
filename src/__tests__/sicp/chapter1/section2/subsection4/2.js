function expt(b,n) {
    return expt_iter(b,n,1);
}
function expt_iter(b,counter,product) {
    return counter === 0
           ? product
           : expt_iter(b,
                       counter - 1, 
                       b * product);
}

expt(3, 4);