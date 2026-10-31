import { createUiApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = createUiApp();
app.listen(config.port, () => {
  console.log(`StatusGrep UI on :${config.port} → API ${config.apiBaseUrl}`);
});
