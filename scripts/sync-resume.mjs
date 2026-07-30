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
import { join, relative } from 'node:path';

const SOURCE_DIR = '/mnt/c/Users/disap/OneDrive/Resume';
const DEST = new URL('../public/resume.pdf', import.meta.url).pathname;

const override = process.argv[2];

/** Walks subfolders too — exports get filed into dated folders like
 *  "July 30 2026/", and a top-level-only scan silently returns a stale file. */
function collectPdfs(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    if (out.length === 0) {
      throw new Error(
        `Cannot read ${dir}. If OneDrive moved, pass the file directly:\n` +
          `  npm run sync-resume -- "/mnt/c/path/to/resume.pdf"`,
      );
    }
    return out;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) collectPdfs(full, out);
    else if (e.name.toLowerCase().endsWith('.pdf')) {
      out.push({ full, name: relative(SOURCE_DIR, full), mtime: statSync(full).mtimeMs });
    }
  }
  return out;
}

function newestPdf(dir) {
  const pdfs = collectPdfs(dir).sort((a, b) => b.mtime - a.mtime);
  if (!pdfs.length) throw new Error(`No PDFs found under ${dir}`);
  return pdfs;
}

// The public site serves the Commercial variant. Levi exports Commercial and
// Defense together, seconds apart, so "newest overall" is a coin flip between
// them — prefer the Commercial one by name, then fall back to newest.
const VARIANT = process.env.RESUME_VARIANT ?? 'commercial';

let src;
if (override) {
  src = override;
  console.log(`Using explicit source: ${src}`);
} else {
  const pdfs = newestPdf(SOURCE_DIR);
  const preferred = pdfs.filter((p) => p.name.toLowerCase().includes(VARIANT));
  const chosen = preferred[0] ?? pdfs[0];
  src = chosen.full;
  if (preferred.length) {
    console.log(`Newest "${VARIANT}" of ${pdfs.length} PDF(s): ${chosen.name}`);
  } else {
    console.log(
      `No PDF matched "${VARIANT}"; falling back to newest overall: ${chosen.name}`,
    );
  }
  const others = pdfs.filter((p) => p !== chosen).slice(0, 3);
  if (others.length) {
    console.log(`  (next newest: ${others.map((p) => p.name).join(', ')})`);
  }
}

copyFileSync(src, DEST);
const kb = (statSync(DEST).size / 1024).toFixed(1);
console.log(`Copied -> public/resume.pdf (${kb} KB)`);
console.log('Now commit and push to publish:  git add public/resume.pdf && git commit -m "Update resume" && git push');
