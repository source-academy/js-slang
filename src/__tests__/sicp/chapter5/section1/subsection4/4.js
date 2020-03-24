controller(
    list(      
       assign("continue", label("fact-done")), // set up final return address
       "fact-loop",
       test(list(op("="), reg("n"), constant(1))),
       branch(label("base-case")),
       // Set up for the recursive call by saving "n" and "continue".
       // Set up "continue" so that the computation will continue
       // at "after-fact" when the subroutine returns.
       save("continue"),
       save("n"),
       assign("n", list(op("-"), reg("n"), const(1))),
       assign("continue", label("after-fact")),
       go_to(label("fact-loop")),
       "after-fact",
       restore("n"),
       restore("continue"),
       assign("val", list(op("*"), reg("n"), reg("val"))),
       // "val" now contains n(n-1)!
       go_to(reg("continue")),        // return to caller
       "base-case",
       assign("val", constant(1)),       // base case: val = 1
       go_to(reg("continue")),        // return to caller
       "fact-done"));