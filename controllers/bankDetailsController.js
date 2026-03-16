import BankDetails from "../models/BankDetails.js";
import { uploadFileToS3 } from "../utils/uploadToS3.js";

// ✅ Save Bank Details (User Submission)

// export const saveBankDetails = async (req, res) => {
//     try {
//         const {
//             userId,
//             name,
//             nameAsPerDocument,
//             bankName,
//             accountNo,
//             branchName,
//             ifscCode,
//         } = req.body;

//         // ✅ Validate required fields
//         if (
//             !userId ||
//             !name ||
//             !nameAsPerDocument ||
//             !bankName ||
//             !accountNo ||
//             !branchName ||
//             !ifscCode
//         ) {
//             return res.status(400).json({ message: "All fields are required." });
//         }

//         // ✅ Check if user already submitted bank details
//         const existing = await BankDetails.findOne({ userId });
//         if (existing) {
//             return res.status(400).json({ message: "Bank details already exist for this user." });
//         }

//         // ✅ Handle passbook photo upload (to S3)
//         let passbookPhotoUrl = null;
//         if (req.file) {
//             passbookPhotoUrl = await uploadFileToS3(req.file, "passbook-photo");
//         } else {
//             return res.status(400).json({ message: "Passbook photo is required." });
//         }

//         // ✅ Create new bank details document
//         const bankDetails = new BankDetails({
//             userId,
//             name,
//             nameAsPerDocument,
//             bankName,
//             accountNo,
//             branchName,
//             ifscCode,
//             passbookPhoto: passbookPhotoUrl,
//         });

//         await bankDetails.save();

//         // ✅ Respond success
//         res.status(201).json({
//             success: true,
//             message: "Bank details saved successfully.",
//             data: {
//                 userId,
//                 name,
//                 nameAsPerDocument,
//                 bankName,
//                 accountNo,
//                 branchName,
//                 ifscCode,
//                 passbookPhoto: passbookPhotoUrl,
//                 status: bankDetails.status,
//             },
//         });

//     } catch (error) {
//         console.error("❌ Error saving bank details:", error);
//         res.status(500).json({
//             success: false,
//             message: "Failed to save bank details.",
//             error: error.message,
//         });
//     }
// };
export const saveBankDetails = async (req, res) => {
  try {
    const {
      userId,
      name,
      nameAsPerDocument,
      bankName,
      accountNo,
      branchName,
      ifscCode,
    } = req.body;

    // Validate required fields
    if (
      !userId ||
      !name ||
      !nameAsPerDocument ||
      !bankName ||
      !accountNo ||
      !branchName ||
      !ifscCode
    ) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const existing = await BankDetails.findOne({ userId });

    // Upload passbook photo
    let passbookPhotoUrl = null;
    if (req.file) {
      passbookPhotoUrl = await uploadFileToS3(req.file, "passbook-photo");
    }

    // 🆕 Case 1: New User
    if (!existing) {
      if (!passbookPhotoUrl) {
        return res.status(400).json({ message: "Passbook photo is required." });
      }

      const bankDetails = new BankDetails({
        userId,
        name,
        nameAsPerDocument,
        bankName,
        accountNo,
        branchName,
        ifscCode,
        passbookPhoto: passbookPhotoUrl,
        status: "pending",
      });

      await bankDetails.save();

      return res.status(201).json({
        success: true,
        message: "KYC submitted successfully.",
        data: bankDetails,
      });
    }

    // ❌ Case 2: Pending
    if (existing.status === "pending") {
      return res.status(400).json({
        message: "Your KYC is already submitted and under review.",
      });
    }

    // ❌ Case 3: Approved
    if (existing.status === "approved") {
      return res.status(400).json({
        message: "Your KYC is already approved.",
      });
    }

    // 🔁 Case 4: Rejected → Update KYC
    if (existing.status === "rejected") {
      existing.name = name;
      existing.nameAsPerDocument = nameAsPerDocument;
      existing.bankName = bankName;
      existing.accountNo = accountNo;
      existing.branchName = branchName;
      existing.ifscCode = ifscCode;

      if (passbookPhotoUrl) {
        existing.passbookPhoto = passbookPhotoUrl;
      }

      existing.status = "pending"; // resubmit again
      existing.updatedAt = new Date();

      await existing.save();

      return res.status(200).json({
        success: true,
        message: "KYC resubmitted successfully.",
        data: existing,
      });
    }

  } catch (error) {
    console.error("❌ Error saving bank details:", error);

    res.status(500).json({
      success: false,
      message: "Failed to save bank details.",
      error: error.message,
    });
  }
};

// ✅ Get all KYC details (including image)
export const getAllKycDetails = async (req, res) => {
    try {
        // ✅ Fetch all bank/KYC details sorted by latest first
        const allDetails = await BankDetails.find().sort({ createdAt: -1 });

        if (!allDetails.length) {
            return res.status(404).json({
                success: false,
                message: "No KYC details found in the system",
            });
        }

        // ✅ Return everything directly (including S3 photo URLs)
        res.status(200).json({
            success: true,
            message: "Fetched all KYC details successfully",
            totalRecords: allDetails.length,
            data: allDetails,
        });
    } catch (error) {
        console.error("❌ Error fetching KYC details:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch KYC details",
            error: error.message,
        });
    }
};



//update status
// ✅ Update KYC Status (Admin Action)
export const updateKycStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ message: "Status is required" });
        }

        const validStatuses = ["pending", "verified", "rejected"];
        if (!validStatuses.includes(status.toLowerCase())) {
            return res.status(400).json({ message: "Invalid status value" });
        }

        const bankDetail = await BankDetails.findOneAndUpdate(
            { userId },
            { status },
            { new: true }
        );

        if (!bankDetail) {
            return res.status(404).json({ message: "Bank details not found for this user" });
        }

        res.status(200).json({
            success: true,
            message: `KYC status updated to ${status}`,
            data: bankDetail,
        });
    } catch (error) {
        console.error("Error updating KYC status:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update KYC status",
            error: error.message,
        });
    }
};


// ✅ Get KYC details for a specific user (including image)
export const getUserBankDetails = async (req, res) => {
    try {
        const { userId } = req.params;
        const bankDetails = await BankDetails.findOne({ userId });

        if (!bankDetails) {
            return res.status(404).json({ message: "No bank details found for this user" });
        }

        res.status(200).json({
            success: true,
            message: "Bank details fetched successfully",
            data: {
                userId: bankDetails.userId,
                nameAsPerDocument: bankDetails.nameAsPerDocument,
                bankName: bankDetails.bankName,
                accountNumber: bankDetails.accountNumber,
                branchName: bankDetails.branchName,
                ifscCode: bankDetails.ifscCode,
                status: bankDetails.status,
                passbookPhoto: bankDetails.passbookPhoto
                    ? `data:${bankDetails.passbookPhoto.contentType};base64,${bankDetails.passbookPhoto.data.toString("base64")}`
                    : null,
            },
        });
    } catch (error) {
        console.error("Error fetching bank details:", error);
        res.status(500).json({ success: false, message: "Failed to fetch bank details" });
    }
};