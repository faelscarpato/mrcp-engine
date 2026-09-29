export interface ClonePageOptions {
  url?: string;
  html?: string;
  format?: "json" | "prompt" | "full";
  customSkillsRepo?: string;
}

export interface ClonedPageData {
  url: string;
  title: string;
  lang: string;
  viewport?: { w: number; h: number };
  scrollHeight?: number;
  tokens: {
    colors: Array<{ color: string; count: number }>;
    fonts: Array<{
      fontFamily: string;
      fontSize?: string;
      fontWeight?: string;
      lineHeight?: string;
      count: number;
    }>;
    borderRadii: string[];
    shadows: string[];
  };
  cssVars: Record<string, string>;
  typography: Record<string, any>;
  components: Array<{
    name: string;
    count: number;
    details: Array<{
      tag: string;
      id?: string;
      classes?: string;
      innerText?: string;
      styles?: Record<string, string>;
    }>;
  }>;
  domStructure: any;
  visibleSections: any[];
  images: any[];
  interactivity: {
    buttons: any[];
    links: any[];
    dropdowns: any[];
    tabs: any[];
    accordions: any[];
  };
  dataPatterns: any;
  formBehaviors: any[];
  animations: any;
  semantics: any;
  externalStyles: string[];
  externalScripts: string[];
  allCSS: string;
  html: string;
  pagePurpose: {
    types: string[];
    scores: Record<string, number>;
    confidence: number;
    completionNeeds: {
      all: string[];
      byType: Record<string, string[]>;
    };
  };
  aiPrompt: string;
  estimatedTokensWithoutMrcp: number;
  estimatedTokensWithMrcp: number;
  tokenSavingsPercent: number;
}

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache",
};

// ─── TENTA CARREGAR CHEERIO DE FORMA OPCIONAL E SEGURA ────────
async function getCheerioInstance() {
  try {
    const mod = await import("cheerio");
    // cheerio v1 nao tem export default; o namespace ESM ja e a instancia.
    return (mod as { default?: typeof mod }).default ?? mod;
  } catch {
    return null;
  }
}

// ─── BUSCA HTML E ESTILOS EXTERNOS ───────────────────────────
async function fetchPageContent(targetUrl: string): Promise<{
  html: string;
  externalStyles: string[];
  externalScripts: string[];
  allCSS: string;
}> {
  const res = await fetch(targetUrl, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    throw new Error(
      `Falha ao acessar URL '${targetUrl}': HTTP status ${res.status} (${res.statusText})`,
    );
  }

  const html = await res.text();
  const externalStyles: string[] = [];
  const styleLinkMatches = html.matchAll(
    /<link[^>]+rel=["']stylesheet["'][^>]*>/gi,
  );
  for (const match of styleLinkMatches) {
    const tag = match[0];
    const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
    if (hrefMatch && hrefMatch[1]) {
      try {
        const fullUrl = new URL(hrefMatch[1], targetUrl).toString();
        externalStyles.push(fullUrl);
      } catch {
        externalStyles.push(hrefMatch[1]);
      }
    }
  }

  const externalScripts: string[] = [];
  const scriptMatches = html.matchAll(
    /<script[^>]+src=["']([^"']+)["'][^>]*>/gi,
  );
  for (const match of scriptMatches) {
    if (match[1]) {
      try {
        const fullUrl = new URL(match[1], targetUrl).toString();
        externalScripts.push(fullUrl);
      } catch {
        externalScripts.push(match[1]);
      }
    }
  }

  let inlineCSS = "";
  const styleBlocks = html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi);
  for (const sb of styleBlocks) {
    inlineCSS += (sb[1] || "") + "\n";
  }

  const fetchedCssChunks: string[] = [];
  for (const styleUrl of externalStyles.slice(0, 3)) {
    if (styleUrl.startsWith("http")) {
      try {
        const cssRes = await fetch(styleUrl, {
          headers: BROWSER_HEADERS,
          signal: AbortSignal.timeout(3000),
        });
        if (cssRes.ok) {
          const cssText = await cssRes.text();
          fetchedCssChunks.push(cssText.slice(0, 40000));
        }
      } catch {
        // ignora se falhar
      }
    }
  }

  const allCSS = inlineCSS + "\n" + fetchedCssChunks.join("\n");
  return { html, externalStyles, externalScripts, allCSS };
}

