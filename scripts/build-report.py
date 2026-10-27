#!/usr/bin/env python
"""Build Micro_Project_Report.docx from the live source tree.

The report is generated, not hand-maintained: prose lives in this script,
code listings are sliced out of the real TypeScript/SCSS files, diagrams are
drawn with matplotlib, and screenshots come from docs/screenshots. If a marker
in the source disappears the build fails loudly rather than printing stale code.
"""

from __future__ import annotations

import math
import re
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import Circle, FancyArrowPatch, FancyBboxPatch

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend" / "src" / "app"
SCREENSHOTS = ROOT / "docs" / "screenshots"
FIGURES = ROOT / "docs" / "report" / "figures"
OUT = ROOT / "Micro_Project_Report.docx"

INK = RGBColor(0x11, 0x13, 0x18)
BODY = RGBColor(0x2A, 0x2F, 0x36)
MUTED = RGBColor(0x5C, 0x61, 0x6B)
ACCENT = RGBColor(0xE1, 0x06, 0x00)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
CODE_INK = RGBColor(0x24, 0x29, 0x30)

PAGE_BG = "#F6F7F8"
PANEL_BG = "#FFFFFF"
PANEL_EDGE = "#D5DADE"
FIELD_BG = "#EEF0F2"
SILVER_TEXT = "#5C616B"
RED = "#E10600"
DARK = "#121517"

TABLE_HEAD = "15171C"
TABLE_ALT = "F7F7F9"
CODE_BG = "F4F5F7"

FIG_WIDTH = Cm(16.4)
SHOT_WIDTH = Cm(16.4)

# ---------------------------------------------------------------------------
# Source helpers
# ---------------------------------------------------------------------------


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def excerpt(rel: str, start: str, end: str) -> str:
    """Return the lines from the line containing *start* up to (excluding) *end*."""
    lines = read(rel).splitlines()
    try:
        first = next(i for i, line in enumerate(lines) if start in line)
    except StopIteration as exc:  # pragma: no cover - build-time guard
        raise SystemExit(f"source marker not found in {rel}: {start!r}") from exc
    try:
        last = next(j for j in range(first + 1, len(lines)) if end in lines[j])
    except StopIteration as exc:  # pragma: no cover - build-time guard
        raise SystemExit(f"end marker not found in {rel}: {end!r}") from exc
    block = lines[first:last]
    while block and not block[-1].strip():
        block.pop()
    if not block:
        raise SystemExit(f"empty excerpt in {rel}: {start!r}")
    return "\n".join(block)


def line_count(rel: str) -> int:
    return len(read(rel).splitlines())


# ---------------------------------------------------------------------------
# Diagrams
# ---------------------------------------------------------------------------


def _canvas(width: float = 10.0, height: float = 5.4):
    fig, ax = plt.subplots(figsize=(width, height), dpi=200)
    fig.patch.set_facecolor(PAGE_BG)
    ax.set_facecolor(PAGE_BG)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis("off")
    return fig, ax


def _box(ax, x, y, w, h, title, detail="", fill=PANEL_BG, edge=PANEL_EDGE, size=9.4, detail_size=7.6):
    patch = FancyBboxPatch(
        (x, y), w, h,
        boxstyle="round,pad=0.35,rounding_size=1.1",
        linewidth=0.9, edgecolor=edge, facecolor=fill, zorder=2,
    )
    ax.add_patch(patch)
    if detail:
        ax.text(x + w / 2, y + h * 0.62, title, ha="center", va="center",
                fontsize=size, color=DARK, fontweight="bold", zorder=3)
        ax.text(x + w / 2, y + h * 0.31, detail, ha="center", va="center",
                fontsize=detail_size, color=SILVER_TEXT, zorder=3, linespacing=1.35)
    else:
        ax.text(x + w / 2, y + h / 2, title, ha="center", va="center",
                fontsize=size, color=DARK, fontweight="bold", zorder=3, linespacing=1.35)


def _arrow(ax, x1, y1, x2, y2, color="#8D949B", style="-|>", width=0.9, rad=0.0):
    ax.add_patch(FancyArrowPatch(
        (x1, y1), (x2, y2),
        arrowstyle=style, mutation_scale=11,
        linewidth=width, color=color,
        connectionstyle=f"arc3,rad={rad}", zorder=1,
    ))


def _band(ax, y, label):
    ax.text(2.0, y, label.upper(), rotation=90, ha="center", va="center",
            fontsize=6.6, color=RED, fontweight="bold")


def figure_architecture() -> Path:
    FIGURES.mkdir(parents=True, exist_ok=True)
    fig, ax = _canvas(10.0, 5.9)

    _band(ax, 83, "presentation")
    _band(ax, 62, "application")
    _band(ax, 41, "domain")
    _band(ax, 18, "data")

    # Presentation layer
    _box(ax, 7, 77, 20, 13, "Home", "hero · 2026 top five\nlatest + next race", fill=FIELD_BG)
    _box(ax, 29, 77, 21, 13, "10 lazy pages", "standings · drivers · teams\ncircuits · races · detail", fill=FIELD_BG)
    _box(ax, 52, 77, 20, 13, "Live & long-form", "live timing · history\nrivalry · credits", fill=FIELD_BG)
    _box(ax, 74, 77, 19, 13, "Shared library", "panel · header · tile\navatar · badge · charts", fill=FIELD_BG)

    # Application layer
    _box(ax, 7, 56, 20, 13, "Router", "11 lazy routes\n/timeline redirect")
    _box(ax, 29, 56, 21, 13, "Signals + computed", "loading · error · selection\nderived view models")
    _box(ax, 52, 56, 20, 13, "HTTP + Material", "HttpClient · dialogs\nscrolling + a11y")
    _box(ax, 74, 56, 19, 13, "Shell", "skip link · navbar\noutlet · footer · maps")

    # Domain layer
    _box(ax, 7, 35, 30, 13, "CSVDataService", "forkJoin · PapaParse · indexes\ncareers · standings · rivalry", fill="#FBECEB", edge="#E8B9B6")
    _box(ax, 39, 35, 30, 13, "OpenF1Service", "token bucket · replay cache\nlive board · lap telemetry", fill="#FBECEB", edge="#E8B9B6")
    _box(ax, 71, 35, 22, 13, "Models + config", "data scope · team colours\nasset + outline manifests")

    # Data layer
    _box(ax, 7, 7, 27, 16, "Bundled archive", "9 CSV files + meta.json\n27 seasons · 1.3 MB", fill="#E8EAED")
    _box(ax, 36, 7, 27, 16, "Local imagery", "logos · maps · portraits\ncredits manifest", fill="#E8EAED")
    _box(ax, 65, 7, 28, 16, "OpenF1 REST", "api.openf1.org/v1\n3 requests / second", fill="#E8EAED")

    for x in (17, 39.5, 62, 83.5):
        _arrow(ax, x, 77, x, 69.4)
        _arrow(ax, x, 56, x, 48.4)
    _arrow(ax, 22, 35, 22, 23.4)
    _arrow(ax, 54, 35, 50, 23.4)
    _arrow(ax, 82, 35, 79, 23.4)

    fig.savefig(FIGURES / "architecture.png", bbox_inches="tight", facecolor=PAGE_BG)
    plt.close(fig)
    return FIGURES / "architecture.png"


def figure_pipeline() -> Path:
    FIGURES.mkdir(parents=True, exist_ok=True)
    fig, ax = _canvas(10.0, 5.2)

    _box(ax, 3, 72, 25, 15, "Ergast archive", "1950–2024 dump\nfull source dataset", fill="#E8EAED")
    _box(ax, 3, 42, 25, 15, "Jolpica API", "2025 → 26 Oct 2026\n100 rows per request", fill="#E8EAED")
    _box(ax, 3, 12, 25, 15, "OpenF1 API", "2023 → today\nsessions · telemetry", fill="#E8EAED")

    _box(ax, 36, 72, 27, 15, "prune-archive.mjs", "keep 2000–2024\nrebuild season standings")
    _box(ax, 36, 42, 27, 15, "sync-current-season.mjs", "append races + results\nsynthesise race IDs")
    _box(ax, 36, 12, 27, 15, "OpenF1Service", "token bucket · cache\nwindowed lap queries")

    _box(ax, 71, 55, 26, 32, "Bundled archive", "frontend/src/assets/archive\n\n9 CSV files + meta.json\n27 seasons · 526 races\n10,954 results", fill="#FBECEB", edge="#E8B9B6")
    _box(ax, 71, 12, 26, 32, "Indexed in browser", "CoreData maps + arrays\n\ncareers · champions\nstandings · rivalries\nlatest / next race", fill="#FBECEB", edge="#E8B9B6")

    _arrow(ax, 28, 79.5, 36, 79.5)
    _arrow(ax, 28, 49.5, 36, 49.5)
    _arrow(ax, 63, 79.5, 71, 74)
    _arrow(ax, 63, 49.5, 71, 61)
    _arrow(ax, 63, 19.5, 71, 28)
    _arrow(ax, 84, 55, 84, 44)

    ax.text(84, 49.5, "once per app load", ha="center", va="center",
            fontsize=7, color=SILVER_TEXT, style="italic")

    fig.savefig(FIGURES / "pipeline.png", bbox_inches="tight", facecolor=PAGE_BG)
    plt.close(fig)
    return FIGURES / "pipeline.png"


def figure_planning() -> Path:
    FIGURES.mkdir(parents=True, exist_ok=True)
    fig, ax = plt.subplots(figsize=(10.0, 4.6), dpi=200)
    fig.patch.set_facecolor(PAGE_BG)
    ax.set_facecolor(PAGE_BG)

    phases = [
        ("Scope and data audit", 0.5, 2.0, "Archive window, 2026 calendar, feature shortlist"),
        ("Data foundation", 2.0, 2.5, "Prune, sync, schema, counts"),
        ("Archive screens", 4.0, 3.0, "Home, standings, drivers, teams, circuits, races"),
        ("Live and long-form", 6.5, 2.5, "Race detail, OpenF1 replay, history, rivalry"),
        ("Design and background", 8.5, 2.5, "Tokens, silver system, map field, responsive"),
        ("Verification and documents", 10.5, 2.5, "Build, smoke tests, screenshots, report"),
    ]

    for i, (name, start, length, detail) in enumerate(phases):
        y = len(phases) - i
        colour = RED if i in (2, 5) else "#C9CED4"
        ax.add_patch(FancyBboxPatch(
            (start, y - 0.26), length, 0.52,
            boxstyle="round,pad=0.02,rounding_size=0.12",
            facecolor=colour, edgecolor="none", zorder=2,
        ))
        ax.text(start + 0.08, y + 0.38, name, fontsize=8.6, color=DARK, fontweight="bold", va="bottom")
        ax.text(start + length + 0.1, y, detail, fontsize=7.0, color=SILVER_TEXT, va="center")

    ax.set_xlim(0, 17.4)
    ax.set_ylim(0.4, len(phases) + 1.0)
    ax.set_yticks([])
    ax.set_xticks([0, 2, 4, 6, 8, 10, 12, 13])
    ax.set_xticklabels(["0", "2", "4", "6", "8", "10", "12", "13 weeks"], fontsize=7.5, color=SILVER_TEXT)
    for spine in ("top", "right", "left"):
        ax.spines[spine].set_visible(False)
    ax.spines["bottom"].set_color(PANEL_EDGE)
    ax.tick_params(axis="x", length=0, pad=6)
    ax.grid(axis="x", color=PANEL_EDGE, linewidth=0.6, linestyle=(0, (2, 3)), zorder=0)

    for week, label in [(2.0, "data locked"), (7.0, "live replay"), (11.0, "feature freeze")]:
        ax.axvline(week, color="#9AA1A8", linewidth=0.7, linestyle=(0, (1, 3)), zorder=0)
        ax.text(week, len(phases) + 0.72, label, fontsize=6.6, color=SILVER_TEXT,
                ha="center", va="center", style="italic")

    fig.savefig(FIGURES / "planning.png", bbox_inches="tight", facecolor=PAGE_BG)
    plt.close(fig)
    return FIGURES / "planning.png"


def _track(ax, cx, cy, size, phase, alpha=0.2, lw=0.8):
    t = np.linspace(0, 2 * np.pi, 220)
    wobble = 0.30 + 0.12 * np.sin(3 * t + phase) + 0.07 * np.cos(5 * t + phase * 1.7)
    x = cx + size * wobble * np.cos(t)
    y = cy + size * wobble * np.sin(t) * 0.72
    ax.plot(x, y, color="#0B0D0F", alpha=alpha, linewidth=lw, solid_capstyle="round")


def figure_background() -> Path:
    FIGURES.mkdir(parents=True, exist_ok=True)
    fig, axes = plt.subplots(1, 3, figsize=(10.0, 3.9), dpi=200)
    fig.patch.set_facecolor(PAGE_BG)

    versions = [
        ("v1 · 12 tracks", "corner collage · heavy pile", "bottom-right", 12, 0.10),
        ("v2 · 24 tracks", "centroid 71 / 67 · 15:1 imbalance", "biased field", 24, 0.13),
        ("v3 · 30 tracks", "centroid 49 / 51 · ~1:1 balance", "full 6×5 field", 30, 0.20),
    ]

    rng = np.random.default_rng(7)

    for idx, (ax, (title, subtitle, field, count, alpha)) in enumerate(zip(axes, versions)):
        ax.set_facecolor("#FBFBFC")
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)
        ax.set_xticks([])
        ax.set_yticks([])
        for spine in ax.spines.values():
            spine.set_color(PANEL_EDGE)
            spine.set_linewidth(0.8)

        if idx == 0:
            positions = [(0.62 + rng.random() * 0.36, 0.04 + rng.random() * 0.34) for _ in range(count)]
            local_alpha = [0.07 + rng.random() * 0.12 for _ in range(count)]
        elif idx == 1:
            positions = []
            while len(positions) < count:
                x, y = rng.random(), rng.random()
                if (x + (1 - y)) > 0.75 or rng.random() < 0.18:
                    positions.append((x, y))
            local_alpha = [0.07 + rng.random() * 0.12 for _ in range(count)]
        else:
            positions = [((col + 0.5 + (0.5 if row % 2 else 0)) / 6, (row + 0.5) / 5)
                         for row in range(5) for col in range(6)]
            positions = [(x + (rng.random() - 0.5) * 0.05, y + (rng.random() - 0.5) * 0.04)
                         for x, y in positions]
            local_alpha = [0.20] * count

        for i, (x, y) in enumerate(positions):
            _track(ax, x, y, 0.085 if idx == 2 else 0.095, i * 1.7,
                   alpha=local_alpha[i], lw=0.85)

        ax.set_title(title, fontsize=9.2, color=DARK, fontweight="bold", pad=8)
        ax.text(0.5, -0.07, subtitle, transform=ax.transAxes, ha="center", va="top",
                fontsize=6.8, color=SILVER_TEXT)
        ax.text(0.5, -0.145, field, transform=ax.transAxes, ha="center", va="top",
                fontsize=6.8, color=RED, fontweight="bold")

    fig.subplots_adjust(wspace=0.14, bottom=0.16)
    fig.savefig(FIGURES / "background-evolution.png", bbox_inches="tight", facecolor=PAGE_BG)
    plt.close(fig)
    return FIGURES / "background-evolution.png"


