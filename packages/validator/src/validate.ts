import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { env, TWEET_KINDS, type JevResult, type Thread, type ValidatorVerdict } from "@sibs/core";
import { adjustSpend, reserveBudget } from "@sibs/db";

const VerdictOutput = z.object({
  verdict: z.enum(["approved", "corrected", "uncertain"]),
  topic: z.string().describe("slug do tema final (existente ou novo, em kebab-case)"),
  new_topic_name: z.string().nullable().describe("nome legível, só se o tema for novo"),
  new_topic_description: z.string().nullable(),
  kind: z.enum(TWEET_KINDS),
  relevant: z.boolean(),
  reasoning: z.string().describe("justificativa curta, em português"),
});

export interface Validation extends ValidatorVerdict {
  newTopic: { name: string; description: string } | null;
}

const MAX_OUTPUT_TOKENS = 4_000; // inclui os tokens de raciocínio

const INSTRUCTIONS = `Você revisa a classificação automática de tweets que vão alimentar uma wiki sobre um único autor.
Um classificador rápido (jev) já sugeriu tema, tipo e relevância, mas ficou com pouca confiança.
Decida:
- "approved": a sugestão está certa.
- "corrected": está errada e você sabe a resposta certa (preencha os campos corrigidos).
- "uncertain": não dá para decidir com segurança; um humano vai revisar.
Prefira um tema existente. Só crie um tema novo se nenhum servir, e então preencha new_topic_name e new_topic_description.`;

export class Validator {
  private readonly client = new OpenAI();
  // Preço em US$ por milhão de tokens; ajuste se trocar de modelo

  async validate(thread: Thread, jev: JevResult, topics: Record<string, string>): Promise<Validation> {
    const worstCaseBrl = this.costBrl(this.estimateInputTokens(thread.text), MAX_OUTPUT_TOKENS);
    await reserveBudget("llm", worstCaseBrl, env().LLM_MONTHLY_BUDGET_BRL);

    let response;
    try {
      response = await this.client.responses.parse({
        model: env().VALIDATOR_MODEL,
        instructions: INSTRUCTIONS,
        // Parte estável (temas) primeiro e a variável (thread) no fim: a OpenAI reaproveita o prefixo em cache
        input: `<temas_existentes>\n${JSON.stringify(topics)}\n</temas_existentes>\n\n<sugestao_do_jev>${JSON.stringify(jev)}</sugestao_do_jev>\n\n<texto>\n${thread.text}\n</texto>`,
        prompt_cache_key: "sibs-validator",
        reasoning: { effort: env().VALIDATOR_EFFORT },
        max_output_tokens: MAX_OUTPUT_TOKENS,
        text: { format: zodTextFormat(VerdictOutput, "verdict") },
        store: false,
      });
    } catch (err) {
      await adjustSpend("llm", -worstCaseBrl);
      throw err;
    }

    const usage = response.usage;
    const actualBrl = usage ? this.costBrl(usage.input_tokens, usage.output_tokens) : worstCaseBrl;
    await adjustSpend("llm", actualBrl - worstCaseBrl);

    const out = response.status === "completed" ? response.output_parsed : null;
    if (!out) {
      const why = response.incomplete_details?.reason ?? response.status;
      return {
        verdict: "uncertain",
        topic: jev.topic,
        kind: jev.kind,
        relevant: jev.relevant,
        reasoning: `Sem resposta válida da LLM (${why})`,
        model: response.model,
        newTopic: null,
      };
    }

    return {
      verdict: out.verdict,
      topic: out.topic,
      kind: out.kind,
      relevant: out.relevant,
      reasoning: out.reasoning,
      model: response.model,
      newTopic:
        out.new_topic_name && !(out.topic in topics)
          ? { name: out.new_topic_name, description: out.new_topic_description ?? "" }
          : null,
    };
  }

  /** Estimativa conservadora: ~1 token a cada 3 caracteres + 2k de instruções/temas. */
  private estimateInputTokens(text: string): number {
    return Math.ceil(text.length / 3) + 2_000;
  }

  private costBrl(inputTokens: number, outputTokens: number): number {
    const e = env();
    return ((inputTokens * e.VALIDATOR_USD_PER_MTOK_INPUT + outputTokens * e.VALIDATOR_USD_PER_MTOK_OUTPUT) / 1_000_000) * e.USD_BRL;
  }
}
