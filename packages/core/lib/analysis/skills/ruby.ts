import type { LanguageSkill } from "./types.js";

export const rubySkill: LanguageSkill = {
  name: "Ruby_Rails_Convention_Skill",
  language: "Ruby",
  aliases: [],
  thresholds: {
    complexityWarning: 40,
    complexityCritical: 80,
    degreeWarning: 20,
    degreeCritical: 35,
  },
  directives: {
    stable: [
      "Siga as convenções Rails: Convention over Configuration.",
      "Mantenha controllers thin e models fat — lógica de negócio pertence a services/concerns.",
    ],
    warning: [
      "ATENÇÃO: Módulo Ruby com complexidade intermediária.",
      "Extraia callbacks complexos para Service Objects (app/services/).",
      "Substitua method_missing por métodos explícitos quando possível.",
      "Use Concerns para compartilhar comportamento entre models sem herança múltipla.",
    ],
    critical: [
      "CRÍTICO: God Class Ruby detectada — violação do princípio de responsabilidade única.",
      "OBRIGATÓRIO: Decomponha em Service Objects, Form Objects, ou Query Objects.",
      "PLANO: Extraia validações complexas para Validator classes dedicadas.",
      "Substitua callbacks encadeados (before_action/after_save) por eventos explícitos.",
      "RESTRIÇÃO: Não adicione novos métodos públicos ao model — use decorators ou presenters.",
    ],
  },
  protectedPatterns: ["def ", "class ", "module ", "attr_"],
};
