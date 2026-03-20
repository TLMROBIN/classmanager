import { z } from "zod";

export const loginBodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(1)
});