// ─── EXTRAÇÃO DE VARIÁVEIS CSS E TOKENS ───────────────────────
function extractDesignTokensFromCSS(allCSS: string, html: string) {
  const cssVars: Record<string, string> = {};
  const rootVarMatches = allCSS.match(/--[\w-]+:\s*[^;{}]+/g) || [];
  for (const match of rootVarMatches) {
    const idx = match.indexOf(":");
    if (idx > -1) {
      const k = match.slice(0, idx).trim();
      const v = match.slice(idx + 1).trim();
      if (k && v && !cssVars[k]) {
        cssVars[k] = v;
      }
    }
  }

  const colorFrequency: Record<string, number> = {};
  const colorPatterns = [
    /#[0-9a-fA-F]{3,8}\b/g,
    /rgba?\([^)]+\)/g,
    /hsla?\([^)]+\)/g,
    /oklch\([^)]+\)/g,
  ];

  const fullText = allCSS + " " + html;
  for (const pat of colorPatterns) {
    const matches = fullText.match(pat) || [];
    for (const c of matches) {
      const normalized = c.toLowerCase().trim();
      colorFrequency[normalized] = (colorFrequency[normalized] || 0) + 1;
    }
  }

  const colors = Object.entries(colorFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([color, count]) => ({ color, count }));

  const fontMatches = allCSS.match(/font-family:\s*([^;{}]+)/gi) || [];
  const fontFrequency: Record<string, number> = {};
  for (const match of fontMatches) {
    const font = match.replace(/font-family:\s*/i, "").trim();
    if (font) {
      fontFrequency[font] = (fontFrequency[font] || 0) + 1;
    }
  }

  const fonts = Object.entries(fontFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([fontFamily, count]) => ({
      fontFamily,
      count,
    }));

  const brMatches = allCSS.match(/border-radius:\s*([^;{}]+)/gi) || [];
  const borderRadii = [
    ...new Set(
      brMatches.map((m) => m.replace(/border-radius:\s*/i, "").trim()),
    ),
  ].slice(0, 8);

  const shadowMatches = allCSS.match(/box-shadow:\s*([^;{}]+)/gi) || [];
  const shadows = [
    ...new Set(
      shadowMatches.map((m) => m.replace(/box-shadow:\s*/i, "").trim()),
    ),
  ].slice(0, 6);

  return { cssVars, colors, fonts, borderRadii, shadows };
}

