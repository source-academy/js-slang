assign("val", op("lookup-variable-value"), constant("a"), reg("env")),
assign("val", op("+"), reg("val"), constant(1)),