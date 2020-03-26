function extract_labels(text, receive) { 
    if (is_null(text)) {
        return pair(null, null);

    } else {
        const result = extract_labels(tail(text));
        const insts = head(result);
        const labels = tail(result);
        const next_inst = head(text);

        return is_string(next_inst)
            ? pair(insts, pair(make_label_entry(next_inst, insts), labels))
            : pair(pair(make_instruction(next_inst), insts), labels);
    }
}