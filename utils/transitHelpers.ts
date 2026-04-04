const ALL_LINES = [
  'A','C','E','B','D','F','M','G','J','Z','L',
  'N','Q','R','W','S','1','2','3','4','5','6','7'
];

export function extractLinesFromStopName(name: string): string[] {
  const found: string[] = [];

  const parenMatch = name.match(/\(([^)]+)\)/);
  if (parenMatch) {
    const tokens = parenMatch[1].split(/[\/,\s]+/);
    for (const token of tokens) {
      const upper = token.trim().toUpperCase();
      if (ALL_LINES.includes(upper) && !found.includes(upper)) {
        found.push(upper);
      }
    }
    if (found.length > 0) return found;
  }

  const lineMatch = name.match(/\b([A-Z0-9])\s*line\b/i);
  if (lineMatch && ALL_LINES.includes(lineMatch[1].toUpperCase())) {
    found.push(lineMatch[1].toUpperCase());
  }

  const tokens = name.split(/[\s\-\/,·]+/);
  for (const token of tokens) {
    const upper = token.toUpperCase().trim();
    if (token.length === 1 && ALL_LINES.includes(upper) && !found.includes(upper)) {
      found.push(upper);
    }
  }

  return found;
}

export function getLinesForStop(stop: { name: string; lines?: string[] }): string[] {
  if (stop.lines && stop.lines.length > 0) {
    return stop.lines;
  }
  return extractLinesFromStopName(stop.name);
}
