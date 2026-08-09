/**
 * MRCP-Engine: Dynamic Skill & Contract Injector
 * 
 * Responsável por traduzir o mapeamento AST em contratos acionáveis para IAs,
 * eliminando a suposição, o "vibe coding" e protegendo nós de alta dependência.
 * 
 * Agora usa o Skills Registry para carregar diretivas específicas por linguagem.
 */

import { getSkillForLanguage } from './skills/registry.js';
import type { LanguageSkill } from './skills/types.js';

export interface ASTNodeMetadata {
  id: string;
  label: string;
  path?: string;
  language?: string;
  complexity?: number;
  degree?: number;
}

export interface MRCPInjectedContract {
  targetNode: string;
  detectedLanguage: string;
  assignedSkill: string;
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
 * Analisa o nó crítico identificado pelo parser AST e injeta a Skill
 * e o Contrato de Blindagem correspondente, usando o Skills Registry.
 */
export function injectSkillAndContract(node: ASTNodeMetadata): MRCPInjectedContract {
  const language = node.language || "TypeScript";
  const complexity = node.complexity || 10;
  const degree = node.degree || 1;

  // 1. Carrega a skill específica da linguagem via Registry
  const skill: LanguageSkill = getSkillForLanguage(language);

  // 2. Classificação estrutural baseada nos thresholds da skill (não mais hardcoded)
  let structuralStatus: 'STABLE' | 'WARNING' | 'CRITICAL_GOD_MODULE' = 'STABLE';
  let directives: string[] = skill.directives.stable;

  if (complexity > skill.thresholds.complexityCritical || degree > skill.thresholds.degreeCritical) {
    structuralStatus = 'CRITICAL_GOD_MODULE';
    directives = skill.directives.critical;
  } else if (complexity > skill.thresholds.complexityWarning || degree > skill.thresholds.degreeWarning) {
    structuralStatus = 'WARNING';
    directives = skill.directives.warning;
  }

  // 3. Montagem do Contrato de Blindagem de Dependências
  const protectedExports = [
    node.label,
    ...skill.protectedPatterns.slice(0, 3),  // Top-3 padrões da linguagem
  ];

  return {
    targetNode: node.id,
    detectedLanguage: language,
    assignedSkill: skill.name,
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
      assignedSkillName: skill.name,
      strictDirectives: directives
    }
  };
}

/**
 * Processa a lista completa de hotspots detectados no JSON da AST do repositório
 * e retorna um lote de contratos prontos para consumo instantâneo pela IA.
 * 
 * Agora usa os thresholds do registry de cada linguagem individualmente.
 */
export function processRepositoryHotspots(nodes: ASTNodeMetadata[]): MRCPInjectedContract[] {
  // Filtra nós que exigem atenção baseado nos thresholds da skill da linguagem
  const vulnerableNodes = nodes.filter(n => {
    const skill = getSkillForLanguage(n.language || 'Generic');
    return (n.complexity && n.complexity > skill.thresholds.complexityWarning) 
        || (n.degree && n.degree > skill.thresholds.degreeWarning);
  });
  
  return vulnerableNodes.map(node => injectSkillAndContract(node));
}