import ChatRoutes from './chats.js';
import UserRoutes from './users.js'
import type express from "express";

export default function (APP: express.Application) {
  ChatRoutes(APP);
  UserRoutes(APP);
}