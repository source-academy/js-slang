PDFLATEX = latexmk -pdf

SPECSNUMS = 1 1_lazy 1_wasm 1_type_inference 1_infinite_loop_detection 2 2_lazy 3_type_inference 3 3_nondet 3_concurrent 4 4_gpu styleguide 1_stepper 

SPECS = $(SPECSNUMS:%=source_%)

PDFSPECS = $(SPECS:%=%.pdf)

HELPERSTEX = $(HELPERS:%=source_%.tex)

all: $(PDFSPECS)

%.pdf: %.tex 
	$(PDFLATEX) $*

clean:
	rm -f *~ *.dvi *.aux *.log *.ps *.out *.pdf
