import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Payout from "../models/Payout.js";
import BankDetails from "../models/BankDetails.js";
import Checkout from "../models/Checkout.js";
import CourseDetails from "../models/CourseDetails.js";
import { generateUniqueUserId } from "../utils/generateUserId.js";
import { uploadFileToS3 } from "../utils/uploadToS3.js";
import { generateToken } from "../utils/generateToken.js";

const BASE_REFERRAL_URL = "https://synthosphereacademy.com/register/";


//User Registration
export const registerUser = async (req, res) => {
    try {
        const {
            name,
            phone,
            email,
            address,
            aadharNo,
            panNo,
            password,
            parentId,
        } = req.body;

        // 1️⃣ Basic validation
        if (!name || !phone || !email || !address || !aadharNo || !panNo || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // 2️⃣ Check for duplicates
        const existingUser = await User.findOne({
            $or: [{ phone }, { email }, { aadharNo }, { panNo }],
        });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists with given details" });
        }

        // 3️⃣ Generate UserID and hash password
        const userId = await generateUniqueUserId();
        //const hashedPassword = await bcrypt.hash(password, 10);

        // 4️⃣ Upload images to S3
        let aadharPhotoFrontUrl = null;
        let aadharPhotoBackUrl = null;
        let panPhotoUrl = null;

        if (req.files) {
            if (req.files.aadharFront && req.files.aadharFront[0]) {
                aadharPhotoFrontUrl = await uploadFileToS3(req.files.aadharFront[0], "aadhar-front");
            }
            if (req.files.aadharBack && req.files.aadharBack[0]) {
                aadharPhotoBackUrl = await uploadFileToS3(req.files.aadharBack[0], "aadhar-back");
            }
            if (req.files.panPhoto && req.files.panPhoto[0]) {
                panPhotoUrl = await uploadFileToS3(req.files.panPhoto[0], "pan-photo");
            }
        }

        // 5️⃣ Generate referral link
        const referralLink = `${BASE_REFERRAL_URL}${userId}`;

        // 6️⃣ Create user document
        const newUser = new User({
            userId,
            name,
            phone,
            email,
            address,
            aadharNo,
            aadharPhotoFront: aadharPhotoFrontUrl,
            aadharPhotoBack: aadharPhotoBackUrl,
            panNo,
            panPhoto: panPhotoUrl,
            password,
            referralLink,
            parentId: parentId || null,
        });

        await newUser.save();

        // 7️⃣ Update parent’s referredIds if any
        if (parentId) {
            await User.updateOne({ userId: parentId }, { $push: { referredIds: userId } });
        }

        // await BankDetails.create({
        //     userId,
        //     name,
        //     nameAsPerDocument: name,
        //     bankName: "",
        //     accountNo: "",
        //     branchName: "",
        //     ifscCode: "",
        //     passbookPhoto: "",
        //     status: "pending",
        // });

        // await Payout.create({
        //     userId,
        //     name,
        //     totalPoints: 0,
        //     referredPoints: 0,
        //     directReferredPoints: 0,
        // });

        // await CourseDetails.create({
        //     userId,
        //     name,
        //     courseName: "",
        //     packageName: "",
        //     validityStart: null,
        //     validityEnd: null,
        //     purchaseHistory: [],
        // });

        // 9️⃣ Success response
        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            data: {
                userId,
                name,
                email,
                phone,
                referralLink,
            },
        });
    } catch (error) {
        console.error("❌ Registration Error:", error);
        res.status(500).json({
            success: false,
            message: "Registration failed",
            error: error.message,
        });
    }
};



