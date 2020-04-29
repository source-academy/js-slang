PDFLATEX = latexmk

SPECSNUMS = 1 1_lazy 2 2_lazy 3 3_concurrent 4 styleguide 1_type_inference 1_wasm 3_nondet

SPECS = $(SPECSNUMS:%=source_%)

PDFSPECS = $(SPECS:%=%.pdf)

HELPERS = header bnf comments intro names numbers return strings typing objects arrays interpreter lists array_support loops boolean_operators pair_mutators 0_rules

HELPERSTEX = $(HELPERS:%=source_%.tex)

all: $(PDFSPECS)

%.pdf: %.tex $(HELPERSTEX)
	$(PDFLATEX) $*

clean:
	rm -f *~ *.dvi *.aux *.log *.ps *.out *.pdf
