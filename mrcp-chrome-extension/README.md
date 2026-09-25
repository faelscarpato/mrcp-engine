# 🌐 MRCP Engine — Extensão para Google Chrome (Manifest V3)

> **Pacote de Distribuição e Instalação Rápida para Navegador**  
> _Code Intelligence, Architecture Cockpit & Deterministic AI Context Packer_ direto na barra lateral do Google Chrome.

---

## 📦 Arquivo de Instalação Rápida (Download)

Para facilitar a instalação por usuários e desenvolvedores sem a necessidade de compilar códigos ou instalar dependências locais, este diretório contém o arquivo compactado pronto para uso:

| Arquivo                                                                       | Versão  | Tamanho | Descrição                                                     |
| :---------------------------------------------------------------------------- | :-----: | :-----: | :------------------------------------------------------------ |
| 📥 **[`mrcp-chrome-extension-v2.6.1.zip`](mrcp-chrome-extension-v2.6.1.zip)** | `2.6.1` | ~387 KB | Pacote pré-empacotado da extensão Google Chrome (Manifest V3) |

---

## 📸 Demonstração Visual

### 1. Painel Lateral Nativo do Chrome (Side Panel)

O **MRCP Engine** roda de forma nativa e não invasiva na barra lateral direita do Google Chrome, mantendo sua aba de navegação intacta enquanto audita o código:

<p align="center">
  <img src="captura_sidebar_aberto.png" alt="MRCP Engine no Chrome Side Panel" width="380" />
</p>

- **Detecção em Tempo Real**: Identifica o repositório da aba aberta (`faelscarpato/mrcp-engine` ou GitLab) automaticamente.
- **Cockpit Executivo**: Health Score (0-100), Grau de Saúde (A–F), Índice de Manutenibilidade SEI (0-100) e Qualidade Documental (DQI).
- **Comprovante de Eficiência LLM**: Mostra a redução drástica de tokens (~94% a 98% de economia) ao enviar contexto para ChatGPT, Claude, Gemini ou Cursor.
- **Abas Diagnósticas**: Visão Geral, God Modules (>750 LOC), Segurança & Segredos, Gaps de Testes, Documentos, Rotas de API e Grafo de Dependências Canvas.

---

### 2. Ação Rápida Integrada ao GitHub & GitLab

Ao visitar qualquer repositório no GitHub ou GitLab, a extensão injeta automaticamente o botão **⚡ MRCP Cockpit** no cabeçalho do projeto:

<p align="center">
  <img src="captura_botao_no_header_do_github.png" alt="Botão MRCP Cockpit no cabeçalho do GitHub" width="850" />
</p>

Basta clicar em **⚡ MRCP Cockpit** para abrir o Side Panel e iniciar a análise imediata com 1 único clique!

---

## 🚀 Passo a Passo: Como Instalar no Google Chrome

A instalação leva menos de 1 minuto:

### Passo 1: Descompacte o arquivo ZIP

1. Baixe ou acesse o arquivo [`mrcp-chrome-extension-v2.6.1.zip`](mrcp-chrome-extension-v2.6.1.zip) presente nesta pasta.
2. Extraia o conteúdo do arquivo `.zip` para uma pasta de sua escolha (ex: `mrcp-chrome-extension-v2.6.1`).
   > 💡 **Dica:** Certifique-se de que o arquivo `manifest.json` esteja diretamente na raiz da pasta extraída.

### Passo 2: Abra o gerenciador de extensões do Chrome

1. Abra o **Google Chrome**.
2. Digite na barra de endereços:
   ```text
   chrome://extensions
   ```
   e pressione `Enter`.

### Passo 3: Ative o Modo do Desenvolvedor

1. No canto superior direito da tela de extensões, ative a chave seletora **"Modo do desenvolvedor"** (_Developer mode_).

### Passo 4: Carregue a extensão descompactada

1. No canto superior esquerdo, clique no botão **"Carregar sem compactação"** (_Load unpacked_).
2. Na janela de seleção de arquivos, escolha a pasta descompactada no **Passo 1**.
3. A extensão **MRCP Engine — Code Intelligence & AI Context Cockpit** aparecerá imediatamente na lista!

### Passo 5: Fixe o ícone para acesso rápido

1. Clique no ícone de quebra-cabeça (Extensões) na barra superior do Chrome.
2. Clique no ícone de alfinete (Fixar / _Pin_) ao lado de **MRCP Engine**.
3. Agora o ícone estará sempre visível para abertura instantânea do painel lateral direito.

---

## 🖥️ Como Usar no Dia a Dia

### 1. Auditoria Automática de Repositórios Abertos

1. Navegue normalmente até qualquer repositório no **GitHub** ou **GitLab** (ex: `https://github.com/facebook/react` ou seus projetos privados).
2. Clique no botão **⚡ MRCP Cockpit** no cabeçalho da página ou abra o painel clicando no ícone da extensão.
3. Clique em **⚡ Analisar Aba** no banner superior do painel lateral.
4. O MRCP fará a varredura AST dos arquivos e exibirá o relatório completo em segundos!

### 2. Consulta Manual de Repositórios

- Se quiser auditar um repositório sem navegar até ele, digite o caminho no campo de busca (ex: `owner/repo`, `gitlab:grupo/projeto` ou a URL completa) e clique em **⚡ Analisar**.

### 3. Copiar Contexto Otimizado para IA (~95% Menos Tokens)

1. Após a conclusão da análise, desça até o rodapé do painel e clique em **📋 Copiar Contexto Otimizado para IA**.
2. Cole o texto resultante no ChatGPT, Claude, Gemini ou Cursor.
3. A IA receberá todas as assinaturas de tipos, funções e rotas de API sem ruído e com precisão cirúrgica, evitando alucinações e economizando custos com tokens.

### 4. Exportar Relatório Executivo

- Clique em **📄 Exportar Relatório MD** para salvar no seu computador um relatório completo em Markdown (`MRCP_DIAGNOSTIC_REPORT.md`) com todos os achados arquiteturais.

---

## ⚙️ Configuração Opcional de Tokens (GitHub & GitLab)

Por padrão, a extensão funciona imediatamente sem necessidade de chaves para repositórios públicos. Se desejar auditar repositórios privados ou elevar os limites de requisições:

1. No topo do painel lateral, clique no ícone de engrenagem **⚙️**.
2. Insira seu **GitHub Personal Access Token** (eleva de 60 para 5.000 requisições/hora) ou **GitLab Token**.
3. Clique em **Salvar Configurações**. Seus tokens ficam armazenados com segurança no `chrome.storage.local` do seu próprio navegador.

---
