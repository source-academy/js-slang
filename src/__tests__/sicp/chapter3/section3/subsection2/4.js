function is_empty_queue(queue) {
    return is_null(front_ptr(queue));
}
function front_ptr(queue) {
    return head(queue);
}
function rear_ptr(queue) {
    return tail(queue);
}
function set_front_ptr(queue, item) {
    set_head(queue, item);
}
function set_rear_ptr(queue, item) {
    set_tail(queue, item);
}
function front_queue(queue) {
    return is_empty_queue(queue)
        ? Error("front_queue called with an empty queue",
                queue)
        : front_ptr(queue);
}