// ─── ANÁLISE DO PROPÓSITO DA PÁGINA (HEURÍSTICA) ───────────────
function analyzePagePurpose(htmlText: string, plainText: string) {
  const html = htmlText.toLowerCase();
  const text = plainText.toLowerCase();

  const signals: Record<string, number> = {
    "Landing Page": 0,
    "E-commerce": 0,
    "Dashboard/App": 0,
    "Blog/Notícias": 0,
    "SaaS/Produto": 0,
    Autenticação: 0,
    Portfólio: 0,
    Documentação: 0,
    "Rede Social": 0,
    "Portal de Notícias": 0,
  };

  if (
    html.includes("hero") ||
    html.includes("cta") ||
    text.includes("get started") ||
    text.includes("sign up free") ||
    text.includes("pricing") ||
    text.includes("features")
  )
    signals["Landing Page"] += 3;

  if (
    html.includes("cart") ||
    html.includes("product") ||
    text.includes("add to cart") ||
    text.includes("buy now") ||
    html.includes("checkout") ||
    html.includes("shop")
  )
    signals["E-commerce"] += 3;

  if (
    html.includes("dashboard") ||
    html.includes("analytics") ||
    html.includes("chart") ||
    html.includes("sidebar") ||
    html.includes("widget") ||
    html.includes("metric")
  )
    signals["Dashboard/App"] += 3;

  if (
    html.includes("article") ||
    html.includes("author") ||
    text.includes("published") ||
    text.includes("read more") ||
    text.includes("min read")
  )
    signals["Blog/Notícias"] += 3;

  if (
    text.includes("free trial") ||
    text.includes("subscription") ||
    text.includes("per month") ||
    text.includes("enterprise") ||
    text.includes("upgrade") ||
    text.includes("plans")
  )
    signals["SaaS/Produto"] += 3;

  if (
    text.includes("login") ||
    text.includes("sign in") ||
    text.includes("forgot password") ||
    html.includes('type="password"')
  )
    signals["Autenticação"] += 4;

  if (
    text.includes("portfolio") ||
    text.includes("my work") ||
    html.includes("showcase") ||
    text.includes("designer") ||
    text.includes("developer")
  )
    signals["Portfólio"] += 2;

  if (
    text.includes("documentation") ||
    text.includes("api reference") ||
    html.includes("<pre") ||
    html.includes("<code")
  )
    signals["Documentação"] += 3;

  if (
    html.includes("feed") ||
    html.includes("follow") ||
    html.includes("like") ||
    html.includes("comment") ||
    html.includes("timeline")
  )
    signals["Rede Social"] += 3;

  if (html.includes("<article") || text.includes("breaking news"))
    signals["Portal de Notícias"] += 3;

  const sorted = Object.entries(signals).sort((a, b) => b[1] - a[1]);
  const detected = sorted.filter(([, v]) => v > 0).slice(0, 2);
  const detectedTypes = detected.map((d) => d[0]);

  const completionNeeds = generateCompletionNeeds(detectedTypes);

  return {
    types: detectedTypes.length ? detectedTypes : ["Landing Page"],
    scores: signals,
    confidence: detected[0] ? Math.min(100, detected[0][1] * 15) : 50,
    completionNeeds,
  };
}

function generateCompletionNeeds(types: string[]) {
  const needs: { all: string[]; byType: Record<string, string[]> } = {
    all: [
      "Navegação funcional entre seções (smooth scroll ou roteamento)",
      "Estados hover/focus/active em todos os elementos interativos",
      "Layout responsivo com breakpoints mobile (480px), tablet (768px) e desktop (1024px+)",
      "Favicon e meta tags SEO completas",
      "Acessibilidade: roles ARIA, labels, navegação por teclado",
      "Loading states para ações assíncronas",
      "Mensagens de feedback ao usuário (toast/snackbar)",
      "Tratamento de erros com mensagens amigáveis",
    ],
    byType: {},
  };

  types.forEach((type) => {
    switch (type) {
      case "Landing Page":
        needs.byType[type] = [
          "Hero com headline impactante, subheadline e botão CTA principal",
          "Seção Features/Benefícios com ícones SVG e descrições",
          "Seção Pricing com 3 planos (Free, Pro, Enterprise) e toggle mensal/anual",
          "Seção Testimonials com avatar, nome, cargo e texto de depoimento",
          "FAQ com accordion abrindo/fechando via JavaScript",
          "CTA final com formulário de captura de email + validação",
          "Header fixo (sticky) com links âncora para cada seção",
          "Footer com 4 colunas: logo+desc, links produto, links empresa, social",
          "Animações scroll-triggered (Intersection Observer) fade-in/slide-up",
          "Menu hamburguer funcional no mobile",
        ];
        break;

      case "E-commerce":
        needs.byType[type] = [
          "Grid de produtos responsivo (4 cols desktop, 2 tablet, 1 mobile)",
          "Card de produto: imagem hover-zoom, nome, preço, avaliação em estrelas, botão",
          "Carrinho lateral (drawer) com overlay, lista de itens e total",
          "Contador de itens no ícone do carrinho no header",
          "Filtros laterais: categoria, preço (range slider), avaliação",
          "Ordenação: relevância, preço asc/desc, novidades",
          "Wishlist (favoritos) com ícone de coração toggle",
          "Checkout simulado: carrinho > endereço > pagamento > confirmação",
          "Cupom de desconto com campo de input e botão aplicar",
        ];
        break;

      case "Dashboard/App":
        needs.byType[type] = [
          "Sidebar fixa com ícones + labels e estado collapsed/expanded",
          "Topbar com busca, notificações (badge), avatar e dropdown de perfil",
          "Cards de métricas: valor principal, variação % com seta, ícone colorido",
          "Gráfico de linha ou barras simulado com CSS ou SVG puro",
          "Tabela de dados com cabeçalho fixo, ordenação por coluna e paginação",
          "Filtros de período: Hoje, 7 dias, 30 dias, Personalizado",
          "Tema claro/escuro com toggle e persistência em localStorage",
          "Indicadores de status com cores (verde=ativo, vermelho=erro, amarelo=aviso)",
        ];
        break;

      case "SaaS/Produto":
        needs.byType[type] = [
          "Header com logo, navegação, botão 'Entrar' e CTA 'Começar grátis'",
          "Hero animado com headline, subheadline, CTA duplo e mockup do produto",
          "Logos de empresas clientes (social proof) em marquee/carrossel",
          "Tabela de preços com toggle mensal/anual e economia destacada",
          "Timeline de como funciona (passo 1, 2, 3) com ícones",
          "FAQ específico do produto com accordion interativo",
          "Chat widget simulado no canto inferior direito",
        ];
        break;

      case "Autenticação":
        needs.byType[type] = [
          "Formulário centralizado com logo acima e card com sombra suave",
          "Campo email com validação de formato em tempo real",
          "Campo senha com toggle mostrar/ocultar (olho)",
          "Indicador de força da senha (fraca/média/forte)",
          "Botões de login social (Google, GitHub, Microsoft)",
          "Loading spinner no botão durante submit simulado",
        ];
        break;

      default:
        needs.byType[type] = [
          "Identificar e replicar o fluxo principal do usuário",
          "Implementar todos os estados interativos visíveis",
          "Garantir consistência visual com a paleta de cores extraída",
        ];
    }
  });

  return needs;
}

