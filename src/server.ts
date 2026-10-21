import "dotenv/config";
import express from "express";
import authRouter from "./routes/auth.routes.js";
import combinedBookingRouter from "./routes/combined-booking.routes.js";
import dashboardRouter from "./routes/dashboard.routes.js";
import hotelRouter from "./routes/hotel.routes.js";
import notificationRouter from "./routes/notification.routes.js";
import mediaRouter from "./routes/media.routes.js";
import reportRouter from "./routes/report.routes.js";
import reservationRouter from "./routes/reservation.routes.js";
import restaurantRouter from "./routes/restaurant.routes.js";
import roomRouter from "./routes/room.routes.js";
import tableRouter from "./routes/table.routes.js";
import userRouter from "./routes/user.routes.js";


const app = express();

const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean)
);

app.use((req, res, next) => {
  const origin = req.get("Origin");
  if (!origin) { next(); return; }

  res.vary("Origin");
  if (!allowedOrigins.has(origin)) {
    if (req.method === "OPTIONS") { res.sendStatus(403); return; }
    next();
    return;
  }

  res.setHeader("Access-Control-Allow-Origin", origin);
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/hotels", hotelRouter);
app.use("/api/restaurants", restaurantRouter);
app.use("/api/rooms", roomRouter);
app.use("/api/tables", tableRouter);
app.use("/api/reservations", reservationRouter);
app.use("/api/combined-bookings", combinedBookingRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/media", mediaRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/reports", reportRouter);

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

app.get("/", (req, res) => {
  res.json({ message: "Hotel Restaurant Management API" });
});

app.listen(PORT, HOST, () => {
  console.log(`Server running on port ${PORT}`);
});
