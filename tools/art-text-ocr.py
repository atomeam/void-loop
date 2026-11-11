#!/usr/bin/env python3
"""OCR one image path; print readable words, one per line. Used by tools/art-text-scan.mjs."""
import sys
from rapidocr_onnxruntime import RapidOCR

def main():
    path = sys.argv[1]
    ocr = RapidOCR()
    rows, _ = ocr(path)
    words = []
    for row in rows or []:
        for w in str(row[1]).split():
            t = ''.join(ch for ch in w if ch.isalnum() or ch == "'")
            if len(t) >= 2:
                words.append(t)
    for w in words:
        print(w)

if __name__ == '__main__':
    main()