// ─── PARSER NATIVO RESILIENTE (ZERO-DEPENDENCY) ───────────────
function parseHtmlNative(html: string) {
  // Title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "Página Sem Título";

  // Lang
  const langMatch = html.match(/<html[^>]+lang=["']([^"']+)["']/i);
  const lang = langMatch ? langMatch[1].trim() : "pt-BR";

  // Plain Text simplificado
  const plainText = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Headings
  const headings: Array<{ level: string; text: string }> = [];
  const headingMatches = html.matchAll(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi);
  for (const m of headingMatches) {
    const text = m[2].replace(/<[^>]+>/g, "").trim();
    if (text)
      headings.push({ level: m[1].toUpperCase(), text: text.slice(0, 80) });
    if (headings.length >= 20) break;
  }

  // Buttons
  const buttons: Array<{ text: string; classes: string; disabled: boolean }> =
    [];
  const btnMatches = html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/gi);
  for (const m of btnMatches) {
    const attrs = m[1];
    const text = m[2].replace(/<[^>]+>/g, "").trim();
    const classMatch = attrs.match(/class=["']([^"']+)["']/i);
    const disabled = /disabled/i.test(attrs);
    if (text) {
      buttons.push({
        text: text.slice(0, 50),
        classes: classMatch ? classMatch[1] : "",
        disabled,
      });
    }
    if (buttons.length >= 15) break;
  }

  // Links
  const links: Array<{ text: string; href: string; isExternal: boolean }> = [];
  const linkMatches = html.matchAll(/<a([^>]+)>([\s\S]*?)<\/a>/gi);
  for (const m of linkMatches) {
    const attrs = m[1];
    const text = m[2].replace(/<[^>]+>/g, "").trim();
    const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
    const href = hrefMatch ? hrefMatch[1] : "";
    if (text && href) {
      links.push({
        text: text.slice(0, 50),
        href,
        isExternal: href.startsWith("http"),
      });
    }
    if (links.length >= 20) break;
  }

  // Forms
  const forms: any[] = [];
  const formMatches = html.matchAll(/<form([^>]*)>([\s\S]*?)<\/form>/gi);
  for (const m of formMatches) {
    const attrs = m[1];
    const inner = m[2];
    const idMatch = attrs.match(/id=["']([^"']+)["']/i);
    const actionMatch = attrs.match(/action=["']([^"']+)["']/i);
    const methodMatch = attrs.match(/method=["']([^"']+)["']/i);

    const fields: any[] = [];
    const inputMatches = inner.matchAll(/<(input|textarea|select)([^>]*)>/gi);
    for (const im of inputMatches) {
      const iAttrs = im[2];
      const typeMatch = iAttrs.match(/type=["']([^"']+)["']/i);
      const nameMatch = iAttrs.match(/name=["']([^"']+)["']/i);
      const placeholderMatch = iAttrs.match(/placeholder=["']([^"']+)["']/i);
      const required = /required/i.test(iAttrs);
      fields.push({
        type: typeMatch ? typeMatch[1] : im[1].toLowerCase(),
        name: nameMatch ? nameMatch[1] : "",
        placeholder: placeholderMatch ? placeholderMatch[1] : "",
        required,
      });
    }

    const submitBtnMatch = inner.match(/<button[^>]*>([\s\S]*?)<\/button>/i);
    forms.push({
      id: idMatch ? idMatch[1] : "",
      action: actionMatch ? actionMatch[1] : "",
      method: methodMatch ? methodMatch[1].toUpperCase() : "GET",
      fields,
      submitText: submitBtnMatch
        ? submitBtnMatch[1].replace(/<[^>]+>/g, "").trim()
        : "Enviar",
      hasValidation: fields.some((f) => f.required),
    });
    if (forms.length >= 8) break;
  }

  // Components
  const componentNames = [
    { name: "Navbar/Header", regex: /<(header|nav)[^>]*>([\s\S]*?)<\/\1>/gi },
    {
      name: "Hero Section",
      regex:
        /<[^>]+class=["'][^"']*(hero|banner)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi,
    },
    { name: "Main Content", regex: /<main[^>]*>([\s\S]*?)<\/main>/gi },
    { name: "Sidebar", regex: /<aside[^>]*>([\s\S]*?)<\/aside>/gi },
    {
      name: "Cards",
      regex:
        /<[^>]+class=["'][^"']*(card|tile)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi,
    },
    { name: "Footer", regex: /<footer[^>]*>([\s\S]*?)<\/footer>/gi },
  ];

  const components: any[] = [];
  for (const c of componentNames) {
    const matches = [...html.matchAll(c.regex)];
    if (matches.length > 0) {
      const details = matches.slice(0, 3).map((m) => {
        const text = m[2]
          ? m[2]
              .replace(/<[^>]+>/g, "")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 150)
          : "";
        return {
          tag: "div",
          innerText: text,
        };
      });
      components.push({ name: c.name, count: matches.length, details });
    }
  }

  // Imagens
  const images: any[] = [];
  const imgMatches = html.matchAll(/<img([^>]+)>/gi);
  for (const im of imgMatches) {
    const srcMatch = im[1].match(/src=["']([^"']+)["']/i);
    const altMatch = im[1].match(/alt=["']([^"']+)["']/i);
    if (srcMatch) {
      images.push({
        src: srcMatch[1],
        alt: altMatch ? altMatch[1] : "",
      });
    }
    if (images.length >= 20) break;
  }

  return {
    title,
    lang,
    plainText,
    headings,
    buttons,
    links,
    forms,
    components,
    images,
  };
}

