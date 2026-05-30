import { Request, Response } from 'express';
import { z } from 'zod';

export const exampleQuerySchema = z.object({
  test: z
    .string({
      error: 'Test must be a string.',
    })
    .describe('A test string param'),
  test2: z.coerce
    .number({
      error: 'Test2 must be a number.',
    })
    .describe('A test numeric param'),
});

export const exampleResponseSchema = z.object({
  test: z.string(),
  test2: z.number(),
});

export const exampleHandler = async (request: Request, response: Response) => {
  // request.query has been parsed and casted (e.g. test2 is a number) by the validator middleware!
  const data = request.query;
  response.status(200).send(data);
};
