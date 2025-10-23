export type PdfjsTextItem = {
  str: string;
  transform?: number[];
  hasEOL?: boolean;
};

export interface PageInput {
  page: number;
  items: PdfjsTextItem[];
  width?: number;
  height?: number;
}

export interface DetectorConfig {
  yTolerancePx: number;
  gapXThresholdPx: number;
  leftMarginPercentile: number; // 0-100
  headerFooterPercent: number; // 0-20
  scoreThreshold: number; // accept if >=
  contextWindow: number; // chars after number
  debug?: boolean;
}

export interface Line {
  page: number;
  text: string;
  x: number;
  y: number;
}

export type TokenKind = 'main' | 'sub';

export interface TokenMeta {
  token: string; // e.g., "1", "1a"
  kind: TokenKind;
  parent?: string; // main number for sub
  page: number;
  x: number;
  y: number;
  confidence: number; // 0..1
  positions?: Array<{ page: number; x: number; y: number }>; // duplicates
}

export interface DetectResult {
  tokens: TokenMeta[];
  debug?: any;
}

const DEFAULT_CONFIG: DetectorConfig = {
  yTolerancePx: 3,
  gapXThresholdPx: 4,
  leftMarginPercentile: 25,
  headerFooterPercent: 7,
  scoreThreshold: 2,
  contextWindow: 120,
  debug: false,
};

function normalizeDiacritics(input: string): string {
  try {
    return input.normalize('NFD').replace(/\p{M}+/gu, '');
  } catch {
    return input;
  }
}

function normalizeDashes(input: string): string {
  return input.replace(/[\u2012\u2013\u2014\u2212]/g, '-');
}

function normalizeTextKeepLines(input: string): string {
  const s = normalizeDashes(normalizeDiacritics(input));
  return s.replace(/[\t ]+/g, ' ').replace(/\s+\n/g, '\n');
}

export function buildLinesFromItems(items: PdfjsTextItem[], page: number, cfg?: Partial<DetectorConfig>): Line[] {
  const yTol = (cfg?.yTolerancePx ?? DEFAULT_CONFIG.yTolerancePx);
  type Span = { text: string; x: number; y: number };
  const spans: Span[] = [];
  for (const it of items) {
    const s = (it?.str ?? '').toString();
    if (!s) continue;
    const tr = it.transform as number[] | undefined;
    const x = Array.isArray(tr) ? Number(tr[4]) : 0;
    const y = Array.isArray(tr) ? Number(tr[5]) : 0;
    spans.push({ text: s, x, y });
  }
  spans.sort((a, b) => (b.y - a.y) || (a.x - b.x));
  const raw: Array<{ y: number; parts: Span[] }> = [];
  for (const sp of spans) {
    let line = raw.find(l => Math.abs(l.y - sp.y) <= yTol);
    if (!line) { line = { y: sp.y, parts: [] }; raw.push(line); }
    line.parts.push(sp);
  }
  const lines: Line[] = [];
  const gapX = (cfg?.gapXThresholdPx ?? DEFAULT_CONFIG.gapXThresholdPx);
  for (const l of raw) {
    l.parts.sort((a, b) => a.x - b.x);
    let txt = '';
    let prevX = Number.NEGATIVE_INFINITY;
    for (const p of l.parts) {
      const gap = p.x - prevX;
      if (txt && gap > gapX) txt += ' ';
      txt += p.text;
      prevX = p.x;
    }
    const clean = txt.replace(/\s+/g, ' ').trim();
    if (clean) lines.push({ text: clean, page, x: l.parts[0]?.x ?? 0, y: l.y });
  }
  return lines;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const arr = [...values].sort((a, b) => a - b);
  const idx = Math.min(arr.length - 1, Math.max(0, Math.floor((p / 100) * arr.length)));
  return arr[idx];
}