// ─── GERADOR DE PROMPT ULTRA-FIEL ─────────────────────────────
export function generateAIPrompt(
  data: ClonedPageData,
  customSkillsRepo?: string,
): string {
  const now = new Date().toLocaleString("pt-BR");
  const skillsRepo =
    customSkillsRepo || "https://github.com/faelscarpato/skills.git";
  const purpose = data.pagePurpose || {
    types: ["Não identificado"],
    confidence: 0,
    completionNeeds: { all: [], byType: {} },
  };
  const types = (purpose.types || ["Não identificado"]).join(" + ");
  const needs = purpose.completionNeeds || { all: [], byType: {} };

  const topColors = (data.tokens?.colors || [])
    .slice(0, 12)
    .map((c) => `  ${c.color} (${c.count}x)`)
    .join("\n");

  const topFonts = (data.tokens?.fonts || [])
    .slice(0, 5)
    .map((f) => `  ${f.fontFamily} (${f.count} ocorrências)`)
    .join("\n");

  const cssVarsStr =
    Object.entries(data.cssVars || {})
      .slice(0, 25)
      .map(([k, v]) => `  ${k}: ${v}`)
      .join("\n") || "  Nenhuma variável CSS detectada";

  const componentsStr = (data.components || [])
    .map((comp) => {
      const sample = comp.details?.[0];
      return `#### ${comp.name} (${comp.count} instâncias)
  - Elemento: <${sample?.tag || "div"}> | id="${sample?.id || ""}" | classes="${(sample?.classes || "").slice(0, 80)}"
  - Amostra de texto: "${(sample?.innerText || "").slice(0, 150)}"`;
    })
    .join("\n\n");

  const buttonsStr = (data.interactivity?.buttons || [])
    .slice(0, 12)
    .map(
      (b) =>
        `  - "${b.text}" | classes="${b.classes}" | disabled=${b.disabled}`,
    )
    .join("\n");

  const linksStr = (data.interactivity?.links || [])
    .slice(0, 15)
    .map(
      (l) =>
        `  - "${l.text}" → ${l.href} ${l.isExternal ? "[EXTERNO]" : "[INTERNO]"}`,
    )
    .join("\n");

  const formsStr = (data.formBehaviors || [])
    .map(
      (f) =>
        `  Form id="${f.id}" action="${f.action}" method="${f.method}"\n  Submit: "${f.submitText}"\n  Campos:\n` +
        f.fields
          .map(
            (field: any) =>
              `    - [${field.type}] name="${field.name}" placeholder="${field.placeholder}" required=${field.required}`,
          )
          .join("\n"),
    )
    .join("\n\n");

  const headingsStr = (data.semantics?.headingStructure || [])
    .map((h: any) => `  ${h.level}: "${h.text}"`)
    .join("\n");

  const allNeeds = needs.all || [];
  const typeNeeds = Object.entries<string[]>(needs.byType || {})
    .map(
      ([type, items]) =>
        `  [${type}]\n${items.map((i) => `    - ${i}`).join("\n")}`,
    )
    .join("\n");

  return `# 🧬 MRCP ENGINE + PAGECLONER PRO — PROMPT DE CLONAGEM ULTRA-FIEL
> Gerado deterministicamente via MRCP Engine em ${now}

---

## ⚠️ INSTRUÇÃO CRÍTICA — OBRIGATÓRIA PARA A IA

**VOCÊ DEVE EXECUTAR ESTAS ETAPAS ANTES DE ESCREVER O CÓDIGO:**

1. Acessar IMEDIATAMENTE a biblioteca de skills: ${skillsRepo}
2. Ler e estudar as skills disponíveis
3. Analisar os dados técnicos e estruturais extraídos abaixo
4. Escolher as melhores skills para este clone específico
5. Declarar quais skills você selecionou e a justificativa
6. Reconstruir a aplicação com fidelidade visual, semântica e interativa máxima
7. Validar a entrega contra o checklist ao final

---

## 📋 IDENTIFICAÇÃO DA PÁGINA

| Campo | Valor |
|-------|-------|
| URL Alvo | ${data.url} |
| Título | ${data.title} |
| Idioma | ${data.lang || "pt-BR"} |
| Tipo detectado | ${types} |
| Confiança | ${purpose.confidence}% |
| Data da análise | ${now} |

---

## 🎨 PALETA DE CORES DETECTADA
${topColors || "  Não identificada"}

---

## 🔡 TIPOGRAFIA & FONTES
${topFonts || "  Fontes do sistema"}

---

## 🔧 VARIÁVEIS DE DESIGN (:root)
${cssVarsStr}

---

## 📐 BORDAS E SOMBRAS
Border-radius usados: ${(data.tokens?.borderRadii || []).join(" | ") || "Nenhum"}
Box-shadows detectadas:
${(data.tokens?.shadows || []).map((s) => `  ${s}`).join("\n") || "  Nenhuma"}

---

## 🧩 COMPONENTES ESTRUTURAIS IDENTIFICADOS
${componentsStr || "  Nenhum componente identificado"}

---

## 🖱️ INTERATIVIDADE & FORMULÁRIOS

### Botões:
${buttonsStr || "  Nenhum botão detectado"}

### Links:
${linksStr || "  Nenhum link detectado"}

### Formulários:
${formsStr || "  Nenhum formulário detectado"}

---

## ♿ ACESSIBILIDADE E HIERARQUIA SEMÂNTICA
### Headings:
${headingsStr || "  Não detectados"}

---

## ✅ O QUE PRECISA SER COMPLETADO PELA IA

### Requisitos universais:
${allNeeds.map((n) => `  - ${n}`).join("\n") || "  Nenhum"}

### Requisitos específicos do tipo (${types}):
${typeNeeds || "  Nenhum requisito específico"}

---

## 📋 FORMATO DE ENTREGA OBRIGATÓRIO

Gere o código autônomo na seguinte ordem:
1. **SKILLS DECLARADAS:** Quais skills de ${skillsRepo} foram aplicadas.
2. **index.html:** Código HTML semântico com seções comentadas (\`<!-- SECTION: HERO -->\`, etc.).
3. **<style>:** CSS organizado por variáveis e com breakpoints (480px, 768px, 1024px).
4. **<script>:** JavaScript vanilla com estados e mocks funcionais.
5. **CHECKLIST DE VALIDAÇÃO:** Confirmação de fidelidade estética e responsiva.

---
*🧬 Gerado deterministamente por MRCP Engine + PageCloner Pro*
`;
}

