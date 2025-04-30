import { Request, Response } from 'express-serve-static-core';
import { checkSchema, matchedData, validationResult } from 'express-validator';

// GET
export const exampleValidator = checkSchema({
  test: {
    isString: { errorMessage: 'Test must be a string.' }
  },
  test2: {
    isNumeric: { errorMessage: 'Test2 must be a number.' }
  }
});
export const exampleHandler = async (request: Request, response: Response) => {
  const errors = validationResult(request);
  if (!errors.isEmpty()) return response.status(400).json({ errors: errors.array()[0].msg });
  const data = matchedData(request);
  response.status(200).send(data);
};
