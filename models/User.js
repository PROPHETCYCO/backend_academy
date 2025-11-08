import mongoose from "mongoose";
import bcrypt from "bcryptjs";
//import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
    {
        userId: {
            type: String,
            required: true,
            unique: true,
        },

        name: {
            type: String,
            required: true,
            trim: true,
        },

        phone: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        address: {
            type: String,
            required: true,
        },

        aadharNo: {
            type: String,
            required: true,
            unique: true,
        },

        // Store uploaded file URLs (from AWS S3)
        aadharPhotoFront: {
            type: String,
            default: "", // URL of front side
        },

        aadharPhotoBack: {
            type: String,
            default: "", // URL of back side
        },

        panNo: {
            type: String,
            required: true,
            unique: true,
        },

        panPhoto: {
            type: String,
            default: "", // URL from S3
        },

        password: {
            type: String,
            required: true,
            minlength: 6,
        },

        referralLink: {
            type: String,
            required: true,
            unique: true,
        },

        parentId: {
            type: String,
            default: null,
        },

        referredIds: {
            type: [String], // list of userIds referred by this user
            default: [],
        },

        selfPoints: {
            type: Number,
            default: 0,
        },

        totalSelfPoints: {
            type: Number,
            default: 0,
        },

        status: {
            type: String,
            enum: ["pending", "active", "inactive"],
            default: "pending",
        },
    },
    { timestamps: true }
);

// 🔐 Hash password before saving
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// 🔑 Compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// 🧾 Generate Auth Token (optional)
// userSchema.methods.generateAuthToken = function () {
//   return jwt.sign(
//     { userId: this.userId, email: this.email },
//     process.env.JWT_SECRET,
//     { expiresIn: process.env.JWT_EXPIRE || "7d" }
//   );
// };

const User = mongoose.model("User", userSchema);

export default User;