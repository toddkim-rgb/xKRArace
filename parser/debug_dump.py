# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding="utf-8")
import pdfplumber

for src, dst in [
    (r"C:\Users\toddk\xHRrace\pdfs\s_run_hr_260614_08.pdf", r"C:\Users\toddk\xHRrace\data\dump_0614_08.txt"),
    (r"C:\Users\toddk\xHRrace\pdfs\s_run_hr_260614_06.pdf", r"C:\Users\toddk\xHRrace\data\dump_0614_06.txt"),
]:
    with pdfplumber.open(src) as pdf, open(dst, "w", encoding="utf-8") as out:
        for i, page in enumerate(pdf.pages):
            out.write(f"========== PAGE {i+1} ==========\n")
            out.write(page.extract_text() or "")
            out.write("\n\n")
    print("dumped", dst)