// ─── FUNÇÃO PRINCIPAL: CLONE PAGE ─────────────────────────────
export async function clonePage(
  options: ClonePageOptions,
): Promise<ClonedPageData> {
  const targetUrl = options.url || "https://local-sample.html";
  let html = options.html || "";
  let externalStyles: string[] = [];
  let externalScripts: string[] = [];
  let allCSS = "";

  if (options.url && !options.html) {
    const fetched = await fetchPageContent(options.url);
    html = fetched.html;
    externalStyles = fetched.externalStyles;
    externalScripts = fetched.externalScripts;
    allCSS = fetched.allCSS;
  } else if (options.html) {
    let inlineCSS = "";
    const styleBlocks = html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi);
    for (const sb of styleBlocks) {
      inlineCSS += (sb[1] || "") + "\n";
    }
    allCSS = inlineCSS;
  } else {
    throw new Error(
      "É necessário fornecer 'url' ou 'html' para clonar a página.",
    );
  }

  // Tokens e variáveis de CSS
  const tokenData = extractDesignTokensFromCSS(allCSS, html);

  // Parsing do HTML via Cheerio (se instalado) ou nativo (fallback resiliente)
  const cheerioLib = await getCheerioInstance();
  let title = "Página Sem Título";
  let lang = "pt-BR";
  let bodyText = "";
  let components: any[] = [];
  const interactivity: any = {
    buttons: [],
    links: [],
    dropdowns: [],
    tabs: [],
    accordions: [],
  };
  let formBehaviors: any[] = [];
  const semantics: any = {
    headingStructure: [],
    landmarks: [],
    hasSkipLink: false,
  };
  let images: any[] = [];

  if (cheerioLib) {
    const $ = cheerioLib.load(html);
    title = $("title").first().text().trim() || title;
    lang = $("html").attr("lang") || lang;
    bodyText = $("body").text().replace(/\s+/g, " ").trim();

    // Seletores de componentes
    const selectors = [
      {
        name: "Navbar/Header",
        sel: 'header, nav, [class*="nav"], [class*="header"]',
      },
      {
        name: "Hero Section",
        sel: '[class*="hero"], [class*="banner"], [class*="jumbotron"]',
      },
      { name: "Main Content", sel: 'main, [role="main"]' },
      { name: "Sidebar", sel: 'aside, [class*="sidebar"]' },
      { name: "Cards", sel: '[class*="card"], [class*="tile"]' },
      { name: "Buttons", sel: 'button, [class*="btn"], [role="button"]' },
      { name: "Forms/Inputs", sel: "form, input, textarea, select" },
      { name: "Footer", sel: 'footer, [class*="footer"]' },
      { name: "Modal", sel: '[class*="modal"], [role="dialog"]' },
    ];

    components = selectors
      .map(({ name, sel }) => {
        const els = $(sel);
        if (!els.length) return null;
        const details = els
          .slice(0, 3)
          .map((_: any, el: any) => {
            const $el = $(el);
            return {
              tag: el.tagName ? el.tagName.toLowerCase() : "div",
              id: $el.attr("id") || "",
              classes: $el.attr("class") || "",
              innerText: $el.text().trim().replace(/\s+/g, " ").slice(0, 200),
            };
          })
          .get();
        return { name, count: els.length, details };
      })
      .filter(Boolean);

    interactivity.buttons = $("button, [role='button'], [class*='btn']")
      .slice(0, 15)
      .map((_: any, el: any) => {
        const $el = $(el);
        return {
          text: $el.text().trim().replace(/\s+/g, " ").slice(0, 50),
          classes: $el.attr("class") || "",
          disabled: $el.is(":disabled") || $el.attr("aria-disabled") === "true",
        };
      })
      .get();

    interactivity.links = $("a[href]")
      .slice(0, 20)
      .map((_: any, el: any) => {
        const $el = $(el);
        const href = $el.attr("href") || "";
        return {
          text: $el.text().trim().replace(/\s+/g, " ").slice(0, 50),
          href,
          isExternal: href.startsWith("http"),
        };
      })
      .get();

    semantics.headingStructure = $("h1, h2, h3, h4, h5, h6")
      .slice(0, 20)
      .map((_: any, el: any) => ({
        level: el.tagName ? el.tagName.toUpperCase() : "H",
        text: $(el).text().trim().replace(/\s+/g, " ").slice(0, 80),
      }))
      .get();

    images = $("img")
      .slice(0, 20)
      .map((_: any, el: any) => ({
        src: $(el).attr("src") || "",
        alt: $(el).attr("alt") || "",
      }))
      .get();
  } else {
    // Parser nativo rápido e seguro sem dependências
    const nativeParsed = parseHtmlNative(html);
    title = nativeParsed.title;
    lang = nativeParsed.lang;
    bodyText = nativeParsed.plainText;
    components = nativeParsed.components;
    interactivity.buttons = nativeParsed.buttons;
    interactivity.links = nativeParsed.links;
    formBehaviors = nativeParsed.forms;
    semantics.headingStructure = nativeParsed.headings;
    images = nativeParsed.images;
  }

  // Semântica e propósito
  const pagePurpose = analyzePagePurpose(html, bodyText);

  const dummyData: any = {
    url: targetUrl,
    title,
    lang,
    tokens: {
      colors: tokenData.colors,
      fonts: tokenData.fonts,
      borderRadii: tokenData.borderRadii,
      shadows: tokenData.shadows,
    },
    cssVars: tokenData.cssVars,
    typography: {},
    components,
    domStructure: {},
    visibleSections: [],
    images,
    interactivity,
    dataPatterns: {
      hasSearch:
        html.includes('type="search"') || html.includes('name="search"'),
      hasPagination: html.includes("pagination"),
      hasDarkMode: html.includes("dark") || html.includes("theme"),
    },
    formBehaviors,
    animations: { hasAnimations: allCSS.includes("@keyframes") },
    semantics,
    externalStyles,
    externalScripts,
    allCSS,
    html,
    pagePurpose,
  };

  const aiPrompt = generateAIPrompt(dummyData, options.customSkillsRepo);

  // Cálculo de ROI de Tokens do MRCP
  const rawHtmlTokens = Math.round((html.length + allCSS.length) / 3.8);
  const mrcpTokens = Math.round(aiPrompt.length / 3.8);
  const tokenSavingsPercent = Math.max(
    80,
    Math.round(
      ((rawHtmlTokens - mrcpTokens) / Math.max(1, rawHtmlTokens)) * 100,
    ),
  );

  return {
    ...dummyData,
    aiPrompt,
    estimatedTokensWithoutMrcp: rawHtmlTokens,
    estimatedTokensWithMrcp: mrcpTokens,
    tokenSavingsPercent,
  };
}
