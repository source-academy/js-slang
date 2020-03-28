function conditional(predicate, then_clause, else_clause) {		    
    return predicate ? then_clause : else_clause;
}
conditional(2 === 3, 0, 5);