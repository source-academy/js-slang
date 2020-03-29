function solve(f, y0, dt) {
    const y = integral( () => dy, y0, dt);
    const dy = stream_map(f, y);
    return y;
}