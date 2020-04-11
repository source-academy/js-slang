function plus_curried(x) {	    
    return y => x + y;
}

plus_curried(3)(4);