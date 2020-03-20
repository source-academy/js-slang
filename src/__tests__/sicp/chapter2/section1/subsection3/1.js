function pair(x, y) {
    return m =>
           m === 0 
           ? x
             : m === 1 
	       ? y
               : error(m, "Argument not 0 or 1 in pair");
}
function head(z) {
    return z(0);
}
function tail(z) {
    return z(1);
}

const x = pair(1,2);
head(x);