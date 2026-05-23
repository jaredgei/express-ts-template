import { Request, Response } from 'express';
import { checkSchema, matchedData } from 'express-validator';

// GET
export const exampleValidator = checkSchema({
  test: {
    isString: { errorMessage: 'Test must be a string.' },
  },
  test2: {
    isNumeric: { errorMessage: 'Test2 must be a number.' },
  },
});

export const exampleHandler = async (request: Request, response: Response) => {
  const data = matchedData(request);
  response.status(200).send(data);
};
