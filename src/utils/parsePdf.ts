import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { Exam } from '../types/exam';
import { detectCourseName } from './courseNameDetector';
import { detectCourseCodeFromFilename as detectCourseCodeFromFilenameExt, detectCourseCodeFromText as detectCourseCodeFromTextExt } from './courseCodeDetector';
import { detectQuestionsFromPages } from './questionDetector';

// Helpers
function normalizeDiacritics(input: string): string {
  try {
    // NFD split + strip combining marks to handle e.g. "poäng" consistently
    return input.normalize('NFD').replace(/\p{M}+/gu, '');
  } catch {
    // Fallback: replace common Swedish chars
    return input
      .replace(/[ÅÄÃ�]/g, 'A')
      .replace(/[åäÃ¥]/g, 'a')
      .replace(/[ÖÃ–]/g, 'O')
      .replace(/[öÃ¶]/g, 'o');
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Repair common encoding/combining issues seen in PDF text (for display only)
function repairCommonMisencoding(input: string): string {
  let s = input;
  // UTF-8 mis-decoded to Latin-1 patterns
  const map: Record<string,string> = {
    'Ã¥': 'å', 'Ã„': 'Ä', 'Ã¤': 'ä', 'Ã…': 'Å', 'Ã–': 'Ö', 'Ã¶': 'ö', 'Ã–': 'Ö', 'Ã–': 'Ö', 'Ã–': 'Ö',
    'Â ': '', 'Â·': '·', 'Â–': '–', 'Â—': '—', 'Â©': '©', 'Â®': '®', 'Â°': '°',
  };
  for (const [bad, good] of Object.entries(map)) s = s.split(bad).join(good);
  // Detached diacritics like "¨ a" -> "ä", and ring "° a"/"˚ a" -> "å"
  s = s.replace(/\u00A8\s*([aA])/g, (_m, p1) => (p1 === 'A' ? 'Ä' : 'ä'));
  s = s.replace(/\u00A8\s*([oO])/g, (_m, p1) => (p1 === 'O' ? 'Ö' : 'ö'));
  s = s.replace(/[\u02DA\u00B0]\s*([aA])/g, (_m, p1) => (p1 === 'A' ? 'Å' : 'å'));
  // Compose characters where possible
  try { s = s.normalize('NFC'); } catch {}
  // Collapse excessive whitespace
  s = s.replace(/[\t ]+/g, ' ');
  return s;
}

// Attempts to obtain a Tesseract instance either from a local dependency,
// a preloaded global (CDN), or by dynamically injecting a CDN script.
async function loadTesseract(): Promise<any | null> {
  try {
    if (typeof window !== 'undefined' && (window as any).Tesseract) {
      return (window as any).Tesseract;
    }
  } catch {}

  // Try a dynamic import if the package is installed locally
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const mod = await import('tesseract.js');
    if (mod && (mod as any).createWorker) {
      return (mod as any);
    }
    if (mod) {
      return mod as any;
    }
  } catch {}

  // Fallback: inject a CDN script dynamically (works when network allowed)
  try {
    if (typeof document !== 'undefined') {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Tesseract.js'));
        document.head.appendChild(script);
      });
      return (window as any).Tesseract || null;
    }
  } catch {}
  return null;
}