def build_figures() -> dict[str, Path]:
    return {
        "architecture": figure_architecture(),
        "pipeline": figure_pipeline(),
        "planning": figure_planning(),
        "background": figure_background(),
    }


# ---------------------------------------------------------------------------
# Low-level DOCX helpers
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


def set_cell_margins(cell, top=80, bottom=80, left=110, right=110) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    mar = OxmlElement("w:tcMar")
    for key, value in (("top", top), ("left", left), ("bottom", bottom), ("right", right)):
        node = OxmlElement(f"w:{key}")
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")
        mar.append(node)
    tc_pr.append(mar)


def set_table_borders(table, color=PANEL_EDGE.replace("#", ""), size=4, accent_left=False) -> None:
    tbl_pr = table._tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = OxmlElement(f"w:{edge}")
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), str(size))
        el.set(qn("w:space"), "0")
        el.set(qn("w:color"), color)
        borders.append(el)
    tbl_pr.append(borders)
    if accent_left:
        first = table.cell(0, 0)._tc
        tc_pr = first.get_or_add_tcPr()
        tc_borders = OxmlElement("w:tcBorders")
        left = OxmlElement("w:left")
        left.set(qn("w:val"), "single")
        left.set(qn("w:sz"), "18")
        left.set(qn("w:space"), "0")
        left.set(qn("w:color"), "E10600")
        tc_borders.append(left)
        tc_pr.append(tc_borders)


def repeat_header(row) -> None:
    tr_pr = row._tr.get_or_add_trPr()
    header = OxmlElement("w:tblHeader")
    header.set(qn("w:val"), "true")
    tr_pr.append(header)


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
    r_id = part.relate_to(
        url,
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink",
        is_external=True,
    )
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


INLINE = re.compile(r"(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)")


def add_inline(paragraph, text: str, size: Pt | None = None, color: RGBColor | None = None,
               italic: bool = False) -> None:
    for token in INLINE.split(text):
        if not token:
            continue
        if token.startswith("**") and token.endswith("**"):
            run = paragraph.add_run(token[2:-2])
            run.bold = True
        elif token.startswith("`") and token.endswith("`"):
            run = paragraph.add_run(token[1:-1])
            run.font.name = "Consolas"
            run.font.size = Pt((size.pt if size else 10.5) - 1.1)
            run.font.color.rgb = RGBColor(0x9A, 0x1B, 0x2E)
        elif token.startswith("[") and "](" in token:
            label, url = token[1:-1].split("](", 1)
            add_hyperlink(paragraph, label, url)
            continue
        elif token.startswith("*") and token.endswith("*") and len(token) > 2:
            run = paragraph.add_run(token[1:-1])
            run.italic = True
        else:
            run = paragraph.add_run(token)
        if size:
            run.font.size = size
        if color:
            run.font.color.rgb = color
        if italic:
            run.italic = True


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
    section.different_first_page_header_footer = True

    normal = doc.styles["Normal"]
    normal.font.name = "Segoe UI"
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = BODY
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.22
    normal.element.rPr.rFonts.set(qn("w:eastAsia"), "Segoe UI")

    for name, size, color, before, after in [
        ("Heading 1", 23, INK, 0, 10),
        ("Heading 2", 15, ACCENT, 17, 5),
        ("Heading 3", 11.8, INK, 12, 3),
    ]:
        style = doc.styles[name]
        style.font.name = "Segoe UI"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = color
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.keep_with_next = True

    for name in ("List Bullet", "List Number"):
        style = doc.styles[name]
        style.font.name = "Segoe UI"
        style.font.size = Pt(10.5)
        style.font.color.rgb = BODY
        style.paragraph_format.space_after = Pt(3)
        style.paragraph_format.line_spacing = 1.18


def add_header_footer(doc: Document) -> None:
    section = doc.sections[0]
    header = section.header
    paragraph = header.paragraphs[0]
    paragraph.text = "Paddock — Formula 1 Archive  ·  Micro Project Report"
    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    for run in paragraph.runs:
        run.font.size = Pt(8)
        run.font.color.rgb = MUTED

    footer = section.footer
    paragraph = footer.paragraphs[0]
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = paragraph.add_run("Jugal Patel · Krish Patel · Paavan Sharma   ·   ")
    run.font.size = Pt(8)
    run.font.color.rgb = MUTED
    add_page_number(paragraph)
    for run in paragraph.runs:
        run.font.size = Pt(8)
        run.font.color.rgb = MUTED


def h1(doc: Document, text: str) -> None:
    global _first_heading
    if not _first_heading:
        doc.add_page_break()
    _first_heading = False
    doc.add_heading(text, level=1)


def h2(doc: Document, text: str) -> None:
    doc.add_heading(text, level=2)


def h3(doc: Document, text: str) -> None:
    doc.add_heading(text, level=3)


def p(doc: Document, text: str, size: Pt | None = None, color: RGBColor | None = None,
      space_after: float = 6, align=None, italic: bool = False, keep_with_next: bool = False):
    paragraph = doc.add_paragraph()
    add_inline(paragraph, text, size=size, color=color, italic=italic)
    paragraph.paragraph_format.space_after = Pt(space_after)
    if align is not None:
        paragraph.alignment = align
    if keep_with_next:
        paragraph.paragraph_format.keep_with_next = True
    return paragraph


def lead(doc: Document, text: str) -> None:
    p(doc, text, size=Pt(11.4), color=RGBColor(0x3A, 0x40, 0x48), space_after=10)


def bullets(doc: Document, items: list[str]) -> None:
    for item in items:
        paragraph = doc.add_paragraph(style="List Bullet")
        add_inline(paragraph, item)
        paragraph.paragraph_format.left_indent = Cm(0.6)
        paragraph.paragraph_format.first_line_indent = Cm(-0.35)


def numbered(doc: Document, items: list[str]) -> None:
    for item in items:
        paragraph = doc.add_paragraph(style="List Number")
        add_inline(paragraph, item)
        paragraph.paragraph_format.left_indent = Cm(0.65)
        paragraph.paragraph_format.first_line_indent = Cm(-0.4)


def caption(doc: Document, text: str, above: bool = False) -> None:
    paragraph = doc.add_paragraph()
    run = paragraph.add_run(text)
    run.font.size = Pt(8.4)
    run.font.color.rgb = MUTED
    run.italic = True
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER if not above else WD_ALIGN_PARAGRAPH.LEFT
    paragraph.paragraph_format.space_before = Pt(3 if not above else 8)
    paragraph.paragraph_format.space_after = Pt(10 if not above else 3)
    paragraph.paragraph_format.keep_with_next = above


def figure(doc: Document, path: Path, label: str, width=SHOT_WIDTH) -> None:
    if not path.exists():
        raise SystemExit(f"missing figure: {path}")
    picture = doc.add_paragraph()
    picture.alignment = WD_ALIGN_PARAGRAPH.CENTER
    picture.paragraph_format.space_before = Pt(6)
    picture.paragraph_format.space_after = Pt(2)
    picture.paragraph_format.keep_with_next = True
    picture.add_run().add_picture(str(path), width=width)
    caption(doc, label)


def table(doc: Document, headers: list[str], rows: list[list[str]], widths: list[float],
          label: str | None = None, font_size: float = 8.7, header_size: float = 7.8) -> None:
    if label:
        caption(doc, label, above=True)
    matrix = doc.add_table(rows=1, cols=len(headers))
    matrix.alignment = WD_TABLE_ALIGNMENT.CENTER
    matrix.autofit = False
    set_table_borders(matrix)
    header_cells = matrix.rows[0].cells
    repeat_header(matrix.rows[0])
    for i, (cell, text) in enumerate(zip(header_cells, headers)):
        cell.width = Cm(widths[i])
        cell_shade(cell, TABLE_HEAD)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        set_cell_margins(cell, top=70, bottom=70)
        paragraph = cell.paragraphs[0]
        paragraph.paragraph_format.space_after = Pt(0)
        run = paragraph.add_run(text.upper())
        run.font.name = "Segoe UI"
        run.font.size = Pt(header_size)
        run.font.bold = True
        run.font.color.rgb = WHITE
    for index, row in enumerate(rows):
        cells = matrix.add_row().cells
        for i, (cell, text) in enumerate(zip(cells, row)):
            cell.width = Cm(widths[i])
            if index % 2:
                cell_shade(cell, TABLE_ALT)
            cell.vertical_alignment = WD_ALIGN_VERTICAL.TOP
            set_cell_margins(cell, top=55, bottom=55)
            paragraph = cell.paragraphs[0]
            paragraph.paragraph_format.space_after = Pt(0)
            paragraph.paragraph_format.line_spacing = 1.1
            add_inline(paragraph, text, size=Pt(font_size))
    doc.add_paragraph().paragraph_format.space_after = Pt(0)


def code_listing(doc: Document, code: str, label: str, lang: str = "typescript") -> None:
    caption(doc, f"{label}  ·  {lang}", above=True)
    matrix = doc.add_table(rows=1, cols=1)
    matrix.alignment = WD_TABLE_ALIGNMENT.CENTER
    matrix.autofit = False
    cell = matrix.cell(0, 0)
    cell.width = Cm(16.4)
    cell_shade(cell, CODE_BG)
    set_table_borders(matrix, color="E2E4E7", size=4, accent_left=True)
    set_cell_margins(cell, top=110, bottom=110, left=150, right=120)
    paragraph = cell.paragraphs[0]
    paragraph.paragraph_format.space_after = Pt(0)
    paragraph.paragraph_format.line_spacing = 1.0
    for index, line in enumerate(code.splitlines()):
        if index:
            paragraph.add_run().add_break()
        run = paragraph.add_run(line if line.strip() else " ")
        run.font.name = "Consolas"
        run.font.size = Pt(7.5)
        run.font.color.rgb = CODE_INK
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def callout(doc: Document, title: str, text: str) -> None:
    matrix = doc.add_table(rows=1, cols=1)
    matrix.alignment = WD_TABLE_ALIGNMENT.CENTER
    matrix.autofit = False
    cell = matrix.cell(0, 0)
    cell.width = Cm(16.4)
    cell_shade(cell, "F1F2F4")
    set_table_borders(matrix, color="E2E4E7", size=4, accent_left=True)
    set_cell_margins(cell, top=130, bottom=130, left=190, right=170)
    paragraph = cell.paragraphs[0]
    paragraph.paragraph_format.space_after = Pt(2)
    run = paragraph.add_run(title.upper())
    run.font.name = "Segoe UI"
    run.font.size = Pt(7.8)
    run.font.bold = True
    run.font.color.rgb = ACCENT
    body = cell.add_paragraph()
    body.paragraph_format.space_after = Pt(0)
    body.paragraph_format.line_spacing = 1.15
    add_inline(body, text, size=Pt(9.5))
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def add_toc(doc: Document) -> None:
    paragraph = doc.add_paragraph()
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = ' TOC \\o "1-2" \\h \\z \\u '
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    placeholder = OxmlElement("w:t")
    placeholder.text = "Contents update when the document is opened in Word."
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.append(begin)
    run._r.append(instr)
    run._r.append(separate)
    run._r.append(placeholder)
    run._r.append(end)


def enable_field_update(doc: Document) -> None:
    settings = doc.settings.element
    update = OxmlElement("w:updateFields")
    update.set(qn("w:val"), "true")
    settings.append(update)


# ---------------------------------------------------------------------------
# Front matter
# ---------------------------------------------------------------------------


