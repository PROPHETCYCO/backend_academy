import express from "express";
import { getAllTeamSummaries, getRealtimeReferralPoints, getTeamSummary, getUserWithReferrals , searchTreeUsers , getUserCouponCode } from "../controllers/referralController.js";
import { bulkGenerateReferralCoupons , getGeneratedCoupons } from "../controllers/couponController.js";
const router = express.Router();

// Real-time points endpoint
router.post("/realtime", getRealtimeReferralPoints);  // Fetch real-time referral points
router.get("/team-summary/all", getAllTeamSummaries);
router.post("/searchtree", searchTreeUsers);
router.post("/teamsummary", getTeamSummary);
router.get("/coupon/:userId", getUserCouponCode);
router.get("/:userId", getUserWithReferrals);  // Fetch user and their referrals (TREE)

router.post(
  "/admin/bulk-generate-coupons",
  bulkGenerateReferralCoupons
);
router.get("/admin/coupons", getGeneratedCoupons);

export default router;