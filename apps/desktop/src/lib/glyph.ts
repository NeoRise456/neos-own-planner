/** The two-letter glyph drawn next to a title: "Buy milk" → "Bu". Display only. */
export const glyphOf = (title: string) => {
  const t = title.trim();
  return (t.slice(0, 1).toUpperCase() + t.slice(1, 2).toLowerCase()) || "··";
};
