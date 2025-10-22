// Course name detector: robust extraction from Swedish/English exam PDFs

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

// Exported API
export function detectCourseName(text: string, fileName?: string, courseCode?: string): string | undefined {
  // Normalize and keep line structure for top-block logic
  const norm = normalizeTextKeepLines(text || '');
  const lines = norm.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const TOP_LINE_LIMIT = 120; // up to ~120 lines
  const TOP_CHAR_LIMIT = 1500; // or up to 1500 chars
  const top: string[] = [];
  let chars = 0;
  for (let i = 0; i < lines.length && i < TOP_LINE_LIMIT; i++) {
    const ln = lines[i];
    if (chars + ln.length > TOP_CHAR_LIMIT && top.length > 0) break;
    top.push(ln);
    chars += ln.length + 1;
  }

  // Exclusions & helpers
  const reMeta = /(sektion|section|uppgift|problem|fr[åa]ga|question|max\s*poa?ng|word\s*limit|sida|examinator|jour|hj[äa]lpmedel|link[öo]pings|institutionen|wiseflow|datum|date)/i;
  const reStartsDigit = /^\s*\d/;
  const reDate = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4}\b/;
  const reTime = /\b\d{1,2}[:\.]\d{2}\b/;
  const reRange = /\b\d+\s*[-–—]\s*\d+\b/;
  const reMultiNums = /(?:\b\d+(?:[\.,]\d+)?\b[\s,;:]{1,3}){3,}\d+/;
  const headingWord = /(uppgift|problem|fr[åa]ga|question|section|sektion|q)\s*\d+/i;

  const candidates: Array<{ name: string; score: number; why: string[] }>= [];

  function addCandidate(name: string, delta: number, why: string) {
    const n = name.trim().replace(/[\s\u00A0]+/g, ' ');
    if (n.length < 3 || n.length > 120) return;
    // quick reject if numeric heavy
    const letters = (n.match(/[A-Za-zÅÄÖåäö]/g) || []).length;
    const digits = (n.match(/\d/g) || []).length;
    if (letters === 0 || digits > letters) return;
    // active exclusions
    if (reMeta.test(n) || reStartsDigit.test(n) || reDate.test(n) || reTime.test(n) || reRange.test(n) || reMultiNums.test(n) || headingWord.test(n)) {
      candidates.push({ name: n, score: -3, why: ['excluded:' + why] });
      return;
    }
    candidates.push({ name: n, score: delta, why: [why] });
  }

  const topJoined = top.join('\n');

  // 1) Labelled field (strong)
  const labelled = /(KURSNAMN|COURSE\s*NAME|KURS\s*NAMN)[^A-Za-z0-9]{0,10}([A-ZÅÄÖA-Za-zåäö0-9 ,.'&\/\-–]{3,120})/i;
  const lm = topJoined.match(labelled);
  if (lm) addCandidate(lm[2], 3, 'labelled');

  // 2) "Tentamen i <Name>" (very strong) + English
  const tent = /(?:TENTAMEN|EXAMINATION)\s+i\s+([A-ZÅÄÖA-Za-zåäö0-9 ,.'&\/\-–]{3,120})/i;
  const tm = topJoined.match(tent);
  if (tm) addCandidate(tm[1], 3, 'tentamen i');

  // 3) courseCode + separator + name
  if (courseCode) {
    const cc = courseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`${cc}\\s*[\-–—:]\\s*([A-ZÅÄÖA-Za-zåäö0-9 ,.'&\/\-–]{3,120})`);
    const m = topJoined.match(re);
    if (m) addCandidate(m[1], 2, 'code+sep');
  }

  // 4) filename pattern (if courseCode & filename)
  if (fileName && courseCode) {
    const base = fileName.replace(/\.[Pp][Dd][Ff]$/, '');
    const cc = courseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = base.match(new RegExp(`${cc}[\s\-–—:_]+(.{3,120})`));
    if (m) addCandidate(m[1], 2, 'filename');
  }

  // 5) Line below the course code line in top block
  if (courseCode) {
    const cc = new RegExp(courseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    for (let i = 0; i < Math.min(top.length, 40); i++) {
      if (cc.test(top[i])) {
        // pick next non-empty line not excluded
        for (let j = i + 1; j < Math.min(top.length, i + 5); j++) {
          const s = top[j];
          if (!s) continue;
          addCandidate(s, 2, 'belowCode');
          break;
        }
        break;
      }
    }
  }

  // 6) Heuristic from top block (metadata filter)
  function looksTitleLike(s: string): boolean {
    if (s.length < 6) return false;
    const firstAlpha = (s.match(/[A-Za-zÅÄÖåäö]/) || [''])[0];
    if (!firstAlpha) return false;
    const firstUpper = firstAlpha === firstAlpha.toUpperCase();
    const manyCaps = (s.match(/[A-ZÅÄÖ]/g) || []).length >= 2;
    return firstUpper || manyCaps;
  }

  for (let i = 0; i < Math.min(top.length, 60); i++) {
    const s = top[i];
    if (!s) continue;
    const bonus = i < 20 ? 1 : 0;
    if (looksTitleLike(s)) addCandidate(s, 1 + bonus, bonus ? 'topTitle+nearTop' : 'topTitle');
  }

  // Choose best candidate by score; tie-break by letters count
  if (candidates.length === 0) return undefined;
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const la = (a.name.match(/[A-Za-zÅÄÖåäö]/g) || []).length;
    const lb = (b.name.match(/[A-Za-zÅÄÖåäö]/g) || []).length;
    return lb - la;
  });

  // Filter out excluded ones with negative scores if any positive exist
  const bestPositive = candidates.find(c => c.score > 0);
  if (bestPositive) return bestPositive.name.trim();
  return candidates[0].score > 0 ? candidates[0].name.trim() : undefined;
}

