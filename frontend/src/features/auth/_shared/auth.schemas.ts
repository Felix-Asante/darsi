import { z } from "zod";

export const emailSchema = z.email({ error: "email" });
export const newPasswordSchema = z
  .string()
  .min(10, { error: "passwordLength" })
  .max(128);
