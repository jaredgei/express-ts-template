import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../utils/database';
import { users, selectUserSchema, insertUserSchema } from '../models/user';

// GET /api/users
export const getUsersResponseSchema = z.object({
  users: z.array(selectUserSchema),
});

export const getUsersHandler = async (_request: Request, response: Response) => {
  const allUsers = await db.select().from(users);
  response.status(200).json({ users: allUsers });
};

// POST /api/users
export const createUserBodySchema = insertUserSchema.pick({
  name: true,
  email: true,
});

export const createUserResponseSchema = z.object({
  user: selectUserSchema,
});

export const createUserHandler = async (request: Request, response: Response) => {
  const { name, email } = request.body;

  const [newUser] = await db.insert(users).values({ name, email }).returning();

  response.status(201).json({ user: newUser });
};
