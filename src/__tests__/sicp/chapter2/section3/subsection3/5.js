function intersection_set(set1, set2) {
    if (is_null(set1) || is_null(set2)) {
        return null;
    } else {
      const x1 = head(set1);
      const x2 = head(set2);
      return x1 === x2
             ? pair(x1, intersection_set(tail(set1),
                                        tail(set2)))
             : x1 < x2 
	       ? intersection_set(tail(set1), set2)
               : intersection_set(set1,
                                  tail(set2));
    }
}

intersection_set(
   list(10, 20, 30),
   list(10, 15, 20));