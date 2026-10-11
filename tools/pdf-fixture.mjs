// pdf-fixture — a small, valid PDF made from lines of text, for the PDF card's browser check (tools/test_void.mjs). One page per
// array of lines, Helvetica 12, one text line per PDF line, with a correct cross-reference table so pdf.js reads it strictly.
//   pdfOf([['line one', 'line two'], ['page two']]) -> Buffer
export function pdfOf(pages) {
  const esc = (s) => String(s).replace(/[\\()]/g, (c) => '\\' + c);
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', null, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const kids = [];
  for (const lines of pages) {
    const body = 'BT /F1 12 Tf 72 720 Td 16 TL ' + lines.map((l, i) => (i ? 'T* ' : '') + '(' + esc(l) + ') Tj').join(' ') + ' ET';
    objs.push('<< /Length ' + Buffer.byteLength(body, 'latin1') + ' >>\nstream\n' + body + '\nendstream');
    const content = objs.length;
    objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ' + content + ' 0 R >>');
    kids.push(objs.length + ' 0 R');
  }
  objs[1] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + kids.length + ' >>';
  let out = '%PDF-1.4\n';
  const at = objs.map((o, i) => { const off = Buffer.byteLength(out, 'latin1'); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; return off; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + at.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  return Buffer.from(out, 'latin1');
}
