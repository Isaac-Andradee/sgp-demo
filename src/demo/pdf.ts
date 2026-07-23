/**
 * Gerador mínimo de PDF para a demonstração.
 *
 * No sistema real os relatórios são gerados no backend com OpenPDF. Como a demo
 * não tem backend, monta-se aqui um PDF simples e válido, apenas para que o
 * botão "Gerar relatório" produza um download de verdade.
 */

/** Remove acentos: o PDF usa Helvetica com WinAnsi, e escapar tudo não compensa aqui. */
function ascii(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E]/g, '');
}

/** Escapa os caracteres especiais de string literal do PDF. */
function escapePdf(text: string): string {
  return ascii(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

export interface PdfLine {
  text: string;
  size?: number;
  bold?: boolean;
  gap?: number;
}

/**
 * Monta um PDF de uma página a partir de linhas de texto.
 * Constrói a tabela xref com os offsets reais — sem isso, leitores rejeitam o arquivo.
 */
export function buildPdf(title: string, lines: PdfLine[]): Blob {
  const pageHeight = 842;
  const marginTop = 60;
  const marginLeft = 50;

  let y = pageHeight - marginTop;
  const ops: string[] = [];

  // Título
  ops.push(`BT /F2 16 Tf ${marginLeft} ${y} Td (${escapePdf(title)}) Tj ET`);
  y -= 28;

  for (const line of lines) {
    if (y < 60) break; // uma página só — o suficiente para a demo
    const font = line.bold ? '/F2' : '/F1';
    const size = line.size ?? 10;
    ops.push(`BT ${font} ${size} Tf ${marginLeft} ${y} Td (${escapePdf(line.text)}) Tj ET`);
    y -= (line.gap ?? size + 6);
  }

  const content = ops.join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R '
      + '/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => { pdf += `${String(off).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}