def cover(doc: Document) -> None:
    for _ in range(2):
        doc.add_paragraph()

    eyebrow = doc.add_paragraph()
    run = eyebrow.add_run("MICRO PROJECT REPORT   ·   SEMESTER 5   ·   FET")
    run.font.name = "Consolas"
    run.font.size = Pt(9.5)
    run.bold = True
    run.font.color.rgb = MUTED
    eyebrow.paragraph_format.space_after = Pt(14)

    title = doc.add_paragraph()
    run = title.add_run("PADDOCK")
    run.font.size = Pt(66)
    run.bold = True
    run.font.color.rgb = INK
    title.paragraph_format.space_after = Pt(0)
    title.paragraph_format.line_spacing = 0.95

    subtitle = doc.add_paragraph()
    run = subtitle.add_run("Formula 1 Archive")
    run.font.size = Pt(24)
    run.font.color.rgb = RGBColor(0x33, 0x36, 0x3D)
    subtitle.paragraph_format.space_after = Pt(10)

    rule = doc.add_paragraph()
    rule.paragraph_format.space_before = Pt(2)
    rule.paragraph_format.space_after = Pt(18)
    p_pr = rule._p.get_or_add_pPr()
    borders = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "20")
    bottom.set(qn("w:color"), "E10600")
    borders.append(bottom)
    p_pr.append(borders)

    label = doc.add_paragraph()
    run = label.add_run("SUBMITTED BY")
    run.font.name = "Consolas"
    run.font.size = Pt(8)
    run.bold = True
    run.font.color.rgb = MUTED
    label.paragraph_format.space_after = Pt(8)

    students = [
        ("Jugal Patel", "24162581032"),
        ("Krish Patel", "24162581017"),
        ("Paavan Sharma", "24162581052"),
    ]
    for name, enrolment in students:
        line = doc.add_paragraph()
        line.paragraph_format.space_after = Pt(2)
        run = line.add_run(name)
        run.font.size = Pt(13)
        run.bold = True
        run.font.color.rgb = INK
        run = line.add_run("   —   ")
        run.font.size = Pt(11)
        run.font.color.rgb = MUTED
        run = line.add_run(enrolment)
        run.font.name = "Consolas"
        run.font.size = Pt(10.5)
        run.font.color.rgb = RGBColor(0x3A, 0x40, 0x48)

    doc.add_paragraph().paragraph_format.space_after = Pt(4)

    body = doc.add_paragraph()
    run = body.add_run(
        "A complete Formula 1 archive covering every season from 2000 to 2026, "
        "built as an Angular single-page application with a bundled 1.3 MB dataset, "
        "a full OpenF1 live-timing layer and a brushed-silver editorial design system."
    )
    run.font.size = Pt(11)
    run.font.color.rgb = MUTED
    body.paragraph_format.right_indent = Cm(2.6)
    body.paragraph_format.space_after = Pt(22)

    facts = doc.add_table(rows=2, cols=2)
    facts.alignment = WD_TABLE_ALIGNMENT.LEFT
    facts.autofit = False
    entries = [
        ("DATE", "27 October 2026"),
        ("DATA THROUGH", "26 October 2026"),
        ("STACK", "Angular 21 · Material 3 · OpenF1"),
        ("DOCUMENT", "Code, planning and interface report"),
    ]
    for i, (key, value) in enumerate(entries):
        cell = facts.cell(i // 2, i % 2)
        cell.width = Cm(8)
        paragraph = cell.paragraphs[0]
        paragraph.paragraph_format.space_after = Pt(1)
        run = paragraph.add_run(key)
        run.font.name = "Consolas"
        run.font.size = Pt(7.2)
        run.bold = True
        run.font.color.rgb = MUTED
        second = cell.add_paragraph()
        second.paragraph_format.space_after = Pt(10)
        run = second.add_run(value)
        run.font.size = Pt(10)
        run.font.color.rgb = INK

    doc.add_page_break()


def details_page(doc: Document, figs: dict[str, Path]) -> None:
    heading = doc.add_paragraph()
    run = heading.add_run("Project at a glance")
    run.font.size = Pt(19)
    run.bold = True
    run.font.color.rgb = INK
    heading.paragraph_format.space_after = Pt(2)

    sub = doc.add_paragraph()
    run = sub.add_run("The numbers, the scope and the three people who built it.")
    run.font.size = Pt(10)
    run.font.color.rgb = MUTED
    sub.paragraph_format.space_after = Pt(14)

    stats = [
        ("27", "seasons bundled"),
        ("526", "races indexed"),
        ("10,954", "race results"),
        ("11", "screens shipped"),
    ]
    strip = doc.add_table(rows=1, cols=4)
    strip.alignment = WD_TABLE_ALIGNMENT.CENTER
    strip.autofit = False
    for i, (value, label_text) in enumerate(stats):
        cell = strip.cell(0, i)
        cell.width = Cm(4.1)
        cell_shade(cell, "F1F2F4")
        set_cell_margins(cell, top=150, bottom=150, left=120, right=80)
        number = cell.paragraphs[0]
        number.paragraph_format.space_after = Pt(0)
        run = number.add_run(value)
        run.font.size = Pt(23)
        run.bold = True
        run.font.color.rgb = INK
        label_para = cell.add_paragraph()
        label_para.paragraph_format.space_after = Pt(0)
        run = label_para.add_run(label_text.upper())
        run.font.name = "Consolas"
        run.font.size = Pt(7)
        run.font.color.rgb = MUTED
    doc.add_paragraph().paragraph_format.space_after = Pt(0)

    facts = [
        ("Report title", "Paddock — Formula 1 Archive: code, planning and interface"),
        ("Subject / semester", "FET · Semester 5"),
        ("Students", "Jugal Patel (24162581032) · Krish Patel (24162581017) · Paavan Sharma (24162581052)"),
        ("Archive scope", "2000–2026, reconciled to 26 October 2026"),
        ("Live-data scope", "OpenF1, 2023 to the present; replay-first, optional paid token"),
        ("Frontend", "Angular 21.2 standalone · signals · Angular Material 21 · SCSS"),
        ("Data", "9 CSV files + meta.json · PapaParse · RxJS · Jolpica and OpenF1 REST"),
        ("Build", "Angular CLI 21 / esbuild · 580.38 kB raw / 154.23 kB transferred"),
        ("Document", "Generated from the live source tree; code listings are read from source"),
        ("Date", "27 October 2026"),
    ]
    table(doc, ["Item", "Detail"], [[k, v] for k, v in facts], [3.6, 12.8],
          label="Table 1 — Project identification", font_size=8.6)

    p(doc,
      "This document is written to be read alongside the repository. It explains what the application does, "
      "how the data reaches the screen, why the interface looks the way it does, and how the finished build was "
      "verified. Every code listing is sliced from the working tree at build time, so the report cannot quietly "
      "drift away from the implementation it describes.",
      space_after=8)

    home = SCREENSHOTS / "home.png"
    if home.exists():
        figure(doc, home, "Figure 1 — The home screen at 1600 × 1100, the entry point for the whole archive.",
               width=Cm(15.0))

    guide = doc.add_paragraph()
    guide.paragraph_format.space_before = Pt(4)
    guide.paragraph_format.space_after = Pt(4)
    run = guide.add_run("How this report is organised")
    run.font.size = Pt(11.5)
    run.bold = True
    run.font.color.rgb = INK

    bullets(doc, [
        "**Chapters 1–3** set out the problem, the planning method, the decisions that were hard to reverse "
        "and the requirements behind the eleven routes.",
        "**Chapters 4–6** describe the architecture, the two data pipelines and the page-by-page "
        "implementation. The code listings in these chapters are read from the working tree at build time.",
        "**Chapters 7–8** cover the design system, the background algorithm and the imagery licensing rules.",
        "**Chapters 9–13** present the evidence: build and route verification, all eleven screenshots, "
        "performance and accessibility, limitations, and the conclusion.",
        "**Appendices A–C** map the source tree, list every build script and give the full rebuild sequence.",
    ])
    p(doc,
      "The companion artefacts — `README.docx` / `.pdf` and `f1-presentation.pptx` / `.pdf` — are generated "
      "from the same repository. Where this report cites a count or a file, the value comes from `meta.json`, "
      "the build log or the source tree rather than from memory.",
      size=Pt(9.5), color=MUTED, space_after=0)

    doc.add_page_break()


def toc_page(doc: Document) -> None:
    heading = doc.add_paragraph()
    run = heading.add_run("Contents")
    run.font.size = Pt(23)
    run.bold = True
    run.font.color.rgb = INK
    heading.paragraph_format.space_after = Pt(2)

    sub = doc.add_paragraph()
    run = sub.add_run("Chapters 1–13, references and appendices. Page numbers are refreshed when the PDF is exported.")
    run.font.size = Pt(9.5)
    run.font.color.rgb = MUTED
    sub.paragraph_format.space_after = Pt(18)

    add_toc(doc)

    doc.add_paragraph().paragraph_format.space_after = Pt(18)
    p(doc, "**A note on the numbers.** Counts in this report come from `frontend/src/assets/archive/meta.json` "
           "and the production build log. The archive is current to 26 October 2026; the 2026 season is still in "
           "progress, so the application names a leader rather than a champion.", size=Pt(9.5), color=MUTED)

    doc.add_page_break()


_first_heading = True


# === CONTENT ===


def content(doc: Document, figs: dict[str, Path]) -> None:
    section_abstract(doc)
    section_introduction(doc)
    section_planning(doc, figs)
    section_requirements(doc)
    section_architecture(doc, figs)
    section_pipeline(doc, figs)
    section_frontend(doc)
    section_design(doc)
    section_imagery(doc)
    section_verification(doc)
    section_screenshots(doc)
    section_performance(doc)
    section_limitations(doc)
    section_conclusion(doc)
    section_references(doc)
    section_appendices(doc)


# ---------------------------------------------------------------------------
# Abstract
# ---------------------------------------------------------------------------


def section_abstract(doc: Document) -> None:
    h1(doc, "Abstract")
    lead(doc,
         "Paddock is a single-page Formula 1 archive that puts twenty-seven seasons of racing data, "
         "thirty circuit outlines and a live telemetry viewer behind one brushed-silver interface.")

    p(doc,
      "The application covers every season from 2000 to 2026. A pruned 1.3 MB dataset — 130 drivers, "
      "40 constructors, 39 circuits, 526 races, 10,954 race results and 9,968 qualifying rows — is bundled "
      "with the frontend, parsed once at start-up and indexed in the browser. That makes career totals, "
      "championship tables, circuit histories and head-to-head comparisons instant, and it keeps the archive "
      "usable offline. From 2023 onward the same interface adds OpenF1 sessions, race control messages, "
      "weather and per-lap car telemetry.")

    p(doc,
      "The interface is deliberately not another dark, glassy dashboard. It is an editorial system built on "
      "matte silver surfaces, hairline rules, tabular numerals and one red accent. Thirty distinct circuit "
      "maps, drawn as black outlines at a uniform 20% ink, form a full-bleed background field that rebuilds "
      "itself for tablet and phone widths. Red is reserved for signal: the F1 mark, the active navigation "
      "rule, a winning row and one primary action per view.")

    p(doc,
      "The report documents the whole build: the planning phases and rejected alternatives, the functional "
      "and non-functional requirements, the Angular architecture, the two data pipelines, the page-by-page "
      "implementation, the design system, image licensing, verification, performance and known limitations. "
      "Code listings are extracted from the source tree when this document is generated, so they show the "
      "code that actually shipped. The finished production build is 580.38 kB raw and 154.23 kB transferred, "
      "with every non-home route lazy-loaded.")

    callout(doc, "At a glance",
            "27 seasons · 526 races · 10,954 results · 11 screens · 30 unique background maps · "
            "580.38 kB initial bundle · 11-route smoke test passing · data reconciled to 26 October 2026.")


# ---------------------------------------------------------------------------
# 1 Introduction
# ---------------------------------------------------------------------------


def section_introduction(doc: Document) -> None:
    h1(doc, "1. Introduction")
    lead(doc,
         "Formula 1 is one of the most thoroughly documented sports in the world, yet its history is still "
         "split across statistics sites, image galleries, PDFs and paywalled timing services.")

    h2(doc, "1.1 The problem")
    p(doc,
      "A reader who wants to compare two drivers usually has to open several sites: one for career totals, "
      "another for season-by-season standings, a third for race classification and a fourth for circuit "
      "layouts. Live timing is separated from history altogether. The result is a fragmented reading "
      "experience in which the same sport looks like four unrelated products.")
    p(doc,
      "The project asks a narrower question: can one interface hold the archive and the live session without "
      "turning into a dashboard? The answer adopted here is a static, bundled archive that behaves like a "
      "reference book, with a live layer that appears only when the reader asks for it.")

    h2(doc, "1.2 Objectives")
    numbered(doc, [
        "**Cover the whole modern era.** Every season from 2000 to the current season, including the 2026 "
        "calendar and the new Audi, Cadillac and Madring entries.",
        "**Answer archive questions instantly.** Career totals, titles, team histories, circuit records, "
        "season standings and race classification should not require a network round trip.",
        "**Make live data optional, not essential.** OpenF1 sessions, race control and telemetry should work "
        "as a replay without a token, and as a live poller when a paid token is supplied.",
        "**Build a coherent visual system.** One silver theme, one red accent, consistent panels and tables, "
        "and a background that belongs to the sport rather than generic decoration.",
        "**Ship a small, accessible, static bundle.** No server is required to run the application, and every "
        "route must remain usable on a phone and with reduced motion enabled.",
    ])

    h2(doc, "1.3 Scope and constraints")
    p(doc,
      "The archive window is fixed at **2000–2026**, reconciled to **26 October 2026**. Ergast supplies the "
      "2000–2024 base; Jolpica supplies 2025 and 2026. OpenF1 supplies live and historical session data from "
      "2023 onward. The app is a student project: it is unofficial, non-commercial, and every trademark and "
      "image source is acknowledged on the credits screen.")
    p(doc,
      "Two constraints shaped most of the engineering. First, the 2026 season is unfinished — 18 of 23 rounds "
      "were complete when the archive was last synced — so the UI must never present the current leader as a "
      "champion. Second, OpenF1's free tier is rate-limited to three requests per second, so the live client "
      "needs a token bucket and an aggressive response cache rather than naive polling.")


# ---------------------------------------------------------------------------
# 2 Planning and methodology
# ---------------------------------------------------------------------------


def section_planning(doc: Document, figs: dict[str, Path]) -> None:
    h1(doc, "2. Planning and methodology")
    lead(doc,
         "The project was built in vertical slices: lock the data, ship one complete screen at a time, then "
         "harden the shared system once the patterns were visible.")

    h2(doc, "2.1 Working method")
    p(doc,
      "The repository began as a Node/Express and MongoDB experiment. Early on it became clear that the "
      "database added deployment friction without improving the reading experience: the dataset is small "
      "enough to ship, and every archive view is read-only. The frontend was therefore rebuilt as a "
      "standalone Angular application, and the Express API was left in place as an optional reference "
      "implementation that the UI does not call.")
    p(doc,
      "Work proceeded in short loops. Each loop started from a real question — “what does a career page need "
      "to show?”, “how does a cancelled race appear?” — then added the smallest service method and the "
      "smallest screen that answered it. Shared components were extracted only after two or three pages had "
      "asked for the same thing, which kept the component library small and prevented speculative abstraction.")
    p(doc,
      "Verification was treated as part of the loop rather than a final phase. The production build was run "
      "after each visual change, the eleven routes were loaded in a headless browser and checked for expected "
      "content, and the background layer was measured from screenshots rather than judged by eye alone.")

    h2(doc, "2.2 Phases")
    p(doc,
      "The schedule below is indicative rather than a dated log; it records the order in which the work "
      "actually depended on itself. The two red bars are the phases that produced the most rework: the "
      "archive screens (because the shared table and panel patterns were still forming) and verification "
      "(because every earlier decision was re-checked there).")
    figure(doc, figs["planning"], "Figure 2 — Indicative build sequence. Data had to be locked before the "
                                  "archive screens could be finished, and the design system was hardened only "
                                  "after the pages exposed its gaps.", width=FIG_WIDTH)
    table(doc,
          ["Phase", "Focus", "Output"],
          [
              ["1 · Scope", "Archive window, 2026 calendar, feature shortlist",
               "Route list, data dictionary, decision to drop the runtime database"],
              ["2 · Data foundation", "Prune Ergast, append Jolpica, rebuild standings",
               "Nine CSVs plus `meta.json`, 27 seasons, reproducible `data:build`"],
              ["3 · Archive screens", "Home, standings, drivers, teams, circuits, races",
               "Six working screens and the first shared panel, table and header primitives"],
              ["4 · Live and long-form", "Race detail, OpenF1 replay, history, rivalry",
               "Session picker, timing tower, telemetry trace, article and comparison engine"],
              ["5 · Design and background", "Tokens, typography, silver surfaces, map field",
               "One theme, responsive rules, 30-map background, reduced-motion handling"],
              ["6 · Verification and documents", "Build, route smoke tests, screenshots, report",
               "Production bundle, eleven captures, README, deck and this report"],
          ],
          [3.4, 5.6, 7.4],
          label="Table 2 — Build phases and deliverables", font_size=8.4)

    h2(doc, "2.3 Decision log")
    p(doc,
      "The most useful planning artefact was not the schedule but the list of decisions that could not be "
      "reversed cheaply. Each one below closed off a plausible alternative, so it is recorded with the reason "
      "rather than just the outcome.")
    table(doc,
          ["Decision", "Alternative rejected", "Why"],
          [
              ["Ship the archive as static CSV",
               "Keep MongoDB behind an Express API",
               "1.3 MB is small enough to bundle; static hosting removes a runtime dependency and makes every "
               "archive view work offline."],
              ["One silver editorial theme",
               "Dark glass dashboard, theme toggle",
               "The subject is archival. A single light system reads like a printed reference and avoids "
               "maintaining two colour languages."],
              ["One red accent used as signal",
               "Team colours as page themes",
               "Forty team palettes would fragment the interface. Team colour survives in badges, bars and "
               "two-pixel rules only."],
              ["Thirty-map full-bleed field",
               "Corner collage with a radial mask",
               "The corner version measured a 15:1 density imbalance and made the top-left feel empty. The "
               "field is now balanced at roughly 1:1."],
              ["Replay-first live page",
               "Live-only timing that requires a token",
               "OpenF1's free tier covers history. Replay keeps the page useful to every reader; polling is "
               "opt-in."],
              ["Hand-built SVG charts",
               "A charting dependency",
               "Two chart types did not justify a library. Hand-built SVG keeps the bundle small and the "
               "styling consistent with the tokens."],
              ["Lazy-load every route except Home",
               "One eager bundle",
               "The live and history screens carry most of the code. Splitting them keeps the first paint "
               "under 155 kB transferred."],
              ["No champion until the season is complete",
               "Show the current leader as champion",
               "The archive is current to 26 October 2026 and 2026 is unfinished. The data model carries a "
               "`completeYears` set so the UI can tell the difference."],
          ],
          [4.4, 4.4, 7.6],
          label="Table 3 — Decisions that constrained the rest of the build", font_size=8.1)

    h2(doc, "2.4 The background, three times")
    p(doc,
      "The background went through three distinct designs. The first was a twelve-track collage piled into the "
      "bottom-right corner. It was atmospheric but unbalanced: the top-left of every page was empty, and the "
      "corner became visually noisy behind the tables.")
    p(doc,
      "The second version raised the count to twenty-four, varied opacity between 6% and 19% and added a "
      "radial mask anchored to the corner. Measurement showed the problem had not gone away: at 1600 px the "
      "ink centroid sat at **71% / 67%**, the bottom-right carried roughly **15 times** the ink of the "
      "top-left, and total coverage was only **1.52%**. The mask was hiding the imbalance rather than fixing it.")
    p(doc,
      "The third version removed the mask entirely and rebuilt the layer as a field. Thirty distinct circuits — "
      "every generated outline except Buddh — sit on a loose 6×5 staggered grid, all at the same 20% ink, with "
      "sizes between 125 and 195 px and rotations between −35° and +35°. Measured at 1600 px, the centroid "
      "moved to **49% / 51%**, the two halves became roughly equal, and coverage rose to **2.51%**. The field "
      "rebuilds to twenty maps at 1400 px and ten at 760 px instead of cropping, so the edges stay covered at "
      "every width.")
    figure(doc, figs["background"], "Figure 3 — The three background systems. The measured centroid moved from "
                                    "71/67 in the masked corner version to 49/51 in the full field; the third "
                                    "panel is the design that shipped.", width=FIG_WIDTH)
    callout(doc, "Design rule",
            "A background should be measurable. If the brief says “spread across the viewport”, the build needs "
            "a number that can fail — in this case the ink centroid and the quadrant ratio.")

    h2(doc, "2.5 Risks and mitigations")
    table(doc,
          ["Risk", "Impact", "Mitigation"],
          [
              ["OpenF1 rate limit (3 req/s)", "Live board stalls or errors",
               "Token bucket with burst 3 and a 340 ms refill, plus an in-memory response cache for immutable "
               "historical data."],
              ["2026 calendar changes mid-season", "Wrong winners, phantom rounds",
               "A race counts as complete only when it has results; cancelled rounds keep their calendar entry "
               "but never produce a classification."],
              ["Incomplete portrait coverage", "Broken images on older drivers",
               "The asset manifest lists only files that exist; components fall back to monograms and "
               "typographic crests."],
              ["Bundle growth", "Slow first paint",
               "Route-level splitting, a 1.5 MB warning budget and a build-size check after every visual change."],
              ["Trademark and image licensing", "Unpublishable project",
               "Locally bundled assets, a generated credits screen and an explicit unofficial-use notice."],
              ["Stale documentation", "Report describes code that no longer exists",
               "Code listings, tables and build numbers are generated from the source tree and the build log."],
          ],
          [5.4, 3.6, 7.4],
          label="Table 4 — Principal risks", font_size=8.4)


# ---------------------------------------------------------------------------
# 3 Requirements
# ---------------------------------------------------------------------------


def section_requirements(doc: Document) -> None:
    h1(doc, "3. Requirements")
    lead(doc,
         "Eleven routes define the product. Everything else — services, tokens, scripts — exists to make "
         "those eleven screens fast, accurate and consistent.")

    h2(doc, "3.1 Functional requirements")
    p(doc,
      "Each route is a complete reading task rather than a fragment of a dashboard. The table records the "
      "purpose of each screen and the component that implements it.")
    table(doc,
          ["Route", "Screen", "What it must do"],
          [
              ["`/`", "Home", "Pair the McLaren MP4/4 hero with the live 2026 top five, archive totals, the "
                                "latest result and the next race."],
              ["`/standings`", "Standings", "Drivers' and constructors' tables for any season, a leader or "
                                            "champion card, points gap and a CSV export."],
              ["`/drivers`", "Drivers", "Searchable, sortable grid; profile dialog with career totals, titles, "
                                        "seasons and teams."],
              ["`/constructors`", "Teams", "Team grid with real logos or typographic crests, title years, "
                                           "line-ups and career totals."],
              ["`/circuits`", "Circuits", "Searchable library, world map, layout image and a detail panel with "
                                          "race history."],
              ["`/races`", "Races", "Season calendar with winners and podiums, plus a year switcher."],
              ["`/races/:id`", "Race detail", "Winner hero, podium, fastest lap, classification, qualifying "
                                              "tabs, previous/next round and season context."],
              ["`/live`", "Live timing", "OpenF1 meeting and session pickers, timing tower, weather, race "
                                         "control, lap telemetry and an optional token."],
              ["`/history`", "History", "Long-form article with infobox, five eras, four rivalries, champions "
                                        "table and records."],
              ["`/rivalry`", "Rivalry", "Two-driver picker, career totals, points chart, season table and a "
                                        "head-to-head score."],
              ["`/credits`", "Credits", "Every image, its source and licence, plus the trademark notice."],
          ],
          [2.6, 2.6, 11.2],
          label="Table 5 — The eleven routed screens", font_size=8.2)
    p(doc,
      "Two routes exist outside the table. `/timeline` is a redirect to `/history`, because the old "
      "timeline became the first section of the article. The wildcard route sends unknown URLs back to Home. "
      "Every page except Home is lazy-loaded, and every screen route sets its own document title.")

    h2(doc, "3.2 Non-functional requirements")
    bullets(doc, [
        "**Speed.** The initial bundle must stay well inside the 1.5 MB warning budget, and archive views must "
        "not re-fetch CSV files per page.",
        "**Offline-friendly archive.** Once the bundle is cached, every 2000–2026 view works without a network "
        "call. Only the live page depends on OpenF1.",
        "**Responsive down to 390 px.** Tables may scroll horizontally, but navigation, headings and the "
        "background field must remain usable on a phone.",
        "**Accessibility.** Semantic headings, captioned tables, labelled controls, visible focus, a skip link, "
        "`aria-selected` tabs and a reduced-motion mode.",
        "**Accuracy.** No fabricated champions, no invented race winners, and no silent fallback that turns a "
        "missing value into a zero.",
        "**Maintainability.** One data-scope config, one token file, one shared component library, and generated "
        "documentation rather than hand-copied numbers.",
        "**Licensing.** Every downloaded image appears on the credits screen with its source; the app is "
        "labelled unofficial and non-commercial.",
    ])

    h2(doc, "3.3 Deliberately out of scope")
    p(doc,
      "The project does not implement user accounts, write operations, a database in the runtime path, native "
      "mobile apps or internationalisation. Sprint results are not yet in the bundled archive, and true "
      "real-time polling requires an OpenF1 paid token. These are stated as limitations rather than hidden "
      "behind placeholder controls.")


# ---------------------------------------------------------------------------
# 4 Architecture
# ---------------------------------------------------------------------------


def section_architecture(doc: Document, figs: dict[str, Path]) -> None:
    h1(doc, "4. System architecture")
    lead(doc,
         "The shipped application is a static Angular bundle with two data services: one for the bundled "
         "archive, one for OpenF1. There is no runtime server in the path.")

    h2(doc, "4.1 Overview")
    p(doc,
      "The architecture is deliberately shallow. Pages own their presentation and local view state; two "
      "root-provided services own data access; a small config and model layer defines the vocabulary shared "
      "between them. Nothing else is allowed to fetch data, which keeps the CSV parsing and the OpenF1 rate "
      "limiting in exactly two places.")
    figure(doc, figs["architecture"], "Figure 4 — Layered architecture. Pages depend on services; services "
                                     "depend on local assets or the OpenF1 API; the shell and shared library "
                                     "are used by every page.", width=FIG_WIDTH)
    p(doc,
      "The build-time tooling sits outside the runtime diagram: Node scripts produce the CSV archive, download "
      "imagery and trace the circuit outlines; Python scripts turn the same source tree into the README, the "
      "presentation and this report. The browser never runs any of it.")

    h2(doc, "4.2 Application shell")
    p(doc,
      "`app.ts` is intentionally small. It renders a skip link, the fixed background layer, the navbar, a "
      "`<main>` element with the router outlet, and the footer. The skip link targets `#content`, and `<main>` "
      "carries `tabindex=\"-1\"` so keyboard users can jump past the navigation. The background sits behind "
      "everything with `pointer-events: none`, so it can never intercept a click.")
    p(doc,
      "The shell imports `TrackBackgroundComponent` directly rather than through a route, because the field is "
      "part of the page frame and must survive navigation. The component draws its own fixed layer and holds "
      "its positions in memory; changing route does not rebuild the field, so there is no flash between pages.")
    p(doc,
      "Global providers are registered in `app.config.ts`: the router with component input binding, view "
      "transitions and in-memory scroll restoration; `HttpClient`; browser animations; and the Material dialog "
      "module. The scroll restoration matters on long pages such as history and race detail, where returning "
      "from a driver dialog or a query-parameter change should not jump the reader back to the top.")

    h2(doc, "4.3 Routing and lazy loading")
    p(doc,
      "Home is imported eagerly so the first paint does not wait for a second chunk. The other ten routes use "
      "`loadComponent`, and each route declares its own title. The route table is short enough to read as the "
      "product definition.")
    code_listing(doc, excerpt("frontend/src/app/app.routes.ts", "export const routes", "path: 'drivers'"),
                 "Listing 1 — The first routes: an eager Home, a lazy Standings page and per-route titles")
    p(doc,
      "The remaining routes follow the same pattern: `drivers`, `constructors`, `circuits`, `races`, "
      "`races/:id`, `live`, `history`, `rivalry` and `credits`. Two non-screen routes close the table: "
      "`/timeline` redirects to `/history`, and `**` returns the reader to Home. The parameterised "
      "race route is the only one that reads an `:id`; the archive's synthesised race identifiers make deep "
      "links stable across rebuilds.")

    h2(doc, "4.4 Services and state")
    p(doc,
      "`CSVDataService` is provided at root and exposes `loading` and `error` signals alongside observable "
      "read methods. It parses the archive once, builds maps and derived arrays, and wraps the result in "
      "`shareReplay({ bufferSize: 1, refCount: false })`. A page that subscribes late still receives the "
      "same parsed object; a page that unsubscribes does not tear the cache down.")
    p(doc,
      "`OpenF1Service` is also root-provided, but its cache is a `Map` keyed by request path plus query. "
      "Historical responses are immutable, so they are kept for the lifetime of the tab. Live requests are "
      "cleared per session through `clearSessionCache` when the reader explicitly asks for fresh data.")
    p(doc,
      "Pages use a consistent pattern: injected services, `signal` for loaded rows, `computed` for derived "
      "view models, and `takeUntilDestroyed` for query-parameter subscriptions. The standings page is the "
      "clearest example — the year is a signal, the champion is a computed lookup, and the feature card falls "
      "back from champion to current leader without pretending the season is over.")

    h2(doc, "4.5 Directory and shared library")
    p(doc,
      "The source tree separates four concerns. `core/` holds configuration, models, services and formatting "
      "utilities. `pages/` holds the routed screens. `features/` currently holds only the rivalry engine, "
      "which is large enough to deserve its own folder. `shared/components/` holds the visual primitives: "
      "panel, page header, stat tile, driver avatar, team badge, spark chart, telemetry chart, skeleton "
      "loader, empty state and the track background.")
    p(doc,
      "This split is not academic. Shared components are the only place where a surface, border radius or "
      "empty-state pattern is defined; pages compose them but do not re-implement them. That is what keeps "
      "eleven screens looking like one product, and it is why the design system could be re-skinned from the "
      "token file without editing every page.")

    h2(doc, "4.6 Optional legacy backend")
    p(doc,
      "The repository still contains the original Express and MongoDB API under `backend/`, together with the "
      "untrimmed source dataset under `archive/`. It is not called by the Angular application. It is kept as "
      "a reference implementation and as a starting point for anyone who wants a server-side API; the README "
      "documents how to import the full dataset and run it on port 3000.")


# ---------------------------------------------------------------------------
# 5 Data pipeline
# ---------------------------------------------------------------------------


def section_pipeline(doc: Document, figs: dict[str, Path]) -> None:
    h1(doc, "5. Data pipeline")
    lead(doc,
         "Two pipelines meet in the browser: a build-time archive that is pruned and indexed once, and a "
         "runtime live layer that is rate-limited and cached.")

    h2(doc, "5.1 Sources and scope")
    p(doc,
      "The bundled archive is built from two sources. **Ergast** supplies the historical dump through 2024; "
      "**Jolpica** supplies 2025 and 2026, including sprint-aware results and the new teams and circuits. The "
      "frontend never sees either API. It reads nine CSV files and one JSON manifest from "
      "`frontend/src/assets/archive/`.")
    table(doc,
          ["File", "Rows", "Role"],
          [
              ["`drivers.csv`", "130", "Driver identity, code, nationality and date of birth"],
              ["`constructors.csv`", "40", "Team identity and nationality"],
              ["`circuits.csv`", "39", "Circuit identity, location and coordinates"],
              ["`races.csv`", "526", "Season calendar across 27 seasons"],
              ["`results.csv`", "10,954", "Race classification, grid, points, status and fastest lap"],
              ["`qualifying.csv`", "9,968", "Q1, Q2 and Q3 times per race"],
              ["`season_standings.csv`", "27 seasons", "Final or current drivers' standings"],
              ["`season_constructor_standings.csv`", "27 seasons", "Final or current constructors' standings"],
              ["`status.csv`", "—", "Result status labels such as Finished, Accident and Disqualified"],
              ["`meta.json`", "1", "Generated timestamp, year range, complete years and row counts"],
          ],
          [5.2, 2.2, 9.0],
          label="Table 6 — The bundled archive", font_size=8.3)
    p(doc,
      "The pruned set is about **1.3 MB**. That figure is the reason the architecture works: it is small "
      "enough to send once with the application, so every archive view can be answered locally. The original "
      "untrimmed dataset remains in `archive/` for the optional backend.")

    h2(doc, "5.2 Build-time ingest")
    p(doc,
      "`prune-archive.mjs` reads the full dump, keeps rows from 2000 onward, rebuilds the season standings "
      "from the surviving results and writes the archive files plus `meta.json`. It never deletes from the "
      "source folder, so the operation is repeatable. `sync-current-season.mjs` then fetches 2025 and 2026 "
      "from Jolpica in pages of 100, appends races, results, qualifying and standings, and synthesises race "
      "identifiers as `year * 100 + round`. Because the identifiers are deterministic, deep links such as "
      "`/races/202618` survive a data refresh.")
    p(doc,
      "Two further scripts prepare the presentation layer. `fetch-assets.mjs` downloads team logos, circuit "
      "maps, driver portraits and archive photographs, skips files that already exist, backs off on HTTP 429, "
      "and writes `asset-manifest.ts` containing only the assets that actually landed on disk. "
      "`extract-circuit-outlines.mjs` traces the circuit map images into the stroke-only SVG paths used by "
      "the background and by the circuit cards.")
    figure(doc, figs["pipeline"], "Figure 5 — Data flow. Build-time scripts produce the immutable archive; the "
                                  "browser indexes it once; OpenF1 is the only runtime data dependency.",
           width=FIG_WIDTH)

    h2(doc, "5.3 Runtime indexing")
    p(doc,
      "The frontend loads all ten archive files in parallel with `forkJoin`, maps each row into a typed model, "
      "and indexes the result. The observable is created once and cached, so the work happens on the first "
      "subscription and never again.")
    code_listing(doc,
                 excerpt("frontend/src/app/core/services/csv-data.service.ts",
                         "private core$:", "  // Public reads"),
                 "Listing 2 — The archive is loaded in parallel, built once and replayed to every page")
    p(doc,
      "`build()` is the single place where raw strings become domain objects. It performs the numeric and "
      "text conversions, then constructs lookup maps and grouping maps that make the rest of the service "
      "cheap. There are no repeated linear scans in page code.")
    code_listing(doc,
                 excerpt("frontend/src/app/core/services/csv-data.service.ts",
                         "const driverById", "const core: CoreData"),
                 "Listing 3 — Identity maps and grouped indexes built once per load")

    h2(doc, "5.4 Derived views")
    p(doc,
      "Careers, season summaries, race detail and rivalry data are derived from the indexes rather than stored. "
      "A driver's career is the union of their results, qualifying rows and season standings; a circuit's "
      "history is the set of races at that circuit; a rivalry is two careers reduced to a common set of "
      "seasons. Deriving instead of duplicating keeps the archive internally consistent.")
    p(doc,
      "The most important derived distinction is complete versus in-progress. A race counts as run only when "
      "it has results, and a season is complete only when `meta.json` lists it. The 2026 calendar is bundled "
      "in full, including rounds that have not happened, so “latest race” can never mean “last row in the "
      "file”.")
    code_listing(doc,
                 excerpt("frontend/src/app/core/services/csv-data.service.ts",
                         "// A race counts as run", "const years = [...new Set"),
                 "Listing 4 — “Latest” and “next” are decided by results and dates, not by file order")
    p(doc,
      "The same rule reaches the standings page. `getChampions()` returns only seasons present in "
      "`completeYears`, while `getSeasonStandings()` returns the current table for an unfinished season. The UI "
      "can therefore show a **leader** card for 2026 and a **champion** card for 2025 without any special-case "
      "copy in the template.")

    h2(doc, "5.5 OpenF1 integration")
    p(doc,
      "OpenF1 is used from 2023 onward. The service exposes typed methods for sessions, meetings, drivers, "
      "positions, intervals, laps, stints, pit stops, weather, race control, car data and location. Every "
      "method funnels through one private `get()` that applies the token bucket and the cache.")
    code_listing(doc,
                 excerpt("frontend/src/app/core/services/openf1.service.ts",
                         "private tokens = 3;", "await new Promise"),
                 "Listing 5 — A three-token bucket keeps the client under OpenF1's three requests per second")
    p(doc,
      "The bucket starts with three tokens, refills at one token every 340 ms (about 2.9 requests per second) "
      "and waits in 90 ms steps when empty. The cache is checked before the bucket, so a repeated historical "
      "request costs nothing. Requests are wrapped in `shareReplay({ bufferSize: 1, refCount: false })` and "
      "cancelled through the observable teardown when a component unsubscribes.")
    code_listing(doc,
                 excerpt("frontend/src/app/core/services/openf1.service.ts",
                         "private get<T>(path: string, key: string)", "return request;"),
                 "Listing 6 — Cache first, then throttle, then one HTTP request shared by all subscribers")
    p(doc,
      "The live board composes nine endpoints in one `forkJoin`: drivers, intervals, positions, laps, stints, "
      "pit stops, race control, weather and the final session result. `buildLiveRows()` merges the latest row "
      "per driver into a single timing row, race control is trimmed to the last forty messages and reversed, "
      "and the latest weather sample is kept. Telemetry is never downloaded for a whole session: the page "
      "requests one driver and one lap inside a date window.")

    h2(doc, "5.6 Changing the scope")
    p(doc,
      "The archive window is not scattered through the code. Three constants define it, and the year list is "
      "computed from them. Changing the start year is therefore a data refresh plus a one-line edit, not a "
      "search-and-replace across pages.")
    code_listing(doc,
                 excerpt("frontend/src/app/core/config/data.config.ts",
                         "export const DATA_START_YEAR", "export const isOpenF1Year"),
                 "Listing 7 — Data scope is centralised; the live bundle value still comes from meta.json")


# ---------------------------------------------------------------------------
# 6 Frontend implementation
# ---------------------------------------------------------------------------


def section_frontend(doc: Document) -> None:
    h1(doc, "6. Frontend implementation")
    lead(doc,
         "Eleven screens share one composition pattern: a page header, a small number of panels, one clear "
         "primary table or chart, and a single primary action.")

    h2(doc, "6.1 Page composition")
    p(doc,
      "Every page follows the same rhythm. `PageHeaderComponent` carries the eyebrow, title, description and "
      "optional actions. `PanelComponent` groups related content on a matte silver surface with a hairline "
      "border. `StatTileComponent` presents a single number with a label and optional delta. Tables use the "
      "global table styles; charts use the shared SVG components. Loading states use skeleton blocks, and "
      "empty states use the shared empty-state panel rather than a bare sentence.")
    p(doc,
      "This is why the pages can be large without becoming inconsistent. The live page is the biggest file in "
      "the project at 1,343 lines, the history article is 972 and race detail is 825, but most of those lines "
      "are markup and scoped styles for a specific reading task. The shared decisions — surface, border, "
      "focus ring, table rhythm, typography — live outside them.")
    table(doc,
          ["File", "Lines", "Responsibility"],
          [
              ["`pages/live/live.component.ts`", "1,343", "Session picker, timing tower, weather, race "
                                                              "control, telemetry, token panel"],
              ["`pages/history/history.component.ts`", "972", "Long-form article, infobox, eras, rivalries, "
                                                               "champions, records"],
              ["`pages/race-detail/race-detail.component.ts`", "825", "Winner hero, podium, classification, "
                                                                        "qualifying tabs, round navigation"],
              ["`pages/home/home.component.ts`", "782", "Hero, top five, archive totals, latest and next race"],
              ["`pages/standings/standings.component.ts`", "762", "Drivers' and constructors' tables, leader "
                                                                   "card, year switcher, export"],
              ["`core/services/csv-data.service.ts`", "746", "Archive load, indexes, careers, standings, "
                                                              "rivalry, summaries"],
              ["`features/rivalry/rivalry.component.ts`", "707", "Two-driver picker, career comparison, chart "
                                                                  "and season table"],
              ["`pages/races/races.component.ts`", "696", "Calendar, winners, podiums, year switcher"],
              ["`pages/constructors/constructors.component.ts`", "664", "Team grid, crests, title years, "
                                                                         "line-ups"],
              ["`pages/circuits/circuits.component.ts`", "648", "Map, searchable library, circuit detail"],
              ["`pages/drivers/drivers.component.ts`", "533", "Searchable, sortable driver grid"],
              ["`components/navbar/navbar.component.ts`", "415", "Desktop navigation, mobile sheet, active rule"],
          ],
          [7.4, 1.6, 7.4],
          label="Table 7 — The largest source files and what they own", font_size=8.0)

    h2(doc, "6.2 Home")
    p(doc,
      "Home is the only eager route, and it carries the most editorial weight. The hero pairs a cut-out "
      "McLaren MP4/4 with the 2026 championship top five, so the archive's history and its present are visible "
      "in the same frame. Below that, three blocks answer the questions a reader arrives with: how large the "
      "archive is, what happened in the latest race, and where the next round takes place.")
    p(doc,
      "The hero does not call the 2026 leader a champion. It uses the season summary to show rounds completed, "
      "the current leader, the gap to second and the next race. The 2025 champion feature is separate and "
      "explicitly labelled, because 2025 is a complete season. The archive totals are read from `meta.json` "
      "rather than hard-coded, so a data refresh updates the copy automatically.")

    h2(doc, "6.3 Standings")
    p(doc,
      "The standings page is the best illustration of the signal-based page pattern. The selected year is a "
      "signal initialised from the query string; champions and drivers are loaded from the service; the "
      "feature card, runner-up, margin and title count are computed. Changing the year writes `?year=` with "
      "`replaceUrl`, so the back button does not walk through every season the reader browsed.")
    code_listing(doc,
                 excerpt("frontend/src/app/pages/standings/standings.component.ts",
                         "readonly champion = computed", "  constructor() {"),
                 "Listing 8 — Derived standings state: a champion only when the season is complete")
    p(doc,
      "The page shows both championships, a leader or champion card, the points margin and a season switcher. "
      "It also builds a CSV export in the browser from the loaded rows, which is useful for coursework and "
      "avoids a server-side report endpoint.")

    h2(doc, "6.4 Drivers and teams")
    p(doc,
      "The drivers page is a searchable, sortable grid. Each card opens a profile dialog with career totals, "
      "titles, the seasons contested and the teams driven for. The dialog is a Material component but uses the "
      "same silver surfaces and table styles as the rest of the app, so it does not feel like a foreign layer.")
    p(doc,
      "The teams page mirrors the structure with a logo or a typographic crest, title years, driver line-ups "
      "and career totals. The crest is not a placeholder image: it is a deliberate fallback for the five teams "
      "without a licensable mark — MF1, Spyker MF1, Jaguar, Lotus Racing and Marussia. The 2026 grid includes "
      "the new Audi and Cadillac entries, both of which carry real marks.")

    h2(doc, "6.5 Circuits and races")
    p(doc,
      "The circuits page combines three representations of the same object: a world map for geographic "
      "context, a searchable library of circuit cards, and a detail panel with the layout, location and race "
      "history. The outline used in the background is the same traced path family used on the cards, which "
      "ties the decoration to the content.")
    p(doc,
      "The races page is a season calendar. Each round shows its winner and podium when results exist, and a "
      "clear “upcoming” treatment when they do not. The year switcher uses the same query-parameter pattern as "
      "standings. Cancelled 2026 rounds keep their calendar entries but never show a winner, because a race "
      "without results cannot produce a classification.")

    h2(doc, "6.6 Race detail")
    p(doc,
      "Race detail is the deepest archive screen. It opens with the winner, then the podium, fastest lap and "
      "the full classification. Qualifying is presented in tabs for Q1, Q2 and Q3. Previous and next round "
      "links make the calendar navigable without returning to the races page, and a context strip places the "
      "race in its season and at its circuit.")
    p(doc,
      "The screen resolves its race from the `:id` parameter and combines the race row, its results, its "
      "qualifying rows, the circuit and the season summary. Missing values are rendered as dashes rather than "
      "zeros, which matters for retirements, disqualifications and races where a driver did not set a time.")

    h2(doc, "6.7 Live timing")
    p(doc,
      "The live page is a replay tool first and a live poller second. The reader chooses a season, meeting and "
      "session; the selection is mirrored into the URL with `replaceUrl`, so a session can be linked and the "
      "back button behaves. The timing tower merges positions, intervals, laps, stints, pit stops and the "
      "final classification into one row per driver.")
    code_listing(doc,
                 excerpt("frontend/src/app/core/services/openf1.service.ts",
                         "  getLiveBoard(sessionKey: number)", "  // ---------------------------------------------------------------------------"),
                 "Listing 9 — One forkJoin composes the live board from nine OpenF1 endpoints")
    p(doc,
      "Weather shows the latest sample, race control is trimmed to the last forty messages and reversed so "
      "the newest is first, and missing fields stay as dashes. Telemetry is a separate, explicit action: the "
      "reader picks a driver and a lap, and the service requests only that window of car data. The resulting "
      "trace shows speed, gear, DRS and summary statistics.")
    p(doc,
      "Polling is off by default. A bearer token can be pasted into the token panel; it is stored under "
      "`paddock.openf1.token`, sent only to `api.openf1.org`, and never committed. The polling preference is "
      "stored separately under `paddock.openf1.polling`. Without a token the page remains a complete "
      "historical replay, which is the state most readers will use.")

    h2(doc, "6.8 History")
    p(doc,
      "The history page is a deliberately long-form article rather than a dashboard. It opens with a lead and "
      "an infobox, then moves through five eras, four defining rivalries, a champions table and a records "
      "section. Source Serif 4 is used for the article body while Titillium Web carries labels and tables, "
      "which gives the page the feel of a printed reference without breaking the application's typography.")
    p(doc,
      "The timeline that once lived at `/timeline` is now the first section of this article; the old route "
      "redirects here. That decision removed a thin screen and gave the history page a stronger "
      "opening.")

    h2(doc, "6.9 Rivalry")
    p(doc,
      "The rivalry engine accepts two driver identifiers through `?d1=` and `?d2=`. It compares career totals, "
      "titles, wins, podiums, poles and fastest laps, draws a points chart across the seasons both drivers "
      "contested, and lists a season-by-season table. The head-to-head score is computed from race results "
      "where both drivers were classified, so it does not count a race one of them missed.")
    p(doc,
      "There is no hard-coded default pairing: the page opens with two empty selectors and a random-pair "
      "action, and a shared URL such as `?d1=1&d2=830` restores a comparison. Query values are validated "
      "against the loaded driver list, so a stale link cannot produce a broken panel.")

    h2(doc, "6.10 Credits")
    p(doc,
      "Credits is generated from the same asset manifest that drives the images. It lists every team logo, "
      "circuit map, portrait and archive photograph with its source and licence, then states the trademark "
      "position: Formula 1, the F1 logo, team marks and circuit names belong to Formula One Licensing B.V., "
      "the FIA and the respective teams; they appear for identification and commentary only. The page is the "
      "reason the project can use real imagery responsibly.")

    h2(doc, "6.11 Shared components and conventions")
    p(doc,
      "The shared library is small on purpose. `PanelComponent` owns the surface, border and padding. "
      "`PageHeaderComponent` owns the eyebrow, title and description rhythm. `StatTileComponent` owns the "
      "number/label pair. `DriverAvatar` reads the manifest and falls back to a monogram. `TeamBadge` does the "
      "same with a typographic crest. `SparkChartComponent` and `TelemetryChartComponent` draw SVG directly, "
      "with no charting dependency. `SkeletonLoaderComponent` and `EmptyStateComponent` make loading and "
      "absence look intentional rather than broken.")
    p(doc,
      "Two conventions are enforced across pages. First, components never hard-code a surface colour; they "
      "use the tokens. Second, interactive controls keep a visible focus ring and enough padding to be "
      "operated comfortably, including the icon-only buttons in the navbar and the session picker. These are "
      "small decisions, but "
      "they are what make eleven independently built screens feel like one application.")


# ---------------------------------------------------------------------------
# 7 Design system
# ---------------------------------------------------------------------------


def section_design(doc: Document) -> None:
    h1(doc, "7. Design system")
    lead(doc,
         "The visual system is a reaction against the default racing dashboard: no dark glass, no neon, no "
         "gradient wash. Silver, ink, hairline rules and one red accent.")

    h2(doc, "7.1 Tokens")
    p(doc,
      "All colour, radius, elevation and motion values are declared once in `styles/_tokens.scss`. Components "
      "consume the custom properties; they do not invent values. The palette is intentionally short: a red "
      "brand scale, a six-step silver scale, a five-step ink scale, and semantic tokens for surfaces, text, "
      "dividers and focus.")
    code_listing(doc,
                 excerpt("frontend/src/styles/_tokens.scss", ":root {", "// Ink"),
                 "Listing 10 — The core palette: one red, a silver scale and a single light colour scheme")
    p(doc,
      "The file opens with `color-scheme: light`, and there is no dark-mode branch anywhere in the project. "
      "That is a statement of intent: the archive is a printed object, and a second theme would double the "
      "surface decisions without improving the reading experience.")
    p(doc,
      "Team colours are stored separately in `core/config/data.config.ts` and applied only to badges, data "
      "bars and two-pixel rules. They never become page backgrounds, because forty team palettes would "
      "destroy the consistency the silver system provides.")

    h2(doc, "7.2 Typography")
    p(doc,
      "Titillium Web carries the interface: navigation, labels, headings, tables and numbers. Source Serif 4 "
      "carries long-form article copy on the history page. Numerals in timing tables and standings are "
      "tabular, so columns of times and points line up without manual padding. Code and metadata use a "
      "monospace stack, which is why eyebrows and document labels look like paddock signage.")
    p(doc,
      "The type scale is fluid at the top end: page titles use `clamp()` so they shrink on a phone without a "
      "separate mobile stylesheet. Body copy stays at a readable measure; long paragraphs are not allowed to "
      "run the full width of a 1600 px viewport.")

    h2(doc, "7.3 Surfaces and elevation")
    p(doc,
      "Every page is built from the same `.panel` primitive: flat matte silver, a hairline border, a two- to "
      "four-pixel radius and one soft shadow reserved for overlays. Brushed metal is used only on the home "
      "hero plate and the navbar, where it signals “object” rather than “card”. Tables sit directly on the "
      "panel surface with alternating row tint, not in nested cards.")
    p(doc,
      "This restraint is what allows the background field to be bold. Because the content surfaces are quiet "
      "and opaque, thirty outlines at 20% ink can sit behind them without making the text unreadable.")

    h2(doc, "7.4 Red as signal")
    p(doc,
      "Red appears in exactly four places: the F1 mark, the active navigation rule, a winning row (P1), and "
      "one primary action per view. It is never a background, never a gradient and never decorative. The "
      "result is that red still means something when it appears — a reader can scan a page and know where the "
      "action is.")

    h2(doc, "7.5 The background algorithm")
    p(doc,
      "The background is generated from thirty circuit identifiers, one for every generated outline except "
      "Buddh. A deterministic hash places each track in a loose slot, so the field looks organic but is "
      "identical on every load. Alternating rows are offset by half a cell, which prevents the columns from "
      "lining up mechanically.")
    code_listing(doc,
                 excerpt("frontend/src/app/shared/components/track-background/track-background.component.ts",
                         "function buildSlot(", " * Decorative layer:"),
                 "Listing 11 — Slot construction: a staggered field with stable, hash-driven jitter")
    p(doc,
      "The placement pass assigns each track a size between 125 and 195 px, a rotation between −35° and +35°, "
      "a drift of 5–9 px, a rock of 2–4° and a loop between 40 and 80 seconds. Every item shares the same "
      "20% ink; variation comes from position, scale and rotation, not from opacity. The whole field is "
      "controlled by one `--ink` custom property, so the density can be tuned in one line.")
    code_listing(doc,
                 excerpt("frontend/src/app/shared/components/track-background/track-background.component.ts",
                         "      .tracks {", "      @media (prefers-reduced-motion: no-preference)"),
                 "Listing 12 — One ink value, one colour and one long, shallow float animation")
    p(doc,
      "The animation moves each track by only a few pixels and rocks it a couple of degrees. That is "
      "deliberate: a field of thirty shapes with large motion would pull attention away from the content. The "
      "loops are long and the delays are negative, so the field is already mid-motion on first paint rather "
      "than starting in unison.")
    p(doc,
      "Responsiveness rebuilds the field instead of cropping it. At 1400 px the component switches to a "
      "five-column, twenty-item layout; at 760 px it switches to two columns and ten items. The alternative — "
      "hiding items at the edges — would leave the phone view with a bare strip, which is exactly the failure "
      "the third design was meant to fix.")
    table(doc,
          ["Viewport", "Visible maps", "Ink coverage", "Ink centroid", "Darkest stroke"],
          [
              ["1600 × 1100", "30", "2.51%", "49% / 51%", "199"],
              ["1280 × 800", "20", "2.65%", "50% / 53%", "199"],
              ["390 × 844", "10", "3.59%", "55% / 47%", "200"],
          ],
          [3.6, 3.0, 3.4, 3.4, 3.0],
          label="Table 8 — Measured background behaviour at the three supported widths", font_size=8.4)
    p(doc,
      "The measurements are taken from the rendered screenshots, not from the source. Coverage is the share "
      "of sampled pixels darkened by the field; the centroid is the ink-weighted centre of the frame. A "
      "centroid near 50/50 and a quadrant ratio near 1:1 are the pass condition for “spread across the "
      "viewport”.")

    h2(doc, "7.6 Motion")
    p(doc,
      "Motion is short and eased. Page transitions use the router's view transitions; entrances are brief "
      "opacity and translate changes; the only looping motions in the content layer are the live indicator "
      "and the loading shimmer. "
      "The background loop is the exception, and it is explicitly disabled under `prefers-reduced-motion`.")
    p(doc,
      "The background and content motion are expressed in CSS rather than JavaScript timers, so the browser "
      "can suspend them when the tab is hidden.")

    h2(doc, "7.7 Responsive behaviour")
    p(doc,
      "The layout is fluid down to 390 px. Navigation collapses into a Material sheet; grids reduce their "
      "column count; wide tables scroll horizontally inside a labelled region rather than forcing the page "
      "to overflow; hero plates stack; and the background field rebuilds. The phone layout is not a shrunken "
      "desktop — the reading order and the number of visible maps both change.")
    p(doc,
      "Touch targets are kept at a usable size even when the visual control is small, and hover-only "
      "affordances are duplicated with focus states. The result is a page that can be operated with a "
      "keyboard, a mouse or a thumb without a separate mobile build.")


# ---------------------------------------------------------------------------
# 8 Imagery and licensing
# ---------------------------------------------------------------------------


def section_imagery(doc: Document) -> None:
    h1(doc, "8. Imagery and licensing")
    lead(doc,
         "Real logos, real circuit maps and real photographs make an archive feel credible. They also create "
         "the project's clearest legal and engineering constraints.")

    h2(doc, "8.1 The asset manifest")
    p(doc,
      "Images are not referenced directly from templates. `scripts/fetch-assets.mjs` downloads them, records "
      "what actually exists in `core/config/asset-manifest.ts`, and the components consult that manifest "
      "before requesting a file. A missing asset therefore produces a designed fallback, never a broken image "
      "icon.")
    table(doc,
          ["Set", "Count", "Source", "Fallback"],
          [
              ["Team logos", "35 of 40", "Formula 1 media CDN", "Typographic crest"],
              ["Circuit maps", "39 of 39", "Formula 1 media CDN", "Country flag"],
              ["Driver portraits", "28", "OpenF1", "Monogram"],
              ["Archive photographs", "9", "Wikimedia Commons (CC / public domain)", "Caption only"],
              ["F1 mark", "1", "Formula 1", "—"],
          ],
          [4.4, 2.4, 6.2, 3.4],
          label="Table 9 — Bundled imagery and its fallbacks", font_size=8.4)
    p(doc,
      "The five teams without a licensable mark are MF1, Spyker MF1, Jaguar, Lotus Racing and Marussia. Their "
      "typographic crests are not placeholders to be replaced later; they are the intended treatment for a "
      "historical grid that no longer has a consistent set of vector marks.")

    h2(doc, "8.2 Why the archive is local")
    p(doc,
      "Hot-linking images from a media CDN would make the archive slower, fragile and harder to audit. "
      "Downloading once and shipping the files means the credits page can list exactly what is present, the "
      "build has no runtime dependency on a third-party image host, and the screenshots used in this report "
      "are reproducible.")
    p(doc,
      "The downloader is deliberately polite: it skips files that already exist, backs off on HTTP 429 and "
      "writes the manifest only after the downloads settle. The manifest is the single source of truth for "
      "both the components and the credits screen, so an image cannot appear in the interface without also "
      "appearing in the credits list.")

    h2(doc, "8.3 Credits and trademark position")
    p(doc,
      "The credits route lists every image set with its source and licence, then states the position in plain "
      "language: Formula 1, F1, the F1 logo, team marks and circuit names are trademarks of Formula One "
      "Licensing B.V., the FIA and the respective teams. They appear for identification and commentary only. "
      "The project is unofficial, non-commercial coursework.")
    p(doc,
      "This is not legal advice, and the report does not claim that the use is risk-free. It is an honest "
      "attempt to attribute what can be attributed, to use openly licensed material where possible, and to "
      "make the project's status clear to anyone who opens it.")


# ---------------------------------------------------------------------------
# 9 Verification and testing
# ---------------------------------------------------------------------------


def section_verification(doc: Document) -> None:
    h1(doc, "9. Verification and testing")
    lead(doc,
         "Verification was build-based and route-based: compile the production bundle, load every route in a "
         "real browser, check the content and the background, then inspect the generated documents.")

    h2(doc, "9.1 Build health")
    p(doc,
      "The production build is the first gate. It must complete without errors, stay inside the configured "
      "budgets and produce a bundle whose initial transfer size is acceptable on a slow connection. The "
      "figures below are from the build used to capture the screenshots in this report.")
    table(doc,
          ["Metric", "Result", "Notes"],
          [
              ["Production build", "Pass", "Angular CLI 21 / esbuild, no errors or budget warnings"],
              ["Initial bundle, raw", "580.38 kB", "Framework, Home and shared library"],
              ["Initial bundle, transferred", "154.23 kB", "Compressed estimate from the build log"],
              ["Largest lazy chunk", "Under 45 kB", "Live timing is the largest route chunk"],
              ["Routes rendered", "11 of 11", "Home plus ten lazy routes"],
              ["Background items per route", "30", "All unique circuit identifiers"],
          ],
          [5.2, 3.4, 7.8],
          label="Table 10 — Production build and route checks", font_size=8.4)

    h2(doc, "9.2 Route smoke tests")
    p(doc,
      "Each route was loaded from the production preview in headless Edge. The check confirmed that the page "
      "rendered its expected content, that the background component mounted, and that no route fell through "
      "to the wildcard redirect. The terms below are the content probes used for each screen.")
    table(doc,
          ["Route", "Content probe", "Background", "Result"],
          [
              ["`/`", "MP4/4 · Antonelli · 2026 · Drivers", "30 items", "Pass"],
              ["`/standings?year=2026`", "Antonelli · Championship leader · Mercedes", "30 items", "Pass"],
              ["`/drivers`", "Antonelli · Verstappen", "30 items", "Pass"],
              ["`/constructors`", "Mercedes · Audi · Cadillac", "30 items", "Pass"],
              ["`/circuits`", "Monza · Madring", "30 items", "Pass"],
              ["`/races?year=2026`", "Bahrain · Mexico City", "30 items", "Pass"],
              ["`/races/202618`", "Classification · Podium", "30 items", "Pass"],
              ["`/live?year=2026`", "Live timing · Telemetry", "30 items", "Pass"],
              ["`/history`", "Senna · Lauda · MP4/4", "30 items", "Pass"],
              ["`/rivalry`", "Choose two drivers · Rivalry", "30 items", "Pass"],
              ["`/credits`", "Trademark notice · licence", "30 items", "Pass"],
          ],
          [4.6, 7.2, 2.4, 2.2],
          label="Table 11 — Headless route smoke tests against the production build", font_size=8.0)
    p(doc,
      "The background check also counts unique identifiers in the component: thirty identifiers, thirty "
      "unique values. That is what prevents a repeated circuit from looking like a richer field than it is. "
      "Visibility was checked at three widths, confirming 30 visible items at 1600 px, 20 at 1280 px and 10 at "
      "390 px.")

    h2(doc, "9.3 Visual measurement")
    p(doc,
      "The background was verified from the captured PNGs rather than from the CSS. A small image analysis "
      "script computed ink coverage, the ink-weighted centroid, the quadrant distribution and the darkest "
      "stroke. Those measurements are the evidence behind the claims in section 7.5 and the reason the "
      "corner-collage design was rejected in favour of the field.")
    p(doc,
      "This is a pragmatic compromise. The build agent cannot judge composition by eye, so density and "
      "balance are expressed as numbers that can fail. The final aesthetic judgement still belongs to a human "
      "reader, which is why the screenshots are included at full width in section 10.")

    h2(doc, "9.4 Screenshot capture")
    p(doc,
      "The eleven screenshots were captured with headless Microsoft Edge at **1600 × 1100**, using "
      "`--virtual-time-budget=30000` and `--run-all-compositor-stages-before-draw` so that fonts, images and "
      "the background field had settled before the frame was written. Each route was captured at the same "
      "viewport, which makes the set comparable and keeps the report's figure widths consistent.")
    p(doc,
      "The live screenshot uses the replay state rather than a paid live session, so the capture is "
      "reproducible and does not depend on a race weekend. The home screenshot is used on the project details "
      "page; the full set appears in section 10.")

    h2(doc, "9.5 Document verification")
    p(doc,
      "The README, presentation and this report are generated artefacts, so each one is checked after it is "
      "built. The README and deck are exported to PDF through Microsoft Office, the page and slide counts are "
      "recorded, the text is extracted and searched for key claims, and the deck's shape bounds are checked to "
      "catch content that has slid off a slide.")
    table(doc,
          ["Artefact", "Check", "Result"],
          [
              ["README.docx / README.pdf", "12 pages, text and figures present", "Pass"],
              ["f1-presentation.pptx / .pdf", "15 slides, all shapes inside slide bounds", "Pass"],
              ["Micro_Project_Report.docx / .pdf", "All chapters, 12 listings, 11 screenshots, TOC refreshed",
               "Pass"],
              ["Screenshots", "11 files at 1600 × 1100", "Pass"],
          ],
          [5.0, 8.4, 3.0],
          label="Table 12 — Generated-document checks", font_size=8.4)
    p(doc,
      "The verification is not a committed unit-test suite. There are no Angular TestBed specs, no end-to-end "
      "runner and no automated accessibility audit in the repository. The checks above are scripted "
      "observations of the production build. That is a real limitation, and it is stated here rather than "
      "implied by a green table.")


# ---------------------------------------------------------------------------
# 10 Screenshots
# ---------------------------------------------------------------------------


def section_screenshots(doc: Document) -> None:
    h1(doc, "10. Screenshots")
    lead(doc,
         "Eleven screens, captured at 1600 × 1100 from the production build. Each caption gives the route, "
         "the reading task and the detail worth noticing.")

    screens = [
        ("home.png", "Figure 6 — Home (/)", "The MP4/4 hero, the 2026 top five, archive totals and the latest "
                                            "and next race. This is the only eager route."),
        ("standings.png", "Figure 7 — Standings (/standings?year=2026)", "Drivers' and constructors' tables, the "
                                                                          "leader card, the points margin and the "
                                                                          "season switcher."),
        ("drivers.png", "Figure 8 — Drivers (/drivers)", "Searchable, sortable grid. Cards open a career dialog "
                                                          "with titles, seasons and teams."),
        ("teams.png", "Figure 9 — Teams (/constructors)", "Real marks where available, typographic crests for the "
                                                          "five unlicensed historical teams."),
        ("circuits.png", "Figure 10 — Circuits (/circuits)", "World map, searchable library and detail panel, "
                                                             "using the same traced outlines as the background."),
        ("races.png", "Figure 11 — Races (/races?year=2026)", "The 2026 calendar with winners and podiums where "
                                                               "results exist, and a clear upcoming state where "
                                                               "they do not."),
        ("race-detail.png", "Figure 12 — Race detail (/races/202618)", "Winner hero, podium, fastest lap, "
                                                                        "classification, qualifying tabs and "
                                                                        "round navigation."),
        ("live.png", "Figure 13 — Live timing (/live?year=2026)", "Session replay: timing tower, weather, race "
                                                                   "control and the per-lap telemetry picker."),
        ("history.png", "Figure 14 — History (/history)", "Long-form article with infobox, five eras, four "
                                                           "rivalries, champions and records."),
        ("rivalry.png", "Figure 15 — Rivalry (/rivalry)", "Two-driver picker, career totals, points chart, "
                                                           "season table and head-to-head score."),
        ("credits.png", "Figure 16 — Credits (/credits)", "Every image set with its source and licence, plus the "
                                                           "trademark notice."),
    ]

    table(doc,
          ["Figure", "File", "Route"],
          [[label.split(" — ")[0], name, label.split("(")[1].rstrip(")")] for name, label, _ in screens],
          [2.0, 5.0, 9.4],
          label="Table 13 — Screenshot index", font_size=8.4)

    h2(doc, "10.1 Archive screens")
    for name, label, description in screens[:7]:
        path = SCREENSHOTS / name
        if not path.exists():
            raise SystemExit(f"missing screenshot: {path}")
        figure(doc, path, f"{label}. {description}")

    h2(doc, "10.2 Live, long-form and credits")
    for name, label, description in screens[7:]:
        path = SCREENSHOTS / name
        if not path.exists():
            raise SystemExit(f"missing screenshot: {path}")
        figure(doc, path, f"{label}. {description}")


# ---------------------------------------------------------------------------
# 11 Performance and accessibility
# ---------------------------------------------------------------------------


def section_performance(doc: Document) -> None:
    h1(doc, "11. Performance and accessibility")
    lead(doc,
         "A 1.3 MB dataset and a live API could easily produce a slow application. The build stays fast by "
         "parsing once, splitting by route and never downloading more telemetry than the reader asked for.")

    h2(doc, "11.1 Bundle and loading")
    p(doc,
      "The production initial bundle is **580.38 kB raw / 154.23 kB transferred**. That includes the Angular "
      "runtime, the eager Home page and the shared component library. Every other route is a separate lazy "
      "chunk, with the live timing screen the largest and still under 45 kB. Angular's budgets are set to "
      "1.5 MB warning and 2.5 MB error for the initial bundle, so the build has a wide margin before it fails.")
    bullets(doc, [
        "The archive is fetched once as ten parallel requests — nine CSVs and the manifest — and indexed in memory; pages never re-fetch "
        "a file.",
        "Derived views are cached with `shareReplay`, so navigating back to a page does not repeat the work.",
        "OpenF1 responses are cached by path and query; the token bucket prevents a burst of page interactions "
        "from exceeding the API limit.",
        "Telemetry requests are scoped to one driver and one lap window; whole-session car data is never "
        "downloaded.",
        "Images are local and lazy-loaded, with manifest checks that avoid 404s.",
        "The background is pure CSS transforms on inline SVG paths; there are no image requests and no "
        "JavaScript animation loop.",
    ])

    h2(doc, "11.2 Accessibility")
    p(doc,
      "Accessibility was treated as a set of concrete interface decisions rather than a checklist added at "
      "the end:")
    bullets(doc, [
        "A skip link targets `#content`, and the main element is focusable.",
        "Headings follow a document outline; tables carry captions and header cells; tabs expose "
        "`aria-selected`.",
        "Controls have visible labels or accessible names, including icon-only buttons.",
        "Focus is never removed without a replacement; the focus ring is part of the token system.",
        "The mobile navigation is a keyboard-operable Material sheet, not a hover-only menu.",
        "`prefers-reduced-motion` disables the background loop; the content layer has no looping animation.",
        "Colour is not the only carrier of meaning: wins, positions and status also appear as text.",
    ])
    p(doc,
      "The project has not been through a formal WCAG 2.2 audit or a screen-reader test matrix. The claims "
      "above describe the implementation, not a certification. A proper audit — automated axe checks plus "
      "manual keyboard and screen-reader passes — is the obvious next step for the accessibility work.")

    h2(doc, "11.3 Data-scale performance")
    p(doc,
      "Ten thousand results and ten thousand qualifying rows are small for a browser but large enough to "
      "punish a careless implementation. The service builds maps for drivers, constructors, circuits and "
      "races, then groups results and qualifying by race and by driver. Page code reads from those maps "
      "instead of filtering the full arrays. The cost is paid once, on the first subscription, and the "
      "loading signal gives the interface something honest to show while it happens.")
    p(doc,
      "The 2026 calendar is bundled in full, including races that have not run. That keeps the next-race card "
      "and the calendar complete without a second data source, at the cost of a small amount of empty data "
      "that the UI must handle explicitly. The complete/in-progress distinction in `meta.json` is what makes "
      "that safe.")


# ---------------------------------------------------------------------------
# 12 Limitations and future work
# ---------------------------------------------------------------------------


def section_limitations(doc: Document) -> None:
    h1(doc, "12. Limitations and future work")
    lead(doc,
         "The application is complete as a student project, but it is not finished as a product. The gaps "
         "below are known, documented and deliberately left visible.")

    h2(doc, "12.1 Data limitations")
    bullets(doc, [
        "**2026 is in progress.** Eighteen of twenty-three rounds were complete on 26 October 2026. The app "
        "shows a leader, not a champion.",
        "**The 2026 calendar has unusual entries.** Sakhir and Jeddah were cancelled, Sepang hosts the Bahrain "
        "Grand Prix in Malaysia, and Madrid uses the `madring` circuit reference. The UI follows the data "
        "rather than assuming a conventional calendar.",
        "**Sprint results are not in the bundled archive.** Sprint weekends appear through their Grand Prix "
        "results and standings, but a separate sprint classification is not yet stored.",
        "**Portraits start in 2023.** OpenF1 lists drivers from 2023 onward, so earlier drivers use monograms. "
        "Arvid Lindblad has no portrait yet.",
        "**The archive is a snapshot.** It is reconciled to 26 October 2026 and must be refreshed with "
        "`npm run data:build` to move forward.",
    ])

    h2(doc, "12.2 Technical limitations")
    bullets(doc, [
        "**No unit or end-to-end test suite.** Verification is build-based and route-based; there are no "
        "Angular TestBed specs or Playwright journeys committed.",
        "**No formal accessibility audit.** The implementation follows accessible patterns, but it has not "
        "been tested with a screen-reader matrix or an automated axe run.",
        "**True live polling needs a paid token.** The free tier is a replay service; the live indicator and "
        "15-second refresh only activate with a bearer token.",
        "**One theme only.** There is no dark mode. That is a design decision, but it is also a limitation for "
        "readers who prefer one.",
        "**The optional backend is unmaintained relative to the frontend.** It still runs, but it is not part "
        "of the shipped data path and does not share the frontend's derived models.",
    ])

    h2(doc, "12.3 Next steps")
    p(doc,
      "The most valuable next step is not a new screen; it is a test suite. A small set of unit tests around "
      "the archive derivations — complete seasons, latest race, rivalry scoring, cancelled rounds — would "
      "protect the parts most likely to break when the data is refreshed. A Playwright journey through the "
      "eleven routes would then cover the integration layer, and an axe pass would turn the accessibility "
      "claims into evidence.")
    p(doc,
      "After that, the data work is straightforward: add sprint classifications, widen portrait coverage where "
      "a licence allows, and add a server-side cache for OpenF1 so a shared deployment does not ask every "
      "visitor to hold a token. On the interface side, saved favourite drivers and deeper stint/tyre analysis "
      "are natural extensions of the existing models.")
    p(doc,
      "The design system is deliberately stable. Any future screen should reuse the panel, header, tile, "
      "badge and table primitives; the quickest way to damage the project would be to add a twelfth screen "
      "with its own surface language.")


# ---------------------------------------------------------------------------
# 13 Conclusion
# ---------------------------------------------------------------------------


def section_conclusion(doc: Document) -> None:
    h1(doc, "13. Conclusion")
    lead(doc,
         "Paddock shows that a static Angular bundle can carry a serious archive and a live session viewer "
         "without a runtime server, and that a restrained visual system can make thirty decorative circuits "
         "feel like part of the subject rather than noise.")

    p(doc,
      "The project met its functional goals. Twenty-seven seasons are searchable and cross-referenced; eleven "
      "screens cover the archive, the live session, the history and the credits; and the live page degrades "
      "cleanly from a token-enabled poller to a historical replay. The production build is 580.38 kB raw and "
      "154.23 kB transferred, with every non-home route split into its own chunk.")
    p(doc,
      "The more interesting result is methodological. Treating documentation as a build artefact — code "
      "listings sliced from source, counts read from `meta.json`, screenshots captured from the production "
      "bundle — removed a whole class of drift. The same habit changed the design work: the background was "
      "not accepted because it looked atmospheric, but because its ink centroid moved from 71/67 to 49/51 and "
      "its coverage could be measured at three widths.")
    p(doc,
      "There are real gaps: no test suite, no formal accessibility audit, no sprint classifications and no "
      "2026 champion to name. Those are documented rather than papered over. For a semester project, the "
      "valuable outcome is not only the application but the repeatable process behind it: lock the data, "
      "build one complete screen at a time, measure the claims, and generate the paperwork from the same "
      "source tree.")


# ---------------------------------------------------------------------------
# References
# ---------------------------------------------------------------------------


def section_references(doc: Document) -> None:
    h1(doc, "References")
    p(doc, "Sources used for data, imagery, platform behaviour and accessibility guidance.", size=Pt(10),
      color=MUTED)

    refs = [
        ("Ergast Motor Racing Data", "Historical Formula 1 dataset, 1950–2024.",
         "https://ergast.com/mrd/"),
        ("Jolpica F1", "Community-maintained continuation of the Ergast API; source of the 2025–2026 data.",
         "https://github.com/jolpica/jolpica-f1"),
        ("OpenF1", "Public Formula 1 session, timing, race control and telemetry API.",
         "https://openf1.org/"),
        ("Angular", "Standalone components, signals, routing and the CLI build pipeline.",
         "https://angular.dev/"),
        ("Angular Material", "Dialog, navigation sheet and accessibility primitives.",
         "https://material.angular.io/"),
        ("PapaParse / ngx-papaparse", "Streaming CSV parsing used for the bundled archive.",
         "https://www.papaparse.com/"),
        ("Formula 1 media CDN", "Team marks and official circuit map imagery, used for identification.",
         "https://www.formula1.com/"),
        ("Wikimedia Commons", "Archive photography under Creative Commons or public-domain licences.",
         "https://commons.wikimedia.org/"),
        ("MDN — prefers-reduced-motion", "CSS media feature used to disable the background animation.",
         "https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion"),
        ("W3C — WCAG 2.2", "Accessibility guidance referenced by the interface decisions.",
         "https://www.w3.org/TR/WCAG22/"),
    ]
    for index, (title, note, url) in enumerate(refs, 1):
        paragraph = doc.add_paragraph()
        paragraph.paragraph_format.space_after = Pt(5)
        paragraph.paragraph_format.left_indent = Cm(0.8)
        paragraph.paragraph_format.first_line_indent = Cm(-0.8)
        run = paragraph.add_run(f"[{index}]  ")
        run.font.name = "Consolas"
        run.font.size = Pt(9)
        run.font.color.rgb = MUTED
        run = paragraph.add_run(title + ".  ")
        run.bold = True
        run.font.size = Pt(10)
        run.font.color.rgb = INK
        run = paragraph.add_run(note + "  ")
        run.font.size = Pt(10)
        run.font.color.rgb = BODY
        add_hyperlink(paragraph, url, url)


# ---------------------------------------------------------------------------
# Appendices
# ---------------------------------------------------------------------------


def section_appendices(doc: Document) -> None:
    h1(doc, "Appendix A — Source map")
    p(doc,
      "Every file below is part of the shipped frontend. Line counts are read from the working tree when this "
      "report is generated, so the map describes the same revision as the listings.",
      space_after=8)
    rows = [
        ["Shell", "`app.ts`", str(line_count("frontend/src/app/app.ts")),
         "Skip link, background, navbar, router outlet and footer"],
        ["Shell", "`app.config.ts`", str(line_count("frontend/src/app/app.config.ts")),
         "Router, HTTP, animations, Material dialog providers"],
        ["Shell", "`app.routes.ts`", str(line_count("frontend/src/app/app.routes.ts")),
         "Eleven routes, lazy loading, timeline redirect and wildcard"],
        ["Shell", "`components/navbar/navbar.component.ts`",
         str(line_count("frontend/src/app/components/navbar/navbar.component.ts")),
         "Desktop navigation, active rule and mobile sheet"],
        ["Config", "`core/config/data.config.ts`",
         str(line_count("frontend/src/app/core/config/data.config.ts")),
         "Archive window, live start year, team colours"],
        ["Config", "`core/config/asset-manifest.ts`",
         str(line_count("frontend/src/app/core/config/asset-manifest.ts")),
         "Generated list of images that exist, with credits"],
        ["Config", "`core/config/circuit-outlines.ts`",
         str(line_count("frontend/src/app/core/config/circuit-outlines.ts")),
         "Generated SVG paths for the circuit background"],
        ["Models", "`core/models/driver.model.ts`",
         str(line_count("frontend/src/app/core/models/driver.model.ts")),
         "Archive entities and derived career/standings types"],
        ["Models", "`core/models/openf1.model.ts`",
         str(line_count("frontend/src/app/core/models/openf1.model.ts")),
         "OpenF1 session, timing, telemetry and weather types"],
        ["Services", "`core/services/csv-data.service.ts`",
         str(line_count("frontend/src/app/core/services/csv-data.service.ts")),
         "Archive load, indexes, careers, standings, summaries, rivalry"],
        ["Services", "`core/services/openf1.service.ts`",
         str(line_count("frontend/src/app/core/services/openf1.service.ts")),
         "Cached API client, token bucket, live board, telemetry"],
        ["Utilities", "`core/utils/format.ts`",
         str(line_count("frontend/src/app/core/utils/format.ts")),
         "Number, date, gap and colour formatting"],
        ["Utilities", "`core/utils/country.ts`",
         str(line_count("frontend/src/app/core/utils/country.ts")),
         "Country names, flags and nationality normalisation"],
        ["Shared", "`shared/components/panel`",
         str(line_count("frontend/src/app/shared/components/panel/panel.component.ts")),
         "The matte silver surface used by every page"],
        ["Shared", "`shared/components/page-header`",
         str(line_count("frontend/src/app/shared/components/page-header/page-header.component.ts")),
         "Eyebrow, title and description rhythm"],
        ["Shared", "`shared/components/stat-tile`",
         str(line_count("frontend/src/app/shared/components/stat-tile/stat-tile.component.ts")),
         "Number and label tile"],
        ["Shared", "`shared/components/driver-avatar`",
         str(line_count("frontend/src/app/shared/components/driver-avatar/driver-avatar.component.ts")),
         "Manifest-backed portrait with monogram fallback"],
        ["Shared", "`shared/components/team-badge`",
         str(line_count("frontend/src/app/shared/components/team-badge/team-badge.component.ts")),
         "Manifest-backed logo with typographic crest fallback"],
        ["Shared", "`shared/components/spark-chart`",
         str(line_count("frontend/src/app/shared/components/spark-chart/spark-chart.component.ts")),
         "Hand-built SVG trend line"],
        ["Shared", "`shared/components/telemetry-chart`",
         str(line_count("frontend/src/app/shared/components/telemetry-chart/telemetry-chart.component.ts")),
         "Speed, gear and DRS trace for one lap"],
        ["Shared", "`shared/components/skeleton-loader`",
         str(line_count("frontend/src/app/shared/components/skeleton-loader/skeleton-loader.component.ts")),
         "Loading placeholders that match the final layout"],
        ["Shared", "`shared/components/empty-state`",
         str(line_count("frontend/src/app/shared/components/empty-state/empty-state.component.ts")),
         "Designed absence state"],
        ["Shared", "`shared/components/track-background`",
         str(line_count("frontend/src/app/shared/components/track-background/track-background.component.ts")),
         "Thirty-map full-bleed field and responsive rebuild"],
        ["Pages", "`pages/home`", str(line_count("frontend/src/app/pages/home/home.component.ts")),
         "MP4/4 hero, top five, totals, latest and next race"],
        ["Pages", "`pages/standings`",
         str(line_count("frontend/src/app/pages/standings/standings.component.ts")),
         "Drivers' and constructors' tables, leader card, export"],
        ["Pages", "`pages/drivers`",
         str(line_count("frontend/src/app/pages/drivers/drivers.component.ts")),
         "Searchable, sortable driver grid"],
        ["Pages", "`pages/drivers/driver-profile-dialog`",
         str(line_count("frontend/src/app/pages/drivers/driver-profile-dialog.component.ts")),
         "Career dialog with titles, seasons and teams"],
        ["Pages", "`pages/constructors`",
         str(line_count("frontend/src/app/pages/constructors/constructors.component.ts")),
         "Team grid, crests, title years and line-ups"],
        ["Pages", "`pages/circuits`",
         str(line_count("frontend/src/app/pages/circuits/circuits.component.ts")),
         "Map, searchable library and circuit detail"],
        ["Pages", "`pages/races`", str(line_count("frontend/src/app/pages/races/races.component.ts")),
         "Season calendar, winners, podiums and year switcher"],
        ["Pages", "`pages/race-detail`",
         str(line_count("frontend/src/app/pages/race-detail/race-detail.component.ts")),
         "Winner, podium, classification, qualifying and navigation"],
        ["Pages", "`pages/live`", str(line_count("frontend/src/app/pages/live/live.component.ts")),
         "Session replay, timing tower, weather, race control, telemetry"],
        ["Pages", "`pages/history`", str(line_count("frontend/src/app/pages/history/history.component.ts")),
         "Long-form article, eras, rivalries, champions and records"],
        ["Pages", "`pages/credits`", str(line_count("frontend/src/app/pages/credits/credits.component.ts")),
         "Generated image credits and trademark notice"],
        ["Feature", "`features/rivalry`",
         str(line_count("frontend/src/app/features/rivalry/rivalry.component.ts")),
         "Two-driver comparison, chart and season table"],
        ["Styles", "`styles/_tokens.scss`",
         str(line_count("frontend/src/styles/_tokens.scss")),
         "Colour, radius, elevation and motion tokens"],
        ["Styles", "`styles.scss`", str(line_count("frontend/src/styles.scss")),
         "Global silver surfaces, buttons, tables and accessibility utilities"],
    ]
    table(doc, ["Layer", "File", "Lines", "Responsibility"], rows, [2.0, 7.2, 1.2, 6.0],
          label="Table 14 — Source map of the shipped frontend", font_size=7.7, header_size=7.4)

    h1(doc, "Appendix B — Build and data scripts")
    p(doc,
      "The repository is reproducible from these commands. The data and asset scripts are Node; the three "
      "document builders are Python.", space_after=8)
    table(doc,
          ["Command", "Script", "What it produces"],
          [
              ["`npm run data:prune`", "`scripts/prune-archive.mjs`",
               "Rebuilds the 2000–2024 base CSVs and season standings"],
              ["`npm run data:sync`", "`scripts/sync-current-season.mjs`",
               "Appends 2025–2026 from Jolpica and rewrites `meta.json`"],
              ["`npm run data:build`", "Both data scripts",
               "A full archive refresh in the correct order"],
              ["`npm run assets:fetch`", "`scripts/fetch-assets.mjs`",
               "Downloads logos, maps, portraits and photos; writes the manifest"],
              ["`npm run outlines:build`", "`scripts/extract-circuit-outlines.mjs`",
               "Traces circuit maps into stroke-only SVG paths"],
              ["`npm run build`", "Angular CLI 21",
               "Production bundle in `frontend/dist/frontend/browser`"],
              ["`npm run docs:build`", "`scripts/build-docs.py`",
               "`README.docx` with cover, contents and screenshots"],
              ["`npm run deck:build`", "`scripts/build-deck.py`",
               "`f1-presentation.pptx`, 15 slides"],
              ["`python scripts/build-report.py`", "`scripts/build-report.py`",
               "This report, with generated diagrams, listings and screenshots"],
          ],
          [5.2, 5.2, 6.0],
          label="Table 15 — Scripts and their outputs", font_size=8.3)

    h1(doc, "Appendix C — Rebuilding the project")
    p(doc,
      "The sequence below rebuilds the data, the application and the documents from a clean checkout. The PDF "
      "exports use Microsoft Office because the table of contents and slide notes must be refreshed by the "
      "same engine that lays them out.")
    code_listing(doc, "\n".join([
        "# 1. data and assets",
        "npm run data:build",
        "npm run assets:fetch",
        "npm run outlines:build",
        "",
        "# 2. application",
        "cd frontend",
        "npm install",
        "npm run build",
        "npx http-server dist/frontend/browser -p 8080 -c-1",
        "",
        "# 3. documents",
        "cd ..",
        "npm run docs:build",
        "npm run deck:build",
        "python scripts/build-report.py",
        "",
        "# 4. PDF export (Word / PowerPoint COM)",
        "#    open the DOCX, update fields and the TOC, then SaveAs PDF (17)",
        "#    open the PPTX and SaveAs PDF (32)",
    ]), "Listing 13 — Full rebuild sequence", lang="powershell")
    p(doc,
      "The screenshots in section 10 are captured from the production preview, not from the development "
      "server, so they show the bundle that would actually be deployed. Re-capturing them is the last step "
      "before rebuilding the documents; otherwise the report and the deck describe an older interface.")


def build() -> None:
    figs = build_figures()
    doc = Document()
    configure(doc)
    add_header_footer(doc)
    enable_field_update(doc)
    doc.core_properties.title = "Paddock — Formula 1 Archive: Micro Project Report"
    doc.core_properties.author = "Jugal Patel, Krish Patel, Paavan Sharma"
    doc.core_properties.subject = "Micro Project Report · Semester 5 · FET"
    doc.core_properties.keywords = "Formula 1, Angular, OpenF1, data visualisation, micro project"

    cover(doc)
    details_page(doc, figs)
    toc_page(doc)
    content(doc, figs)

    doc.save(OUT)
    size_kb = OUT.stat().st_size / 1024
    print(f"Wrote {OUT.name} ({size_kb:.0f} KB)")


if __name__ == "__main__":
    build()
