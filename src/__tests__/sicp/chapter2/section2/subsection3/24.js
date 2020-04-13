function matrix_times_vector(m, v) {
    return map(??, m);
}

function transpose(mat) {
    return accumulate_n(??, ??, mat);
}

function matrix_times_matrix(n, m) {
    const cols = transpose(n);
    return map(??, m);
}