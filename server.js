require("dotenv").config();
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
app.use(express.json());
app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}));


const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 3,
    message: "Too many requests, please try again later.",
});
app.use("/contact", limiter);

app.post("/contact", async (req, res) => {
    const { firstName, lastName, phone, email, message, requestResume, captchaToken, selectedOptions } = req.body;

    if (!firstName || !email || !message) {
        return res.status(400).json({ error: "Alle Pflichtfelder müssen ausgefüllt werden." });
    }

    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Bitte eine gültige E-Mail-Adresse angeben." });
    }

    if (!captchaToken) {
        return res.status(400).json({ error: "reCAPTCHA-Token fehlt." });
    }

    try {
        const googleVerifyUrl = "https://www.google.com/recaptcha/api/siteverify";
        const params = `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${captchaToken}`;
        const googleRes = await fetch(googleVerifyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params,
        });
        const captchaResult = await googleRes.json();
        if (!captchaResult.success) {
            return res.status(403).json({ error: "reCAPTCHA verification failed. Request denied." });
        }

    } catch (err) {
        console.error("Error verifying reCAPTCHA:", err);
        return res.status(500).json({ error: "Fehler bei der reCAPTCHA-Überprüfung." });
    }

    const transporter = nodemailer.createTransport({
        host: "mail.gmx.com",
        port: 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
        tls: {
            rejectUnauthorized: true
        }
    });


    const mailOptionsOwner = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_RECEIVER,
        subject: `New Contact Request – ${selectedOptions}`,
        text:
            `You have received a new contact request from your portfolio website.\n\n` +
            `Name: ${firstName} ${lastName}\n` +
            `Email: ${email}\n` +
            `Phone: ${phone || "Not provided"}\n\n` +
            `Message:\n${message}\n\n` +
            (requestResume ? "Note: The sender requested your resume." : ""),
    };


    let mailOptionsUser;
    if (requestResume) {
        mailOptionsUser = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Requested Resume – Sebastian Olthoff",
            text:
                `Dear ${firstName} ${lastName},\n\n` +
                `Thank you for reaching out and for your interest in my profile. As requested, I have attached my resume to this email. ` +
                `Please feel free to review it and let me know if you have any questions or need further information.\n\n` +
                `I appreciate your time and consideration, and I look forward to the possibility of discussing how I can contribute to your team or project.\n\n` +
                `Sincerely,\n` +
                `Sebastian Olthoff`,
            attachments: [
                {
                    filename: "CV.pdf",
                    path: path.join(__dirname, "CV.pdf"),
                    contentType: "application/pdf",
                },
            ],
        };
    }

    try {

        await transporter.sendMail(mailOptionsOwner);
        if (requestResume) {
            await transporter.sendMail(mailOptionsUser);
        }
        return res.status(200).json({ success: "E-Mail erfolgreich gesendet!" });
    } catch (error) {
        console.error("Error sending email:", error);
        return res.status(500).json({ error: "Fehler beim Senden der E-Mail." });
    }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));