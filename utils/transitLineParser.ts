import { SUBWAY_LINE_COLORS, NEIGHBORHOOD_TRAINS } from '../constants/transitData';

export interface ParsedTransitLine {
  line: string;
  color: string;
  textColor: string;
}

export interface ParsedTransitStop {
  name: string;
  type: 'subway' | 'bus' | 'train' | 'tram' | 'ferry' | 'other';
  distanceMiles: number;
  lines: ParsedTransitLine[];
}

export interface TransitStopInput {
  name: string;
  type: string;
  distanceMiles?: number;
  distanceMi?: number;
  walkMinutes?: number;
  lines?: string[];
}

function lineToParsed(lineStr: string): ParsedTransitLine | null {
  const upper = lineStr.toUpperCase().trim();
  if (!upper) return null;
  const color = SUBWAY_LINE_COLORS[upper] || SUBWAY_LINE_COLORS[lineStr] || null;
  if (!color) return null;
  return {
    line: upper,
    color,
    textColor: getContrastText(color),
  };
}

export function parseTransitLines(stopName: string, explicitLines?: string[]): ParsedTransitLine[] {
  const result: ParsedTransitLine[] = [];
  const seen = new Set<string>();

  if (explicitLines && explicitLines.length > 0) {
    for (const l of explicitLines) {
      const parsed = lineToParsed(l);
      if (parsed && !seen.has(parsed.line)) {
        seen.add(parsed.line);
        result.push(parsed);
      }
    }
    if (result.length > 0) return result;
  }

  const name = stopName || '';

  const parenMatch = name.match(/\(([^)]+)\)/);
  if (parenMatch) {
    const inner = parenMatch[1];
    const parts = inner.split(/[\/,\s]+/).map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      const parsed = lineToParsed(part);
      if (parsed && !seen.has(parsed.line)) {
        seen.add(parsed.line);
        result.push(parsed);
      }
    }
  }

  const upper = name.toUpperCase();

  if (upper.includes('PATH') && !seen.has('PATH')) {
    seen.add('PATH');
    result.push({
      line: 'PATH',
      color: SUBWAY_LINE_COLORS['PATH'] || '#004D6F',
      textColor: '#fff',
    });
  }

  if (upper.includes('LIRR') && !seen.has('LIRR')) {
    seen.add('LIRR');
    result.push({
      line: 'LIRR',
      color: SUBWAY_LINE_COLORS['LIRR'] || '#0D5EA7',
      textColor: '#fff',
    });
  }

  if ((upper.includes('METRO-NORTH') || upper.includes('METRO NORTH')) && !seen.has('MNR')) {
    seen.add('MNR');
    result.push({
      line: 'MNR',
      color: SUBWAY_LINE_COLORS['Metro-North'] || '#007E5B',
      textColor: '#fff',
    });
  }

  return result;
}

export function cleanStopName(stopName: string): string {
  return (stopName || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function normalizeTransitType(type?: string): 'subway' | 'bus' | 'train' | 'tram' | 'ferry' | 'other' {
  if (!type) return 'other';
  const lower = type.toLowerCase();
  if (lower === 'subway') return 'subway';
  if (lower === 'bus' || lower === 'bus stop') return 'bus';
  if (lower === 'train' || lower === 'train station') return 'train';
  if (lower === 'tram') return 'tram';
  if (lower === 'ferry') return 'ferry';
  return 'other';
}

export function parseTransitStop(stop: TransitStopInput): ParsedTransitStop {
  const normalizedType = normalizeTransitType(stop.type);
  return {
    name: cleanStopName(stop.name),
    type: normalizedType,
    distanceMiles: stop.distanceMiles ?? stop.distanceMi ?? 0,
    lines: parseTransitLines(stop.name, stop.lines),
  };
}

export function getAllLinesFromStops(
  stops: TransitStopInput[]
): ParsedTransitLine[] {
  const seen = new Set<string>();
  const allLines: ParsedTransitLine[] = [];

  for (const stop of stops) {
    const parsed = parseTransitLines(stop.name, stop.lines);
    for (const line of parsed) {
      if (!seen.has(line.line)) {
        seen.add(line.line);
        allLines.push(line);
      }
    }
  }

  return allLines.sort((a, b) => {
    const aNum = /^\d$/.test(a.line);
    const bNum = /^\d$/.test(b.line);
    const aSpecial = a.line.length > 1;
    const bSpecial = b.line.length > 1;

    if (aNum && !bNum) return -1;
    if (!aNum && bNum) return 1;
    if (aSpecial && !bSpecial) return 1;
    if (!aSpecial && bSpecial) return -1;
    return a.line.localeCompare(b.line);
  });
}

export function getTransitLinesForListing(
  transitInfo?: {
    stops?: TransitStopInput[];
    noTransitNearby?: boolean;
    manualOverride?: string;
    fetchedAt?: string;
  },
  neighborhood?: string
): ParsedTransitLine[] {
  if (transitInfo?.stops && transitInfo.stops.length > 0) {
    const fromStops = getAllLinesFromStops(transitInfo.stops);
    if (fromStops.length > 0) return fromStops;
  }

  if (neighborhood && NEIGHBORHOOD_TRAINS[neighborhood]) {
    const trains = NEIGHBORHOOD_TRAINS[neighborhood];
    return trains.map(line => ({
      line,
      color: SUBWAY_LINE_COLORS[line] || '#666',
      textColor: getContrastText(SUBWAY_LINE_COLORS[line] || '#666'),
    }));
  }

  return [];
}

function getContrastText(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000' : '#fff';
}
