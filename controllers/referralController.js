import User from "../models/User.js";
import Payout from "../models/Payout.js";
import { calculateRealtimeReferralPoints, calculateReferralPoints } from "../utils/calculateReferralPoints.js";

// GET /api/referral/realtime/:userId
export const getRealtimeReferralPoints = async (req, res) => {
    try {
        const { userId, name } = req.body;

        if (!userId || !name) {
            return res.status(400).json({
                success: false,
                message: "userId and name are required.",
            });
        }

        // ✅ Find the main user
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
            });
        }

        // ✅ Step 1: Calculate Direct Team Points (12% of each direct’s selfPoints)
        let directReferredPoints = 0;

        if (user.referredIds && user.referredIds.length > 0) {
            const directTeam = await User.find({ userId: { $in: user.referredIds } });

            directReferredPoints = directTeam.reduce((total, member) => {
                const points = (member.selfPoints || 0) * 0.12;
                return total + points;
            }, 0);
        }

        // ✅ Step 2: Calculate Multi-level Referral Points
        const referredPoints = await calculateRealtimeReferralPoints(userId);
        const { referralPoints, directReferralPoints } = await calculateReferralPoints(userId);
        const referralPoint = referralPoints + directReferralPoints;

        // ✅ Step 3: Save or Update Payout Record
        let payout = await Payout.findOne({ userId });

        if (!payout) {
            // 🆕 Create new payout record
            payout = new Payout({
                userId,
                name,
                totalPoints: 0, // initialized empty
                referredPoints,
                directReferredPoints,
                payouts: [], // empty array
            });
        } else {
            // 🔁 Update existing payout record but KEEP totalPoints as it is
            payout.referredPoints = referredPoints;
            payout.directReferredPoints = directReferredPoints;
            // ✅ Do not change payout.totalPoints (keep existing value)
        }

        await payout.save();

        // ✅ Step 4: Send Response
        return res.status(200).json({
            success: true,
            message: "Referral and direct points calculated successfully.",
            data: {
                userId,
                name,
                directReferredPoints,
                referredPoints,
                referralPoint,
                directReferralPoints,
                totalPoints: payout.totalPoints, // existing totalPoints retained
            },
        });

    } catch (error) {
        console.error("❌ Error in real-time referral calculation:", error);
        res.status(500).json({
            success: false,
            message: "Error calculating real-time referral points",
            error: error.message,
        });
    }
};



//Tree  Api
export const getUserWithReferrals = async (req, res) => {
    try {
        const { userId } = req.params;

        // Find main user
        const mainUser = await User.findOne({ userId });
        if (!mainUser) {
            return res.status(404).json({ message: "User not found" });
        }

        // Find referred users using referredIds array
        const referredUsers = await User.find({ userId: { $in: mainUser.referredIds } });

        res.status(200).json({
            success: true,
            message: "User and referred users fetched successfully",
            data: {
                mainUser: {
                    userId: mainUser.userId,
                    name: mainUser.name,
                    email: mainUser.email,
                    phone: mainUser.phone,
                    address: mainUser.address,
                    referralLink: mainUser.referralLink,
                    selfPoints: mainUser.selfPoints,
                    //referredPoints: mainUser.referredPoints,
                    //totalPoints: mainUser.totalPoints,
                    status: mainUser.status,
                },
                referredUsers: referredUsers.map(user => ({
                    userId: user.userId,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    address: user.address,
                    selfPoints: user.selfPoints,
                    //referredPoints: user.referredPoints,
                    //totalPoints: user.totalPoints,
                    status: user.status,
                })),
            },
        });
    } catch (error) {
        console.error("Error fetching user and referrals:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch referral details",
            error: error.message,
        });
    }
};


// New API: Get Team Summary
export const getTeamSummary = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "userId is required in request body",
            });
        }

        // Step 1️⃣: Load all users once for optimization
        const allUsers = await User.find({}, { userId: 1, name: 1, referredIds: 1, totalSelfPoints: 1 });
        const userMap = new Map(allUsers.map(u => [u.userId, u]));

        const rootUser = userMap.get(userId);
        if (!rootUser) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        const visited = new Set();

        // Step 2️⃣: Recursive function to calculate team stats
        const calculateTeam = (id, level = 1) => {
            if (level > 10) return { totalPoints: 0, totalDownlineCount: 0 };
            if (visited.has(id)) return { totalPoints: 0, totalDownlineCount: 0 };
            visited.add(id);

            const user = userMap.get(id);
            if (!user || !user.referredIds?.length) return { totalPoints: 0, totalDownlineCount: 0 };

            let totalPoints = 0;
            let totalDownlineCount = 0;

            for (const childId of user.referredIds) {
                const child = userMap.get(childId);
                if (!child) continue;

                totalPoints += child.totalSelfPoints || 0;
                totalDownlineCount += 1;

                const subTree = calculateTeam(childId, level + 1);
                totalPoints += subTree.totalPoints;
                totalDownlineCount += subTree.totalDownlineCount;
            }

            return { totalPoints, totalDownlineCount };
        };

        // Step 3️⃣: Compute team stats
        const { totalPoints, totalDownlineCount } = calculateTeam(userId);

        // Step 4️⃣: Count direct referrals
        const directReferrals = rootUser.referredIds?.length || 0;

        // ✅ Step 5️⃣: Send response
        res.status(200).json({
            success: true,
            userId: rootUser.userId,
            name: rootUser.name, // ✅ root user's name
            totalPoints,
            totalDownlineCount,
            directReferrals,
        });

    } catch (error) {
        console.error("Error in getTeamSummary:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};


// New API: Get All Team Summaries
export const getAllTeamSummaries = async (req, res) => {
    try {
        // Step 1️⃣: Load all users once for optimization
        const allUsers = await User.find({}, { userId: 1, name: 1, referredIds: 1, totalSelfPoints: 1 });
        const userMap = new Map(allUsers.map(u => [u.userId, u]));

        // Step 2️⃣: Recursive function (same as before)
        const calculateTeam = (id, level = 1, visited = new Set()) => {
            if (level > 10) return { totalPoints: 0, totalDownlineCount: 0 };
            if (visited.has(id)) return { totalPoints: 0, totalDownlineCount: 0 };
            visited.add(id);

            const user = userMap.get(id);
            if (!user || !user.referredIds?.length) return { totalPoints: 0, totalDownlineCount: 0 };

            let totalPoints = 0;
            let totalDownlineCount = 0;

            for (const childId of user.referredIds) {
                const child = userMap.get(childId);
                if (!child) continue;

                totalPoints += child.totalSelfPoints || 0;
                totalDownlineCount += 1;

                const subTree = calculateTeam(childId, level + 1, visited);
                totalPoints += subTree.totalPoints;
                totalDownlineCount += subTree.totalDownlineCount;
            }

            return { totalPoints, totalDownlineCount };
        };

        // Step 3️⃣: Loop through every user
        const results = [];
        for (const user of allUsers) {
            const { totalPoints, totalDownlineCount } = calculateTeam(user.userId);
            const directReferrals = user.referredIds?.length || 0;

            results.push({
                userId: user.userId,
                name: user.name,
                totalPoints,
                totalDownlineCount,
                directReferrals,
            });
        }

        // Step 4️⃣: Send all results
        res.status(200).json({
            success: true,
            count: results.length,
            data: results,
        });

    } catch (error) {
        console.error("Error in getAllTeamSummaries:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};