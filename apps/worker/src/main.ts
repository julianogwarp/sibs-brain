import { closeDb } from "@sibs/db";
import { runPipeline } from "./pipeline";

// Execução local (npm run worker): sem prazo
runPipeline()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(closeDb);
