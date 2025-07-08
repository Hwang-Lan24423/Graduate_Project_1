import express from "express";
import path from "path";
import mongoose from "mongoose";
import session from "express-session";
import MongoStore from "connect-mongo";
import methodOverride from "method-override";
import flash from "connect-flash";
import passport from "passport";
import { fileURLToPath } from "url";
import expressEjsLayouts from "express-ejs-layouts";
import multer from "multer";
import fs from "fs";

// Routes
import indexRoutes from "./routes/index.js";
import authRoutes from "./routes/auth.js";
import customerRoutes from "./routes/customer.js";
import staffRoutes from "./routes/staff.js";
import adminRoutes from "./routes/admin.js";

// Middleware
import { isLoggedIn, isStaff, isAdmin } from "./middleware/auth.js";

// Passport config
import "./config/passport.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MongoDB connection
mongoose
  .connect("mongodb://localhost:27017/hotel_management", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// MongoDB event handlers
mongoose.connection.on("connected", () => {
  console.log("MongoDB connected successfully");
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("MongoDB disconnected");
});

process.on("SIGINT", async () => {
  await mongoose.connection.close();
  process.exit(0);
});

// Multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadDir;
    // Check route to determine upload directory
    if (req.url.startsWith('/admin/rooms/')) {
      uploadDir = path.join(__dirname, "public/uploads/rooms");
    } else if (req.url.startsWith('/admin/services/')) {
      uploadDir = path.join(__dirname, "public/uploads/services");
    } else {
      uploadDir = path.join(__dirname, "public/uploads");
    }
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const prefix = req.url.startsWith('/admin/rooms/') ? 'room' : 'service';
    cb(null, `${prefix}-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Chấp nhận chỉ image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 10 // Tối đa 10 files
  }
});

// Middleware xử lý upload cho cả phòng và dịch vụ
app.use(async (req, res, next) => {
  const isUploadRoute = req.url.startsWith('/admin/rooms/') || req.url.startsWith('/admin/services/');
  const isPostMethod = req.method === 'POST';
  
  if (isUploadRoute && isPostMethod) {
    upload.single('serviceImage')(req, res, async (err) => {
      if (err instanceof multer.MulterError) {
        req.flash('error', `Upload error: ${err.message}`);
        return res.redirect(req.url);
      } else if (err) {
        req.flash('error', `Invalid file: ${err.message}`);
        return res.redirect(req.url);
      }
      next();
    });
  } else {
    next();
  }
});

// EJS setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressEjsLayouts);
app.set("layout", "layouts/main");

// Middleware setup
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

// Session setup
app.use(
  session({
    secret: process.env.SESSION_SECRET || "default-secret-key",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || "mongodb://localhost:27017/hotel_management",
      ttl: 24 * 60 * 60,
    }),
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// Passport initialization
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

// Global variables middleware
app.use((req, res, next) => {
  res.locals.currentUser = req.user || null;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

// Routes
app.use("/", indexRoutes);
app.use("/auth", authRoutes);
app.use("/customer", isLoggedIn, customerRoutes);
app.use("/staff", isLoggedIn, isStaff, staffRoutes);
app.use("/admin", isLoggedIn, isAdmin, adminRoutes);

// Temporary dashboard route for testing
app.get("/dashboard", isLoggedIn, (req, res) => {
  res.render("dashboard", { title: `Welcome ${req.user.name}` });
});

// Error handling
app.use((req, res) => {
  res.status(404).render("error/404", { layout: false });
});

app.use((err, req, res, next) => {
  console.error("Error details:", err);
  console.error("Stack trace:", err.stack);

  if (err.name === "MongoError" || err.name === "MongooseError") {
    console.error("Database error:", err);
    return res.status(500).render("error/500", {
      message: "Database connection error",
      layout: "layouts/error",
    });
  }

  res.status(500).render("error/500", {
    message: "Internal server error",
    layout: "layouts/error",
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;