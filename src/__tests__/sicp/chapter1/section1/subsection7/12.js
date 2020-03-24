function conditional(predicate, then_clause, else_clause) {		    
    return predicate ? then_clause : else_clause;
}
conditional(1 === 1, 0, 5);