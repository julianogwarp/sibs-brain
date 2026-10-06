/**
 * Temas iniciais da wiki. O jev escolhe entre estes + os que já existem no Mongo.
 * Edite à vontade; quando o jev responder "new_topic", a LLM sugere um tema novo.
 */
export const SEED_TOPICS: Record<string, { name: string; description: string }> = {
  tecnologia: { name: "Tecnologia", description: "Software, IA, produtos e ferramentas" },
  negocios: { name: "Negócios", description: "Empresas, startups, mercado e carreira" },
  ideias: { name: "Ideias", description: "Reflexões, filosofia e modelos mentais" },
};

/**
 * Temas que não queremos mais. O worker apaga página, tema e revisões e devolve os posts
 * deles para a fila de classificação, para irem para os temas que restam.
 */
export const REMOVED_TOPICS: string[] = ["vida"];

export const NEW_TOPIC = "new_topic";
