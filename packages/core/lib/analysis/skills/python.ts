import type { LanguageSkill } from "./types.js";

export const pythonSkill: LanguageSkill = {
  name: "Karpathy_Python_Strict_Typing_Skill",
  language: "Python",
  aliases: [],
  thresholds: {
    complexityWarning: 40,
    complexityCritical: 80,
    degreeWarning: 20,
    degreeCritical: 35,
  },
  directives: {
    stable: [
      "Mantenha type hints em todas as assinaturas de funções e retornos.",
      "Use docstrings no formato Google/NumPy para documentação inline.",
    ],
    warning: [
      "ATENÇÃO: Módulo Python com complexidade intermediária.",
      "Adicione type hints (PEP 484) a todos os parâmetros e retornos.",
      "Substitua dicionários genéricos por dataclasses ou TypedDict.",
      "Extraia funções lambda complexas para funções nomeadas com docstring.",
    ],
    critical: [
      "CRÍTICO: God Module Python — violação severa do Princípio da Responsabilidade Única.",
      "OBRIGATÓRIO: Decomponha em módulos menores seguindo o padrão de Package por Feature.",
      "PLANO: Elimine variáveis globais mutáveis e substitua por injeção de dependência.",
      "Use @dataclass(frozen=True) para dados imutáveis e Protocol para interfaces.",
      "RESTRIÇÃO: Não adicione novos imports circulares — resolva com lazy imports ou reestruturação.",
    ],
  },
  protectedPatterns: ["def ", "class ", "__all__"],
};
