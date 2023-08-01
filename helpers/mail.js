const nodemailer = require("nodemailer");

function sendEmail(message) {
  const transport = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    auth: {
      user: process.env.MAILTRAP_USER,
      pass: process.env.MAILTRAP_PASS,
    },
  });

  message.from = "viss82@ukr.net";

  return transport.sendMail(message);
}

module.exports = { sendEmail };