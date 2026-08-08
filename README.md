# mrcp-engine

Machine-Readable Context Protocol Engine

# SPECIFICATION PAPER: The Machine-Readable Context Protocol (MRCP)

**Um Middleware de Estruturação Semântica para Otimização de LLMs**

## Resumo Executivo (Abstract)

Atualmente, Modelos de Linguagem de Grande Escala (LLMs) gastam ciclos computacionais massivos processando dados não estruturados (HTML cru, repositórios de código inteiros, PDFs complexos). Isso resulta em janelas de contexto saturadas, altos custos de inferência (tokens) e degradação de atenção, levando à alucinação de dados. Este documento propõe a arquitetura **MRCP**, um motor de pré-processamento que atua como um _Gatekeeper_ e Tradutor. Ele ingere qualquer fonte de dados (Código, Web, Documentos) e devolve para a IA um JSON altamente estruturado, mastigado e semântico, operando no padrão de "Divulgação Progressiva" (Progressive Disclosure).

---

## 1. O Problema do Paradigma Atual

Quando uma IA é solicitada a analisar um repositório GitHub, varrer um site ou ler um contrato, o fluxo padrão força o LLM a atuar como um _parser_. A IA recebe milhares de linhas de código, tags HTML inúteis ou textos extraídos sem formatação geométrica.

- **Desperdício de Tokens:** 80% do texto em um arquivo HTML ou repositório (node_modules, logs, boilerplate) é lixo cognitivo para a IA.
- **Efeito "Lost in the Middle":** Contextos muito longos fazem com que a IA esqueça instruções cruciais que ficaram no meio do prompt.
- **Alucinação Arquitetural:** Ao ler muitos arquivos soltos, a IA falha em mapear as dependências corretas, inventando relações que não existem.

## 2. A Arquitetura Proposta: O Motor Tradutor

A solução é retirar a carga de _parsing_ da IA e transferi-la para um microserviço dedicado. O motor atua em três camadas fundamentais:

### 2.1. Ingestão Multimodal

O motor é agnóstico em relação à fonte. Ele recebe um _endpoint_ e identifica a natureza do dado:

- **Repositórios:** Acessa a árvore de arquivos.
- **Websites:** Executa _headless browsers_ para capturar o DOM.
- **Documentos/Imagens:** Utiliza bibliotecas de OCR (Optical Character Recognition) aceleradas por hardware para extrair texto preservando a geometria da página.

### 2.2. Processamento Sintático (O Cérebro do Motor)

Em vez de ler texto, o motor entende a estrutura.

- **Para Código:** Utiliza binários WebAssembly do `Tree-Sitter` para gerar Árvores de Sintaxe Abstrata (AST). Ele extrai apenas assinaturas de funções, classes e grafos de dependência (imports/exports).
- **Para Web:** Remove CSS/Scripts e converte a semântica de `<h1>`, `<table>` e `<article>` para um Markdown limpo.
- **Para Documentos (O Futuro):** Mapeia cláusulas de contratos, sumários de livros e verbetes de enciclopédias, convertendo PDFs blocados em arrays lógicos.

### 2.3. O Padrão de Divulgação Progressiva (A "Lupa")

A genialidade do protocolo reside em **não enviar tudo de uma vez**. A API responde em 4 a 7 segundos com um "Esqueleto Inteligente".

```json
{
  "context_type": "repository",
  "summary": "Projeto web modular com uso intensivo de banco de dados.",
  "architecture": {
    "src/lib/api.ts": { "exports": ["fetchData", "authenticate"] },
    "src/components/ui/": { "type": "visual_components", "count": 24 }
  },
  "llm_action_required": "Para ler o conteúdo interno de um arquivo específico, chame o endpoint /analyze/deep-dive?path=[ARQUIVO]"
}
```

A IA recebe o mapa da mina. Se ela precisar ler um contrato específico ou a função `fetchData`, ela faz uma segunda chamada pontual.

---

## 3. Escalabilidade e Infraestrutura

Para suportar o tráfego de agentes autônomos sem gargalos, a arquitetura exige:

- **Edge Computing & Serverless:** A lógica de _parsing_ deve rodar na borda (Edge) para latência quase zero.
- **Caching Inteligente:** Integração com bancos de dados de alta performance (como instâncias no Supabase ou Redis) para salvar hashes de repositórios e sites. Se uma IA pedir a análise de um repositório que já foi processado há 1 hora, a API devolve o JSON salvo do banco de dados em milissegundos, poupando processamento.
- **Aceleração de OCR:** Para a futura implementação de processamento de enciclopédias e PDFs volumosos, o motor poderá delegar o processamento de imagem para GPUs em nuvem (utilizando pipelines como as disponíveis no ecossistema NVIDIA Developer), transformando pixels em JSON semântico assincronamente.

---

## 4. O Impacto Direto nas IAs (Por que deve ser um Padrão Nativo)

Se os provedores de IA adotarem esse protocolo como uma ferramenta nativa (_Native Function Call_):

1. **Redução de Custo de Inferência:** O processamento nos clusters das IAs cairá drasticamente, pois elas não gastarão mais poder computacional tentando entender estruturas sintáticas — o motor já fez isso.
2. **Aumento Absoluto de Precisão:** A IA passa a responder perguntas sobre bases de código complexas ou documentos jurídicos longos com exatidão matemática, pois está consultando um banco de dados estruturado, não lendo um pergaminho infinito.
3. **Velocidade para o Usuário Final:** Como o motor devolve o contexto tático em segundos, a interface de chat do usuário final parece ter ganho um aumento absurdo de velocidade e inteligência.

## 5. Como conectar via MCP (Model Context Protocol)

O MRCP-Engine possui suporte nativo ao padrão MCP (Model Context Protocol) para ser consumido instantaneamente por agentes como **Claude Desktop**, **Cursor**, **Gemini** e orquestradores de IA.

### Opção A: Executando via NPX (Claude Desktop)
Para adicionar o MRCP-Engine ao Claude Desktop, adicione o seguinte trecho no seu arquivo `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mrcp-engine": {
      "command": "npx",
      "args": ["-y", "mrcp-engine"]
    }
  }
}
```

### Opção B: Conectando via API HTTP (SSE)
Para agentes em nuvem ou bibliotecas como LangChain e LlamaIndex, o motor expõe um endpoint oficial de comunicação:
- **URL do Servidor MCP:** `https://mrcp-engine.vercel.app/api/mcp`

### Opção C: Para o ChatGPT (OpenAI Custom Actions)
Basta importar o Manifesto da OpenAPI no portal de criação de GPTs:
- **Manifest URL:** `https://mrcp-engine.vercel.app/openapi.json`

## 6. Conclusão

O motor proposto não é apenas um "leitor de repositórios". É a fundação para a **Machine-Readable Web**. Ao entregar dados mastigados, estruturados e sob demanda, permitimos que as IAs deixem de ser leitoras braçais de código sujo e passem a operar exclusivamente no nível cognitivo avançado, tomando decisões arquiteturais, analisando lógica e gerando insights em tempo recorde.

