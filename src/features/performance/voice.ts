/**
 * Parses a spoken transcript of the form "<student number> <note…>".
 *
 * Speech recognition usually transcribes Turkish numbers as digits ("12"),
 * but can also emit words ("on iki"), so both forms are handled. The number
 * tokens are consumed greedily from the start; everything after them is the
 * note text.
 */

const UNITS: Record<string, number> = {
  bir: 1,
  iki: 2,
  üç: 3,
  dört: 4,
  beş: 5,
  altı: 6,
  yedi: 7,
  sekiz: 8,
  dokuz: 9,
};

const TENS: Record<string, number> = {
  on: 10,
  yirmi: 20,
  otuz: 30,
  kırk: 40,
  elli: 50,
  altmış: 60,
  yetmiş: 70,
  seksen: 80,
  doksan: 90,
};

export interface ParsedVoiceNote {
  studentNumber: number;
  note: string;
}

export function parseVoiceNote(transcript: string): ParsedVoiceNote | null {
  const tokens = transcript.trim().split(/\s+/);
  if (tokens.length === 0) return null;

  let index = 0;
  let total = 0;
  let current = 0;

  const digitMatch = tokens[0].match(/^(\d{1,4})[.,]?$/);
  if (digitMatch) {
    total = Number(digitMatch[1]);
    index = 1;
  } else {
    while (index < tokens.length) {
      const word = tokens[index].toLocaleLowerCase("tr-TR");
      if (word in UNITS) {
        current += UNITS[word];
      } else if (word in TENS) {
        current += TENS[word];
      } else if (word === "yüz") {
        current = (current || 1) * 100;
      } else if (word === "bin") {
        total += (current || 1) * 1000;
        current = 0;
      } else {
        break;
      }
      index += 1;
    }
    total += current;
    if (index === 0) return null; // transcript does not start with a number
  }

  const note = tokens.slice(index).join(" ").trim();
  if (total < 1 || total > 9999 || !note) return null;

  return { studentNumber: total, note };
}