function isHeaderFooter(y: number, pageMinY: number, pageMaxY: number, percent: number): 'header' | 'footer' | null {
  const span = Math.max(1, pageMaxY - pageMinY);
  const headerY = pageMaxY - (percent / 100) * span;
  const footerY = pageMinY + (percent / 100) * span;
  if (y >= headerY) return 'header';
  if (y <= footerY) return 'footer';
  return null;
}

// Heading words: no bare 'q' to avoid false positives, allow 'question' or 'q' with word boundary
const headingWord = '(?:uppgift|problem|fr(?:a|å)ga|question|q\\b|section|sektion)';
// Precompiled head regex (unicode + case-insensitive)
const headRe = new RegExp(`^\\s*${headingWord}`, 'iu');
// Ensure number is not immediately followed by point markers (p/poang/points)
const reMainHead = new RegExp(`^\\s*(?:${headingWord}\\s*)?([1-9]\\d?)(?!\\s*p(?:oang|oints)?\\b)\\s*([\\.:\\)])?`, 'iu');
// Inline combined number+letter, e.g., 2a) or 2a. or 2a:
const reInlineCombined = /^\s*([1-9]\d?)(?!\s*p(?:oang|points)?\b)\s*([a-zA-Z])\s*[\)\.:]/u; // e.g., 2a)
const reSubOnly = /^\s*\(?([a-zA-Z])\)?\s*[\)\.:]/u;
const reSubRange = /deluppgift(?:er)?[^a-zA-Z]{0,10}([a-zA-Z])\s*[\-\u2013\u2014]\s*([a-zA-Z])/iu;

// Context keywords commonly following a question heading
const reContext = /(poa?ng|points|task|scenario|svara|beskriv|motivera|f(?:ör|or)klara|definiera|bevisa|visa|ber[aä]kna)/iu;

// Date/time and non-question numeric patterns
const reDateTime = /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4}|\d{1,2}:\d{2}|(?:[01]\d|2[0-3])\d{2})\b/u;
const reNumericRange = /\b\d+\s*[\-\u2013\u2014]\s*\d+\b/u;
const rePageIndicator = /\b(?:sida|page)\b(?:\s*\d+(?:\s*(?:av|of)\s*\d+)?)?/iu;
const reScoreSummary = /\b(?:max\s*poa?ng|betyg\s*\d|betyg\b|total(?:\s*poa?ng|\s*points)?|points?)\b/iu;
// Number followed immediately by point marker variants (p, p), p., poang, points), allowing NBSP
const reNumFollowedByPoints = new RegExp(`^\\s*(?:${headingWord}\\s*)?([1-9]\\d?)\\s?(?:\u00A0)?(?:p(?:[\)\.]|\\b)|poa?ng\\b|points\\b)`, 'iu');
const reMultiNumbersRow = /(?:\b\d+(?:[\.,]\d+)?\b[\s,;:]{1,3}){3,}\d+/u; // 4+ numbers
// Section heading to allow sequence reset
const reSectionHeading = /^\s*(?:sektion|section)\s+\d+[a-z]?\b/iu;

function letterRange(a: string, b: string): string[] {
  const s = a.toLowerCase().charCodeAt(0);
  const e = b.toLowerCase().charCodeAt(0);
  const lo = Math.max('a'.charCodeAt(0), Math.min(s, e));
  const hi = Math.min('z'.charCodeAt(0), Math.max(s, e));
  const out: string[] = [];
  for (let c = lo; c <= hi; c++) out.push(String.fromCharCode(c));
  return out;
}

