import "./load-env";
import { getAvailability } from "../src/lib/calendar";

async function main() {
  const slots = await getAvailability();
  console.log(JSON.stringify({ count: slots.length, slots: slots.slice(0, 5) }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