function extractQuestionsFromText(text: string): Array<any> {
  // Normalize whitespace to make regex scanning across PDF text more reliable
  const base = normalizeDiacritics(text);
  const normalized = base.replace(/\s+/g, ' ').trim();

  // Track order of main questions and their sub-letters
  const mainOrder: number[] = [];
  const hasMain = new Set<number>();
  const subOrder = new Map<number, string[]>(); // preserves insertion order per main
  const pointsByToken = new Map<string, number>();

  function ensureMain(n: number) {
    if (!hasMain.has(n)) {
      hasMain.add(n);
      mainOrder.push(n);
    }
    if (!subOrder.has(n)) subOrder.set(n, []);
  }

  function parsePointsFromSegment(seg: string): number | null {
    const s = normalizeDiacritics(seg);
    const patterns = [
      /\((\d{1,3})\s*p(?:oang)?\)/i,
      /(\d{1,3})\s*p(?:oang)?\b/i,
      /\b(?:poang|points)\s*:?\s*(\d{1,3})\b/i,
    ];
    for (const re of patterns) {
      const m = s.match(re);
      if (m) {
        const v = parseInt(m[1], 10);
        if (!Number.isNaN(v)) return v;
      }
    }
    return null;
  }

  function parsePointsListFromSegment(seg: string): number[] | null {
    // Matches (3+2+1)p or (3 + 2 + 1) p, with or without trailing p
    const s = normalizeDiacritics(seg);
    const m = s.match(/\((\s*\d{1,3}(?:\s*\+\s*\d{1,3})+)\)\s*p?(?:oang)?/i);
    if (!m) return null;
    const list = m[1]
      .split(/\+/)
      .map(s => parseInt(s.trim(), 10))
      .filter(v => !Number.isNaN(v));
    return list.length >= 2 ? list : null;
  }

  function letterRangeExpand(a: string, b: string): string[] {
    const start = a.toLowerCase().charCodeAt(0);
    const end = b.toLowerCase().charCodeAt(0);
    const lo = Math.max('a'.charCodeAt(0), Math.min(start, end));
    const hi = Math.min('z'.charCodeAt(0), Math.max(start, end));
    const res: string[] = [];
    for (let c = lo; c <= hi; c++) res.push(String.fromCharCode(c));
    return res;
  }

  // 1) Extract combined patterns like "2a)" anywhere in the text
  const combinedRe = /(?:\b(?:uppgift|problem|fraga|question|q)\s*)?([1-9]\d?)\s*([a-zA-Z])\s*[\)\.:]/g;
  let cm: RegExpExecArray | null;
  while ((cm = combinedRe.exec(normalized)) !== null) {
    const mainNum = parseInt(cm[1], 10);
    const letter = cm[2].toLowerCase();
    if (Number.isNaN(mainNum)) continue;
    ensureMain(mainNum);
    const arr = subOrder.get(mainNum)!;
    if (!arr.includes(letter)) arr.push(letter);

    // Try to capture points near this token in the normalized flow
    const token = `${mainNum}${letter}`;
    if (!pointsByToken.has(token)) {
      const end = cm.index + cm[0].length;
      const ahead = normalized.slice(end, end + 120);
      const behind = normalized.slice(Math.max(0, cm.index - 50), cm.index);
      let pts = parsePointsFromSegment(ahead);
      if (pts == null) pts = parsePointsFromSegment(behind);
      if (pts != null) pointsByToken.set(token, pts);
    }
    if (mainOrder.length >= 150) break; // safety cap
  }

  // 2) Scan line-by-line to catch "Uppgift 2" and lone "a)" lines
  const lines = base.split(/\r?\n/).map((l) => l.trim());
  const mainLineRe = /^(?:uppgift|problem|fraga|question|q)?\s*([1-9]\d?)\s*(?:[\)\.:]|\b)/i;
  const letterLineRe = /^(?:deluppgift\s*)?\(?([a-zA-Z])\)?\s*[\)\.:]/;
  let currentMain: number | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // main heading
    const mm = line.match(mainLineRe);
    if (mm) {
      const m = parseInt(mm[1], 10);
      if (!Number.isNaN(m)) {
        ensureMain(m);
        currentMain = m;
        // Try to parse points from remainder of line, else next line
        const rem = line.slice(mm[0].length);
        let pts = parsePointsFromSegment(rem);
        if (pts == null && i + 1 < lines.length) {
          pts = parsePointsFromSegment(lines[i + 1]);
        }
        if (pts != null) {
          const token = String(m);
          // Only set if there are no sub-questions recorded for this main
          const subs = subOrder.get(m) || [];
          if ((subs.length === 0) && !pointsByToken.has(token)) pointsByToken.set(token, pts);
        }

        // Also look for group patterns near the main heading
        const nearby = rem + ' ' + (i + 1 < lines.length ? lines[i + 1] : '');
        // Pattern: Deluppgifter a–d: 3p vardera
        const eachRe = /deluppgift(?:er)?[^a-zA-Z]{0,10}([a-zA-Z])\s*[\-–—]\s*([a-zA-Z]).*?(vardera|var)/i;
        const eachM = nearby.match(eachRe);
        if (eachM) {
          const letters = letterRangeExpand(eachM[1], eachM[2]);
          let ptsEach = parsePointsFromSegment(nearby);
          if (ptsEach != null) {
            for (const letter of letters) {
              ensureMain(m);
              const arr = subOrder.get(m)!;
              if (!arr.includes(letter)) arr.push(letter);
              const token = `${m}${letter}`;
              if (!pointsByToken.has(token)) pointsByToken.set(token, ptsEach);
            }
          }
        }

        // Pattern: (3+2+1)p style tied to this main
        const list = parsePointsListFromSegment(nearby);
        if (list && list.length > 0) {
          ensureMain(m);
          let subs = subOrder.get(m)!;
          if (subs.length === 0) {
            // Create subletters a.. as many as the list length
            const newSubs: string[] = [];
            for (let k = 0; k < Math.min(8, list.length); k++) newSubs.push(String.fromCharCode('a'.charCodeAt(0) + k));
            subOrder.set(m, newSubs);
            subs = newSubs;
          }
          const L = Math.min(Math.max(subs.length, list.length), list.length);
          for (let k = 0; k < L; k++) {
            const token = `${m}${subs[k]}`;
            if (!pointsByToken.has(token)) pointsByToken.set(token, list[k]);
          }
        }
        continue;
      }
    }
    // letter-only under current main
    const lm = line.match(letterLineRe);
    if (lm && currentMain != null) {
      const letter = lm[1].toLowerCase();
      ensureMain(currentMain);
      const arr = subOrder.get(currentMain)!;
      if (!arr.includes(letter)) arr.push(letter);
      // Try to parse points from remainder of this line or next line
      const rem = line.slice(lm[0].length);
      let pts = parsePointsFromSegment(rem);
      if (pts == null && i + 1 < lines.length) {
        pts = parsePointsFromSegment(lines[i + 1]);
      }
      if (pts != null) {
        const token = `${currentMain}${letter}`;
        if (!pointsByToken.has(token)) pointsByToken.set(token, pts);
      }

      // Also support "Deluppgifter a–d: 3p vardera" on lines following main
      const nearby = rem + ' ' + (i + 1 < lines.length ? lines[i + 1] : '');
      const eachRe = /deluppgift(?:er)?[^a-zA-Z]{0,10}([a-hA-H])\s*[-–—]\s*([a-hA-H]).*?(vardera|var)/i;
      const eachM = nearby.match(eachRe);
      if (eachM && currentMain != null) {
        const letters = letterRangeExpand(eachM[1], eachM[2]);
        let ptsEach = parsePointsFromSegment(nearby);
        if (ptsEach != null) {
          for (const L of letters) {
            ensureMain(currentMain);
            const sarr = subOrder.get(currentMain)!;
            if (!sarr.includes(L)) sarr.push(L);
            const token = `${currentMain}${L}`;
            if (!pointsByToken.has(token)) pointsByToken.set(token, ptsEach);
          }
        }
      }

      // And "(3+2+1)p" near letter sections: treat as distribution for current main
      const list = parsePointsListFromSegment(nearby);
      if (list && currentMain != null) {
        ensureMain(currentMain);
        const subs = subOrder.get(currentMain)!;
        const L = Math.min(subs.length, list.length);
        for (let k = 0; k < L; k++) {
          const token = `${currentMain}${subs[k]}`;
          if (!pointsByToken.has(token)) pointsByToken.set(token, list[k]);
        }
      }
    }
  }

  // 2b) Scan the flat normalized text for letter-only markers and bind to the last seen main
  const mainGlobalRe = /(?:^|[^A-Za-z0-9])(?:\b(?:uppgift|problem|fraga|question|q)\s*)?([1-9]\d?)(?=\s|[\)\.:])/gi;
  const mainHits: Array<{ n: number; idx: number }> = [];
  let mh: RegExpExecArray | null;
  while ((mh = mainGlobalRe.exec(normalized)) !== null) {
    const n = parseInt(mh[1], 10);
    if (!Number.isNaN(n)) mainHits.push({ n, idx: mh.index });
  }
  const letterAnyRe = /(?:^|[^a-zA-Z0-9])(?:deluppgift\s*)?\(?([a-zA-Z])\)?\s*[\)\.:]/g;
  let lh: RegExpExecArray | null;
  letterAnyRe.lastIndex = 0;
  while ((lh = letterAnyRe.exec(normalized)) !== null) {
    // Find the closest preceding main
    const pos = lh.index;
    let attached: number | null = null;
    for (let i = mainHits.length - 1; i >= 0; i--) {
      if (mainHits[i].idx <= pos) { attached = mainHits[i].n; break; }
    }
    if (attached != null) {
      ensureMain(attached);
      const letter = lh[1].toLowerCase();
      const arr = subOrder.get(attached)!;
      if (!arr.includes(letter)) arr.push(letter);

      // Try to capture points near this token
      const end = lh.index + lh[0].length;
      const ahead = normalized.slice(end, end + 120);
      const behind = normalized.slice(Math.max(0, lh.index - 50), lh.index);
      let pts = parsePointsFromSegment(ahead);
      if (pts == null) pts = parsePointsFromSegment(behind);
      if (pts != null) {
        const token = `${attached}${letter}`;
        if (!pointsByToken.has(token)) pointsByToken.set(token, pts);
      }
    }
  }

  // 3) Also capture standalone main markers like "3." if no subs were seen
  if (mainOrder.length < 150) {
    const mainRe = /(?:\b(?:uppgift|problem|fraga|question|q)\s*)?([1-9]\d?)\s*[\)\.:]/g;
    let mm2: RegExpExecArray | null;
    while ((mm2 = mainRe.exec(normalized)) !== null) {
      const n = parseInt(mm2[1], 10);
      if (!Number.isNaN(n)) ensureMain(n);
    }
  }

  // Build final tokens preserving main and sub order.
  const tokens: string[] = [];
  for (const n of mainOrder) {
    const subs = subOrder.get(n) || [];
    if (subs.length > 0) {
      for (const letter of subs) tokens.push(`${n}${letter}`);
    } else {
      tokens.push(String(n));
    }
    if (tokens.length >= 150) break;
  }

  // Fallback if nothing detected but there is text content
  if (tokens.length === 0) {
    return [];
  }

  return tokens.map((token) => ({
    id: `q-${token}`,
    number: `${token}`,
    theme: [],
    points: pointsByToken.get(token) ?? 0,
    status: 'not-started',
    difficulty: 'medium',
    comments: [],
  }));
}

