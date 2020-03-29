PDFLATEX = pdflatex

SPECSNUMS = 1 2 3 4 styleguide

SPECS = $(SPECSNUMS:%=source_%)

PDFSPECS = $(SPECS:%=%.pdf)

HELPERS = header bnf comments intro names numbers return strings typing objects arrays interpreter lists array_support loops boolean_operators pair_mutators 0_rules

HELPERSTEX = $(HELPERS:%=source_%.tex)

all: $(PDFSPECS)

%.pdf: %.tex $(HELPERSTEX)
	$(PDFLATEX) $*

clean:
	rm -f *~ *.dvi *.aux *.log *.ps *.out *.pdf
