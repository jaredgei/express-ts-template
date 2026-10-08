export const logJson = (fields: Record<string, unknown>, error = false) =>
  (error ? console.error : console.log)(JSON.stringify({ timestamp: new Date().toISOString(), ...fields }));