// Improved question extractor with broader patterns
function extractQuestionsFromText2(text: string): Array<any> {
  const normalized = normalizeDiacritics(text).replace(/\s+/g, ' ').trim();

  const mainOrder: number[] = [];
  const hasMain = new Set<number>();
  const subOrder = new Map<number, string[]>();
  const pointsByToken = new Map<string, number>();

  const uprefix = '(?:\\b(?:uppg(?:ift)?|problem|fraga|question|q)\\s*)?';

  function ensureMain(n: number) {
    if (!hasMain.has(n)) {
      hasMain.add(n);
      mainOrder.push(n);
    }
    if (!subOrder.has(n)) subOrder.set(n, []);
  }

  function parsePts(seg: string): number | null {
    const s = normalizeDiacritics(seg);
    const patterns = [
      /\((\d{1,3})\s*p(?:oang)?\)/i,
      /(\d{1,3})\s*p(?:oang)?\b/i,
      /\b(?:poang|points)\s*:?\s*(\d{1,3})\b/i,
    ];
    for (const re of patterns) {
      const m = s.match(re);
      if (m) {
        const v = parseInt(m[1], 10);
        if (!Number.isNaN(v)) return v;
      }
    }
    return null;
  }

  function parsePtsList(seg: string): number[] | null {
    const s = normalizeDiacritics(seg);
    const m = s.match(/\((\s*\d{1,3}(?:\s*\+\s*\d{1,3})+)\)\s*p?(?:oang)?/i);
    if (!m) return null;
    const list = m[1].split(/\+/).map(s => parseInt(s.trim(), 10)).filter(v => !Number.isNaN(v));
    return list.length >= 2 ? list : null;
  }

  function letterRange(a: string, b: string): string[] {
    const s = a.toLowerCase().charCodeAt(0);
    const e = b.toLowerCase().charCodeAt(0);
    const lo = Math.max('a'.charCodeAt(0), Math.min(s, e));
    const hi = Math.min('z'.charCodeAt(0), Math.max(s, e));
    const out: string[] = [];
    for (let c = lo; c <= hi; c++) out.push(String.fromCharCode(c));
    return out;
  }

  // Combined number+letter like 2a), Uppg 3b:
  const combinedRe = new RegExp(`${uprefix}([1-9]\\d?)\\s*([a-zA-Z])\\s*[\\)\\.:]`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = combinedRe.exec(normalized)) !== null) {
    const main = parseInt(m[1], 10);
    const letter = m[2].toLowerCase();
    if (Number.isNaN(main)) continue;
    ensureMain(main);
    const arr = subOrder.get(main)!;
    if (!arr.includes(letter)) arr.push(letter);
    const token = `${main}${letter}`;
    if (!pointsByToken.has(token)) {
      const end = m.index + m[0].length;
      const ahead = normalized.slice(end, end + 120);
      const behind = normalized.slice(Math.max(0, m.index - 50), m.index);
      let pts = parsePts(ahead);
      if (pts == null) pts = parsePts(behind);
      if (pts != null) pointsByToken.set(token, pts);
    }
    if (mainOrder.length >= 80) break;
  }

  // Line-by-line for main titles and plain letters
  const lines = text.split(/\r?\n/).map(l => l.trim());
  const mainLineRe = /^(?:uppg(?:ift)?|problem|fraga|question|q)?\s*([1-9]\d?)\s*(?:[\)\.:]|\b)/i;
  const letterLineRe = /^(?:deluppgift\s*)?\(?([a-zA-Z])\)?\s*[\)\.:]/;
  let currentMain: number | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const mm = line.match(mainLineRe);
    if (mm) {
      const n = parseInt(mm[1], 10);
      if (!Number.isNaN(n)) {
        ensureMain(n);
        currentMain = n;
        const rem = line.slice(mm[0].length);
        let pts = parsePts(rem);
        if (pts == null && i + 1 < lines.length) pts = parsePts(lines[i + 1]);
        if (pts != null) {
          const subs = subOrder.get(n) || [];
          if (subs.length === 0 && !pointsByToken.has(String(n))) pointsByToken.set(String(n), pts);
        }

        const nearby = rem + ' ' + (i + 1 < lines.length ? lines[i + 1] : '');
        const eachRe = /deluppgift(?:er)?[^a-zA-Z]{0,10}([a-zA-Z])\s*[\-–—]\s*([a-zA-Z]).*?(vardera|var)/i;
        const eachM = nearby.match(eachRe);
        if (eachM) {
          const letters = letterRange(eachM[1], eachM[2]);
          let ptsEach = parsePts(nearby);
          if (ptsEach != null) {
            for (const L of letters) {
              ensureMain(n);
              const arr = subOrder.get(n)!;
              if (!arr.includes(L)) arr.push(L);
              const token = `${n}${L}`;
              if (!pointsByToken.has(token)) pointsByToken.set(token, ptsEach);
            }
          }
        }

        const list = parsePtsList(nearby);
        if (list && list.length > 0) {
          ensureMain(n);
          let subs = subOrder.get(n)!;
          if (subs.length === 0) {
            const newSubs: string[] = [];
            for (let k = 0; k < Math.min(26, list.length); k++) newSubs.push(String.fromCharCode('a'.charCodeAt(0) + k));
            subOrder.set(n, newSubs);
            subs = newSubs;
          }
          const L = Math.min(subs.length, list.length);
          for (let k = 0; k < L; k++) {
            const token = `${n}${subs[k]}`;
            if (!pointsByToken.has(token)) pointsByToken.set(token, list[k]);
          }
        }
        continue;
      }
    }

    const lm = line.match(letterLineRe);
    if (lm && currentMain != null) {
      const L = lm[1].toLowerCase();
      ensureMain(currentMain);
      const arr = subOrder.get(currentMain)!;
      if (!arr.includes(L)) arr.push(L);
      const rem = line.slice(lm[0].length);
      let pts = parsePts(rem);
      if (pts == null && i + 1 < lines.length) pts = parsePts(lines[i + 1]);
      if (pts != null) {
        const token = `${currentMain}${L}`;
        if (!pointsByToken.has(token)) pointsByToken.set(token, pts);
      }
    }
  }

  // Global main and letters binding by proximity
  const mainGlobalRe = new RegExp(`(?:^|[^A-Za-z0-9])${uprefix}([1-9]\\d?)(?=\\s|[\\)\\.:])`, 'gi');
  const mainHits: Array<{ n: number; idx: number }> = [];
  let mh: RegExpExecArray | null;
  while ((mh = mainGlobalRe.exec(normalized)) !== null) {
    const n = parseInt(mh[1], 10);
    if (!Number.isNaN(n)) mainHits.push({ n, idx: mh.index });
  }
  const letterAnyRe = /(?:^|[^a-zA-Z0-9])(?:deluppgift\s*)?\(?([a-zA-Z])\)?\s*[\)\.:]/g;
  let lh: RegExpExecArray | null;
  while ((lh = letterAnyRe.exec(normalized)) !== null) {
    const pos = lh.index;
    let attached: number | null = null;
    for (let i = mainHits.length - 1; i >= 0; i--) {
      if (mainHits[i].idx <= pos) { attached = mainHits[i].n; break; }
    }
    if (attached != null) {
      ensureMain(attached);
      const L = lh[1].toLowerCase();
      const arr = subOrder.get(attached)!;
      if (!arr.includes(L)) arr.push(L);
      const end = lh.index + lh[0].length;
      const ahead = normalized.slice(end, end + 120);
      const behind = normalized.slice(Math.max(0, lh.index - 50), lh.index);
      let pts = parsePts(ahead);
      if (pts == null) pts = parsePts(behind);
      if (pts != null) {
        const token = `${attached}${L}`;
        if (!pointsByToken.has(token)) pointsByToken.set(token, pts);
      }
    }
  }

  // Fill tokens in order
  const tokens: string[] = [];
  for (const n of mainOrder) {
    const subs = subOrder.get(n) || [];
    if (subs.length > 0) {
      for (const L of subs) tokens.push(`${n}${L}`);
    } else {
      tokens.push(String(n));
    }
    if (tokens.length >= 150) break;
  }
  if (tokens.length === 0) return [];
  return tokens.map(token => ({
    id: `q-${token}`,
    number: `${token}`,
    theme: [],
    points: pointsByToken.get(token) ?? 0,
    status: 'not-started',
    difficulty: 'medium',
    comments: [],
  }));
}

