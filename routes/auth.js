import express from "express";
import passport from "passport";
import User from "../models/User.js";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { isLoggedIn, handleLoginRedirect } from "../middleware/auth.js";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

// Login page
router.get("/login", (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect("/dashboard");
  }
  res.render("auth/login", { title: "Login" });
});

// Login process
router.post("/login", (req, res, next) => {
  passport.authenticate("local", {
    failureRedirect: "/auth/login",
    failureFlash: true,
  })(req, res, (err) => {
    if (err) return next(err);
    handleLoginRedirect(req, res, next);
  });
});

// Register page
router.get("/register", (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect("/dashboard");
  }
  res.render("auth/register", { title: "Register" });
});

// Register process
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, password2, phone, address } = req.body;
    const errors = [];

    if (!name || !email || !password || !password2) {
      errors.push({ msg: "Please fill in all required fields" });
    }
    if (password !== password2) {
      errors.push({ msg: "Passwords do not match" });
    }
    if (password.length < 6) {
      errors.push({ msg: "Password should be at least 6 characters" });
    }

    if (errors.length > 0) {
      return res.render("auth/register", {
        title: "Register",
        errors,
        name,
        email,
        phone,
        address,
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      errors.push({ msg: "Email is already registered" });
      return res.render("auth/register", {
        title: "Register",
        errors,
        name,
        email,
        phone,
        address,
      });
    }

    const newUser = new User({ name, email, password, phone, address, role: "customer" });
    await newUser.save();

    req.flash("success", "You are now registered and can log in");
    res.redirect("/auth/login");
  } catch (err) {
    console.error("Registration error:", err);
    req.flash("error", "Registration failed");
    res.redirect("/auth/register");
  }
});

// Logout
router.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.flash("success", "You are logged out");
    res.redirect("/");
  });
});

// Forgot password page
router.get("/forgot", (req, res) => {
  res.render("auth/forgot", { title: "Forgot Password" });
});

// Forgot password process
router.post("/forgot", async (req, res) => {
  try {
    const token = crypto.randomBytes(20).toString("hex");
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      req.flash("error", "No account with that email address exists");
      return res.redirect("/auth/forgot");
    }

    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const mailOptions = {
      to: user.email,
      from: process.env.SMTP_USER,
      subject: "Password Reset",
      text: `You are receiving this because a password reset was requested for your account.\n\n
Please click the following link, or paste it into your browser:\n
http://${req.headers.host}/auth/reset/${token}\n\n
If you did not request this, please ignore this email.\n`,
    };

    transporter.sendMail(mailOptions, (err) => {
      if (err) {
        console.error("Error sending email:", err);
        req.flash("error", "Error sending reset email");
        return res.redirect("/auth/forgot");
      }
      req.flash("success", `An email has been sent to ${user.email} with further instructions`);
      res.redirect("/auth/forgot");
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    req.flash("error", "Something went wrong");
    res.redirect("/auth/forgot");
  }
});

// Reset password page
router.get("/reset/:token", async (req, res) => {
  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      req.flash("error", "Password reset token is invalid or has expired");
      return res.redirect("/auth/forgot");
    }

    res.render("auth/reset", {
      title: "Reset Password",
      token: req.params.token,
    });
  } catch (err) {
    console.error("Reset password page error:", err);
    req.flash("error", "Something went wrong");
    res.redirect("/auth/forgot");
  }
});

// Reset password process
router.post("/reset/:token", async (req, res) => {
  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      req.flash("error", "Password reset token is invalid or has expired");
      return res.redirect("/auth/forgot");
    }

    if (req.body.password !== req.body.password2) {
      req.flash("error", "Passwords do not match");
      return res.redirect(`/auth/reset/${req.params.token}`);
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    req.flash("success", "Your password has been updated");
    res.redirect("/auth/login");
  } catch (err) {
    console.error("Reset process error:", err);
    req.flash("error", "Something went wrong");
    res.redirect("/auth/forgot");
  }
});

// Change password page
router.get("/change-password", isLoggedIn, (req, res) => {
  res.render("auth/change-password", { title: "Change Password" });
});

// Change password process
router.post("/change-password", isLoggedIn, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const user = await User.findById(req.user._id);

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      req.flash("error", "Current password is incorrect");
      return res.redirect("/auth/change-password");
    }

    if (newPassword !== confirmPassword) {
      req.flash("error", "New passwords do not match");
      return res.redirect("/auth/change-password");
    }

    user.password = newPassword;
    await user.save();

    req.flash("success", "Password updated successfully");
    res.redirect("/dashboard");
  } catch (err) {
    console.error("Change password error:", err);
    req.flash("error", "Something went wrong");
    res.redirect("/auth/change-password");
  }
});

export default router;