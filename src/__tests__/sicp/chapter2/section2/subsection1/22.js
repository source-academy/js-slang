function plus_curried(x) {	    
    return y => x + y;
}
// brooks to be written by the student
brooks(plus_curried, list(3, 4));