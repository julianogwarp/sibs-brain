import type { Tweet } from "@sibs/core";
import { collections } from "../client";

export async function saveTweet(tweet: Tweet): Promise<void> {
  const { tweets } = await collections();
  await tweets.replaceOne({ _id: tweet._id }, tweet, { upsert: true });
}

/** Tweet mais novo, mais antigo e total no banco (null se ainda não há nenhum). */
export async function tweetBounds(): Promise<{ newest: Tweet; oldest: Tweet; count: number } | null> {
  const { tweets } = await collections();
  const [newest, oldest, count] = await Promise.all([
    tweets.find().sort({ createdAt: -1 }).limit(1).next(),
    tweets.find().sort({ createdAt: 1 }).limit(1).next(),
    tweets.countDocuments(),
  ]);
  return newest && oldest ? { newest, oldest, count } : null;
}

/** Tweets das conversas, em ordem cronológica. */
export async function tweetsOfConversations(conversationIds: string[]): Promise<Tweet[]> {
  const { tweets } = await collections();
  return tweets.find({ conversationId: { $in: conversationIds } }).sort({ createdAt: 1 }).toArray();
}
