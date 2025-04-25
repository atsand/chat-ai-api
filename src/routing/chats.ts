import { DB } from '../config/database.js';
import { CHATS, USERS } from '../db/schema.js';
import { desc, eq } from "drizzle-orm";
import { Request, Response } from "express";
import { ChatCompletionMessageParam } from "openai/resources.mjs";
import { StreamChat } from "stream-chat";
import type express from "express";
import OpenAI from "openai";

// Initialize Stream Client
const CHAT_CLIENT = StreamChat.getInstance(process.env.STREAM_API_KEY!, process.env.STREAM_API_SECRET!);
// Initialize Open AI
const OPEN_AI = new OpenAI({ apiKey: process.env.OPEN_AI_API_KEY! });

export default function (APP: express.Application) {

// Send message to OpenAi
APP.post('/chat', async (req: Request, res: Response): Promise<any> => {
  const { message, userId } = req.body ?? {};

  if (!message || !userId) {
    return res.status(400).json({ error: 'Message and userId are required' });
  }

  try {
    // Verify user exists
    const USER_RESPONSE = await CHAT_CLIENT.queryUsers({ id: userId });

    if (!USER_RESPONSE.users?.length) {
      return res.status(404).json({ error: 'User not found. Please register first.' });
    }

    // Fetch users past messages for context
    const RECENT_HISTORY = await DB
      .select()
      .from(CHATS)
      .where(eq(CHATS.userId, userId))
      .orderBy(desc(CHATS.createdAt))
      .limit(10);
    
    // Re-order by createdAt asc
    const SORTED_HISTORY = RECENT_HISTORY.sort((a, b) => {
      return a.createdAt.getTime() - b.createdAt.getTime();
    })
    
    // Format chat history for OpenAi context
    const CONVERSATION: ChatCompletionMessageParam[] = SORTED_HISTORY.flatMap((chat) => {
      return [
        {
          content: chat.reply,
          role: 'assistant'
        },
        {
          content: chat.message,
          role: 'user'
        }
      ]
    });

    // Add latest message to the conversation
    CONVERSATION.push({ role: 'user', content: message });

    // Send message to OpenAi GPT-4
    const RESPONSE = await OPEN_AI.chat.completions.create({
      model: 'gpt-4.1',
      messages: CONVERSATION as ChatCompletionMessageParam[]
    });

    // Check for existing uer in db
    const EXISTING_USER = await DB
      .select()
      .from(USERS)
      .where(eq(USERS.userId, userId));

    if (!EXISTING_USER.length) {
      return res.status(404).json({ error: 'User not found in database. Please register first.' });
    }

    const AI_MESSAGE = RESPONSE?.choices?.[0]?.message?.content ?? 'No response from AI';

    // Save message to db
    await DB.insert(CHATS).values({ userId, message, reply: AI_MESSAGE, });

    // Create or get channel
    const CHANNEL = CHAT_CLIENT.channel('messaging', `chat-${userId}`, {
      name: 'AI Chat',
      created_by_id: 'ai_bot'
    });

    await CHANNEL.create();
    await CHANNEL.sendMessage({ text: AI_MESSAGE, user_id: 'ai_bot' });

    res.status(200).json({ reply: AI_MESSAGE });
  } catch (error) {
    console.log('Error generating AI response', error);

    res.status(500).json({ error: 'Internal Server Error' });
  }
})

// Get chat history for a user
  APP.post('/get-messages', async (req: Request, res: Response): Promise<any> => {
    const { userId } = req.body ?? {};

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required ' });
  }

  try {
    const CHAT_HISTORY = await DB
      .select()
      .from(CHATS)
      .where(eq(CHATS.userId, userId));
    
    res.status(200).json({ messages: CHAT_HISTORY });
  } catch (error) {
    console.log('Error getting chat history', error);

    res.status(500).json({ error: 'Internal Server Error' });
  }
})
}