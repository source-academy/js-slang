function add_streams(s1, s2) {
    return stream_combine((x1, x2) => x1 + x2, s1, s2);
}
const s = pair(1, () => add_streams(s, s));