import type { LanguageSkill } from './types.js';

export const goSkill: LanguageSkill = {
  name: 'Go_Idiomatic_Concurrency_Skill',
  language: 'Go',
  aliases: ['Golang'],
  thresholds: {
    complexityWarning: 40,
    complexityCritical: 80,
    degreeWarning: 20,
    degreeCritical: 30,
  },
  directives: {
    stable: [
      "Siga as convenções Go: nomes curtos, interfaces pequenas, pacotes coesos.",
      "Retorne errors explicitamente — nunca use panic para fluxo de controle.",
    ],
    warning: [
      "ATENÇÃO: Pacote Go com complexidade intermediária.",
      "Extraia funções longas em helpers privados (lowercase) no mesmo pacote.",
      "Substitua switches extensos por maps de funções (strategy pattern via closures).",
      "Verifique se goroutines têm mecanismo de cancelamento (context.Context).",
    ],
    critical: [
      "CRÍTICO: Pacote Go com alta complexidade — risco de race conditions e deadlocks.",
      "OBRIGATÓRIO: Decomponha em sub-pacotes seguindo o padrão /internal/ do Go.",
      "PLANO: Isole lógica de concorrência (channels, goroutines) em um pacote dedicado.",
      "Use interfaces estreitas (1-2 métodos) para desacoplar dependências.",
      "RESTRIÇÃO: Não exporte novos tipos deste pacote — reduza a superfície pública.",
    ],
  },
  protectedPatterns: ['func ', 'type ', 'var ', 'const '],
};
