import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const emailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "cloudanalytics08@gmail.com",
    pass: "rpnjuebojiskzxib",
  },
  tls: {
    rejectUnauthorized: false, // <--- This fixes the self-signed cert issue
  },
});

export async function sendEmailFromNodeMailer(toEmail, subject, htmlEmailBody) {
  try {
    const sendEmailResponse = await emailTransporter.sendMail({
      from: `Cloudsanalytics Team team@cloudsanalytics.ai`,
      to: toEmail,
      subject: subject,
      html: htmlEmailBody,
    });
    return sendEmailResponse;
  } catch (error) {
    console.log(error);
    throw error;
  }
}
