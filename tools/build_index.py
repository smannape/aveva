#!/usr/bin/env python3
"""Build assets/search-index.json for the client-side search.

Indexes every *.html page in the site root: each h1/h2/h3 section becomes one
entry {page, anchor, title, section, text}. Run from anywhere:

    python3 tools/build_index.py

No dependencies beyond the standard library.
"""
import html
import json
import os
import re
import sys
from html.parser import HTMLParser

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(SITE, "assets", "search-index.json")
SKIP_TAGS = {"script", "style", "nav", "header", "footer", "svg", "button"}


class Extractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.sections = []          # [{anchor, section, text}]
        self.cur = {"anchor": "", "section": "Introduction", "text": []}
        self.skip = 0
        self.in_title = False
        self.in_heading = None
        self.heading_buf = []
        self.in_main = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in SKIP_TAGS:
            self.skip += 1
        if tag == "main":
            self.in_main = True
        if tag == "title":
            self.in_title = True
        if self.in_main and tag in ("h1", "h2", "h3") and not self.skip:
            self._flush()
            self.in_heading = tag
            self.heading_buf = []
            self.cur = {"anchor": a.get("id", ""), "section": "", "text": []}
        if tag in ("td", "th", "li", "p", "br", "dd", "dt") and self.in_main:
            self.cur["text"].append(" ")

    def handle_endtag(self, tag):
        if tag in SKIP_TAGS and self.skip:
            self.skip -= 1
        if tag == "title":
            self.in_title = False
        if tag == "main":
            self._flush()
            self.in_main = False
        if self.in_heading and tag == self.in_heading:
            self.cur["section"] = " ".join("".join(self.heading_buf).split())
            self.in_heading = None

    def handle_data(self, data):
        if self.in_title:
            self.title += data
            return
        if self.skip or not self.in_main:
            return
        if self.in_heading:
            self.heading_buf.append(data)
        else:
            self.cur["text"].append(data)

    def _flush(self):
        text = " ".join("".join(self.cur["text"]).split())
        if text or self.cur["section"]:
            self.sections.append({"anchor": self.cur["anchor"], "section": self.cur["section"] or "Introduction", "text": text})
        self.cur = {"anchor": "", "section": "", "text": []}


def main():
    entries = []
    for name in sorted(os.listdir(SITE)):
        if not name.endswith(".html"):
            continue
        with open(os.path.join(SITE, name), encoding="utf-8") as f:
            p = Extractor()
            p.feed(f.read())
        page_title = p.title.split(" — ")[0].strip()
        for s in p.sections:
            if not s["text"]:
                continue
            entries.append({
                "page": name,
                "anchor": s["anchor"],
                "title": page_title,
                "section": s["section"],
                "text": s["text"][:2000],
            })
    # Relationship chart nodes, so a product search also lands on the chart.
    rel_path = os.path.join(SITE, "assets", "relations.json")
    if os.path.exists(rel_path):
        with open(rel_path, encoding="utf-8") as f:
            rel = json.load(f)
        layers = {l["id"]: l["name"] for l in rel["layers"]}
        labels = {n["id"]: n["label"] for n in rel["nodes"]}
        for n in rel["nodes"]:
            cons = [f'{n["label"]} {e["rel"]} {labels[e["to"]]} ({e["evidence"]})' if e["from"] == n["id"]
                    else f'{labels[e["from"]]} {e["rel"]} {n["label"]} ({e["evidence"]})'
                    for e in rel["edges"] if n["id"] in (e["from"], e["to"])]
            text = n["desc"] + (f'. Formerly {n["formerly"]}' if n.get("formerly") else "") + ". Layer: " + layers[n["layer"]] + ". " + "; ".join(cons)
            entries.append({"page": "relationships.html", "anchor": "", "title": "Relationships", "section": n["label"], "text": text})
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"built_from": "site/*.html", "entries": entries}, f, ensure_ascii=False, indent=0)
    # Also emit a script version so search works when pages are opened from disk (file://), where fetch() is blocked.
    with open(OUT.replace(".json", ".js"), "w", encoding="utf-8") as f:
        f.write("window.AVEVA_SEARCH_INDEX=" + json.dumps({"built_from": "site/*.html", "entries": entries}, ensure_ascii=False) + ";\n")
    print(f"wrote {OUT}: {len(entries)} entries from {len({e['page'] for e in entries})} pages")


if __name__ == "__main__":
    main()