export function detectQuestionsFromPages(pages: PageInput[], cfg?: Partial<DetectorConfig>): DetectResult {
  const conf: DetectorConfig = { ...DEFAULT_CONFIG, ...(cfg || {}) };
  const debug = conf.debug ? { pages: [], candidates: [] as any[] } : undefined;
  const allTokens: TokenMeta[] = [];
  const tokenIndex = new Map<string, number>();
  let lastMain = 0;
  let lastMainPage = 0;
  let anyMainAccepted = false;
  let lastSectionPage = -1;

  // First pass: build lines for all pages and compute a global left-margin threshold
  const linesByPage: Map<number, Line[]> = new Map();
  const allXs: number[] = [];
  for (const pi of pages) {
    const lines = buildLinesFromItems(pi.items || [], pi.page, conf);
    linesByPage.set(pi.page, lines);
    for (const l of lines) allXs.push(l.x);
  }
  const xThresholdGlobal = percentile(allXs, conf.leftMarginPercentile);

  for (const pageInput of pages) {
    const { page, items, height } = pageInput;
    const lines = linesByPage.get(page) || [];
    if (!items || items.length === 0 || lines.length === 0) { if (debug) debug.pages.push({ page, lines: 0 }); continue; }
    const xThreshold = xThresholdGlobal;
    const minY = 0;
    const maxY = typeof height === 'number' && isFinite(height) ? height : Math.max(...lines.map(l => l.y));
    let i = 0;
    while (i < lines.length) {
      const ln = lines[i];
      const lnTextRaw = ln.text;
      const t = normalizeTextKeepLines(lnTextRaw);
      const headerFoot = isHeaderFooter(ln.y, minY, maxY, conf.headerFooterPercent);
      const nextText = (i + 1 < lines.length) ? normalizeTextKeepLines(lines[i + 1].text) : '';
      const nearby = (t + ' ' + nextText).slice(0, conf.contextWindow + 40);

      const reasons: string[] = [];
      let score = 0;
      let mainNum: number | null = null;
      let subLetter: string | null = null;
      let excluded = false;

      let m = t.match(reMainHead);
      if (m) {
        mainNum = parseInt(m[1], 10);
        if (headRe.test(t)) { score += 3; reasons.push('headingWord'); }
        if (m[2]) { score += 2; reasons.push('punct'); }
        // Reject if immediately followed by points marker like 20p / 20 p
        const fp = t.match(reNumFollowedByPoints);
        if (fp && parseInt(fp[1], 10) === mainNum) { excluded = true; reasons.push('followedByPoints'); }
      }

// --- Course name detection ---
// (Course name detection moved to src/utils/courseNameDetector.ts)

      // Inline combined: 2a)
      if (!m) {
        const mi = t.match(reInlineCombined);
        if (mi) {
          mainNum = parseInt(mi[1], 10);
          subLetter = mi[2].toLowerCase();
          reasons.push('inlineCombined');
          // Guard against inline like "20 p)" though unlikely; reuse points-following rule
          const fp = t.match(reNumFollowedByPoints);
          if (fp && parseInt(fp[1], 10) === mainNum) { excluded = true; reasons.push('followedByPoints'); }
          score += 2;
        }
      }

      // Sub-only row like a)
      let isSubOnly = false;
      if (!m && !subLetter) {
        const ms = t.match(reSubOnly);
        if (ms) { subLetter = ms[1].toLowerCase(); isSubOnly = true; reasons.push('subOnly'); }
      }

      // Additional signals
      if (mainNum != null && ln.x <= xThreshold) { score += 2; reasons.push('leftMargin'); }
      if (mainNum != null && reContext.test(nearby)) { score += 1; reasons.push('contextWord'); }

      // Section heading: soft reset sequence and ignore line
      if (reSectionHeading.test(t) && ln.x <= xThreshold) {
        lastMain = 0; lastSectionPage = page; // soft reset
        excluded = true; reasons.push('sectionHeading');
      }

      // Exclusions (additional signals)
      if (reDateTime.test(t) || reNumericRange.test(t)) { score -= 3; reasons.push('date/time'); }
      if (reMultiNumbersRow.test(t)) { score -= 2; reasons.push('multiNumbers'); }
      if (rePageIndicator.test(t)) { excluded = true; reasons.push('pageIndicator'); }
      if (reScoreSummary.test(t)) { excluded = true; reasons.push('scoreSummary'); }
      if (headerFoot) { score -= 2; reasons.push(headerFoot); }

      // Accept main candidate
      // Sequence heuristics
      if (mainNum != null) {
        if (lastMain > 0) {
          if (mainNum === lastMain + 1) { score += 2; reasons.push('seq+1'); }
          else if (mainNum === lastMain) { score += 1; reasons.push('seqSame'); }
          else if (mainNum === lastMain + 2) { /* 0 change */ reasons.push('seq+2'); }
          else if (mainNum < lastMain - 1 && page > lastMainPage + 1 && !(lastSectionPage >= lastMainPage)) {
            score -= 2; reasons.push('seqPenaltyBack');
          }
        } else {
          // No main yet accepted
          if (mainNum > 5 && page <= 2) { score -= 3; reasons.push('earlyLarge'); }
          if (mainNum >= 15) { score -= 2; reasons.push('veryLargeFirst'); }
        }
      }

      const MAX_SCORE = 10;
      const thr = conf.scoreThreshold;
      const confFromScore = (s: number) => Math.max(0, Math.min(1, (s - thr) / Math.max(1, (MAX_SCORE - thr))))
      let acceptedMain = false;
      if (!excluded && mainNum != null && score >= conf.scoreThreshold) {
        const token = String(mainNum);
        const conf01 = confFromScore(score);
        if (!tokenIndex.has(token)) {
          tokenIndex.set(token, allTokens.length);
          allTokens.push({ token, kind: 'main', page, x: ln.x, y: ln.y, confidence: conf01 });
        } else if (conf.debug) {
          const idx = tokenIndex.get(token)!; const pos = { page, x: ln.x, y: ln.y };
          allTokens[idx].positions = [...(allTokens[idx].positions || []), pos];
        }
        acceptedMain = true; lastMain = Math.max(lastMain, mainNum); lastMainPage = page; anyMainAccepted = true;
        if (debug) debug.candidates.push({ page, text: t.slice(0, 140), kind: 'main', n: mainNum, score, reasons });
      } else if (debug && (mainNum != null || reInlineCombined.test(t) || reSubOnly.test(t))) {
        debug.candidates.push({ page, text: t.slice(0, 140), kind: 'excluded', score, reasons });
      }

      // Sub handling
      // Inline combined ensures both main and sub are added
      if (subLetter && (acceptedMain || (!isSubOnly && anyMainAccepted) || lastMain > 0)) {
        const parent = acceptedMain ? String(mainNum) : String(lastMain || (mainNum ?? ''));
        if (parent) {
          const token = `${parent}${subLetter}`;
          const conf01 = confFromScore(score);
          if (!tokenIndex.has(token)) {
            tokenIndex.set(token, allTokens.length);
            allTokens.push({ token, kind: 'sub', parent, page, x: ln.x, y: ln.y, confidence: conf01 });
          } else if (conf.debug) {
            const idx = tokenIndex.get(token)!; const pos = { page, x: ln.x, y: ln.y };
            allTokens[idx].positions = [...(allTokens[idx].positions || []), pos];
          }
          if (debug) debug.candidates.push({ page, text: t.slice(0, 140), kind: 'sub', parent, score, reasons });
        }
      }

      // Expand subrange near accepted mains
      if (acceptedMain) {
        const near = (t + ' ' + nextText).slice(0, conf.contextWindow + 40);
        const mr = near.match(reSubRange);
        if (mr) {
          const letters = letterRange(mr[1], mr[2]);
          for (const L of letters) {
            const token = `${String(mainNum)}${L}`;
            if (!tokenIndex.has(token)) {
              tokenIndex.set(token, allTokens.length);
              allTokens.push({ token, kind: 'sub', parent: String(mainNum), page, x: ln.x, y: ln.y, confidence: confFromScore(score) });
            }
          }
        }
      }

      i += 1;
    }
    if (debug) debug.pages.push({ page, lines: lines.length, xThreshold, minY, maxY });
  }

  // Ensure document order: page asc, y desc (top->bottom), x asc
  const ordered = [...allTokens].sort((a, b) => (a.page - b.page) || (b.y - a.y) || (a.x - b.x));
  return { tokens: ordered, debug };
}




