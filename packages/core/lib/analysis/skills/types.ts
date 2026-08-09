/**
 * MRCP Skills — Interface comum para todas as Skills por linguagem
 */

export interface LanguageSkill {
  name: string;
  language: string;
  aliases: string[];  // Nomes alternativos (ex: "JS" para "JavaScript")
  thresholds: {
    complexityWarning: number;
    complexityCritical: number;
    degreeWarning: number;
    degreeCritical: number;
  };
  directives: {
    stable: string[];
    warning: string[];
    critical: string[];
  };
  protectedPatterns: string[];  // Padrões de export que nunca devem ser alterados
}
