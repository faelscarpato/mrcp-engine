import type { LanguageSkill } from "./types.js";

export const rustSkill: LanguageSkill = {
  name: "Rust_Ownership_Safety_Skill",
  language: "Rust",
  aliases: [],
  thresholds: {
    complexityWarning: 60,
    complexityCritical: 120,
    degreeWarning: 20,
    degreeCritical: 35,
  },
  directives: {
    stable: [
      "Garanta que os lifetimes estejam explícitos onde o compilador não consegue inferir.",
      "Prefira &str sobre String em parâmetros de função para evitar alocações desnecessárias.",
    ],
    warning: [
      "ATENÇÃO: Módulo Rust com complexidade intermediária.",
      "Substitua unwrap()/expect() por tratamento de erro explícito com Result<T, E>.",
      "Use #[derive] para minimizar boilerplate de traits.",
      "Considere extrair closures complexas para funções nomeadas.",
    ],
    critical: [
      "CRÍTICO: Módulo Rust com alta complexidade — risco de bugs de ownership.",
      "OBRIGATÓRIO: Elimine blocos unsafe desnecessários ou isole-os em módulos dedicados.",
      "PLANO: Decomponha match statements aninhados em funções menores.",
      "Use o padrão Builder ou New Type para reduzir a superfície de API.",
      "RESTRIÇÃO: Não adicione novos lifetimes genéricos — simplifique os existentes.",
    ],
  },
  protectedPatterns: [
    "pub fn",
    "pub struct",
    "pub enum",
    "pub trait",
    "pub mod",
  ],
};
