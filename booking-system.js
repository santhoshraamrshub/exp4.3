const express = require("express");
const cors = require("cors");
const { createClient } = require("redis");
const app = express();
app.use(cors());
app.use(express.json());
const redisClient = createClient({
url: process.env.REDIS_URL
});
redisClient.on("error", (err) => {
    console.error("Redis Client Error", err);
});
(async () => {
    await redisClient.connect();
    console.log("Connected to Redis");
})();
const TOTAL_SEATS = 50;
app.post("/api/book", async (req, res) => {
    const seatNumber = req.body.seat;
    const lockKey = `lock:seat:${seatNumber}`;
    const bookedKey = `booked:seat:${seatNumber}`;
    try {
        const alreadyBooked = await redisClient.get(bookedKey);
        if (alreadyBooked) {
            return res.status(400).json({
                success: false,
                message: "Seat already permanently booked"
            });
        }
        const lock = await redisClient.set(lockKey, "locked", {
            NX: true,
            EX: 10
        });
        if (!lock) {
            return res.status(400).json({
                success: false,
                message: "Seat is currently being booked by someone else"
            });
        }
        await redisClient.set(bookedKey, "true");
        return res.status(200).json({
            success: true,
            bookingId: Date.now(),
            seat: seatNumber
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
});
app.get("/api/seats", async (req, res) => {
    try {
        let bookedSeats = [];
        for (let i = 1; i <= TOTAL_SEATS; i++) {
            const booked = await redisClient.get(`booked:seat:${i}`);
            if (booked) bookedSeats.push(i);
        }
        res.json({
            totalSeats: TOTAL_SEATS,
            bookedSeats,
            remainingSeats: TOTAL_SEATS - bookedSeats.length
        });
    } catch (err) {
        res.status(500).json({ error: "Error fetching seats" });
    }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
console.log(`Booking system running on port ${PORT}`);
});
app.get("/api/reset", async (req, res) => {
    try {
        for (let i = 1; i <= TOTAL_SEATS; i++) {
            await redisClient.del(`booked:seat:${i}`);
            await redisClient.del(`lock:seat:${i}`);
        }
        res.json({
            success: true,
            message: "All seats have been reset"
        });
    } catch (err) {
        res.status(500).json({ error: "Error resetting seats" });
    }
});
app.get("/", (req, res) => {
res.send("Ticket Booking System API is running 🚀");
});