import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import todoRoutes from "./routes/todos.js";
import collaboratorRoutes from "./routes/collaborators.js";
import { startReminderScheduler } from "./reminders.js";

if (!process.env.JWT_SECRET) {
  console.error("Missing JWT_SECRET in server/.env");
  process.exit(1);
}

if (!process.env.RESEND_API_KEY) {
  console.warn("RESEND_API_KEY not set - emails will be logged to the console instead of sent.");
}

if (!process.env.GOOGLE_CLIENT_ID) {
  console.warn("GOOGLE_CLIENT_ID not set - Google sign-in will fail until it's configured.");
}

const app = express();

app.use(cors(process.env.CLIENT_ORIGIN ? { origin: process.env.CLIENT_ORIGIN } : undefined));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/todos", todoRoutes);
app.use("/api/collaborators", collaboratorRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true }));

startReminderScheduler();

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
