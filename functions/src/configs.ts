import { defineSecret } from "firebase-functions/params";

export const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

export const SECRETS = [OPENAI_API_KEY];