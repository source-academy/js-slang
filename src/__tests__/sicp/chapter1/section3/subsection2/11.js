function h() {
    const x = 1;
    function i() {
        const x = x + 1;
        return x;
    }
    return i();
}
h();