PDFLATEX = latexmk

SPECSNUMS = 1 1_lazy 1_wasm 1_type_inference 1_infinite_loop_detection 2 2_lazy 2_type_inference 3 3_nondet 3_concurrent 4 4_gpu styleguide 

SPECS = $(SPECSNUMS:%=source_%)

PDFSPECS = $(SPECS:%=%.pdf)

HELPERS = header bnf comments intro names numbers return strings typing objects arrays interpreter lists array_support loops boolean_operators pair_mutators 0_rules

HELPERSTEX = $(HELPERS:%=source_%.tex)

all: $(PDFSPECS)

%.pdf: %.tex $(HELPERSTEX)
	$(PDFLATEX) $*

clean:
	rm -f *~ *.dvi *.aux *.log *.ps *.out *.pdf
