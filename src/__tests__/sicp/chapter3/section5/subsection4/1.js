function integral(integrand, intial_value, dt) {
    return pair(intial_value,
        is_null(integrand) ? null
            : integral(stream_tail(integrand),
                dt * head(integrand) + initial_value,
	        dt));
}