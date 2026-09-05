import type { LanguageSkill } from "./types.js";

export const phpSkill: LanguageSkill = {
  name: "PHP_Modern_Architecture_Skill",
  language: "PHP",
  aliases: [],
  thresholds: {
    complexityWarning: 45,
    complexityCritical: 90,
    degreeWarning: 25,
    degreeCritical: 40,
  },
  directives: {
    stable: [
      "Use strict_types (declare(strict_types=1)) em todos os arquivos.",
      "Tipagem completa em parâmetros, retornos e propriedades (PHP 8+).",
    ],
    warning: [
      "ATENÇÃO: Classe PHP com complexidade intermediária.",
      "Substitua arrays associativos por DTOs (Data Transfer Objects) tipados.",
      "Use enums (PHP 8.1+) em vez de constantes de classe para estados finitos.",
      "Extraia queries SQL inline para Repository classes dedicadas.",
    ],
    critical: [
      "CRÍTICO: God Class PHP detectada — risco de acoplamento temporal e efeitos colaterais.",
      "OBRIGATÓRIO: Aplique o padrão Action/Command para isolar operações de negócio.",
      "PLANO: Decomponha em Services, Repositories e Value Objects.",
      "Use Dependency Injection Container — elimine instanciações manuais (new Class()).",
      "RESTRIÇÃO: Não adicione novos métodos estáticos — converta para instância injetável.",
    ],
  },
  protectedPatterns: ["public function", "class ", "interface ", "namespace "],
};
