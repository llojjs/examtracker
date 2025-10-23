// Course code detectors split out from parsePdf

// Detect course code from a filename, handling variants like ABC123, AB-1234, ABC_123, etc.
export function detectCourseCodeFromFilename(name: string): string | undefined {
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

// Detect course code from extracted text; prioritizes labelled forms then generic patterns.
export function detectCourseCodeFromText(text: string): string | undefined {
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

