import express from "express";
import type { Request, Response } from "express";

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`v5-backend listening on port ${PORT}`);
});