//Login User
export const loginUser = async (req, res) => {
    try {
        const { emailOrPhone, password } = req.body;

        // 🧩 Basic validation
        if (!emailOrPhone || !password) {
            return res.status(400).json({
                success: false,
                message: "Email/Phone and Password are required.",
            });
        }

        // 🔍 Check if user exists (by email or phone)
        const user = await User.findOne({
            $or: [{ email: emailOrPhone }, { phone: emailOrPhone }],
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
            });
        }

        // 🔐 Compare password using the model method
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials.",
            });
        }

        // 🚫 (Optional) Check if user is active
        // if (user.status !== "active") {
        //     return res.status(403).json({
        //         success: false,
        //         message: "Account not active. Please contact admin.",
        //     });
        // }

        // 🎟️ Generate JWT token
        const token = generateToken(user._id);

        // ✅ Send response
        res.status(200).json({
            success: true,
            message: "Login successful.",
            token,
            user: {
                id: user._id,
                userId: user.userId,
                name: user.name,
                email: user.email,
                phone: user.phone,
                status: user.status,
            },
        });

    } catch (error) {
        console.error("❌ Login Error:", error);
        res.status(500).json({
            success: false,
            message: "Login failed.",
            error: error.message,
        });
    }
};



// Aadhar Photo Api
export const getAadharPhoto = async (req, res) => {
    try {
        const { id } = req.params;

        // Find user by ID (can be MongoDB _id or userId)
        const user = await User.findOne({
            $or: [{ userId: id }, { userId: id }],
        });

        if (!user || !user.aadharPhoto || !user.aadharPhoto.data) {
            return res.status(404).json({ message: "Aadhaar photo not found." });
        }

        // Set content type and send the image buffer
        res.set("Content-Type", user.aadharPhoto.contentType);
        return res.send(user.aadharPhoto.data);

    } catch (error) {
        console.error("Error retrieving Aadhaar photo:", error);
        res.status(500).json({
            message: "Failed to retrieve Aadhaar photo",
            error: error.message,
        });
    }
};


// export const getuser_by_id = async (req, res) => {
//     try {
//         const { userId } = req.body;
//         console.log(userId);
//         const userdetails = await User.findOne({ userId: userId });
//         if (!userdetails) {
//             return res.status(404).json({ error: 'user not found' });
//         }
//         res.status(200).json(userdetails);
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// };

export const getuser_by_id = async (req, res) => {
    try {
        const { userId } = req.body;
        console.log("Requested User ID:", userId);

        // 1️⃣ Fetch main user
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // 2️⃣ Recursive function to get all downline users (no level limit)
        const getAllTeamMembers = async (uId, allMembers = []) => {
            const children = await User.find({ parentId: uId });
            if (children.length === 0) return allMembers;

            for (const child of children) {
                allMembers.push(child);
                await getAllTeamMembers(child.userId, allMembers); // go deeper recursively
            }

            return allMembers;
        };

        // 3️⃣ Get full downline team
        const teamMembers = await getAllTeamMembers(userId);

        // 4️⃣ Calculate team stats
        const totalTeamMembers = teamMembers.length;
        const totalTeamSelfPoints = teamMembers.reduce(
            (sum, member) => sum + (member.selfPoints || 0),
            0
        );

        // 5️⃣ Send response
        res.status(200).json({
            success: true,
            message: "User details with team data fetched successfully",
            // user: {
            //     userId: user.userId,
            //     name: user.name,
            //     email: user.email,
            //     phone: user.phone,
            //     selfPoints: user.selfPoints || 0,
            //     parentId: user.parentId || null,
            // },
            user,
            totalTeamMembers,
            totalTeamSelfPoints,
            // teamMembers: teamMembers.map((m) => ({
            //     userId: m.userId,
            //     name: m.name,
            //     selfPoints: m.selfPoints || 0,
            //     parentId: m.parentId,
            // })),
        });
    } catch (err) {
        console.error("Error in getuser_by_id:", err);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message,
        });
    }
};



//user detail update api
export const updateUserDetails = async (req, res) => {
    try {
        const { userId } = req.params;
        const { name, email, phone, password, aadharNo } = req.body;

        // Find user first
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Build dynamic update object
        const updates = {};

        if (name) updates.name = name;
        if (email) {
            const existingEmail = await User.findOne({ email, userId: { $ne: userId } });
            if (existingEmail) {
                return res.status(400).json({ success: false, message: "Email already in use" });
            }
            updates.email = email;
        }
        if (phone) {
            const existingPhone = await User.findOne({ phone, userId: { $ne: userId } });
            if (existingPhone) {
                return res.status(400).json({ success: false, message: "Phone number already in use" });
            }
            updates.phone = phone;
        }
        if (aadharNo) {
            const existingAadhar = await User.findOne({ aadharNo, userId: { $ne: userId } });
            if (existingAadhar) {
                return res.status(400).json({ success: false, message: "Aadhaar number already in use" });
            }
            updates.aadharNo = aadharNo;
        }
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updates.password = hashedPassword;
        }

        // Update user
        const updatedUser = await User.findOneAndUpdate(
            { userId },
            { $set: updates },
            { new: true }
        );

        res.status(200).json({
            success: true,
            message: "User details updated successfully",
            data: updatedUser,
        });
    } catch (error) {
        console.error("Error updating user details:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update user details",
            error: error.message,
        });
    }
};


