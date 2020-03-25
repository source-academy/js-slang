function salary_of_highest_paid_programmer(records) {
    return accumulate(math_max, 
                      0, 
                      map(salary, 
                          filter(is_programmer, records)));
}

const my_records = list(list("Linus", "programmer", 30000),
                        list("Richard", "programmer", 25000),
                        list("Bill", "manager", 2500000));
function is_programmer(record) {
    return head(tail(record)) === "programmer";
}
function salary(record) {
    return head(tail(tail(record)));
}
salary_of_highest_paid_programmer(my_records);