const fs = require('fs-extra');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const curriculum = require('./curriculum');

const UPLOADS_DIR = path.join(__dirname, 'uploads');

function sanitize(name) {
  return name.replace(/[\/\\:*?"<>|]/g, '').trim();
}

async function renameAndCombine() {
  let renamed = 0;
  let combined = 0;

  for (const [classKey, classObj] of Object.entries(curriculum)) {
    for (const [streamKey, stream] of Object.entries(classObj.streams)) {
      for (const [subjectKey, subject] of Object.entries(stream.subjects)) {
        const ncertDir = path.join(UPLOADS_DIR, classKey, streamKey, subjectKey, 'ncert-textbook');
        if (!await fs.pathExists(ncertDir)) continue;

        const files = (await fs.readdir(ncertDir)).filter(f => f.endsWith('.pdf'));
        if (!files.length) continue;

        const chapterFiles = files.filter(f => {
          const base = f.replace('.pdf', '').toLowerCase();
          return !base.endsWith('ps') && !base.endsWith('an') && !base.endsWith('sm') && !base.match(/a\d+$/);
        });
        chapterFiles.sort();

        const specialFiles = files.filter(f => {
          const base = f.replace('.pdf', '').toLowerCase();
          return base.endsWith('ps') || base.endsWith('an') || base.endsWith('sm') || base.match(/a\d+$/);
        });

        const chapters = subject.chapters;
        const allSorted = [...chapterFiles];
        console.log(`${classKey}/${streamKey}/${subjectKey}: ${chapterFiles.length} chapter files, ${chapters.length} curriculum chapters`);

        const renamedFiles = [];
        for (let i = 0; i < allSorted.length; i++) {
          const oldFile = path.join(ncertDir, allSorted[i]);
          const chapterName = i < chapters.length ? chapters[i] : `Chapter ${i + 1}`;
          const newFileName = sanitize(`Ch ${String(i + 1).padStart(2, '0')} - ${chapterName}`) + '.pdf';
          const newFile = path.join(ncertDir, newFileName);

          if (allSorted[i] !== newFileName) {
            await fs.rename(oldFile, newFile);
            renamed++;
          }
          renamedFiles.push(newFileName);
        }

        for (const sf of specialFiles) {
          const base = sf.replace('.pdf', '').toLowerCase();
          let label = 'Appendix';
          if (base.endsWith('ps')) label = 'Preface';
          else if (base.endsWith('sm')) label = 'Supplementary Material';
          const oldFile = path.join(ncertDir, sf);
          const newFileName = label + '.pdf';
          const newFile = path.join(ncertDir, newFileName);
          if (sf !== newFileName) {
            await fs.rename(oldFile, newFile);
            renamed++;
          }
        }

        try {
          const mergedPdf = await PDFDocument.create();
          for (const fileName of renamedFiles) {
            const filePath = path.join(ncertDir, fileName);
            try {
              const pdfBytes = await fs.readFile(filePath);
              const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
              const pages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
              for (const page of pages) {
                mergedPdf.addPage(page);
              }
            } catch (err) {
              console.log(`  Skipped ${fileName}: ${err.message}`);
            }
          }
          if (mergedPdf.getPageCount() > 0) {
            const mergedBytes = await mergedPdf.save();
            const label = sanitize(`${subject.label} - Complete Textbook`);
            const mergedPath = path.join(ncertDir, label + '.pdf');
            await fs.writeFile(mergedPath, mergedBytes);
            combined++;
            console.log(`  Combined: ${label}.pdf (${mergedPdf.getPageCount()} pages)`);
          }
        } catch (err) {
          console.log(`  Combine failed: ${err.message}`);
        }
      }
    }
  }

  console.log(`\nDone. Renamed: ${renamed}, Combined: ${combined}`);
}

renameAndCombine().catch(console.error);
