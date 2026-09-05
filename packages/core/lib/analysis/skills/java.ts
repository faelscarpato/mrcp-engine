import type { LanguageSkill } from "./types.js";

export const javaSkill: LanguageSkill = {
  name: "Java_SOLID_Enterprise_Skill",
  language: "Java",
  aliases: ["Kotlin"],
  thresholds: {
    complexityWarning: 50,
    complexityCritical: 100,
    degreeWarning: 30,
    degreeCritical: 50,
  },
  directives: {
    stable: [
      "Mantenha classes com responsabilidade única (SRP) e injeção de dependência via construtor.",
      "Documente APIs públicas com Javadoc incluindo @param, @return e @throws.",
    ],
    warning: [
      "ATENÇÃO: Classe Java com complexidade intermediária.",
      "Extraia métodos privados para classes de serviço ou utilitárias dedicadas.",
      "Substitua herança profunda por composição (favor composition over inheritance).",
      "Considere usar Records (Java 16+) para DTOs imutáveis.",
    ],
    critical: [
      "CRÍTICO: God Class Java detectada — violação severa dos princípios SOLID.",
      "OBRIGATÓRIO: Aplique o padrão Extract Class para separar responsabilidades.",
      "PLANO: Use interfaces com implementações específicas (Strategy/Factory pattern).",
      "Elimine if/else cascades — substitua por polimorfismo ou Chain of Responsibility.",
      "RESTRIÇÃO: Não adicione novos métodos públicos — apenas refatore os existentes.",
    ],
  },
  protectedPatterns: [
    "public class",
    "public interface",
    "public enum",
    "public static",
    "@Override",
  ],
};
