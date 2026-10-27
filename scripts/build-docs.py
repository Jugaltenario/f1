#!/usr/bin/env python
"""Build README.docx from README.md with a styled cover, TOC and screenshots."""

from __future__ import annotations

import re
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

ROOT = Path(__file__).resolve().parent.parent
README = ROOT / "README.md"
OUT = ROOT / "README.docx"

INK = RGBColor(0x11, 0x13, 0x18)
MUTED = RGBColor(0x5C, 0x61, 0x6B)
ACCENT = RGBColor(0xE1, 0x06, 0x00)
CODE_BG = "F2F3F5"
TABLE_HEAD = "15171C"
TABLE_ALT = "F7F7F9"


# ---------------------------------------------------------------------------
# Low-level helpers
# ---------------------------------------------------------------------------
def shade(element, fill: str) -> None:
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    element.get_or_add_pPr().append(shd)


def cell_shade(cell, fill: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def add_page_number(paragraph) -> None:
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.append(begin)
    run._r.append(instr)
    run._r.append(end)


def add_hyperlink(paragraph, text: str, url: str) -> None:
    part = paragraph.part
    r_id = part.relate_to(url, "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink", is_external=True)
    hyperlink = OxmlElement("w:hyperlink")
    hyperlink.set(qn("r:id"), r_id)
    run = OxmlElement("w:r")
    props = OxmlElement("w:rPr")
    color = OxmlElement("w:color")
    color.set(qn("w:val"), "C8102E")
    underline = OxmlElement("w:u")
    underline.set(qn("w:val"), "single")
    props.append(color)
    props.append(underline)
    run.append(props)
    text_el = OxmlElement("w:t")
    text_el.text = text
    run.append(text_el)
    hyperlink.append(run)
    paragraph._p.append(hyperlink)


INLINE = re.compile(r"(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))")


def add_inline(paragraph, text: str, size: Pt | None = None, color: RGBColor | None = None) -> None:
    for token in INLINE.split(text):
        if not token:
            continue
        if token.startswith("**") and token.endswith("**"):
            run = paragraph.add_run(token[2:-2])
            run.bold = True
        elif token.startswith("`") and token.endswith("`"):
            run = paragraph.add_run(token[1:-1])
            run.font.name = "Consolas"
            run.font.size = Pt(9)
            run.font.color.rgb = RGBColor(0x9A, 0x1B, 0x2E)
        elif token.startswith("[") and "](" in token:
            label, url = token[1:-1].split("](", 1)
            add_hyperlink(paragraph, label, url)
            continue
        else:
            run = paragraph.add_run(token)
        if size:
            run.font.size = size
        if color:
            run.font.color.rgb = color


# ---------------------------------------------------------------------------
# Document scaffolding
# ---------------------------------------------------------------------------
def configure(doc: Document) -> None:
    section = doc.sections[0]
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(2.1)
    section.bottom_margin = Cm(2.0)
    section.left_margin = Cm(2.2)
    section.right_margin = Cm(2.2)

    normal = doc.styles["Normal"]
    normal.font.name = "Segoe UI"
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = INK
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.22
    normal.element.rPr.rFonts.set(qn("w:eastAsia"), "Segoe UI")

    for name, size, color, before, after in [
        ("Heading 1", 24, INK, 0, 8),
        ("Heading 2", 16, ACCENT, 18, 6),
        ("Heading 3", 12.5, INK, 12, 4),
    ]:
        style = doc.styles[name]
        style.font.name = "Segoe UI"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = color
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.keep_with_next = True


def add_header_footer(doc: Document, title: str) -> None:
    section = doc.sections[0]
    header = section.header
    paragraph = header.paragraphs[0]
    paragraph.text = title
    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    for run in paragraph.runs:
        run.font.size = Pt(8)
        run.font.color.rgb = MUTED
    footer = section.footer
    paragraph = footer.paragraphs[0]
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = paragraph.add_run("Paddock · Formula 1 archive · ")
    run.font.size = Pt(8)
    run.font.color.rgb = MUTED
    add_page_number(paragraph)
    for run in paragraph.runs:
        run.font.size = Pt(8)
        run.font.color.rgb = MUTED


def cover(doc: Document, lines: list[str]) -> None:
    for _ in range(2):
        doc.add_paragraph()

    eyebrow = doc.add_paragraph()
    run = eyebrow.add_run("FET PROJECT  ·  FORMULA 1 ARCHIVE")
    run.font.size = Pt(10)
    run.bold = True
    run.font.color.rgb = MUTED
    run.font.name = "Consolas"
    eyebrow.paragraph_format.space_after = Pt(10)

    title = doc.add_paragraph()
    run = title.add_run("PADDOCK")
    run.font.size = Pt(62)
    run.bold = True
    run.font.color.rgb = INK
    title.paragraph_format.space_after = Pt(0)

    rule = doc.add_paragraph()
    rule.paragraph_format.space_before = Pt(4)
    rule.paragraph_format.space_after = Pt(12)
    p_pr = rule._p.get_or_add_pPr()
    borders = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "18")
    bottom.set(qn("w:color"), "E10600")
    borders.append(bottom)
    p_pr.append(borders)

    subtitle = doc.add_paragraph()
    run = subtitle.add_run("Every season since 2000. Every lap since 2023.")
    run.font.size = Pt(18)
    run.font.color.rgb = RGBColor(0x33, 0x36, 0x3D)
    subtitle.paragraph_format.space_after = Pt(18)

    body = doc.add_paragraph()
    run = body.add_run(
        "A brushed-silver Formula 1 archive built with Angular 21 and Material 3. "
        "The complete 2000–2026 dataset powers instant career, race and championship analysis, "
        "while OpenF1 adds session replay, live timing and car telemetry from 2023 to today."
    )
    run.font.size = Pt(11.5)
    run.font.color.rgb = MUTED
    body.paragraph_format.right_indent = Cm(2.2)
    body.paragraph_format.space_after = Pt(18)

    home = ROOT / "docs" / "screenshots" / "home.png"
    if home.exists():
        picture = doc.add_paragraph()
        picture.alignment = WD_ALIGN_PARAGRAPH.CENTER
        picture.add_run().add_picture(str(home), width=Cm(16.2))
        label = doc.add_paragraph()
        label.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = label.add_run("Home · silver editorial theme")
        run.font.size = Pt(8.5)
        run.font.color.rgb = MUTED

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    meta = doc.add_table(rows=0, cols=2)
    meta.alignment = WD_TABLE_ALIGNMENT.LEFT
    details = [
        ("Name", "Jugal Patel · Krish Patel · Paavan Sharma"),
        ("Enrolment no.", "24162581032 · 24162581017 · 24162581052"),
        ("Subject", "FET"),
        ("Document", "Project report and README"),
        ("Data scope", "Archive 2000–2026, reconciled 26 Oct 2026 · OpenF1 2023 → today"),
        ("Stack", "Angular 21 · Angular Material 3 · SCSS · Jolpica · OpenF1"),
    ]
    for key, value in details:
        row = meta.add_row().cells
        row[0].width = Cm(4)
        row[1].width = Cm(12)
        p = row[0].paragraphs[0]
        run = p.add_run(key.upper())
        run.font.size = Pt(8)
        run.bold = True
        run.font.color.rgb = MUTED
        p = row[1].paragraphs[0]
        run = p.add_run(value)
        run.font.size = Pt(10)
        run.font.color.rgb = INK

    doc.add_paragraph()

    links = doc.add_paragraph()
    run = links.add_run("Live app: ")
    run.font.size = Pt(9)
    run.font.color.rgb = MUTED
    add_hyperlink(links, "http://localhost:4200", "http://localhost:4200")
    run = links.add_run("   ·   API: ")
    run.font.size = Pt(9)
    run.font.color.rgb = MUTED
    add_hyperlink(links, "https://openf1.org", "https://openf1.org")

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


