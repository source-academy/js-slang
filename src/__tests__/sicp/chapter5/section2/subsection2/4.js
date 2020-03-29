function assemble_alternative(controller_text, machine) {
    const result = extract_labels(controller_text);
    const insts = head(result);
    const labels = tail(result);

    update_insts(insts, labels, machine);

    return insts;
}