// Build lines from pdf.js text items using y/x coordinates to preserve structure
function buildLinesFromItems(items: any[], page: number): Array<{ text: string; page: number }> {
  type Span = { text: string; x: number; y: number; hasEOL?: boolean };
  const spans: Span[] = [];
  for (const it of items as any[]) {
    const s = (it?.str ?? '').toString();
    if (!s) continue;
    const tr = (it as any).transform as number[] | undefined;
    const x = Array.isArray(tr) ? Number(tr[4]) : 0;
    const y = Array.isArray(tr) ? Number(tr[5]) : 0;
    spans.push({ text: s, x, y, hasEOL: !!(it as any).hasEOL });
  }
  // Sort by y descending (pdf origin bottom-left), then x ascending
  spans.sort((a, b) => (b.y - a.y) || (a.x - b.x));
  // Group into lines by close y
  const yTol = 3; // px tolerance for line grouping
  const rawLines: Array<{ y: number; parts: Span[] }> = [];
  for (const sp of spans) {
    let line = rawLines.find(l => Math.abs(l.y - sp.y) <= yTol);
    if (!line) { line = { y: sp.y, parts: [] }; rawLines.push(line); }
    line.parts.push(sp);
  }
  // Compose line strings left-to-right
  const out: Array<{ text: string; page: number }> = [];
  for (const l of rawLines) {
    l.parts.sort((a, b) => a.x - b.x);
    let txt = '';
    let prevX = Number.NEGATIVE_INFINITY;
    const gapX = 3; // px threshold for inserting a space between fragments
    for (const p of l.parts) {
      const gap = p.x - prevX;
      if (txt && gap > gapX) txt += ' ';
      txt += p.text;
      prevX = p.x;
    }
    const clean = txt.replace(/\s+/g, ' ').trim();
    if (clean) out.push({ text: clean, page });
  }
  return out;
}

