import "dotenv/config";

import app from "./app.js";
import connectDb from "./config/connectDb.js";
import { startSwitchListener } from "./agents/switchListener.js";

const port = Number(process.env.PORT ?? 3000);

await connectDb();
startSwitchListener();
app.listen(port, () => console.log(`Server listening on port ${port}`));
