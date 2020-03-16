function advance_pc(pc) {
    set_contents(pc, tail(get_contents(pc))); 
    
}