//update user status by id
export const updateUserStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.body;

        // Validate input
        if (!status) {
            return res.status(400).json({ success: false, message: "Status is required" });
        }

        const validStatuses = ["pending", "active", "rejected"];
        if (!validStatuses.includes(status.toLowerCase())) {
            return res.status(400).json({ success: false, message: "Invalid status value" });
        }

        // Update user status
        const updatedUser = await User.findOneAndUpdate(
            { userId },
            { status: status.toLowerCase() },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.status(200).json({
            success: true,
            message: `User status updated to ${status}`,
            data: updatedUser,
        });
    } catch (error) {
        console.error("Error updating user status:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update user status",
            error: error.message,
        });
    }
};


//all user and all user details
export const getAllUsers = async (req, res) => {
    try {
        // ✅ Fetch all users
        const users = await User.find();

        if (!users || users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No users found in the system",
            });
        }

        // ✅ Fetch all course details
        const allCourses = await CourseDetails.find();

        // ✅ Create a map for faster lookup
        const courseMap = new Map(allCourses.map(course => [course.userId, course]));

        // ✅ Attach course details to each user
        const usersWithCourses = users.map(user => ({
            ...user.toObject(),
            courseDetails: courseMap.get(user.userId) || null, // attach matching course details
        }));

        // ✅ Send final response
        res.status(200).json({
            success: true,
            message: "All users with their course details fetched successfully",
            totalUsers: usersWithCourses.length,
            data: usersWithCourses,
        });

    } catch (error) {
        console.error("❌ Error fetching all users with courses:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch users with course details",
            error: error.message,
        });
    }
};


// ✅ Get total selfPoints from all referred users
export const getReferredSelfPoints = async (req, res) => {
    try {
        const { userId } = req.params;

        // 1️⃣ Find the user
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // 2️⃣ Get all referred users
        const referredUsers = await User.find({
            userId: { $in: user.referredIds }
        }).select("userId selfPoints");

        // 3️⃣ Calculate total selfPoints
        const totalSelfPoints = referredUsers.reduce(
            (sum, refUser) => sum + (refUser.selfPoints || 0),
            0
        );

        // 4️⃣ Return response
        res.status(200).json({
            success: true,
            userId,
            totalSelfPointsFromReferredUsers: totalSelfPoints,
            referredUsers
        });
    } catch (error) {
        console.error("Error fetching referred self points:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};


//users dashboard data
export const getUserFullDetails = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "userId is required in request body",
            });
        }

        // 🧩 Fetch all user-related data in parallel for speed
        const [user, payout, bankDetails, courseDetails, checkouts] = await Promise.all([
            User.findOne({ userId }),
            Payout.findOne({ userId }),
            BankDetails.findOne({ userId }),
            CourseDetails.findOne({ userId }),
            Checkout.find({ userId }),
        ]);

        // ✅ Prepare dynamic response (only include existing documents)
        const responseData = {};
        if (user) responseData.user = user;
        if (payout) responseData.payout = payout;
        if (bankDetails) responseData.bankDetails = bankDetails;
        if (courseDetails) responseData.courseDetails = courseDetails;
        if (checkouts && checkouts.length > 0) responseData.checkouts = checkouts;

        if (Object.keys(responseData).length === 0) {
            return res.status(404).json({
                success: false,
                message: "No records found for this userId",
            });
        }

        // ✅ Send success response
        res.status(200).json({
            success: true,
            message: "Fetched all available user details successfully",
            data: responseData,
        });

    } catch (error) {
        console.error("❌ Error fetching full user details:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch full user details",
            error: error.message,
        });
    }
};