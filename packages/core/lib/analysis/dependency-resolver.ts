<<<<<<< HEAD
=======
<<<<<<< HEAD
>>>>>>> 0a10f0543a8d313cd48c6d2ae1e9fdefdee2a770
import { fetchRepoFile } from "./repo-fetcher.js";

export interface DependencyResolverOptions {
  packageName: string;
  targetVersion?: string;
  manifestFilePath?: string;
  repoUrl?: string;
}

export interface DependencyConflict {
  peerPackage: string;
  requiredRange: string;
  currentInstalled?: string;
  isCompatible: boolean;
  reason: string;
}

export interface DependencyResolverResult {
  packageName: string;
  targetVersion: string;
  resolvedVersion: string;
  recommendedSafeVersion: string;
  latestVersion: string;
  currentInstalledVersion?: string;
  isDeprecated?: boolean;
  deprecationReason?: string;
  hasBreakingChanges: boolean;
  breakingChangeDetails: string[];
  conflicts: DependencyConflict[];
  safeInstallCommand: string;
  isApplicable: boolean;
  message?: string;
  warnings: string[];
}

export async function resolveDependencyCompatibility(
  options: DependencyResolverOptions
): Promise<DependencyResolverResult> {
  const { packageName, targetVersion = "latest", manifestFilePath = "package.json", repoUrl } = options;
  const warnings: string[] = [];

  const cleanPkg = packageName.trim();
  if (!cleanPkg) {
    return {
      packageName: "",
      targetVersion,
      resolvedVersion: "",
      recommendedSafeVersion: "",
      latestVersion: "",
      hasBreakingChanges: false,
      breakingChangeDetails: [],
      conflicts: [],
      safeInstallCommand: "",
      isApplicable: false,
      message: "Não se aplica: Nenhum nome de pacote fornecido.",
      warnings: ["Nome do pacote está vazio."]
    };
  }

  // 1. Consulta ao registro oficial do NPM
  let npmData: any = null;
  try {
    const encoded = encodeURIComponent(cleanPkg);
    const registryUrl = `https://registry.npmjs.org/${encoded}`;
    const res = await fetch(registryUrl, {
      headers: { Accept: "application/json" }
    });

    if (res.status === 404) {
      return {
        packageName: cleanPkg,
        targetVersion,
        resolvedVersion: "",
        recommendedSafeVersion: "",
        latestVersion: "",
        hasBreakingChanges: false,
        breakingChangeDetails: [],
        conflicts: [],
        safeInstallCommand: "",
        isApplicable: false,
        message: `Não se aplica: O pacote '${cleanPkg}' não foi encontrado no registro oficial do NPM.`,
        warnings: [`Pacote '${cleanPkg}' inexistente ou privado no registry do NPM (HTTP 404).`]
      };
    }

    if (!res.ok) {
      warnings.push(`Falha na resposta do registry NPM: HTTP ${res.status}`);
    } else {
      npmData = await res.json();
    }
  } catch (err: any) {
    warnings.push(`Erro de conexão com o NPM Registry: ${err.message}`);
  }

  if (!npmData) {
    return {
      packageName: cleanPkg,
      targetVersion,
      resolvedVersion: targetVersion,
      recommendedSafeVersion: targetVersion,
      latestVersion: "unknown",
      hasBreakingChanges: false,
      breakingChangeDetails: [],
      conflicts: [],
      safeInstallCommand: `npm install ${cleanPkg}@${targetVersion}`,
      isApplicable: false,
      message: "Não foi possível verificar a compatibilidade devido à indisponibilidade do NPM Registry.",
      warnings
    };
  }

  const distTags = npmData["dist-tags"] || {};
  const latestTag = distTags.latest || "0.0.0";
  const allVersions = Object.keys(npmData.versions || {});

  let resolvedVersion = latestTag;
  if (targetVersion === "latest") {
    resolvedVersion = latestTag;
  } else if (distTags[targetVersion]) {
    resolvedVersion = distTags[targetVersion];
  } else if (allVersions.includes(targetVersion)) {
    resolvedVersion = targetVersion;
  } else {
    // Procura a versão mais alta que satisfaça ou corresponda
    const matched = allVersions.filter((v) => v.startsWith(targetVersion.replace(/[\^~>=<]/g, "").split(".")[0]));
    resolvedVersion = matched.length > 0 ? matched[matched.length - 1] : latestTag;
  }

  const versionDetails = npmData.versions?.[resolvedVersion] || {};
  const isDeprecated = Boolean(versionDetails.deprecated);
  const deprecationReason = versionDetails.deprecated || undefined;

  // 2. Leitura do package.json local ou do repositório para conferir versões atuais e peerDependencies
  let currentInstalledVersion: string | undefined;
  const projectDeps: Record<string, string> = {};

  if (repoUrl) {
    const pkgFile = await fetchRepoFile(repoUrl, manifestFilePath);
    if (pkgFile?.content) {
      try {
        const pkgJson = JSON.parse(pkgFile.content);
        const allLocalDeps = {
          ...(pkgJson.dependencies || {}),
          ...(pkgJson.devDependencies || {}),
          ...(pkgJson.peerDependencies || {})
        };
        Object.assign(projectDeps, allLocalDeps);
        if (allLocalDeps[cleanPkg]) {
          currentInstalledVersion = allLocalDeps[cleanPkg].replace(/[\^~]/g, "");
        }
      } catch (err: any) {
        warnings.push(`Arquivo ${manifestFilePath} no repositório está corrompido ou contém JSON inválido.`);
      }
    }
  }

  // 3. Verificação de Breaking Changes
  const breakingChangeDetails: string[] = [];
  let hasBreakingChanges = false;

  if (currentInstalledVersion && resolvedVersion) {
    const currentMajor = parseInt(currentInstalledVersion.split(".")[0], 10);
    const targetMajor = parseInt(resolvedVersion.split(".")[0], 10);
    if (!isNaN(currentMajor) && !isNaN(targetMajor) && targetMajor > currentMajor) {
      hasBreakingChanges = true;
      breakingChangeDetails.push(
        `Major version jump detectado (${currentInstalledVersion} -> ${resolvedVersion}). Risco de quebra de APIs públicas.`
      );
    }
  }

  if (isDeprecated) {
    breakingChangeDetails.push(`A versão ${resolvedVersion} está marcada como DEPRECATED: ${deprecationReason}`);
  }

  // 4. Verificação de conflitos de Peer Dependencies
  const conflicts: DependencyConflict[] = [];
  const peerDeps: Record<string, string> = versionDetails.peerDependencies || {};

  for (const [peerPkg, requiredRange] of Object.entries(peerDeps)) {
    const installed = projectDeps[peerPkg];
    if (installed) {
      // Exemplo simplificado de checagem de major
      const reqMajor = requiredRange.replace(/[\^~>=<]/g, "").split(".")[0];
      const instMajor = installed.replace(/[\^~>=<]/g, "").split(".")[0];
      const isCompat = !reqMajor || !instMajor || reqMajor === instMajor || requiredRange.includes(installed);
      conflicts.push({
        peerPackage: peerPkg,
        requiredRange,
        currentInstalled: installed,
        isCompatible: isCompat,
        reason: isCompat
          ? `Compatível com a versão instalada (${installed}).`
          : `Incompatibilidade de peer dependency: ${peerPkg}@${requiredRange} requerido, mas ${installed} está instalado.`
      });
    }
  }

  const safeInstallCommand = `npm install ${cleanPkg}@${resolvedVersion}`;

  return {
    packageName: cleanPkg,
    targetVersion,
    resolvedVersion,
    recommendedSafeVersion: resolvedVersion,
    latestVersion: latestTag,
    currentInstalledVersion,
    isDeprecated,
    deprecationReason,
    hasBreakingChanges,
    breakingChangeDetails,
    conflicts,
    safeInstallCommand,
    isApplicable: true,
    warnings
  };
}
<<<<<<< HEAD
=======
=======
<<<<<<< HEAD
import { fetchRepoFile } from "./repo-fetcher.js";

