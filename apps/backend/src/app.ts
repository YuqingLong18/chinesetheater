import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { router } from './routes/index.js';

export const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('dev'));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api', router);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // Basic error response; in production log more details
    console.error(err);
    res.status(500).json({ message: '服务器内部错误' });
  });

  return app;
};
