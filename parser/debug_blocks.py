# -*- coding: utf-8 -*-
"""특정 출전마 블록의 원문 라인을 확인해 정규식 실패 원인을 찾는다."""
import sys
sys.stdout.reconfigure(encoding="utf-8")
import os
import re
import pdfplumber

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_pdfs import ENTRY_RE

PDF_DIR = r"C:\Users\toddk\xHRrace\pdfs"
TARGETS = [
    ("s_run_hr_260613_08.pdf", 6),   # sire 누락
    ("s_run_hr_260614_01.pdf", 3),   # owner 누락
    ("s_run_hr_260614_07.pdf", 3),   # sire 누락
]

for fname, gate in TARGETS:
    with pdfplumber.open(os.path.join(PDF_DIR, fname)) as pdf:
        lines = []
        for page in pdf.pages:
            lines.extend((page.extract_text() or "").splitlines())
    starts = []
    expected = 1
    for i, line in enumerate(lines):
        if re.match(r"^레이팅\s+승률", line):
            break
        m = ENTRY_RE.match(line)
        if m and int(m.group(1)) == expected:
            starts.append((expected, i))
            expected += 1
    idx = {g: i for g, i in starts}
    if gate not in idx:
        print(f"== {fname} gate {gate}: NOT FOUND ==")
        continue
    start = idx[gate]
    stop = idx.get(gate + 1, start + 12)
    print(f"== {fname} gate {gate} ==")
    for l in lines[start:stop][:9]:
        print("  |", l[:120])
    print()
