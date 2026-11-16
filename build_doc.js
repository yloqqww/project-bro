const fs = require('fs');
const path = require('path');
const { Document, Packer, Header, Footer, Paragraph, TextRun, AlignmentType, PageNumber } = require('docx');
const { THEME } = require('./doc_helpers');
const { getPart1Children } = require('./doc_sections_part1');
const { getPart2Children } = require('./doc_sections_part2');
const { getPart3Children } = require('./doc_sections_part3');

async function main() {
  console.log("Compiling document sections in clean basic English...");
  const part1 = getPart1Children();
  const part2 = getPart2Children();
  const part3 = getPart3Children();

  const allChildren = [...part1, ...part2, ...part3];
  console.log(`Total document elements: ${allChildren.length}`);

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: THEME.fontFamily,
            color: '111827'
          }
        }
      }
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,    // 1 inch = 1440 twips
              bottom: 1440,
              left: 1440,
              right: 1440
            }
          }
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: "SAD Finals Activity #2: Integrated System Design (Modules XIII–XVII)",
                    font: THEME.fontFamily,
                    size: 18,
                    color: "64748B",
                    italics: false
                  })
                ]
              })
            ]
          })
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: "Page ",
                    font: THEME.fontFamily,
                    size: 18,
                    color: "64748B"
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: THEME.fontFamily,
                    size: 18,
                    color: "64748B"
                  }),
                  new TextRun({
                    text: " | BSIT Group 1",
                    font: THEME.fontFamily,
                    size: 18,
                    color: "64748B"
                  })
                ]
              })
            ]
          })
        },
        children: allChildren
      }
    ]
  });

  console.log("Packing Word document buffer...");
  const buffer = await Packer.toBuffer(doc);
  const outputPath = path.join(__dirname, 'Finals_Activity_2_SAD_Document.docx');
  fs.writeFileSync(outputPath, buffer);

  console.log(`Successfully generated Word doc: ${outputPath}`);
  console.log(`File size: ${(buffer.length / 1024).toFixed(2)} KB`);
}

main().catch(err => {
  console.error("Error generating document:", err);
  process.exit(1);
});
