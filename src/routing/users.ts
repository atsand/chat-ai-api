
import type express from "express";
import { Request, Response } from "express";
import { DB } from '../config/database.js';
import { eq } from "drizzle-orm";
import { StreamChat } from "stream-chat";
import { USERS } from '../db/schema.js';

// Initialize Stream Client
const CHAT_CLIENT = StreamChat.getInstance(process.env.STREAM_API_KEY!, process.env.STREAM_API_SECRET!);

export default function (APP: express.Application) {
  // Register user with Stream Chat
  APP.post('/register-user', async (req: Request, res: Response): Promise<any> => {
    const { name, email } = req.body ?? {};
  
  
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
}