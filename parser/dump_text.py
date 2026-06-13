# -*- coding: utf-8 -*-
"""Dump full extracted text of one PDF for parser design."""
import pdfplumber

SRC = r"C:\Users\toddk\xHRrace\pdfs\s_run_hr_260613_05.pdf"
DST = r"C:\Users\toddk\xHRrace\data\sample_dump.txt"

with pdfplumber.open(SRC) as pdf, open(DST, "w", encoding="utf-8") as out:
    for i, page in enumerate(pdf.pages):
        out.write(f"========== PAGE {i+1} ==========\n")
        out.write(page.extract_text() or "")
        out.write("\n\n")
print("dumped to", DST)
