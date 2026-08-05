import { createApp } from './app';

const port = Number(process.env.PORT ?? 3001);
const baseUrl = process.env.BASE_URL ?? `http://localhost:${port}`;

createApp({ baseUrl }).listen(port, () => {
  console.log(`url-shortener listening on ${baseUrl}`);
});
