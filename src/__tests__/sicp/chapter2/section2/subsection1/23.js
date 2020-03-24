function plus_curried(x) {	    
    return y => x + y;
}
// brooks_curried to be written by the student
brooks_curried(list(plus_curried, 3, 4));