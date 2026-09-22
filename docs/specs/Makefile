PDFLATEX = latexmk -pdf

SPECSNUMS = 1 1_wasm 1_type_inference 1_infinite_loop_detection 1_typed 2 2_typed 3_type_inference 3 3_typed 4 4_explicitcontrol 4_typed styleguide 2_stepper studio_2 python_1

SPECS = $(SPECSNUMS:%=source_%)

# source_1..4 are now thin `\input javascript_N.tex` shims kept only for the historical PDF URLs
# (see javascript_N.tex) - javascript_1..4 are the real, renamed ("Source" -> "JavaScript") entry
# points and should be used for any new reference.
#
# The deprecated-variant and styleguide entries below go the *other* way around: source_* still
# holds the real (unrenamed) content, and javascript_* is a thin forwarding alias, so their PDF
# URLs don't say "source" either, without renaming any of their own body text.
JSSPECS = javascript_1 javascript_2 javascript_3 javascript_4 \
	javascript_1_wasm javascript_1_typed javascript_2_typed javascript_3_typed \
	javascript_4_typed javascript_4_explicitcontrol javascript_1_infinite_loop_detection \
	javascript_2_stepper javascript_3_type_inference javascript_styleguide

PDFSPECS = $(SPECS:%=%.pdf) $(JSSPECS:%=%.pdf)

HELPERSTEX = $(HELPERS:%=source_%.tex)

all: $(PDFSPECS)

%.pdf: %.tex 
	$(PDFLATEX) $*

clean:
	rm -f *~ *.dvi *.aux *.log *.ps *.out *.pdf
