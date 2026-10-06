/**
 * Subcategorias das categorias maiores. O jev escolhe uma delas para cada post publicado na categoria;
 * com pouca confiança o post fica em "Outros". Edite à vontade: o worker reclassifica o que mudou.
 */
export const SUBTOPICS: Record<string, Record<string, { name: string; description: string }>> = {
  tecnologia: {
    ia: { name: "IA", description: "Inteligência artificial, LLMs, agentes, prompts e modelos" },
    stacks: { name: "Stacks e ferramentas", description: "Linguagens, frameworks, bibliotecas e ferramentas de desenvolvimento" },
    backend: { name: "Backend", description: "APIs, servidores, serviços, filas e infraestrutura de backend" },
    frontend: { name: "Frontend", description: "Interfaces, web, mobile, React e experiência do usuário" },
    "banco-de-dados": { name: "Banco de dados", description: "Bancos de dados, SQL, NoSQL, modelagem e performance de dados" },
    arquitetura: { name: "Arquitetura", description: "Arquitetura de software, design de sistemas, escalabilidade e código limpo" },
    carreira: { name: "Carreira dev", description: "Carreira de desenvolvedor, mercado de trabalho, times e aprendizado" },
  },
  negocios: {
    startups: { name: "Startups", description: "Fundar e crescer startups, produto, tração e cultura" },
    b2b: { name: "B2B", description: "Vender e construir para empresas, SaaS e clientes corporativos" },
    fintech: { name: "Fintech", description: "Pagamentos, bancos, Pix, crédito e serviços financeiros" },
    vendas: { name: "Vendas", description: "Vendas, marketing, distribuição e aquisição de clientes" },
    investimentos: { name: "Investimentos", description: "Investidores, venture capital, rodadas e valuation" },
    gestao: { name: "Gestão", description: "Liderança, gestão de pessoas, contratação e operação" },
  },
};

/** Slug usado para posts que não se encaixam em nenhuma subcategoria. */
export const OTHER_SUBTOPIC = "outros";
