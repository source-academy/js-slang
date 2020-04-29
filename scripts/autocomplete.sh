#!/usr/bin/env python3

from lxml import etree, html
from pathlib import Path
import os
import re
import json

CONST_DECL = "const"
FUNC_DECL = "func"


base_dir = "docs/source"
src_filename = "global.html"
out_dir = "src/editors/ace/docTooltip"


def new_title_node(title):
    node = etree.Element("h4")
    node.text = title
    return node


def build_description_html(description_div):
    description_html = html.tostring(description_div).decode("utf-8")

    # There's a whole bunch of newlines between sections for some reason.
    # Main reason for this is to avoid double newlines inside code blocks.
    description_html = re.sub("\n+", "\n", description_html)

    return description_html


def process_constant(namespace, element):
    header = element.find('./h4')
    raw_name = "".join(header.itertext())
    fields = raw_name.split()[1:]  # first result just says (constant)

    name = header.attrib["id"]
    title = "".join(fields)
    if not title:  # Some runes have no title
        title = name

    title_node = new_title_node(title)

    description_node = element.find('./div[@class="description"]')

    description_div = etree.Element("div")
    description_div.append(title_node)
    description_div.append(description_node)

    description_html = build_description_html(description_div)

    namespace[name] = {"title": title,
                       "description": description_html, "meta": CONST_DECL}


def process_function(namespace, element):
    header = element.find('./h4')
    title = "".join(header.itertext())
    name = header.attrib["id"]

    title_node = new_title_node(title)

    description_node = element.find('./div[@class="description"]')

    description_div = etree.Element("div")
    description_div.append(title_node)
    description_div.append(description_node)

    description_html = build_description_html(description_div)

    namespace[name] = {"title": title,
                       "description": description_html, "meta": FUNC_DECL}


def process_dir_globals(target):
    infile = os.path.join(base_dir, target, src_filename)
    with open(infile) as f:
        contents = "\n".join(f.readlines())
    try:
        tree = etree.HTML(contents)
    except Exception as e:
        print(infile, "failed", e)
        return

    names = {}

    constants = tree.findall('.//div[@class="constant-entry"]')
    for c in constants:
        process_constant(names, c)

    functions = tree.findall('.//div[@class="function-entry"]')
    for f in functions:
        process_function(names, f)

    Path(out_dir).mkdir(parents=True, exist_ok=True)
    outfile = os.path.join(out_dir, target + ".json")
    with open(outfile, "w") as f:
        json.dump(names, f, indent=2)

# Folder names for jsdoc html
targets = [
    "source_1",
    "source_1_lazy",
    "source_1_wasm",
    "source_2",
    "source_2_lazy",
    "source_3",
    "source_3_concurrent",
    "source_3_non-det",
    "source_4",
    "External libraries",
]

for target in targets:
    if not os.path.exists(base_dir):
        print("""\
        Error: path to jsdoc html is invalid.
        Ensure that this script is run from the project root and documentation has been generated\
        """)
        exit(1)

    process_dir_globals(target)

