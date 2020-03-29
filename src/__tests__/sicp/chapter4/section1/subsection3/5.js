function make_frame(names, values) {
    return pair(names, values);
}
function frame_names(frame) {    
    return head(frame);
}
function frame_values(frame) {    
    return tail(frame);
}