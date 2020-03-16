function make_frame(origin, edge1, edge2) {
    return list(origin, edge1, edge2);
}
function origin_frame(frame) {
    return list_ref(frame, 0);
}
function edge1_frame(frame) {
    return list_ref(frame, 1);
}
function edge2_frame(frame) {
    return list_ref(frame, 2);
}
function make_vect(x, y) {
    return pair(x, y);
}
function xcor_vect(vector) {
    return head(vector);
}
function ycor_vect(vector) {
    return tail(vector);
}
function scale_vect(factor, vector) {
    return make_vect(factor * xcor_vect(vector), 
                     factor * ycor_vect(vector));
}
function add_vect(vector1, vector2) {
    return make_vect(xcor_vect(vector1)  
                     + xcor_vect(vector2), 
                     ycor_vect(vector1)  
                     + ycor_vect(vector2));
}
function sub_vect(vector1, vector2) {
    return make_vect(xcor_vect(vector1)  
                     - xcor_vect(vector2), 
                     ycor_vect(vector1)  
                     - ycor_vect(vector2));
}
function frame_coord_map(frame) {
    return v => add_vect(origin_frame(frame), 
                         add_vect(scale_vect(xcor_vect(v), 
                                             edge1_frame(frame)), 
                                  scale_vect(ycor_vect(v), 
                                             edge2_frame(frame))));
}

const my_origin = make_vect(1.0, 2.0);
const my_edge_1 = make_vect(3.0, 4.0);
const my_edge_2 = make_vect(5.0, 6.0);
const my_frame = make_frame(my_origin, my_edge_1, my_edge_2);
const my_coord_map = frame_coord_map(my_frame);
const my_vector = make_vect(1.0, 2.0);
const my_mapped_vector = my_coord_map(my_vector);
my_mapped_vector;