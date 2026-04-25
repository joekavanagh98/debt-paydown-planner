import { buildApp } from "./app.js";

const PORT = Number(process.env.PORT ?? 3001);

const app = buildApp();

app.listen(PORT, () => {
  console.log(`v5-backend listening on port ${PORT}`);
});
