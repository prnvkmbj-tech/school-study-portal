const fs = require('fs-extra');
const path = require('path');
const https = require('https');
const AdmZip = require('adm-zip');

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const TEMP_DIR = path.join(__dirname, '_temp');
fs.ensureDirSync(TEMP_DIR);

const BASE = 'https://ncert.nic.in/textbook/pdf';

const books = [
  { cls:'class-11', streams:['medical','non_medical'], subject:'physics', zips:['keph1dd.zip','keph2dd.zip'] },
  { cls:'class-11', streams:['medical','non_medical'], subject:'chemistry', zips:['kech1dd.zip','kech2dd.zip'] },
  { cls:'class-11', streams:['medical'], subject:'biology', zips:['kebo1dd.zip'] },
  { cls:'class-11', streams:['non_medical'], subject:'mathematics', zips:['kemh1dd.zip','kemh2dd.zip'] },
  { cls:'class-12', streams:['medical','non_medical'], subject:'physics', zips:['leph1dd.zip','leph2dd.zip'] },
  { cls:'class-12', streams:['medical','non_medical'], subject:'chemistry', zips:['lech1dd.zip','lech2dd.zip'] },
  { cls:'class-12', streams:['medical'], subject:'biology', zips:['lebo1dd.zip'] },
  { cls:'class-12', streams:['non_medical'], subject:'mathematics', zips:['lemh1dd.zip','lemh2dd.zip'] },
];

function download(url) {
  return new Promise((resolve, reject) => {
    const doRequest = (reqUrl) => {
      const get = reqUrl.startsWith('https') ? https.get : require('http').get;
      get(reqUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return doRequest(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }).on('error', reject);
    };
    doRequest(url);
  });
}

async function main() {
  let totalFiles = 0;

  for (const book of books) {
    for (const zipName of book.zips) {
      const url = `${BASE}/${zipName}`;
      process.stdout.write(`Downloading ${zipName}... `);

      try {
        const buf = await download(url);
        const zip = new AdmZip(buf);
        const entries = zip.getEntries();

        let pdfCount = 0;
        for (const entry of entries) {
          if (entry.entryName.endsWith('.pdf') && !entry.entryName.startsWith('__MACOSX')) {
            const pdfData = entry.getData();
            const fileName = path.basename(entry.entryName);

            for (const stream of book.streams) {
              const dir = path.join(UPLOADS_DIR, book.cls, stream, book.subject, 'ncert-textbook');
              fs.ensureDirSync(dir);
              fs.writeFileSync(path.join(dir, fileName), pdfData);
            }
            pdfCount++;
          }
        }
        totalFiles += pdfCount * book.streams.length;
        console.log(`${pdfCount} chapters`);
      } catch (err) {
        console.log(`FAILED (${err.message})`);
      }
    }
  }

  fs.removeSync(TEMP_DIR);
  console.log(`\nDone! ${totalFiles} files placed across all streams.`);
}

main().catch(console.error);
