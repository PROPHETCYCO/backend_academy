import express from "express";
import { getAllTeamSummaries, getRealtimeReferralPoints, getTeamSummary, getUserWithReferrals } from "../controllers/referralController.js";

const router = express.Router();

// Real-time points endpoint
router.post("/realtime", getRealtimeReferralPoints);  // Fetch real-time referral points
router.get("/team-summary/all", getAllTeamSummaries);
router.post("/teamsummary", getTeamSummary);
router.get("/:userId", getUserWithReferrals);  // Fetch user and their referrals (TREE)


export default router;