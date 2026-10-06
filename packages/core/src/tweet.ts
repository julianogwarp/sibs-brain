import { z } from "zod";

export const TweetSchema = z.object({
  _id: z.string(), // id do tweet na X
  authorId: z.string(),
  text: z.string(),
  createdAt: z.coerce.date(),
  conversationId: z.string(),
  inReplyToTweetId: z.string().nullable(),
  quotedTweetId: z.string().nullable(),
  urls: z.array(z.string()),
  metrics: z.object({
    likes: z.number(),
    retweets: z.number(),
    replies: z.number(),
    quotes: z.number(),
  }),
  fetchedAt: z.coerce.date(),
});
export type Tweet = z.infer<typeof TweetSchema>;

export const ThreadSchema = z.object({
  _id: z.string(), // conversationId
  tweetIds: z.array(z.string()), // em ordem cronológica
  text: z.string(), // tweets concatenados, usado na classificação
  startedAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Thread = z.infer<typeof ThreadSchema>;
