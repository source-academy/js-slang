export const nonDetPrelude = `
    /* DISTINCT */
    /* The distinct function checks whether the items in a list are unique. */
    /* Taken from SICP JS section 4.3.2 */

    function distinct(items) {
        return is_null(items)
            ? true
            : is_null(tail(items))
            ? true
            : is_null(member(head(items), tail(items)))
                ? distinct(tail(items))
                : false;
    }

    function an_element_of(items) {
        require(!is_null(items));
        return amb(head(items), an_element_of(tail(items)));
    }

    function an_integer_between(low, high) {
        return low > high ? amb() : amb(low, an_integer_between(low + 1, high));
    }
`
