import { createApp } from './create-app.js';

const port = Number(process.env.PORT ?? 3333);

const app = await createApp();
await app.listen(port);
console.log(`API ouvindo em http://localhost:${port}`);
