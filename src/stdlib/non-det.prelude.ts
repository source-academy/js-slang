export const nonDetPrelude = `
    function require(predicate) {
        return predicate ? "Satisfied require" : amb();
    }

    function an_element_of(items) {
        require(!is_null(items));
        return amb(head(items), an_element_of(tail(items)));
    }

    function an_integer_between(low, high) {
        return low > high ? amb() : amb(low, an_integer_between(low + 1, high));
    }
`