// Parse questions from structured lines (with page numbers preserved)
function extractQuestionsFromLines(lines: Array<{ text: string; page: number }>): Array<any> {
  const mainOrder: number[] = [];
  const hasMain = new Set<number>();
  const subOrder = new Map<number, string[]>();
  const pointsByToken = new Map<string, number>();
  const pageByToken = new Map<string, number>();

  function ensureMain(n: number) {
    if (!hasMain.has(n)) { hasMain.add(n); mainOrder.push(n); }
    if (!subOrder.has(n)) subOrder.set(n, []);
  }

  function parsePts(seg: string): number | null {
    const s = normalizeDiacritics(seg);
    const patterns = [
      /\((\d{1,3})\s*p(?:oang)?\)/i,
      /(\d{1,3})\s*p(?:oang)?\b/i,
      /\b(?:poang|points)\s*:?\s*(\d{1,3})\b/i,
    ];
    for (const re of patterns) {
      const m = s.match(re);
      if (m) { const v = parseInt(m[1], 10); if (!Number.isNaN(v)) return v; }
    }
    return null;
  }

  function parsePtsList(seg: string): number[] | null {
    const s = normalizeDiacritics(seg);
    const m = s.match(/\((\s*\d{1,3}(?:\s*\+\s*\d{1,3})+)\)\s*p?(?:oang)?/i);
    if (!m) return null;
    const list = m[1].split(/\+/).map(s => parseInt(s.trim(), 10)).filter(v => !Number.isNaN(v));
    return list.length >= 2 ? list : null;
  }

  function letterRange(a: string, b: string): string[] {
    const s = a.toLowerCase().charCodeAt(0);
    const e = b.toLowerCase().charCodeAt(0);
    const lo = Math.max('a'.charCodeAt(0), Math.min(s, e));
    const hi = Math.min('z'.charCodeAt(0), Math.max(s, e));
    const out: string[] = [];
    for (let c = lo; c <= hi; c++) out.push(String.fromCharCode(c));
    return out;
  }

  const mainLineRe = /^(?:uppg(?:ift)?|problem|fraga|question|q)?\s*([1-9]\d?)\s*(?:[\)\.:]|\b)/i;
  const letterLineRe = /^(?:deluppgift\s*)?\(?([a-zA-Z])\)?\s*[\)\.:]/;
  const combinedRe = /(?:\b(?:uppgift|problem|fraga|question|q)\s*)?([1-9]\d?)\s*([a-zA-Z])\s*[\)\.:]/g;

  let currentMain: number | null = null;
  for (let i = 0; i < lines.length; i++) {
    const { text, page } = lines[i];
    const t = normalizeDiacritics(text);

    // Inline combined tokens like "2a)"
    let m: RegExpExecArray | null;
    combinedRe.lastIndex = 0;
    while ((m = combinedRe.exec(t)) !== null) {
      const n = parseInt(m[1], 10); if (Number.isNaN(n)) continue;
      const L = m[2].toLowerCase();
      ensureMain(n);
      const arr = subOrder.get(n)!; if (!arr.includes(L)) arr.push(L);
      const token = `${n}${L}`;
      if (!pageByToken.has(token)) pageByToken.set(token, page);
      if (!pointsByToken.has(token)) {
        const end = m.index + m[0].length;
        const ahead = t.slice(end, end + 120);
        const behind = t.slice(Math.max(0, m.index - 50), m.index);
        let pts = parsePts(ahead); if (pts == null) pts = parsePts(behind);
        if (pts != null) pointsByToken.set(token, pts);
      }
    }

    // Main line markers
    const mm = t.match(mainLineRe);
    if (mm) {
      const n = parseInt(mm[1], 10);
      if (!Number.isNaN(n)) {
        ensureMain(n); currentMain = n;
        if (!pageByToken.has(String(n))) pageByToken.set(String(n), page);
        const rem = t.slice(mm[0].length);
        let pts = parsePts(rem); if (pts == null && i + 1 < lines.length) pts = parsePts(normalizeDiacritics(lines[i + 1].text));
        if (pts != null && !pointsByToken.has(String(n))) pointsByToken.set(String(n), pts);

        // "Deluppgifter a–d: 3p vardera"
      const nearby = rem + ' ' + (i + 1 < lines.length ? normalizeDiacritics(lines[i + 1].text) : '');
      const eachRe = /deluppgift(?:er)?[^a-zA-Z]{0,10}([a-zA-Z])\s*[\-–—]\s*([a-zA-Z]).*?(vardera|var)/i;
        const eachM = nearby.match(eachRe);
        if (eachM) {
          const letters = letterRange(eachM[1], eachM[2]);
          let ptsEach = parsePts(nearby);
          if (ptsEach != null) {
            for (const L of letters) {
              ensureMain(n);
              const arr = subOrder.get(n)!; if (!arr.includes(L)) arr.push(L);
              const token = `${n}${L}`;
              if (!pageByToken.has(token)) pageByToken.set(token, page);
              if (!pointsByToken.has(token)) pointsByToken.set(token, ptsEach);
            }
          }
        }

        // "(3+2+1)p" style distribution
        const list = parsePtsList(nearby);
        if (list && list.length > 0) {
          ensureMain(n);
          let subs = subOrder.get(n)!;
          if (subs.length === 0) {
            const newSubs: string[] = [];
            for (let k = 0; k < Math.min(26, list.length); k++) newSubs.push(String.fromCharCode('a'.charCodeAt(0) + k));
            subOrder.set(n, newSubs); subs = newSubs;
          }
          const L = Math.min(subs.length, list.length);
          for (let k = 0; k < L; k++) {
            const token = `${n}${subs[k]}`;
            if (!pageByToken.has(token)) pageByToken.set(token, page);
            if (!pointsByToken.has(token)) pointsByToken.set(token, list[k]);
          }
        }
        continue; // to next line
      }
    }

    // Letter-only under current main
    const lm = t.match(letterLineRe);
    if (lm && currentMain != null) {
      const L = lm[1].toLowerCase();
      ensureMain(currentMain);
      const arr = subOrder.get(currentMain)!; if (!arr.includes(L)) arr.push(L);
      const rem = t.slice(lm[0].length);
      let pts = parsePts(rem); if (pts == null && i + 1 < lines.length) pts = parsePts(normalizeDiacritics(lines[i + 1].text));
      const token = `${currentMain}${L}`;
      if (!pageByToken.has(token)) pageByToken.set(token, lines[i].page);
      if (pts != null && !pointsByToken.has(token)) pointsByToken.set(token, pts);
    }
  }

  // Emit final tokens preserving order
  const tokens: string[] = [];
  for (const n of mainOrder) {
    const subs = subOrder.get(n) || [];
    if (subs.length > 0) {
      for (const L of subs) tokens.push(`${n}${L}`);
    } else {
      tokens.push(String(n));
    }
    if (tokens.length >= 150) break;
  }

  if (tokens.length === 0) return [];
  return tokens.map((token) => ({
    id: `q-${token}`,
    number: `${token}`,
    theme: [],
    points: pointsByToken.get(token) ?? 0,
    page: pageByToken.get(token),
    status: 'not-started',
    difficulty: 'medium',
    comments: [],
  }));
}

