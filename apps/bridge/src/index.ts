import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handleHolds } from './routes/holds';
import { handleAG } from './routes/ag';
import { handleCompliance } from './routes/compliance';

type Bindings = {
  DB: any;
  AG_TOS_OK: string;
  CRA_SRP_LIVE: string;
  R2: any;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors());

app.get('/health', (c) => c.json({ ok: true, service: 'aether-bridge' }));

// v1 compliance routes (CRA Article 14 + AlphaGenome)
app.route('/v1/compliance', handleCompliance);

// Legacy routes
app.route('/v1/holds', handleHolds);
app.route('/v1/ag', handleAG);

app.get('/api/health', (c) => c.json({ ok: true, worker: 'aether-bridge' }));

export default app;