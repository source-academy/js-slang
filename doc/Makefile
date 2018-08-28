PDFLATEX = pdflatex

SPECSNUMS = 1 2 3 4 styleguide

SPECS = $(SPECSNUMS:%=source_%)

PDFSPECS = $(SPECS:%=%.pdf)

HELPERS = header bnf comments intro names numbers return strings typing objects arrays interpreter lists array_support

HELPERSTEX = $(HELPERS:%=source_%.tex)

all: $(PDFSPECS)

%.pdf: %.tex $(HELPERSTEX)
	$(PDFLATEX) $? $@

clean:
	rm -f *~ *.dvi *.aux *.log *.ps *.out

install: $(PDFSPECS)
	scp $(PDFSPECS) cs1101s@sunfire.comp.nus.edu.sg:public_html/source/.
