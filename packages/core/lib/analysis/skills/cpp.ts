import type { LanguageSkill } from "./types.js";

export const cppSkill: LanguageSkill = {
  name: "CPP_Memory_Safety_Audit_Skill",
  language: "C++",
  aliases: ["C", "C/C++"],
  thresholds: {
    complexityWarning: 60,
    complexityCritical: 130,
    degreeWarning: 25,
    degreeCritical: 40,
  },
  directives: {
    stable: [
      "Use RAII (Resource Acquisition Is Initialization) para gerenciamento de recursos.",
      "Prefira smart pointers (unique_ptr, shared_ptr) sobre ponteiros brutos.",
    ],
    warning: [
      "ATENÇÃO: Módulo C/C++ com complexidade intermediária.",
      "Substitua arrays C-style por std::vector ou std::array.",
      "Use const correctness em todos os parâmetros e métodos que não modificam estado.",
      "Extraia macros complexas para funções constexpr ou templates.",
    ],
    critical: [
      "CRÍTICO: Módulo C/C++ com alta complexidade — risco de memory leaks e buffer overflows.",
      "OBRIGATÓRIO: Audite todos os ponteiros brutos e substitua por smart pointers.",
      "PLANO: Isole código unsafe (ponteiros, reinterpret_cast) em módulos wrapper dedicados.",
      "Decomponha funções longas — nenhuma função deve exceder 50 linhas.",
      "RESTRIÇÃO: Não adicione novos #define — use constexpr, enum class, ou templates.",
    ],
  },
  protectedPatterns: ["class ", "struct ", "namespace ", "extern ", "#ifndef"],
};
