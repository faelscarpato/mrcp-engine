const PTBR_FILLERS =
  /\b(é|hã|hum|tipo|então|sabe|veja bem|ou seja|né|cara|aí|tipo assim|olha só|meio que)\b/gi;

export function sanitizeVoiceInput(rawInput: string): string {
  if (!rawInput) return "";
  return rawInput
    .replace(PTBR_FILLERS, "")
    .replace(/[,.\?!]{2,}/g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeForTTS(text: string): string {
  if (!text) return "";
  return text
    .replace(/[*_#`~\[\]()]/g, "") // Remove Markdown syntax
    .replace(/\n+/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}
