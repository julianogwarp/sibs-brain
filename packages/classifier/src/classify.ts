import { choice, noul, TypeSafeClient } from "@typesafe-ai/sdk";
import { OTHER_SUBTOPIC, TWEET_KINDS, type JevResult, type Thread, type TweetKind } from "@sibs/core";
import { adjustSpend } from "@sibs/db";
import { NEW_TOPIC } from "./seed-topics";

const KIND_DESCRIPTIONS: Record<TweetKind, string> = {
  opinion: "Opinião ou posicionamento do autor",
  insight: "Ideia, aprendizado ou explicação com valor duradouro",
  news: "Notícia ou comentário sobre algo do momento",
  reference: "Indicação de link, livro, ferramenta ou pessoa",
  personal: "Fato da vida pessoal do autor",
  conversation: "Resposta casual, piada ou interação sem conteúdo próprio",
  other: "Nada acima",
};

// US$ 0,042 por milhão de tokens de entrada; saída grátis
const USD_PER_INPUT_TOKEN = 0.042 / 1_000_000;

export class Classifier {
  private readonly client = new TypeSafeClient();
  private readonly usdBrl = Number(process.env.USD_BRL ?? 5.5);

  /** `topics`: slug → descrição (seed + temas que já existem). */
  async classify(thread: Thread, topics: Record<string, string>): Promise<JevResult> {
    const response = await this.client.systemOne({
      state: { thread: thread.text },
      questions: {
        topic: choice("Qual é o tema principal deste texto?", {
          ...topics,
          [NEW_TOPIC]: "Nenhum dos temas acima se aplica",
        }),
        kind: choice("Que tipo de conteúdo é este?", KIND_DESCRIPTIONS),
        relevant: noul("Este texto tem conteúdo que vale registrar numa wiki sobre o autor?"),
      },
    });

    const { topic, kind, relevant } = response.answers;
    await adjustSpend("jev", response.usage.input_tokens * USD_PER_INPUT_TOKEN * this.usdBrl, { countCall: true });

    const relevantConfidence = Math.max(relevant.noul, 1 - relevant.noul);
    return {
      topic: topic.choice,
      kind: TWEET_KINDS.includes(kind.choice as TweetKind) ? (kind.choice as TweetKind) : "other",
      relevant: relevant.noul >= 0.5,
      // O tipo não decide nada na wiki, então a dúvida nele não justifica chamar a LLM
      confidence: Math.min(topic.confidence, relevantConfidence),
      relevantConfidence,
    };
  }

  /**
   * Escolhe a subcategoria do post dentro da categoria. Com confiança abaixo de `minConfidence`
   * (ou se o jev disser que nenhuma serve) devolve "outros".
   */
  async classifySubtopic(
    thread: Thread,
    subtopics: Record<string, { name: string; description: string }>,
    minConfidence = 0.5,
  ): Promise<{ slug: string; confidence: number }> {
    const options = Object.fromEntries(Object.entries(subtopics).map(([slug, s]) => [slug, `${s.name}: ${s.description}`]));
    const response = await this.client.systemOne({
      state: { thread: thread.text },
      questions: {
        subtopic: choice("Qual é o assunto específico deste texto?", {
          ...options,
          [OTHER_SUBTOPIC]: "Nenhum dos assuntos acima",
        }),
      },
    });
    await adjustSpend("jev", response.usage.input_tokens * USD_PER_INPUT_TOKEN * this.usdBrl, { countCall: true });

    const { choice: slug, confidence } = response.answers.subtopic;
    return { slug: confidence >= minConfidence && slug in subtopics ? slug : OTHER_SUBTOPIC, confidence };
  }
}
