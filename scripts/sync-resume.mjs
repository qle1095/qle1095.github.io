/**
 * Copies the newest resume PDF from OneDrive into public/, where the site
 * serves it from. Run with `npm run sync-resume`.
 *
 * The exported filename carries a date ("Levi Le - Commercial 07292026.pdf"),
 * so this picks the most recently modified PDF in the folder rather than
 * hard-coding a name that goes stale on every export. Pass an explicit path
 * to override:  npm run sync-resume -- "/mnt/c/.../Some Other.pdf"
 */
import { copyFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE_DIR = '/mnt/c/Users/disap/OneDrive/Resume';
const DEST = new URL('../public/resume.pdf', import.meta.url).pathname;

const override = process.argv[2];

function newestPdf(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    throw new Error(
      `Cannot read ${dir}. If OneDrive moved, pass the file directly:\n` +
        `  npm run sync-resume -- "/mnt/c/path/to/resume.pdf"`,
    );
  }
  const pdfs = entries
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .map((f) => {
      const full = join(dir, f);
      return { full, name: f, mtime: statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  if (!pdfs.length) throw new Error(`No PDFs found in ${dir}`);
  return pdfs;
}

let src;
if (override) {
  src = override;
  console.log(`Using explicit source: ${src}`);
} else {
  const pdfs = newestPdf(SOURCE_DIR);
  src = pdfs[0].full;
  console.log(`Newest of ${pdfs.length} PDF(s) in OneDrive: ${pdfs[0].name}`);
  if (pdfs.length > 1) {
    console.log(`  (others: ${pdfs.slice(1).map((p) => p.name).join(', ')})`);
  }
}

copyFileSync(src, DEST);
const kb = (statSync(DEST).size / 1024).toFixed(1);
console.log(`Copied -> public/resume.pdf (${kb} KB)`);
console.log('Now commit and push to publish:  git add public/resume.pdf && git commit -m "Update resume" && git push');
