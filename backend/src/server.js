require('dotenv').config();
const connectDB = require('./config/db');
const app = require('./app');

const PORT = process.env.PORT || 5000;

(async () => {
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not set. Copy .env.example to .env and set it.');
    process.exit(1);
  }
  await connectDB(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ai_assessment');
  app.listen(PORT, () => console.log(`API running on http://localhost:${PORT} (AI: ${process.env.AI_PROVIDER || 'mock'})`));
})().catch((e) => { console.error(e); process.exit(1); });
