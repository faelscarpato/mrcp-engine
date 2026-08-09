import type { LanguageSkill } from './types.js';

export const typescriptSkill: LanguageSkill = {
  name: 'Enterprise_TS_Modularization_Skill',
  language: 'TypeScript',
  aliases: ['JavaScript', 'TSX', 'JSX'],
  thresholds: {
    complexityWarning: 50,
    complexityCritical: 100,
    degreeWarning: 25,
    degreeCritical: 40,
  },
  directives: {
    stable: [
      "Mantenha a coesão do módulo e a separação de responsabilidades.",
      "Valide que todas as interfaces públicas possuem tipagem explícita (sem `any`).",
    ],
    warning: [
      "ATENÇÃO: Módulo TypeScript com densidade lógica intermediária.",
      "Isole efeitos colaterais em funções puras separadas.",
      "Substitua `any` por tipos genéricos ou unions discriminadas.",
      "Considere extrair hooks customizados se houver lógica de estado acoplada a UI.",
    ],
    critical: [
      "CRÍTICO: God Module TypeScript detectado — alto acoplamento e complexidade ciclomática.",
      "OBRIGATÓRIO: Aplique o padrão Barrel Export (index.ts) para controlar a superfície pública.",
      "PLANO: Decomponha em sub-módulos usando inversão de dependência (DI).",
      "RESTRIÇÃO: Não adicione novas responsabilidades — apenas refatore as existentes.",
      "Extraia constantes mágicas, elimine code paths duplicados e substitua switches por mapas de estratégia.",
    ],
  },
  protectedPatterns: ['export default', 'export function', 'export const', 'export type', 'export interface'],
};