// Filter likely headers/footers that repeat on most pages (top/bottom few lines)
function filterHeaderFooterLines(lines: Array<{ text: string; page: number }>, totalPages: number): Array<{ text: string; page: number }>{
  try {
    const byPage = new Map<number, Array<{ text: string; page: number }>>();
    for (const ln of lines) {
      const arr = byPage.get(ln.page) || [];
      arr.push(ln);
      byPage.set(ln.page, arr);
    }
    // Sort each page by visual order (as already done: y desc then x asc); keep as is.
    const topCount = new Map<string, number>();
    const bottomCount = new Map<string, number>();
    const TOP_K = 3, BOTTOM_K = 3;
    for (const [, arr] of byPage) {
      const top = arr.slice(0, TOP_K);
      const bot = arr.slice(Math.max(0, arr.length - BOTTOM_K));
      for (const t of top) {
        const key = t.text;
        topCount.set(key, (topCount.get(key) || 0) + 1);
      }
      for (const b of bot) {
        const key = b.text;
        bottomCount.set(key, (bottomCount.get(key) || 0) + 1);
      }
    }
    const thr = Math.max(2, Math.floor(0.6 * Math.max(1, totalPages)));
    const topCommon = new Set<string>(Array.from(topCount.entries()).filter(([,c]) => c >= thr).map(([k]) => k));
    const botCommon = new Set<string>(Array.from(bottomCount.entries()).filter(([,c]) => c >= thr).map(([k]) => k));

    const out: Array<{ text: string; page: number }> = [];
    for (const [p, arr] of byPage) {
      const topIdx = new Set<number>([0,1,2].filter(i => i < arr.length));
      const botIdx = new Set<number>([arr.length-1, arr.length-2, arr.length-3].filter(i => i >=0));
      for (let i = 0; i < arr.length; i++) {
        const ln = arr[i];
        const isTop = topIdx.has(i) && topCommon.has(ln.text);
        const isBot = botIdx.has(i) && botCommon.has(ln.text);
        if (isTop || isBot) continue; // skip header/footer
        out.push(ln);
      }
    }
    // Preserve original relative order by page then by appearance
    out.sort((a,b) => (a.page - b.page));
    return out;
  } catch {
    return lines;
  }
}

function detectCourseCodeFromFilename(name: string): string | undefined {
  const upper = name.toUpperCase();
  const patterns = [
    /\b([A-Z]{2})[\s\-_.]?(\d{4})\b/g, // e.g., SF1624, SF-1624, SF 1624
    /\b([A-Z]{3})[\s\-_.]?(\d{3})\b/g, // e.g., ABC123, ABC-123, ABC 123
    /\b([A-Z]{4})[\s\-_.]?(\d{2})\b/g, // e.g., TATA42, TATA-42, TATA 42
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(upper)) !== null) {
      if (m[1] && m[2]) return `${m[1]}${m[2]}`;
    }
  }
  return undefined;
}

function detectCourseCodeFromText(text: string): string | undefined {
  const upper = text.toUpperCase();
  const labelled = [
    /(KURSKOD|COURSE\s*CODE|KURS\s*KOD)[^A-Z0-9]{0,10}([A-Z]{2,4})[ \-\._]?(\d{2,4})/g,
    /(KURSKOD|COURSE\s*CODE|KURS\s*KOD)[^A-Z0-9]{0,10}([A-Z]{2,4}\d{2,4})/g,
  ];
  const generic = [
    /\b([A-Z]{2})[ \-\._]?(\d{4})\b/g,
    /\b([A-Z]{3})[ \-\._]?(\d{3})\b/g,
    /\b([A-Z]{4})[ \-\._]?(\d{2})\b/g,
  ];

  const scores = new Map<string, number>();
  function bump(code: string, by: number) {
    scores.set(code, (scores.get(code) || 0) + by);
  }

  for (const re of labelled) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(upper)) !== null) {
      const code = m[3] ? `${m[2]}${m[3]}` : m[2];
      bump(code, 5);
    }
  }
  for (const re of generic) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(upper)) !== null) {
      const code = `${m[1]}${m[2]}`;
      bump(code, 1);
    }
  }

  let best: string | undefined;
  let bestScore = -1;
  for (const [code, sc] of scores) {
    if (sc > bestScore) { best = code; bestScore = sc; }
  }
  return best;
}

function detectCourseNameFromFilename(name: string, courseCode?: string): string | undefined {
  const base = name.replace(/\.[Pp][Dd][Ff]$/, '');
  // Common patterns: CODE_name, CODE-name, CODE – name
  if (courseCode) {
    const re = new RegExp(`${courseCode}[\n\r\-_\s:–—]+([^_\-]+)`, 'i');
    const m = base.match(re);
    if (m) {
      const cand = m[1].replace(/[_-]+/g, ' ').trim();
      if (cand.length >= 3) return cand;
    }
  }
  // Generic: something after first underscore or dash
  const m2 = base.match(/^[^-_]+[-_\s]+(.{3,80})$/);
  if (m2) return m2[1].replace(/[_-]+/g, ' ').trim();
  return undefined;
}

