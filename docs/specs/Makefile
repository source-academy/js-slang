PDFLATEX = latexmk -pdf

SPECSNUMS = 1 1_wasm 1_type_inference 1_infinite_loop_detection 1_typed 2 2_typed 3_type_inference 3 3_typed 4 4_explicitcontrol 4_typed styleguide 2_stepper studio_2 python_1

SPECS = $(SPECSNUMS:%=source_%)

# source_1..4 are now thin `\input javascript_N.tex` shims kept only for the historical PDF URLs
# (see javascript_N.tex) - javascript_1..4 are the real, renamed ("Source" -> "JavaScript") entry
# points and should be used for any new reference.
JSSPECS = javascript_1 javascript_2 javascript_3 javascript_4

PDFSPECS = $(SPECS:%=%.pdf) $(JSSPECS:%=%.pdf)

HELPERSTEX = $(HELPERS:%=source_%.tex)

all: $(PDFSPECS)

%.pdf: %.tex 
	$(PDFLATEX) $*

clean:
	rm -f *~ *.dvi *.aux *.log *.ps *.out *.pdf
