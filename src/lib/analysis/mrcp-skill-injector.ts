/**
 * MRCP-Engine: Dynamic Skill & Contract Injector
 * Responsável por traduzir o mapeamento AST em contratos acionáveis para IAs,
 * eliminando a suposição, o "vibe coding" e protejendo nós de alta dependência.
 */

export interface ASTNodeMetadata {
  id: string;
  label: string;
  path?: string;
  language?: string;
  complexity?: number;
  degree?: number; // Grau de conectividade / arestas incidentes
}

export interface MRCPInjectedContract {
  targetNode: string;
  detectedLanguage: string;
  metrics: {
    complexity: number;
    connectivityDegree: number;
    structuralStatus: 'STABLE' | 'WARNING' | 'CRITICAL_GOD_MODULE';
  };
  dependencyShielding: {
    protectedExports: string[];
    rule: string;
  };
  actionableSkillDirective: {
    assignedSkillName: string;
    strictDirectives: string[];
  };
}

/**
 * Analisa o nó crítico identificado pelo parser AST e injeta a Skill e o Contrato de Blindagem correspondente.
 */
export function injectSkillAndContract(node: ASTNodeMetadata): MRCPInjectedContract {
  const language = node.language || "TypeScript";
  const complexity = node.complexity || 10;
  const degree = node.degree || 1;

  // 1. Determinação da Skill baseada na linguagem mapeada pelo Tree-Sitter
  let assignedSkillName = "Standard_Clean_Architecture_Skill";
  if (language.toLowerCase() === "python") {
    assignedSkillName = "Karpathy_Python_Strict_Typing_Skill";
  } else if (language.toLowerCase() === "typescript" || language.toLowerCase() === "javascript") {
    assignedSkillName = "Enterprise_TS_Modularization_Skill";
  }

  // 2. Classificação estrutural baseada em métricas matemáticas
  let structuralStatus: 'STABLE' | 'WARNING' | 'CRITICAL_GOD_MODULE' = 'STABLE';
  let directives: string[] = [
    "Execute otimizações locais mantendo a coesão do módulo.",
    "Valide a integridade de compilação antes de finalizar."
  ];

  if (complexity > 100 || degree > 30) {
    structuralStatus = 'CRITICAL_GOD_MODULE';
    directives = [
      "CRÍTICO: Este componente é um Módulo Deus (God Module) de alto acoplamento.",
      "OBRIGATÓRIO: Quebre blocos condicionais aninhados (if/else/switch) em funções puras independentes.",
      "PLANO DE AÇÃO: Reduza a complexidade ciclomática dividindo responsabilidades sem alterar o comportamento externo.",
      "RESTRIÇÃO ABSOLUTA: Não adicione novas lógicas de negócio; foque estritamente na refatoração estrutural prescrita."
    ];
  } else if (complexity > 50) {
    structuralStatus = 'WARNING';
    directives = [
      "ATENÇÃO: Módulo com densidade lógica intermediária.",
      "DIRETRIZ: Isole efeitos colaterais e garanta que as tipagens estejam estritamente definidas."
    ];
  }

  // 3. Montagem do Contrato de Blindagem de Dependências
  const protectedExports = [
    node.label,
    "initializeEngine",
    "parseAST"
  ];

  return {
    targetNode: node.id,
    detectedLanguage: language,
    metrics: {
      complexity,
      connectivityDegree: degree,
      structuralStatus
    },
    dependencyShielding: {
      protectedExports,
      rule: "ZERO_REGRESSION_POLICY: Proibido alterar assinaturas de exportação públicas consumidas por nós dependentes."
    },
    actionableSkillDirective: {
      assignedSkillName,
      strictDirectives: directives
    }
  };
}

/**
 * Processa a lista completa de hotspots detectados no JSON da AST do repositório
 * e retorna um lote de contratos prontos para consumo instantâneo pela IA.
 */
export function processRepositoryHotspots(nodes: ASTNodeMetadata[]): MRCPInjectedContract[] {
  // Filtra apenas nós que exigem atenção (complexidade > 50 ou grau > 25)
  const vulnerableNodes = nodes.filter(n => (n.complexity && n.complexity > 50) || (n.degree && n.degree > 25));
  
  // Mapeia para o formato de contrato acionável
  return vulnerableNodes.map(node => injectSkillAndContract(node));
}