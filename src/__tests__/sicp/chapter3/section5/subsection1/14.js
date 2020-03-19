function memo(fun) {	    
    let already_run = false;
    let result = undefined;
    return () => {
                     if (!already_run) {
                         result = fun();
                         already_run = true;
                         return result;
                     } else {
                         return result;
                     }
	         };
}

function square_4() {
    const result = 4 * 4;	    
    display("multiplication carried out");
    return result;
}
const memo_square_4 = memo(square_4);
display(memo_square_4()); // shows "multipl.."
display(memo_square_4()); // does not show "multipl.."