import { createServer } from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();
const server = createServer(app);

const port = env.PORT || 4000;

server.listen(port, () => {
  console.log(`服务器已启动，端口: ${port}`);
});
