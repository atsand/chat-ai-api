
import { DB } from './config/database.js';
import { CHATS, USERS } from './db/schema.js';
import { ChatCompletionMessage } from "openai/resources";
import { eq } from "drizzle-orm";
import express, { Request, Response } from "express";
import { StreamChat } from "stream-chat";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const APP = express();

APP.use(cors());
APP.use(express.json());
APP.use(express.urlencoded({ extended: false }));

// Initialize Stream Client
const CHAT_CLIENT = StreamChat.getInstance(process.env.STREAM_API_KEY!, process.env.STREAM_API_SECRET!);
// Initialize Open AI
const OPEN_AI = new OpenAI({ apiKey: process.env.OPEN_AI_API_KEY! });

// Register user with Stream Chat
APP.post('/register-user', async (req: Request, res: Response): Promise<any> => {
  const { name, email } = req.body;


  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  try {
    const USER_ID = email.replace(/[^a-zA-Z0-9_-]/g, '_');
    
    // Check if user exists
    const USER_RESPONSE = await CHAT_CLIENT.queryUsers({ id: { $eq: USER_ID } });

    if (!USER_RESPONSE.users?.length) {
      // Add new user to stream
      await CHAT_CLIENT.upsertUser({
        id: USER_ID,
        name: name,
        email: email,
        role: 'user'
      });
    }

    // Check for existing uer in db
    const EXISTING_USER = await DB
      .select()
      .from(USERS)
      .where(eq(USERS.userId, USER_ID));

    if (!EXISTING_USER.length) {
      console.log(`User ${USER_ID} does not exist in db. Adding new user.`);
      await DB.insert(USERS).values({ userId: USER_ID, name, email });
    }
    
    res.status(200).json({ USER_ID, name, email });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
})

// Send message to OpenAi
APP.post('/chat', async (req: Request, res: Response): Promise<any> => {
  const { message, userId } = req.body;

  if (!message || !userId) {
    return res.status(400).json({ error: 'Message and userId are required' });
  }

  try {
    // Verify user exists
    const USER_RESPONSE = await CHAT_CLIENT.queryUsers({ id: userId });

    if (!USER_RESPONSE.users?.length) {
      return res.status(404).json({ error: 'User not found. Please register first.' });
    }

    // Send message to OpenAi GPT-4
    const RESPONSE = await OPEN_AI.chat.completions.create({
      model: 'gpt-4.1',
      messages: [{ role: 'user', content: message }]
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

const PORT = process.env.PORT || 5000;

APP.listen(PORT, () => console.log(`Server running on ${PORT}`));