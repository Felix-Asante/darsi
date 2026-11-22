import { z } from "zod";
import { emailSchema } from "../_shared/auth.schemas";

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: "required" }),
});

export type SignInValues = z.infer<typeof signInSchema>;
