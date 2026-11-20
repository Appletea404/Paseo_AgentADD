import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

const agentId = z.string().regex(/^[A-Za-z0-9_-]+$/);

export const attachAgent = defineRpc({
  name: "omp-child.attach",
  input: z.object({ parentId: agentId, childId: agentId }),
  output: z.object({ title: z.string() }),
});