def contents(doc: Document, headings: list[str]) -> None:
    heading = doc.add_paragraph()
    run = heading.add_run("Contents")
    run.font.size = Pt(22)
    run.bold = True
    run.font.color.rgb = INK
    heading.paragraph_format.space_after = Pt(12)

    for index, title in enumerate(headings, start=1):
        row = doc.add_paragraph()
        row.paragraph_format.space_after = Pt(3)
        number = row.add_run(f"{index:02d}   ")
        number.font.name = "Consolas"
        number.font.size = Pt(9)
        number.font.color.rgb = ACCENT
        text = row.add_run(title)
        text.font.size = Pt(11)
        text.font.color.rgb = INK

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


# ---------------------------------------------------------------------------
# Markdown rendering
# ---------------------------------------------------------------------------
def split_row(line: str) -> list[str]:
    line = line.strip()
    if line.startswith("|"):
        line = line[1:]
    if line.endswith("|"):
        line = line[:-1]
    return [cell.strip() for cell in line.split("|")]


def is_separator(cells: list[str]) -> bool:
    return all(re.fullmatch(r":?-{2,}:?", cell.strip()) for cell in cells if cell.strip())


def render_table(doc: Document, rows: list[list[str]]) -> None:
    if not rows:
        return
    if all(not cell for row in rows for cell in row):
        return

    cols = max(len(row) for row in rows)
    table = doc.add_table(rows=0, cols=cols)
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    width = Cm(16.6) / cols

    for r_index, row in enumerate(rows):
        cells = table.add_row().cells
        for c_index in range(cols):
            cell = cells[c_index]
            cell.width = width
            value = row[c_index] if c_index < len(row) else ""
            paragraph = cell.paragraphs[0]
            paragraph.paragraph_format.space_before = Pt(3)
            paragraph.paragraph_format.space_after = Pt(3)

            image = re.fullmatch(r"!\[([^\]]*)\]\(([^)]+)\)", value)
            if image:
                rel = ROOT / image.group(2)
                if rel.exists():
                    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    paragraph.add_run().add_picture(str(rel), width=width - Cm(0.35))
                continue

            if r_index == 0:
                add_inline(paragraph, value, size=Pt(8.5), color=RGBColor(0xFF, 0xFF, 0xFF))
                for run in paragraph.runs:
                    run.bold = True
                cell_shade(cell, TABLE_HEAD)
            else:
                add_inline(paragraph, value, size=Pt(9))
                if r_index % 2 == 0:
                    cell_shade(cell, TABLE_ALT)

    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def render_code(doc: Document, lines: list[str]) -> None:
    for index, line in enumerate(lines):
        paragraph = doc.add_paragraph()
        paragraph.paragraph_format.space_before = Pt(4 if index == 0 else 0)
        paragraph.paragraph_format.space_after = Pt(4 if index == len(lines) - 1 else 0)
        paragraph.paragraph_format.left_indent = Cm(0.4)
        paragraph.paragraph_format.line_spacing = 1.0
        shade(paragraph._p, CODE_BG)
        run = paragraph.add_run(line if line else " ")
        run.font.name = "Consolas"
        run.font.size = Pt(8.5)
        run.font.color.rgb = RGBColor(0x25, 0x29, 0x31)


