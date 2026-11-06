import nodemailer from "nodemailer";

export async function sendSignupOtp(email: string, otp: string): Promise<void> {
  const sender = process.env.EMAIL;
  const password = process.env.PASSWORD;
  if (!sender || !password) throw new Error("Email credentials are missing");

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: sender, pass: password },
  });

  await transporter.sendMail({
    from: sender,
    to: email,
    subject: "Your JurisMate verification code",
    text: `Your verification code is ${otp}. It expires in 5 minutes.`,
  });
}
