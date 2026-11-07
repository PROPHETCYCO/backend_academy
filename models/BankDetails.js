import mongoose from "mongoose";

const bankDetailsSchema = new mongoose.Schema(
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

    nameAsPerDocument: {
      type: String,
      required: true,
      trim: true,
    },

    bankName: {
      type: String,
      required: true,
      trim: true,
    },

    branchName: {
      type: String,
      required: true,
      trim: true,
    },

    accountNo: {
      type: String,
      required: true,
      trim: true,
    },

    ifscCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    accountType: {
      type: String,
      enum: ["savings", "current"],
      required: true,
    },

    // ✅ Store S3 URL instead of binary data
    passbookPhoto: {
      type: String, // URL of image uploaded to S3
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true },
);

const BankDetails = mongoose.model("BankDetails", bankDetailsSchema);
export default BankDetails;
