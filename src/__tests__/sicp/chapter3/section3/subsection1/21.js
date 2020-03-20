function pair(x, y) {
    function dispatch(m) {
        if (m === "head") {
            return x;
        } else if (m === "tail") {
            return y;
        } else {
            return "undefined operation -- pair";
        }
    }
    return dispatch;	
}