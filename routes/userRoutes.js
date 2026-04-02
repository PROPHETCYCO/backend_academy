import express from "express";
import { getAadharPhoto, getAllUsers, getReferredSelfPoints, getuser_by_id, getUserFullDetails, loginUser, registerUser, testEmail, updateUserDetails, updateUserStatus } from "../controllers/userController.js";
import upload from "../middleware/upload.js";
import { checkout, getorderdetails_by_userid, getUserCheckoutDetails, paymentverification_students } from "../controllers/checkoutController.js";
import {watchvideo, getWatchedVideos, submitQuiz , getProgress} from "../controllers/userController.js";
const router = express.Router();

router.post(
  "/register",
  upload.fields([
    { name: "aadharFront", maxCount: 1 },
    { name: "aadharBack", maxCount: 1 },
    { name: "panPhoto", maxCount: 1 },
  ]),
  registerUser
); // for registering user
router.post("/login", loginUser);  // foir login user
router.post("/full-details", getUserFullDetails);  //fetch full user details by user id
router.get("/:id/aadharPhoto", getAadharPhoto);  //particularly fetch user

router.post("/checkout", checkout);
router.post("/paymentverification_students", paymentverification_students);
router.post("/getuserdetails", getuser_by_id);   //fetch user details by id
router.post("/getorderdetailsbyuser", getorderdetails_by_userid);  //fetch order details by user id
router.get("/all", getAllUsers);  //fetch all users
// router.put("/update/:userId", updateUserDetails);  
router.put(
  "/update/:userId",
  upload.fields([
    { name: "aadharFront", maxCount: 1 },
    { name: "aadharBack", maxCount: 1 },
    { name: "panPhoto", maxCount: 1 },
    { name: "passbookPhoto", maxCount: 1 },
  ]),
  updateUserDetails
);  //update user details by id
router.put("/status/:userId", updateUserStatus);  //update user status by id
router.get("/:userId", getUserCheckoutDetails);  //fetch checkout details by user id


router.get("/referred-selfpoints/:userId", getReferredSelfPoints); //fetch referred and self points for a user
router.post("/email-test", testEmail); //test email sending
router.post("/watch-video", watchvideo); //track video watching progress
router.post("/get-watched-videos", getWatchedVideos); //fetch all watched videos for a user
router.post("/submit-quiz", submitQuiz);
router.post("/get-progress", getProgress);
export default router;