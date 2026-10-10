import 'dotenv/config';
import express from 'express';
import vaani from './routes/vaani.js';
import booking from './routes/booking.js';
import dashboard from './routes/dashboard.js';

const app = express();
app.use(express.json({ limit: '5mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/webhook/vaani', vaani);
app.use('/api/dashboard', dashboard); // must come before the Vaani-secret routes below
app.use('/api', booking);
app.use('/dashboard', express.static(new URL('../dashboard', import.meta.url).pathname));
app.get('/', (_req, res) => res.redirect('/dashboard/'));

// On Vercel the app is exported and run as a serverless function; locally we start a normal server.
if (!process.env.VERCEL) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Aangan Studio server running on http://localhost:${port}`));
}

export default app;