function detectCourseNameFromText(text: string, courseCode?: string): string | undefined {
  const t = text.replace(/\s+\n/g, '\n');
  // Labelled
  const labelled = /(?:KURSNAMN|COURSE\s*NAME)\s*[:\-]?\s*([A-ZÅÄÖa-zåäö0-9 ,.'&/\-–]{3,120})/i;
  const m1 = t.match(labelled);
  if (m1) return m1[1].trim();

  // "Tentamen i <Name>"
  const m2 = t.match(/TENTAMEN\s+i\s+([A-ZÅÄÖa-zåäö0-9 ,.'&/\-–]{3,120})/i);
  if (m2) return m2[1].trim();

  // CODE - Name
  if (courseCode) {
    const re = new RegExp(`${courseCode}\s*[\-–—:]\s*([A-ZÅÄÖa-zåäö0-9 ,.'&/\-–]{3,120})`);
    const m3 = t.match(re);
    if (m3) return m3[1].trim();
  }

  // Fallback: most prominent capitalized phrase near top
  const top = t.slice(0, 600);
  const m4 = top.match(/([A-ZÅÄÖ][A-ZÅÄÖa-zåäö0-9 ,.'&/\-–]{5,80})/);
  if (m4) return m4[1].trim();
  return undefined;
}

export async function parsePdf(file: File, opts?: { deepOcr?: boolean }): Promise<Partial<Exam>> {
  // Minimal parsing: extract text of first few pages and infer course/date from filename
  const fileName = file.name;
  const yearMatch = fileName.match(/20(\d{2})/);
  const dateMatch = fileName.match(/(\d{4})-(\d{2})-(\d{2})/);

  let courseCode = detectCourseCodeFromFilenameExt(fileName);
  const year = yearMatch ? parseInt(`20${yearMatch[1]}`) : undefined;
  const examDate = dateMatch
    ? new Date(
        parseInt(dateMatch[1]),
        parseInt(dateMatch[2]) - 1,
        parseInt(dateMatch[3])
      )
    : undefined;

  try {
    const debug: any = { steps: [], counts: {}, ocr: {}, detectors: {} };
    const isProd = ((import.meta as any)?.env?.MODE === 'production') || (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production');
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask: any = getDocument({ data: arrayBuffer });
    const pdf: any = await loadingTask.promise;

    // Parse text from all pages to detect every question
    const maxPages = pdf?.numPages || 1;
    let fullText = '';
    const structuredLines: Array<{ text: string; page: number }> = [];

    for (let i = 1; i <= maxPages; i++) {
      const page: any = await pdf.getPage(i);
      const content: any = await page.getTextContent();
      if (!content || !content.items || (content.items as any[])?.length === 0) {
        continue;
      }
      let buf = '';
      for (const it of content.items as any[]) {
        const s = (it?.str ?? '').toString();
        if (!s) continue;
        buf += (buf ? ' ' : '') + s;
        // pdf.js sometimes marks end-of-line
        if ((it as any).hasEOL) buf += '\n';
      }
      const rawPage = (buf || content.items.map((it: any) => it.str).join(' '));
      const pageText = repairCommonMisencoding(rawPage).replace(/[\t ]+/g, ' ');
      fullText += (fullText ? '\n' : '') + pageText;
      // Build layout-aware lines for this page as well
      try {
        const built = buildLinesFromItems(content.items, i);
        structuredLines.push(...built);
      } catch {}
    }
    debug.counts.pages = maxPages;
    debug.counts.linesBuilt = structuredLines.length;

    // Filter out repeating headers/footers
    const structuredLinesFiltered = filterHeaderFooterLines(structuredLines, maxPages);
    debug.counts.linesAfterHeaderFooter = structuredLinesFiltered.length;

    // Try to parse directly from text layer first
    let textForParsing = fullText;
    let questionsDetected = extractQuestionsFromLines(structuredLinesFiltered);
    debug.detectors.lines = { count: (questionsDetected?.length || 0) };
    if (!questionsDetected || questionsDetected.length === 0) {
      questionsDetected = extractQuestionsFromText2(textForParsing);
      debug.detectors.text2 = { count: (questionsDetected?.length || 0) };
    }

    // Final fallback: use layout-aware questionDetector on raw text items if still empty
    if (!questionsDetected || questionsDetected.length === 0) {
      try {
        const detectorPages = [] as any[];
        // Re-read minimal items to pass to detector (first up to 10 pages for speed)
        const maxDetPages = Math.min(pdf.numPages || 1, 10);
        for (let i = 1; i <= maxDetPages; i++) {
          const page: any = await pdf.getPage(i);
          const content: any = await page.getTextContent();
          detectorPages.push({ page: i, items: (content?.items || []) });
        }
        const det = detectQuestionsFromPages(detectorPages as any);
        if (det && det.tokens && det.tokens.length > 0) {
          questionsDetected = det.tokens.map((tk: any) => ({
            id: `q-${tk.token}`,
            number: `${tk.token}`,
            theme: [],
            points: 0,
            page: tk.page,
            confidence: Math.round(Math.max(0, Math.min(1, tk.confidence ?? 0)) * 100),
            status: 'not-started',
            difficulty: 'medium',
            comments: [],
          }));
          debug.detectors.layoutFallback = { count: questionsDetected.length };
        }
      } catch {}
    }

    // If no questions detected, expand OCR across more pages progressively
    if (!questionsDetected || questionsDetected.length === 0) {
      const Tesseract = await loadTesseract();
      if (Tesseract && typeof document !== 'undefined') {
        try {
          const deep = !!(opts?.deepOcr);
          const ocrPages = Math.min(pdf.numPages || 1, deep ? 100 : 20);
          const ocrParts: string[] = [];
          // Prefer worker if available
          let worker: any = null;
          if (typeof (Tesseract as any).createWorker === 'function') {
            worker = await (Tesseract as any).createWorker({ logger: () => {} });
            await worker.load();
            await worker.loadLanguage('swe+eng');
            await worker.initialize('swe+eng');
          }
          debug.ocr = { used: true, worker: !!worker, deep, pagesTried: ocrPages };
          for (let i = 1; i <= ocrPages; i++) {
            const page: any = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: deep ? 1.8 : 1.6 });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) { try { canvas.width = canvas.height = 0; } catch {} continue; }
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            await page.render({ canvasContext: ctx, viewport }).promise;
            let textChunk = '';
            try {
              if (worker) {
                const res = await worker.recognize(canvas);
                textChunk = String(res?.data?.text || '');
              } else {
                const res = await (Tesseract as any).recognize(canvas, 'swe+eng');
                textChunk = String(res?.data?.text || '');
              }
            } catch {}
            // release canvas memory
            try { canvas.width = canvas.height = 0; } catch {}
            if (textChunk) {
              ocrParts.push(textChunk);
              textForParsing = (fullText + '\n' + ocrParts.join('\n')).trim();
              if (!deep) {
                questionsDetected = extractQuestionsFromText2(textForParsing);
                if (questionsDetected.length > 0) break;
              }
            }
          }
          if (worker) { try { await worker.terminate(); } catch {} }
          if (deep) {
            // Efter att alla sidor OCR:ats, gör ett fullständigt försök
            questionsDetected = extractQuestionsFromText2(textForParsing);
          }
          debug.detectors.ocrText2 = { count: (questionsDetected?.length || 0) };
        } catch {}
      }
    }

    // Optionally derive course code from OCR text if missing
    if (!courseCode && textForParsing) {
      const detected = detectCourseCodeFromTextExt(textForParsing);
      if (detected) courseCode = detected;
    }

    // Derive course name from text or filename
    let courseName: string | undefined;
    if (textForParsing || fileName) {
      courseName = detectCourseName(textForParsing || '', fileName, courseCode);
    }
    // Final cleanup: drop obvious headings like "Sektion 1 1 a" and trim punctuation
    if (courseName) {
      const cleaned = normalizeDiacritics(courseName).trim();
      const reHeadingInline = /(sektion|section|uppgift|problem|fraga|question)\s*\d+/i;
      const isBad = reHeadingInline.test(cleaned) || /^\s*\d/.test(cleaned);
      const compact = cleaned.replace(/^[\-–—:,.\s]+|[\-–—:,.\s]+$/g, '').replace(/\s{2,}/g, ' ');
      courseName = isBad ? undefined : compact;
    }
    debug.course = { courseCode, courseNameFromText: !!courseName, fileName };

    let questions = questionsDetected && questionsDetected.length > 0
      ? questionsDetected
      : extractQuestionsFromText2(textForParsing);

    // Dedupe by question number
    if (questions && questions.length > 0) {
      const seen = new Set<string>();
      questions = questions.filter(q => {
        const key = String(q.number || q.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    const totalPoints = (questions || []).reduce((s, q) => s + (Number.isFinite(q?.points) ? Number(q.points) : 0), 0);
    return {
      fileName,
      examDate,
      courseName: "Ok\u00E4nt kursnamn",
      courseCode,
      year,
      totalPoints: Number.isFinite(totalPoints) ? totalPoints : 0,
      questions,
      extractedText: repairCommonMisencoding(textForParsing).replace(/[\t ]+/g, ' ').slice(0, 5000),
      tags: [],
      ...(isProd ? {} : { __debug: debug })
    } as Partial<Exam>;
  } catch (error) {
    // Fallback: do not invent questions; return minimal info and error text
    return {
      fileName,
      examDate,
      courseCode,
      year,
      questions: [],
      extractedText: `Failed to extract text: ${String(error)}`,
    } as Partial<Exam>;
  }
}

export default parsePdf;
// --- Enhanced course name detectors (v2) ---
function detectCourseNameFromFilename2(name: string, courseCode?: string): string | undefined {
  const base = name.replace(/\.[Pp][Dd][Ff]$/, '');
  if (courseCode) {
    const cc = escapeRegExp(courseCode);
    const re = new RegExp(`${cc}[\\n\\r\-_\\s:–—]+([^_\-]{3,120})`, 'i');
    const m = base.match(re);
    if (m) {
      const cand = m[1].replace(/[_-]+/g, ' ').trim();
      if (cand.length >= 3) return cand;
    }
  }
  const m2 = base.match(/^[^-_]+[-_\s]+(.{3,120})$/);
  if (m2) return m2[1].replace(/[_-]+/g, ' ').trim();
  return undefined;
}

function detectCourseNameFromText2(text: string, courseCode?: string): string | undefined {
  const t = text.replace(/[\t ]+/g, ' ').replace(/\s+\n/g, '\n');
  const labelled = /(?:KURSNAMN|COURSE\s*NAME)\s*[:\-:]?\s*([A-ZÅÄÖA-Za-zåäö0-9 ,.'&\/\-–]{3,120})/i;
  const m1 = t.match(labelled);
  if (m1) return m1[1].trim();
  const m2 = t.match(/(?:TENTAMEN|EXAMINATION)\s+i\s+([A-ZÅÄÖA-Za-zåäö0-9 ,.'&\/\-–]{3,120})/i);
  if (m2) return m2[1].trim();
  if (courseCode) {
    const cc = escapeRegExp(courseCode);
    const re = new RegExp(`${cc}\\s*[\-–—:]\\s*([A-ZÅÄÖA-Za-zåäö0-9 ,.'&\/\-–]{3,120})`);
    const m3 = t.match(re);
    if (m3) return m3[1].trim();
  }
  const top = t.slice(0, 600);
  const m4 = top.match(/([A-ZÅÄÖ][A-ZÅÄÖA-Za-zåäö0-9 ,.'&\/\-–]{5,80})/);
  if (m4) return m4[1].trim();
  return undefined;
}
// Configure pdf.js worker (best-effort for bundlers like Vite)
try {
  if ((GlobalWorkerOptions as any) && !(GlobalWorkerOptions as any).workerSrc) {
    // Prefer ESM worker when available
    (GlobalWorkerOptions as any).workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  }
} catch {}




