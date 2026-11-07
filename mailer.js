// import nodemailer from 'nodemailer';
// import dotenv from 'dotenv';
// dotenv.config();

// const transporter = nodemailer.createTransport({
//     host: process.env.SMTP_HOST,
//     port: Number(process.env.SMTP_PORT),
//     secure: Number(process.env.SMTP_PORT) === 465, // true for SSL, false for TLS
//     auth: {
//         user: process.env.SMTP_USER,
//         pass: process.env.SMTP_PASS
//     }
// });

// // Verify SMTP connection (optional)
// transporter.verify((error, success) => {
//     if (error) {
//         console.error('SMTP Error:', error);
//     } else {
//         console.log('✅ SMTP Server is ready to send emails!');
//     }
// });

// export async function sendMail(to, subject, html) {
//     try {
//         const info = await transporter.sendMail({
//             from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
//             to,
//             subject,
//             html
//         });
//         console.log('📧 Email sent:', info.messageId);
//     } catch (err) {
//         console.error('❌ Email sending failed:', err);
//     }
// }