=======
>>>>>>> bf27a4ca35ecf7a0a9b0f4e1680cca22cc24f407
export interface DependencyResolverOptions {
  packageName: string;
  targetVersion?: string;
  manifestFilePath?: string;
<<<<<<< HEAD
  repoUrl?: string;
=======
>>>>>>> bf27a4ca35ecf7a0a9b0f4e1680cca22cc24f407
}

export interface DependencyConflict {
  peerPackage: string;
  requiredRange: string;
<<<<<<< HEAD
  currentInstalled?: string;
  isCompatible: boolean;
  reason: string;
=======
  currentInstalled: string;
  isCompatible: boolean;
>>>>>>> bf27a4ca35ecf7a0a9b0f4e1680cca22cc24f407
}

export interface DependencyResolverResult {
  packageName: string;
  targetVersion: string;
<<<<<<< HEAD
  resolvedVersion: string;
  recommendedSafeVersion: string;
  latestVersion: string;
  currentInstalledVersion?: string;
  isDeprecated?: boolean;
  deprecationReason?: string;
  hasBreakingChanges: boolean;
  breakingChangeDetails: string[];
  conflicts: DependencyConflict[];
  safeInstallCommand: string;
  isApplicable: boolean;
  message?: string;
  warnings: string[];
}

export async function resolveDependencyCompatibility(
  options: DependencyResolverOptions
): Promise<DependencyResolverResult> {
  const { packageName, targetVersion = "latest", manifestFilePath = "package.json", repoUrl } = options;
  const warnings: string[] = [];

  const cleanPkg = packageName.trim();
  if (!cleanPkg) {
    return {
      packageName: "",
      targetVersion,
      resolvedVersion: "",
      recommendedSafeVersion: "",
      latestVersion: "",
      hasBreakingChanges: false,
      breakingChangeDetails: [],
      conflicts: [],
      safeInstallCommand: "",
      isApplicable: false,
      message: "Não se aplica: Nenhum nome de pacote fornecido.",
      warnings: ["Nome do pacote está vazio."]
    };
  }

  // 1. Consulta ao registro oficial do NPM
  let npmData: any = null;
  try {
    const encoded = encodeURIComponent(cleanPkg);
    const registryUrl = `https://registry.npmjs.org/${encoded}`;
    const res = await fetch(registryUrl, {
      headers: { Accept: "application/json" }
    });

    if (res.status === 404) {
      return {
        packageName: cleanPkg,
        targetVersion,
        resolvedVersion: "",
        recommendedSafeVersion: "",
        latestVersion: "",
        hasBreakingChanges: false,
        breakingChangeDetails: [],
        conflicts: [],
        safeInstallCommand: "",
        isApplicable: false,
        message: `Não se aplica: O pacote '${cleanPkg}' não foi encontrado no registro oficial do NPM.`,
        warnings: [`Pacote '${cleanPkg}' inexistente ou privado no registry do NPM (HTTP 404).`]
      };
    }

    if (!res.ok) {
      warnings.push(`Falha na resposta do registry NPM: HTTP ${res.status}`);
    } else {
      npmData = await res.json();
    }
  } catch (err: any) {
    warnings.push(`Erro de conexão com o NPM Registry: ${err.message}`);
  }

  if (!npmData) {
    return {
      packageName: cleanPkg,
      targetVersion,
      resolvedVersion: targetVersion,
      recommendedSafeVersion: targetVersion,
      latestVersion: "unknown",
      hasBreakingChanges: false,
      breakingChangeDetails: [],
      conflicts: [],
      safeInstallCommand: `npm install ${cleanPkg}@${targetVersion}`,
      isApplicable: false,
      message: "Não foi possível verificar a compatibilidade devido à indisponibilidade do NPM Registry.",
      warnings
    };
  }

  const distTags = npmData["dist-tags"] || {};
  const latestTag = distTags.latest || "0.0.0";
  const allVersions = Object.keys(npmData.versions || {});

  let resolvedVersion = latestTag;
  if (targetVersion === "latest") {
    resolvedVersion = latestTag;
  } else if (distTags[targetVersion]) {
    resolvedVersion = distTags[targetVersion];
  } else if (allVersions.includes(targetVersion)) {
    resolvedVersion = targetVersion;
  } else {
    // Procura a versão mais alta que satisfaça ou corresponda
    const matched = allVersions.filter((v) => v.startsWith(targetVersion.replace(/[\^~>=<]/g, "").split(".")[0]));
    resolvedVersion = matched.length > 0 ? matched[matched.length - 1] : latestTag;
  }

  const versionDetails = npmData.versions?.[resolvedVersion] || {};
  const isDeprecated = Boolean(versionDetails.deprecated);
  const deprecationReason = versionDetails.deprecated || undefined;

  // 2. Leitura do package.json local ou do repositório para conferir versões atuais e peerDependencies
  let currentInstalledVersion: string | undefined;
  const projectDeps: Record<string, string> = {};

  if (repoUrl) {
    const pkgFile = await fetchRepoFile(repoUrl, manifestFilePath);
    if (pkgFile?.content) {
      try {
        const pkgJson = JSON.parse(pkgFile.content);
        const allLocalDeps = {
          ...(pkgJson.dependencies || {}),
          ...(pkgJson.devDependencies || {}),
          ...(pkgJson.peerDependencies || {})
        };
        Object.assign(projectDeps, allLocalDeps);
        if (allLocalDeps[cleanPkg]) {
          currentInstalledVersion = allLocalDeps[cleanPkg].replace(/[\^~]/g, "");
        }
      } catch (err: any) {
        warnings.push(`Arquivo ${manifestFilePath} no repositório está corrompido ou contém JSON inválido.`);
      }
    }
  }

  // 3. Verificação de Breaking Changes
  const breakingChangeDetails: string[] = [];
  let hasBreakingChanges = false;

  if (currentInstalledVersion && resolvedVersion) {
    const currentMajor = parseInt(currentInstalledVersion.split(".")[0], 10);
    const targetMajor = parseInt(resolvedVersion.split(".")[0], 10);
    if (!isNaN(currentMajor) && !isNaN(targetMajor) && targetMajor > currentMajor) {
      hasBreakingChanges = true;
      breakingChangeDetails.push(
        `Major version jump detectado (${currentInstalledVersion} -> ${resolvedVersion}). Risco de quebra de APIs públicas.`
      );
    }
  }

  if (isDeprecated) {
    breakingChangeDetails.push(`A versão ${resolvedVersion} está marcada como DEPRECATED: ${deprecationReason}`);
  }

  // 4. Verificação de conflitos de Peer Dependencies
  const conflicts: DependencyConflict[] = [];
  const peerDeps: Record<string, string> = versionDetails.peerDependencies || {};

  for (const [peerPkg, requiredRange] of Object.entries(peerDeps)) {
    const installed = projectDeps[peerPkg];
    if (installed) {
      // Exemplo simplificado de checagem de major
      const reqMajor = requiredRange.replace(/[\^~>=<]/g, "").split(".")[0];
      const instMajor = installed.replace(/[\^~>=<]/g, "").split(".")[0];
      const isCompat = !reqMajor || !instMajor || reqMajor === instMajor || requiredRange.includes(installed);
      conflicts.push({
        peerPackage: peerPkg,
        requiredRange,
        currentInstalled: installed,
        isCompatible: isCompat,
        reason: isCompat
          ? `Compatível com a versão instalada (${installed}).`
          : `Incompatibilidade de peer dependency: ${peerPkg}@${requiredRange} requerido, mas ${installed} está instalado.`
      });
    }
  }

  const safeInstallCommand = `npm install ${cleanPkg}@${resolvedVersion}`;

  return {
    packageName: cleanPkg,
    targetVersion,
    resolvedVersion,
    recommendedSafeVersion: resolvedVersion,
    latestVersion: latestTag,
    currentInstalledVersion,
    isDeprecated,
    deprecationReason,
    hasBreakingChanges,
    breakingChangeDetails,
    conflicts,
    safeInstallCommand,
    isApplicable: true,
    warnings
=======
  recommendedSafeVersion: string;
  hasBreakingChanges: boolean;
  conflicts: DependencyConflict[];
  safeInstallCommand: string;
}

export async function resolveDependencyCompatibility(options: DependencyResolverOptions): Promise<DependencyResolverResult> {
  const { packageName, targetVersion = "latest" } = options;

  return {
    packageName,
    targetVersion,
    recommendedSafeVersion: targetVersion === "latest" ? "1.0.0" : targetVersion,
    hasBreakingChanges: false,
    conflicts: [],
    safeInstallCommand: `npm install ${packageName}@${targetVersion === "latest" ? "1.0.0" : targetVersion}`
>>>>>>> bf27a4ca35ecf7a0a9b0f4e1680cca22cc24f407
  };
}
>>>>>>> d6b6b143eac7885322e1cb04fd8155dc5ebb9b9e
>>>>>>> 0a10f0543a8d313cd48c6d2ae1e9fdefdee2a770
