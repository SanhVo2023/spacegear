// Splits a title into words and user-perceived characters for the split-title reveal.

export type SplitWord = { text: string; chars: string[] };

const graphemes = typeof Intl !== "undefined" && "Segmenter" in Intl
  ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
  : null;

function chars(word: string): string[] {
  return graphemes ? Array.from(graphemes.segment(word), (part) => part.segment) : Array.from(word);
}

/** Words split on whitespace, each with its characters (accents stay with their letters). */
export function splitWords(text: string): SplitWord[] {
  return text.trim().split(/\s+/).filter(Boolean).map((word) => ({ text: word, chars: chars(word) }));
}

/** Index of each word's first character across the whole title, for the stagger. */
export function charOffsets(words: SplitWord[]): number[] {
  return words.map((_, i) => words.slice(0, i).reduce((total, word) => total + word.chars.length, 0));
}
