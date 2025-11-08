import Payout from "../models/Payout.js";
import User from "../models/User.js";
import { calculateRealtimeReferralPoints } from "../utils/calculateReferralPoints.js";

// ✅ POST /api/payout/run → runs payout for ALL users

// ✅ Helper function to convert UTC → IST readable format
const formatIST = (utcDate) => {
    return new Date(utcDate).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
};

// ✅ POST /api/payout/run → runs payout for ALL users
export const runGlobalPayout = async (req, res) => {
    try {
        console.log("Running global payout process...");

        const users = await User.find({});
        if (!users.length) {
            return res.status(404).json({ success: false, message: "No users found" });
        }

        const allPayouts = [];

        for (const user of users) {
            const referredPoints = await calculateRealtimeReferralPoints(user.userId);
            const totalPoints = referredPoints;
            const deduction = totalPoints * 0.05;
            const payoutAmount = totalPoints - deduction;

            // New payout entry
            const payoutEntry = {
                amount: totalPoints,
                payoutAmount: payoutAmount,
                status: "pending",
            };

            // Create or update user's payout record
            let payoutRecord = await Payout.findOne({ userId: user.userId });

            if (!payoutRecord) {
                payoutRecord = new Payout({
                    userId: user.userId,
                    name: user.name,
                    totalPoints: totalPoints,
                    referredPoints: 0,          // reset to 0 after payout
                    directReferredPoints: 0,    // reset to 0 after payout
                    payouts: [payoutEntry],
                });
            } else {
                payoutRecord.totalPoints += totalPoints;
                payoutRecord.referredPoints = 0;
                payoutRecord.directReferredPoints = 0;
                payoutRecord.payouts.push(payoutEntry);
            }

            await payoutRecord.save();

            // Reset referredPoints after payout
            //user.referredPoints = 0;
            user.selfPoints = 0;
            await user.save();

            // ✅ Add formatted IST date to response
            allPayouts.push({
                userId: user.userId,
                name: user.name,
                payoutAmount: totalPoints,
                date: formatIST(payoutEntry.date),
                status: payoutEntry.status,
            });
        }

        // ✅ Final response
        res.status(200).json({
            success: true,
            message: "Global payout generated successfully",
            totalUsers: allPayouts.length,
            payouts: allPayouts,
        });
    } catch (error) {
        console.error("Error during global payout:", error);
        res.status(500).json({
            success: false,
            message: "Error generating global payout",
            error: error.message,
        });
    }
};


//payout for single user
export const getUserPayouts = async (req, res) => {
    try {
        const { userId } = req.params;
        const payouts = await Payout.find({ userId });

        if (!payouts.length) {
            return res.status(404).json({ message: "No payout records found for this user" });
        }

        res.status(200).json({
            success: true,
            message: "Payout records fetched successfully",
            data: payouts,
        });
    } catch (error) {
        console.error("Error fetching payout data:", error);
        res.status(500).json({ success: false, message: "Failed to fetch payout details" });
    }
};


//update payout sttaus by id
export const updatePayoutStatus = async (req, res) => {
    try {
        const { userId, payoutId } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ success: false, message: "Status is required" });
        }

        const validStatuses = ["pending", "completed", "failed"];
        if (!validStatuses.includes(status.toLowerCase())) {
            return res.status(400).json({ success: false, message: "Invalid status value" });
        }

        // Find user payout record
        const payoutRecord = await Payout.findOne({ userId });
        if (!payoutRecord) {
            return res.status(404).json({ success: false, message: "No payout record found for this user" });
        }

        // Find the specific payout inside the array
        const payout = payoutRecord.payouts.id(payoutId);
        if (!payout) {
            return res.status(404).json({ success: false, message: "Payout entry not found" });
        }

        // Update status
        payout.status = status.toLowerCase();

        // Save document
        await payoutRecord.save();

        res.status(200).json({
            success: true,
            message: `Payout status updated to ${status}`,
            data: payoutRecord,
        });
    } catch (error) {
        console.error("Error updating payout status:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update payout status",
            error: error.message,
        });
    }
};


//all payouts
export const getAllPayouts = async (req, res) => {
    try {
        // Fetch all payout records sorted by most recent first
        const allPayouts = await Payout.find().sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: "All user payouts fetched successfully",
            data: allPayouts,
        });
    } catch (error) {
        console.error("Get All Payouts Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch payouts",
            error: error.message,
        });
    }
};