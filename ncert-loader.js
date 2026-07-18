const fs = require('fs-extra');
const path = require('path');
const https = require('https');
const AdmZip = require('adm-zip');

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const BASE = 'https://ncert.nic.in/textbook/pdf';

const books = [
  { cls:'class-11', streams:['medical','non_medical'], subject:'physics', zips:['keph1dd.zip','keph2dd.zip'] },
  { cls:'class-11', streams:['medical','non_medical'], subject:'chemistry', zips:['kech1dd.zip','kech2dd.zip'] },
  { cls:'class-11', streams:['medical'], subject:'biology', zips:['kebo1dd.zip'] },
  { cls:'class-11', streams:['non_medical'], subject:'mathematics', zips:['kemh1dd.zip'] },
  { cls:'class-12', streams:['medical','non_medical'], subject:'physics', zips:['leph1dd.zip','leph2dd.zip'] },
  { cls:'class-12', streams:['medical','non_medical'], subject:'chemistry', zips:['lech1dd.zip','lech2dd.zip'] },
  { cls:'class-12', streams:['medical'], subject:'biology', zips:['lebo1dd.zip'] },
  { cls:'class-12', streams:['non_medical'], subject:'mathematics', zips:['lemh1dd.zip','lemh2dd.zip'] },
];

function download(url) {
  return new Promise((resolve, reject) => {
    const doRequest = (reqUrl, redirects = 0) => {
      if (redirects > 5) return reject(new Error('Too many redirects'));
      const get = reqUrl.startsWith('https') ? https.get : require('http').get;
      get(reqUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return doRequest(res.headers.location, redirects + 1);
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

async function ensureNcertPdfs() {
  const marker = path.join(UPLOADS_DIR, '.ncert-downloaded');
  if (await fs.pathExists(marker)) return;

  console.log('NCERT PDFs not found. Downloading...');
  fs.ensureDirSync(UPLOADS_DIR);

  for (const book of books) {
    for (const zipName of book.zips) {
      try {
        process.stdout.write(`  ${zipName}... `);
        const buf = await download(`${BASE}/${zipName}`);
        const zip = new AdmZip(buf);
        for (const entry of zip.getEntries()) {
          if (entry.entryName.endsWith('.pdf') && !entry.entryName.includes('MACOSX')) {
            const data = entry.getData();
            const name = path.basename(entry.entryName);
            for (const stream of book.streams) {
              const dir = path.join(UPLOADS_DIR, book.cls, stream, book.subject, 'ncert-textbook');
              fs.ensureDirSync(dir);
              fs.writeFileSync(path.join(dir, name), data);
            }
          }
        }
        console.log('OK');
      } catch (err) {
        console.log(`skip (${err.message})`);
      }
    }
  }

  await fs.writeFile(marker, new Date().toISOString());
  console.log('NCERT PDFs ready.\n');
}

module.exports = { ensureNcertPdfs };
