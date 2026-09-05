/**
 * MRCP Skills Registry
 *
 * Centraliza todas as skills por linguagem e provê um lookup por nome de linguagem.
 * O Skill Injector usa este registry para encontrar a skill correta para cada nó.
 */

import type { LanguageSkill } from "./types.js";
import { typescriptSkill } from "./typescript.js";
import { pythonSkill } from "./python.js";
import { rustSkill } from "./rust.js";
import { goSkill } from "./go.js";
import { javaSkill } from "./java.js";
import { cppSkill } from "./cpp.js";
import { rubySkill } from "./ruby.js";
import { phpSkill } from "./php.js";

// Skill genérica de fallback para linguagens sem skill específica
const genericSkill: LanguageSkill = {
  name: "Standard_Clean_Architecture_Skill",
  language: "Generic",
  aliases: [],
  thresholds: {
    complexityWarning: 50,
    complexityCritical: 100,
    degreeWarning: 25,
    degreeCritical: 40,
  },
  directives: {
    stable: [
      "Mantenha a coesão do módulo e a separação de responsabilidades.",
      "Valide a integridade de compilação antes de finalizar.",
    ],
    warning: [
      "ATENÇÃO: Módulo com densidade lógica intermediária.",
      "Isole efeitos colaterais e garanta que as interfaces estejam bem definidas.",
    ],
    critical: [
      "CRÍTICO: God Module detectado — alto acoplamento e complexidade ciclomática.",
      "OBRIGATÓRIO: Quebre blocos condicionais aninhados em funções puras independentes.",
      "PLANO: Reduza a complexidade dividindo responsabilidades sem alterar o comportamento externo.",
      "RESTRIÇÃO: Não adicione novas lógicas de negócio — foque na refatoração estrutural.",
    ],
  },
  protectedPatterns: [],
};

// Todas as skills registradas
const ALL_SKILLS: LanguageSkill[] = [
  typescriptSkill,
  pythonSkill,
  rustSkill,
  goSkill,
  javaSkill,
  cppSkill,
  rubySkill,
  phpSkill,
];

// Mapa de lookup (case-insensitive) → skill
const skillMap = new Map<string, LanguageSkill>();

for (const skill of ALL_SKILLS) {
  skillMap.set(skill.language.toLowerCase(), skill);
  for (const alias of skill.aliases) {
    skillMap.set(alias.toLowerCase(), skill);
  }
}

/**
 * Retorna a skill correspondente à linguagem detectada.
 * Se não houver skill específica, retorna a skill genérica.
 */
export function getSkillForLanguage(language: string): LanguageSkill {
  return skillMap.get(language.toLowerCase()) || genericSkill;
}

/**
 * Retorna todas as skills disponíveis (para listagem/documentação).
 */
export function getAllSkills(): LanguageSkill[] {
  return [...ALL_SKILLS, genericSkill];
}
