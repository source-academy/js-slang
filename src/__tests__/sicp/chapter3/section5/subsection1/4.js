function stream_tail(stream) {
    return tail(stream)();
}

stream_tail(pair(4, () => pair(5, () => null)));