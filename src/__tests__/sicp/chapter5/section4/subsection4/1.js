"print_result",
          perform(op("print_stack_statistics")), // added instruction
          perform(op("announce_output"), const("/// EC-Eval value:")),
          /* ... same as before ... */