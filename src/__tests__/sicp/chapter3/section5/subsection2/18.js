function expand(num, den, radix) {	
    return pair(quotient(num * radix, den),
                expand((num * radix) % den, den, radix));
}