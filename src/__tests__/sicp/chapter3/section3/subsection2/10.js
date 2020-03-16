insert_queue(q1, "b");
insert_queue(q1, "a");
function insert_queue(queue, item) {
    const new_pair = pair(item, null);
    if (is_empty_queue(queue)) {
        set_front_ptr(queue, new_pair);
        set_rear_ptr(queue, new_pair);
    } else {
        set_tail(rear_ptr(queue), new_pair);
        set_rear_ptr(queue, new_pair);
    }
    return queue;
}
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
const q1 = make_queue();
function make_queue() {
    return pair(null, null);
}
function delete_queue(queue) {
    if (is_empty_queue(queue)) {
        Error("delete_queue called with an empty queue",
              queue);
    } else {
        set_front_ptr(queue, tail(front_ptr(queue)));
        return queue;
    }
}
delete_queue(q1);