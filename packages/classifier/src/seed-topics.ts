/**
 * Temas iniciais da wiki. O jev escolhe entre estes + os que já existem no Mongo.
 * Edite à vontade; quando o jev responder "new_topic", a LLM sugere um tema novo.
 */
export const SEED_TOPICS: Record<string, { name: string; description: string }> = {
  tecnologia: { name: "Tecnologia", description: "Software, IA, produtos e ferramentas" },
  negocios: { name: "Negócios", description: "Empresas, startups, mercado e carreira" },
  ideias: { name: "Ideias", description: "Reflexões, filosofia e modelos mentais" },
};

// Temas removidos ficam em @sibs/core (a web também precisa deles)
export { REMOVED_TOPICS, isRemovedTopic } from "@sibs/core";

export const NEW_TOPIC = "new_topic";
