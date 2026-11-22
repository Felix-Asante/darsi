import { z } from "zod";
import { emailSchema, newPasswordSchema } from "../_shared/auth.schemas";

export const signUpSchema = z.object({
  name: z.string().trim().min(1, { error: "required" }).max(120),
  email: emailSchema,
  password: newPasswordSchema,
});

export type SignUpValues = z.infer<typeof signUpSchema>;
