### Naming 
- The official specifications for Source § X is `source_X.pdf`.
- Other `.tex` files are used as imports within the specs.
- `source_week_X.pdf` is an *internal reference* for the staff, to aid with discussion groups.

### Generating PDFs
Required for making the documents is a LaTeX installation.

Just try
	make
in order to make the four documents
source_1.pdf
source_2.pdf
source_3.pdf
source_4.pdf
source_styleguide.pdf

If you get an error, try
       touch *.tex
and try
       make
again.
