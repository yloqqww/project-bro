function escapePdf(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7E]/g, '?');
}

function wrapLine(value: string, width = 95) {
  const text = String(value || '');
  if (!text) return [''];
  const output: string[] = [];
  let remaining = text;
  while (remaining.length > width) {
    let splitAt = remaining.lastIndexOf(' ', width);
    if (splitAt < Math.floor(width / 2)) splitAt = width;
    output.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  output.push(remaining);
  return output;
}

function pageStream(title: string, lines: string[], page: number, pageCount: number) {
  return [
    'BT',
    '/F1 16 Tf',
    '50 790 Td',
    `(${escapePdf(page === 1 ? title : `${title} (continued)`)}) Tj`,
    '/F1 11 Tf',
    '0 -24 Td',
    ...lines.flatMap((line) => [`(${escapePdf(line)}) Tj`, '0 -15 Td']),
    'ET',
    'BT',
    '/F1 9 Tf',
    '50 34 Td',
    `(Page ${page} of ${pageCount}) Tj`,
    'ET',
  ].join('\n');
}

export function createTextPdf(title: string, lines: string[]) {
  const wrapped = lines.flatMap((line) => wrapLine(line));
  const pages: string[][] = [];
  const linesPerPage = 46;
  for (let index = 0; index < Math.max(1, wrapped.length); index += linesPerPage) {
    pages.push(wrapped.slice(index, index + linesPerPage));
  }

  const pageObjectNumbers = pages.map((_, index) => 4 + index * 2);
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  pages.forEach((pageLines, index) => {
    const pageObject = pageObjectNumbers[index];
    const contentObject = pageObject + 1;
    const stream = pageStream(title, pageLines, index + 1, pages.length);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObject} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
  });

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}
