# @mrcp/cli

Tríade de Orquestração Autônoma do MRCP Engine: `TechLeadOrchestrator`,
`MrcpGatekeeper` e os agentes de `Backend`, `Frontend` e `Database`.

O pacote expõe os agentes para uso programático. A alternativa por
linha de comando (configuração de IDEs, dashboard e servidor MCP) vive no
pacote raiz `mrcp-engine`.

## Instalação

```bash
npm install @mrcp/cli @mrcp/core
```

`@mrcp/core` é dependência direta: os agentes chamam `calculateCodeHealth`,
`detectArchitectureDrift`, `searchDuckDuckGo` e `scrapeUrl` através dos
subpaths exportados pelo core.

## Uso

```ts
import { TechLeadOrchestrator } from "@mrcp/cli";

const orchestrator = new TechLeadOrchestrator();
const resultado = await orchestrator.execute({
  title: "Revisar módulo de checkout",
  description: "Auditar a lógica de cupons",
});
```

O `MrcpGatekeeper` valida a saída de cada etapa contra o grafo AST antes de
seguir, e é ele quem impede que um agente avance com resultado inventado.

## Entradas

| Binário do pacote      | Papel                                                   |
| ---------------------- | ------------------------------------------------------- |
| `mrcp` / `mrcp-engine` | Configura IDEs, abre o dashboard ou sobe o servidor MCP |
| `mrcp-auto`            | Modo autônomo (Tríade Tech Lead + Gatekeeper)           |

## Build

O `src/` é TypeScript; o que é publicado é `dist/`.

```bash
npm run build
```

## Licença

MIT
