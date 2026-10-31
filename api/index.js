/**
 * Vercel serverless entry — must default-export an Express app (or (req,res) => {}).
 * Prefer compiled dist so routes match production build.
 */
import app from "../dist/app.js";
export default app;
