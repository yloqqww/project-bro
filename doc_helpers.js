const { 
  Document, Paragraph, TextRun, Table, TableRow, TableCell, 
  HeadingLevel, WidthType, AlignmentType, BorderStyle, ShadingType, 
  Header, Footer, PageNumber
} = require('docx');

const THEME = {
  primary: '000000',    // Formal Black
  secondary: '1E293B',  // Slate Dark
  darkText: '000000',   // Black
  bodyText: '111827',   // Clean Black / Dark Gray
  lightBg: 'F8FAFC',    // Subtle soft gray for callouts
  zebraBg: 'F9FAFB',    // Clean subtle zebra row
  tableBorder: '94A3B8',// Standard clean border
  tableHeaderBg: '1E293B', // Professional Dark Slate Header
  fontFamily: 'Calibri'
};

const borderConfig = {
  top: { style: BorderStyle.SINGLE, size: 4, color: THEME.tableBorder },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: THEME.tableBorder },
  left: { style: BorderStyle.SINGLE, size: 4, color: THEME.tableBorder },
  right: { style: BorderStyle.SINGLE, size: 4, color: THEME.tableBorder }
};

function h1(title) {
  return new Paragraph({
    text: title,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 180 },
    run: {
      font: THEME.fontFamily,
      size: 28, // 14pt
      bold: true,
      color: '000000'
    }
  });
}

function h2(title) {
  return new Paragraph({
    text: title,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    run: {
      font: THEME.fontFamily,
      size: 24, // 12pt
      bold: true,
      color: '000000'
    }
  });
}

function h3(title) {
  return new Paragraph({
    text: title,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 80 },
    run: {
      font: THEME.fontFamily,
      size: 22, // 11pt
      bold: true,
      color: '000000'
    }
  });
}

function p(text, options = {}) {
  return new Paragraph({
    spacing: { before: 50, after: 80, line: 276 }, // 1.15 line spacing
    children: [
      new TextRun({
        text: text,
        font: THEME.fontFamily,
        size: options.size || 22, // 11pt
        color: options.color || '111827',
        bold: !!options.bold,
        italics: !!options.italics
      })
    ]
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    bullet: { level },
    spacing: { before: 30, after: 30, line: 260 },
    children: [
      new TextRun({
        text: text,
        font: THEME.fontFamily,
        size: 22,
        color: '111827'
      })
    ]
  });
}

function callout(title, body) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { fill: 'F8FAFC', type: ShadingType.CLEAR },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
              right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
              left: { style: BorderStyle.SINGLE, size: 20, color: '1E293B' }
            },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 40 },
                children: [
                  new TextRun({
                    text: title,
                    font: THEME.fontFamily,
                    bold: true,
                    size: 22,
                    color: '000000'
                  })
                ]
              }),
              new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({
                    text: body,
                    font: THEME.fontFamily,
                    size: 21,
                    color: '334155',
                    italics: false
                  })
                ]
              })
            ]
          })
        ]
      })
    ]
  });
}

function createTable(headers, rows, colWidths = []) {
  const headerRow = new TableRow({
    isHeader: true,
    tableHeader: true,
    children: headers.map((h, i) => {
      const cellConfig = {
        shading: { fill: '1E293B', type: ShadingType.CLEAR }, // dark slate professional
        borders: borderConfig,
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 0, after: 0 },
            children: [
              new TextRun({
                text: h,
                font: THEME.fontFamily,
                bold: true,
                size: 20,
                color: 'FFFFFF'
              })
            ]
          })
        ]
      };
      if (colWidths[i]) {
        cellConfig.width = { size: colWidths[i], type: WidthType.PERCENTAGE };
      }
      return new TableCell(cellConfig);
    })
  });

  const dataRows = rows.map((row, rowIndex) => {
    const isEven = rowIndex % 2 === 1;
    return new TableRow({
      children: row.map((cellText, i) => {
        const cellConfig = {
          shading: { fill: isEven ? 'F8FAFC' : 'FFFFFF', type: ShadingType.CLEAR },
          borders: borderConfig,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [
            new Paragraph({
              spacing: { before: 0, after: 0 },
              children: [
                new TextRun({
                  text: String(cellText),
                  font: THEME.fontFamily,
                  size: 20,
                  color: '000000'
                })
              ]
            })
          ]
        };
        if (colWidths[i]) {
          cellConfig.width = { size: colWidths[i], type: WidthType.PERCENTAGE };
        }
        return new TableCell(cellConfig);
      })
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows]
  });
}

module.exports = {
  THEME,
  h1,
  h2,
  h3,
  p,
  bullet,
  callout,
  createTable
};
