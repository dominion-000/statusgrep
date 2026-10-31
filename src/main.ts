import app from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
app.listen(config.port, () => {
  console.log(`StatusGrep UI on :${config.port} → API ${config.apiBaseUrl}`);
});
