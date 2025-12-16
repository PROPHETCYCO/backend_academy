// import express from 'express';
// import cors from 'cors';
// import dotenv from 'dotenv';
// import helmet from 'helmet';
// import morgan from 'morgan';
// import Razorpay from "razorpay";

// import connectDB from "./config/db.js";
// import adminRoutes from "./routes/adminRoutes.js";
// import bankDetailsRoutes from "./routes/bankDetailsRoutes.js";
// import userRoutes from "./routes/userRoutes.js";
// import payoutRoutes from "./routes/payoutRoutes.js";
// import referralRoutes from "./routes/referralRoutes.js";
// import rankRoutes from "./routes/rankRoutes.js";


// dotenv.config();

// const app = express();

// export const instance = new Razorpay({
//     key_id: process.env.RAZORPAY_API_KEY,
//     key_secret: process.env.RAZORPAY_API_SECRET
// })

// // Middleware
// app.use(express.json());
// app.use(cors());
// app.use(helmet()); // add security headers
// app.use(morgan("dev")); // log incoming requests

// // Connect to MongoDB
// connectDB();

// // Default route
// app.get("/", (req, res) => {
//     res.send("API is running...");
// });

// //Routes
// app.use("/api/users", userRoutes);
// app.use("/api/referral", referralRoutes);
// app.use("/api/payout", payoutRoutes);
// app.use("/api/bankdetails", bankDetailsRoutes);
// app.use("/api/admin", adminRoutes);
// app.use("/api/rank", rankRoutes);

// // Start server
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, '0.0.0.0', () => {
//     console.log(`✅ Server running on port ${PORT}`);
// });



import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import Razorpay from "razorpay";
import connectDB from "./config/db.js";
import adminRoutes from "./routes/adminRoutes.js";
import bankDetailsRoutes from "./routes/bankDetailsRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import payoutRoutes from "./routes/payoutRoutes.js";
import referralRoutes from "./routes/referralRoutes.js";
import rankRoutes from "./routes/rankRoutes.js";
import bodyParser from "body-parser";
import { razorpayWebhook } from "./controllers/checkoutController.js";
dotenv.config();
const app = express();
app.post(
    "/api/razorpay/webhook",
    bodyParser.raw({ type: "application/json" }),
    razorpayWebhook
);
export const instance = new Razorpay({
    key_id: process.env.RAZORPAY_API_KEY,
    key_secret: process.env.RAZORPAY_API_SECRET
})
// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet()); // add security headers
app.use(morgan("dev")); // log incoming requests
// Connect to MongoDB
connectDB();
// Default route
app.get("/", (req, res) => {
    res.send("API is running...");
});
//Routes
app.use("/api/users", userRoutes);
app.use("/api/referral", referralRoutes);
app.use("/api/payout", payoutRoutes);
app.use("/api/bankdetails", bankDetailsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/rank", rankRoutes);
// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`:white_tick: Server running on port ${PORT}`);
});