def render_markdown(doc: Document, markdown: str) -> None:
    lines = markdown.splitlines()
    buffer: list[str] = []
    in_code = False
    code: list[str] = []
    index = 0

    def flush() -> None:
        nonlocal buffer
        if buffer:
            paragraph = doc.add_paragraph()
            add_inline(paragraph, " ".join(buffer).strip())
            buffer = []

    while index < len(lines):
        line = lines[index]
        stripped = line.strip()

        if stripped.startswith("```"):
            flush()
            if in_code:
                render_code(doc, code)
                code = []
                in_code = False
            else:
                in_code = True
            index += 1
            continue

        if in_code:
            code.append(line)
            index += 1
            continue

        if not stripped:
            flush()
            index += 1
            continue

        if stripped == "---":
            flush()
            index += 1
            continue

        heading = re.match(r"^(#{1,3})\s+(.*)$", stripped)
        if heading:
            flush()
            level = len(heading.group(1))
            text = heading.group(2)
            if level == 1:
                paragraph = doc.add_paragraph(style="Heading 1")
                add_inline(paragraph, text)
                paragraph.paragraph_format.space_before = Pt(2)
            else:
                paragraph = doc.add_paragraph(style=f"Heading {level}")
                add_inline(paragraph, text)
            index += 1
            continue

        if stripped.startswith("|") and "|" in stripped[1:]:
            flush()
            rows = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                cells = split_row(lines[index])
                if not is_separator(cells):
                    rows.append(cells)
                index += 1
            render_table(doc, rows)
            continue

        bullets = re.match(r"^(\s*)-\s+(.*)$", line)
        if bullets:
            flush()
            indent = len(bullets.group(1))
            text = bullets.group(2)
            style = "List Bullet 2" if indent >= 2 else "List Bullet"
            paragraph = doc.add_paragraph(style=style)
            paragraph.paragraph_format.space_after = Pt(2)
            if text.startswith("[ ]"):
                text = "☐  " + text[3:].strip()
            elif text.startswith("[x]"):
                text = "☑  " + text[3:].strip()
            add_inline(paragraph, text)
            index += 1
            continue

        numbers = re.match(r"^(\d+)\.\s+(.*)$", stripped)
        if numbers:
            flush()
            paragraph = doc.add_paragraph(style="List Number")
            paragraph.paragraph_format.space_after = Pt(2)
            add_inline(paragraph, numbers.group(2))
            index += 1
            continue

        if stripped.startswith(">"):
            flush()
            paragraph = doc.add_paragraph()
            paragraph.paragraph_format.left_indent = Cm(0.6)
            run = paragraph.add_run(stripped.lstrip("> ").strip())
            run.italic = True
            run.font.color.rgb = MUTED
            index += 1
            continue

        image = re.fullmatch(r"!\[([^\]]*)\]\(([^)]+)\)", stripped)
        if image:
            flush()
            rel = ROOT / image.group(2)
            if rel.exists():
                paragraph = doc.add_paragraph()
                paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
                paragraph.add_run().add_picture(str(rel), width=Cm(16.0))
                caption = doc.add_paragraph()
                caption.alignment = WD_ALIGN_PARAGRAPH.CENTER
                run = caption.add_run(image.group(1))
                run.italic = True
                run.font.size = Pt(8.5)
                run.font.color.rgb = MUTED
            index += 1
            continue

        buffer.append(stripped)
        index += 1

    flush()
    if in_code and code:
        render_code(doc, code)


# ---------------------------------------------------------------------------
def main() -> None:
    markdown = README.read_text(encoding="utf-8")
    doc = Document()
    configure(doc)
    add_header_footer(doc, "Paddock · Formula 1 archive")

    # Cover + contents are built before the body, so the body starts on page 3.
    cover(doc, [])

    headings = [
        heading
        for heading in re.findall(r"^##\s+(.+)$", markdown, flags=re.MULTILINE)
        if heading.strip().lower() != "table of contents"
    ]
    contents(doc, headings)

    # The README title/intro are represented by the cover, and the generated
    # contents page replaces the markdown table of contents.
    body = markdown.split("\n---\n", 1)[-1]
    body = re.sub(r"^## Table of contents\s*$.*?(?=^## )", "", body, flags=re.MULTILINE | re.DOTALL)
    render_markdown(doc, body)

    doc.save(OUT)
    print(f"Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
