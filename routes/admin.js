import express from "express";
import { isLoggedIn, isAdmin } from "../middleware/auth.js";
import User from "../models/User.js";
import Room from "../models/Room.js";
import Booking from "../models/booking.js";
import Service from "../models/Service.js";
import Review from "../models/Review.js";
import Notification from "../models/Notification.js";
import LoyaltyProgram from "../models/LoyaltyProgram.js";
import Payment from "../models/Payment.js";
import ServiceRequest from "../models/ServiceRequest.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Admin dashboard
router.get("/dashboard", isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get booking statistics
    const totalBookings = await Booking.countDocuments();
    const activeBookings = await Booking.countDocuments({
      status: { $in: ["confirmed", "checked-in"] },
    });

    // Get revenue statistics
    const revenue = await Payment.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const totalRevenue = revenue.length > 0 ? revenue[0].total : 0;

    // Get user statistics
    const totalCustomers = await User.countDocuments({ role: "customer" });
    const totalStaff = await User.countDocuments({ role: "staff" });

    // Get room statistics
    const totalRooms = await Room.countDocuments();
    const availableRooms = await Room.countDocuments({ status: "available" });
    const occupiedRooms = await Room.countDocuments({ status: "occupied" });

    // Get recent bookings
    const recentBookings = await Booking.find()
      .populate("customer")
      .populate("room")
      .sort({ createdAt: -1 })
      .limit(5);

    // Get pending reviews
    const pendingReviews = await Review.find({ isApproved: false })
      .populate("customer")
      .sort({ createdAt: -1 })
      .limit(5);

    // Fetch active loyalty program
    const loyaltyProgram = await LoyaltyProgram.findOne({ isActive: true });

    res.render("admin/dashboard", {
      title: "Admin Dashboard",
      stats: {
        totalBookings,
        activeBookings,
        totalRevenue,
        totalCustomers,
        totalStaff,
        totalRooms,
        availableRooms,
        occupiedRooms,
      },
      recentBookings,
      pendingReviews,
      loyaltyProgram, // Pass loyalty program to the view
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Something went wrong");
    res.redirect("/");
  }
});

// User management
router.get("/users", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { role, search } = req.query;

    const query = {};

    if (role && role !== "all") {
      query.role = role;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(query).sort({ name: 1 });

    res.render("admin/users", {
      title: "Manage Users",
      users,
      currentRole: role || "all",
      search: search || "",
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to load users");
    res.redirect("/admin/dashboard");
  }
});

// Add user form
router.get("/users/add", isLoggedIn, isAdmin, (req, res) => {
  res.render("admin/add-user", { title: "Add User" });
});

// Add user process
router.post("/users/add", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { name, email, password, role, phone, address } = req.body;

    // Check if email exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      req.flash("error", "Email is already registered");
      return res.redirect("/admin/users/add");
    }

    // Create new user
    const newUser = new User({
      name,
      email,
      password,
      role,
      phone,
      address,
    });

    await newUser.save();

    req.flash("success", "User added successfully");
    res.redirect("/admin/users");
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to add user");
    res.redirect("/admin/users/add");
  }
});

// Edit user form
router.get("/users/:id/edit", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      req.flash("error", "User not found");
      return res.redirect("/admin/users");
    }

    res.render("admin/edit-user", {
      title: "Edit User",
      user,
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to load user");
    res.redirect("/admin/users");
  }
});

// Update user
router.post("/users/:id", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { name, email, role, phone, address, password } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      req.flash("error", "User not found");
      return res.redirect("/admin/users");
    }

    // Update user details
    user.name = name;
    user.email = email;
    user.role = role;
    user.phone = phone;
    user.address = address;

    // Update password if provided
    if (password && password.trim() !== "") {
      user.password = password;
    }

    await user.save();

    req.flash("success", "User updated successfully");
    res.redirect("/admin/users");
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to update user");
    res.redirect(`/admin/users/${req.params.id}/edit`);
  }
});

// Delete user
router.post("/users/:id/delete", isLoggedIn, isAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);

    req.flash("success", "User deleted successfully");
    res.redirect("/admin/users");
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to delete user");
    res.redirect("/admin/users");
  }
});

// Room management
router.get("/rooms", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const rooms = await Room.find().sort({ roomNumber: 1 });

    res.render("admin/rooms", {
      title: "Manage Rooms",
      rooms,
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to load rooms");
    res.redirect("/admin/dashboard");
  }
});

// Add room form
router.get("/rooms/add", isLoggedIn, isAdmin, (req, res) => {
  res.render("admin/add-room", { title: "Add Room" });
});

// Add room process
router.post("/rooms/add", isLoggedIn, isAdmin, async (req, res) => {
  try {
    let { roomNumber, type, price, capacity, amenities, floor, description } = req.body;
    const files = req.files?.roomImages;

    // Làm sạch dữ liệu đầu vào
    roomNumber = roomNumber?.trim();
    description = description?.trim();
    
    // Parse giá trị số
    const parsedPrice = parseFloat(price);
    const parsedCapacity = parseInt(capacity);
    const parsedFloor = parseInt(floor);

    // Validate số phòng
    if (!roomNumber || !/^[0-9]{3,4}$/.test(roomNumber)) {
      req.flash("error", "Số phòng không hợp lệ");
      return res.redirect("/admin/rooms/add");
    }

    // Validate các giá trị số
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      req.flash("error", "Giá phòng không hợp lệ");
      return res.redirect("/admin/rooms/add");
    }

    if (isNaN(parsedCapacity) || parsedCapacity < 1 || parsedCapacity > 10) {
      req.flash("error", "Sức chứa phải từ 1-10 người");
      return res.redirect("/admin/rooms/add");
    }

    if (isNaN(parsedFloor) || parsedFloor < 1 || parsedFloor > 20) {
      req.flash("error", "Số tầng phải từ 1-20");
      return res.redirect("/admin/rooms/add");
    }

    // Kiểm tra trùng số phòng
    const existingRoom = await Room.findOne({ roomNumber });
    if (existingRoom) {
      req.flash("error", "Số phòng đã tồn tại");
      return res.redirect("/admin/rooms/add");
    }

    // Xử lý images path
    let images = [];
    if (files) {
      if (!Array.isArray(files)) {
        files = [files];
      }
      images = files.map(file => `/uploads/rooms/${file.filename}`);
    }

    // Tạo room mới
    const newRoom = new Room({
      roomNumber,
      type,
      price: parsedPrice,
      capacity: parsedCapacity,
      amenities: amenities ? amenities.split(",").map(item => item.trim()).filter(Boolean) : [],
      floor: parsedFloor,
      description,
      images,
      status: "available"
    });

    await newRoom.save();

    req.flash("success", "Thêm phòng mới thành công");
    res.redirect("/admin/rooms");
  } catch (err) {
    console.error('Lỗi khi thêm phòng:', err);
    
    if (err.name === 'ValidationError') {
      const errorMessages = Object.values(err.errors)
        .map(error => error.message)
        .join(', ');
      req.flash("error", `Lỗi validation: ${errorMessages}`);
    } else if (err.code === 11000) {
      req.flash("error", "Số phòng đã tồn tại");
    } else {
      req.flash("error", "Không thể thêm phòng. Vui lòng kiểm tra lại thông tin.");
    }
    
    res.redirect("/admin/rooms/add");
  }
});

// Edit room form
router.get("/rooms/:id/edit", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      req.flash("error", "Room not found");
      return res.redirect("/admin/rooms");
    }

    res.render("admin/edit-room", {
      title: "Edit Room",
      room,
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to load room");
    res.redirect("/admin/rooms");
  }
});

// Update room
router.post("/rooms/:id", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const {
      roomNumber,
      type,
      price,
      capacity,
      amenities,
      status,
      floor,
      description,
      existingImages
    } = req.body;

    // Find room
    const room = await Room.findById(req.params.id);
    if (!room) {
      req.flash("error", "Không tìm thấy phòng");
      return res.redirect("/admin/rooms");
    }

    // Validate required fields
    if (!roomNumber || !type || !price || !capacity || !floor || !description) {
      req.flash("error", "Vui lòng điền đầy đủ các trường bắt buộc");
      return res.redirect(`/admin/rooms/${req.params.id}/edit`);
    }

    // Process images
    let images = [];
    
    // Add existing images that weren't deleted
    if (existingImages) {
      images = existingImages.split(',').filter(Boolean);
    }
    
    // Add new uploaded images
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => `/uploads/rooms/${file.filename}`);
      images = [...images, ...newImages];
    }

    // Create update object
    const updateData = {
      roomNumber: roomNumber.trim(),
      type,
      price: parseFloat(price),
      capacity: parseInt(capacity),
      amenities: amenities ? amenities.split(',').map(item => item.trim()).filter(Boolean) : room.amenities,
      status: status || room.status,
      floor: parseInt(floor),
      description: description.trim(),
      updatedAt: Date.now()
    };

    // Only update images if they were modified
    if (existingImages !== undefined) {
      updateData.images = images;
    }

    // Use findByIdAndUpdate to ensure atomic update
    await Room.findByIdAndUpdate(
      req.params.id, 
      updateData,
      { new: true, runValidators: true }
    );

    req.flash("success", "Cập nhật phòng thành công");
    res.redirect("/admin/rooms");
  } catch (err) {
    console.error("Lỗi khi cập nhật phòng:", err);
    
    if (err.name === 'ValidationError') {
      const errorMessages = Object.values(err.errors)
        .map(error => error.message)
        .join(', ');
      req.flash("error", `Lỗi validation: ${errorMessages}`);
    } else {
      req.flash("error", "Không thể cập nhật phòng. Vui lòng kiểm tra lại thông tin.");
    }
    
    res.redirect(`/admin/rooms/${req.params.id}/edit`);
  }
});

// Delete room
router.post("/rooms/:id/delete", isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Check if room has active bookings
    const activeBookings = await Booking.countDocuments({
      room: req.params.id,
      status: { $in: ["pending", "confirmed", "checked-in"] },
    });

    if (activeBookings > 0) {
      req.flash("error", "Cannot delete room with active bookings");
      return res.redirect("/admin/rooms");
    }

    await Room.findByIdAndDelete(req.params.id);

    req.flash("success", "Room deleted successfully");
    res.redirect("/admin/rooms");
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to delete room");
    res.redirect("/admin/rooms");
  }
});

// Service management
router.get("/services", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const services = await Service.find().sort({ name: 1 });

    res.render("admin/services", {
      title: "Manage Services",
      services,
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to load services");
    res.redirect("/admin/dashboard");
  }
});

// Add service form
router.get("/services/add", isLoggedIn, isAdmin, (req, res) => {
  res.render("admin/add-service", { title: "Add Service" });
});

// Add service process
router.post("/services/add", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { name, description, price, category } = req.body;

    // Create new service
    const newService = new Service({
      name,
      description,
      price: Number.parseFloat(price),
      category,
      available: true,
    });

    await newService.save();

    req.flash("success", "Service added successfully");
    res.redirect("/admin/services");
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to add service");
    res.redirect("/admin/services/add");
  }
});

// Edit service form
router.get("/services/:id/edit", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      req.flash("error", "Service not found");
      return res.redirect("/admin/services");
    }

    res.render("admin/edit-service", {
      title: "Edit Service",
      service,
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to load service");
    res.redirect("/admin/services");
  }
});

// Update service
router.post("/services/:id", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { name, description, price, category, available, deleteImage } = req.body;

    // Validate required fields
    if (!name || !description || !category) {
      req.flash("error", "Name, description and category are required");
      return res.redirect(`/admin/services/${req.params.id}/edit`);
    }

    const service = await Service.findById(req.params.id);

    if (!service) {
      req.flash("error", "Service not found");
      return res.redirect("/admin/services");
    }

    // Update service details
    service.name = name.trim();
    service.description = description.trim();
    service.price = price ? Number.parseFloat(price) : service.price;
    service.category = category;
    service.available = available === "on" || available === true;

    // Handle image deletion if requested
    if (deleteImage === "on" && service.image) {
      try {
        const imagePath = path.join(__dirname, '../public', service.image);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
          service.image = null;
        }
      } catch (error) {
        console.error('Error deleting image file:', error);
        // Continue execution even if file deletion fails
      }
    }

    // Handle new image upload if provided
    if (req.file) {
      // Delete old image if exists
      if (service.image) {
        try {
          const oldImagePath = path.join(__dirname, '../public', service.image);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        } catch (error) {
          console.error('Error deleting old image file:', error);
          // Continue execution even if old file deletion fails
        }
      }
      
      // Set new image path
      service.image = `/uploads/services/${req.file.filename}`;
    }

    await service.save();

    req.flash("success", "Service updated successfully");
    res.redirect("/admin/services");
  } catch (err) {
    console.error(err);
    req.flash("error", err.message || "Failed to update service");
    res.redirect(`/admin/services/${req.params.id}/edit`);
  }
});

// Delete service
router.post("/services/:id/delete", isLoggedIn, isAdmin, async (req, res) => {
  try {
    await Service.findByIdAndDelete(req.params.id);

    req.flash("success", "Service deleted successfully");
    res.redirect("/admin/services");
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to delete service");
    res.redirect("/admin/services");
  }
});

// Review management
router.get("/reviews", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { approved } = req.query;
    
    const query = {};
    
    // Chỉ lọc khi có query approved
    if (approved === 'true') {
      query.isApproved = true;
    } else if (approved === 'false') {
      query.isApproved = false;
    }

    const reviews = await Review.find(query)
      .populate("customer")
      .populate({
        path: "booking",
        populate: { path: "room" },
      })
      .sort({ createdAt: -1 });

    res.render("admin/reviews", {
      title: "Quản lý đánh giá",
      reviews,
      currentFilter: approved || "all",
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Không thể tải danh sách đánh giá");
    res.redirect("/admin/dashboard");
  }
});

// Approve/respond to review
router.post("/reviews/:id", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { isApproved, adminResponse } = req.body;
    const review = await Review.findById(req.params.id).populate({
      path: 'booking',
      populate: { path: 'room' }
    });

    if (!review) {
      req.flash("error", "Không tìm thấy đánh giá");
      return res.redirect("/admin/reviews");
    }

    // Cập nhật đánh giá
    review.isApproved = isApproved === "true";
    if (adminResponse) {
      review.adminResponse = adminResponse;
    }
    await review.save();

    // Thông báo cho khách hàng
    const notification = new Notification({
      recipient: review.customer,
      title: "Cập nhật đánh giá",
      message: adminResponse 
        ? "Đánh giá của bạn đã được phản hồi từ quản trị viên."
        : "Đánh giá của bạn đã được duyệt.",
      type: "system", // Thay đổi từ "review" thành "system"
      relatedTo: {
        model: "Booking",
        id: review.booking._id
      }
    });

    await notification.save();

    req.flash("success", "Đã cập nhật đánh giá thành công");
    res.redirect("/admin/reviews");
  } catch (err) {
    console.error(err);
    req.flash("error", "Không thể cập nhật đánh giá");
    res.redirect("/admin/reviews");
  }
});

// Loyalty program management
router.get("/loyalty", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const loyaltyPrograms = await LoyaltyProgram.find().sort({ createdAt: -1 });

    res.render("admin/loyalty", {
      title: "Manage Loyalty Programs",
      loyaltyPrograms,
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to load loyalty programs");
    res.redirect("/admin/dashboard");
  }
});

// Add loyalty program form
router.get("/loyalty/add", isLoggedIn, isAdmin, (req, res) => {
  res.render("admin/add-loyalty", { title: "Add Loyalty Program" });
});

// Add loyalty program process
router.post("/loyalty/add", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { name, description, pointsPerDollar, tiers } = req.body;

    // Parse tiers from form data
    const parsedTiers = [];

    // Update array check using Array.isArray()
    if (Array.isArray(tiers.name)) {
      for (let i = 0; i < tiers.name.length; i++) {
        parsedTiers.push({
          name: tiers.name[i],
          minimumPoints: Number.parseInt(tiers.minimumPoints[i]),
          benefits: tiers.benefits[i]
            .split(",")
            .map((benefit) => benefit.trim()),
          discountPercentage: Number.parseFloat(tiers.discountPercentage[i]),
        });
      }
    } else {
      // Single tier case
      parsedTiers.push({
        name: tiers.name,
        minimumPoints: Number.parseInt(tiers.minimumPoints),
        benefits: tiers.benefits.split(",").map((benefit) => benefit.trim()),
        discountPercentage: Number.parseFloat(tiers.discountPercentage),
      });
    }

    // Create new loyalty program
    const newLoyaltyProgram = new LoyaltyProgram({
      name,
      description,
      pointsPerDollar: Number.parseFloat(pointsPerDollar),
      tiers: parsedTiers,
      isActive: true,
    });

    await newLoyaltyProgram.save();

    // If this is active, deactivate other programs
    if (newLoyaltyProgram.isActive) {
      await LoyaltyProgram.updateMany(
        { _id: { $ne: newLoyaltyProgram._id } },
        { isActive: false }
      );
    }

    req.flash("success", "Loyalty program added successfully");
    res.redirect("/admin/loyalty");
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to add loyalty program");
    res.redirect("/admin/loyalty/add");
  }
});

// Edit loyalty program form
router.get("/loyalty/:id/edit", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const loyaltyProgram = await LoyaltyProgram.findById(req.params.id);

    if (!loyaltyProgram) {
      req.flash("error", "Loyalty program not found");
      return res.redirect("/admin/loyalty");
    }

    res.render("admin/edit-loyalty", {
      title: "Edit Loyalty Program",
      loyaltyProgram,
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to load loyalty program");
    res.redirect("/admin/loyalty");
  }
});

// Update loyalty program
router.post("/loyalty/:id", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { name, description, pointsPerDollar, tiers, isActive } = req.body;

    const loyaltyProgram = await LoyaltyProgram.findById(req.params.id);

    if (!loyaltyProgram) {
      req.flash("error", "Loyalty program not found");
      return res.redirect("/admin/loyalty");
    }

    // Parse tiers from form data
    const parsedTiers = [];

    // Assuming tiers are submitted as arrays of fields
    if (Array.isArray(tiers.name)) {
      for (let i = 0; i < tiers.name.length; i++) {
        parsedTiers.push({
          name: tiers.name[i],
          minimumPoints: Number.parseInt(tiers.minimumPoints[i]),
          benefits: tiers.benefits[i]
            .split(",")
            .map((benefit) => benefit.trim()),
          discountPercentage: Number.parseFloat(tiers.discountPercentage[i]),
        });
      }
    } else {
      // Single tier case
      parsedTiers.push({
        name: tiers.name,
        minimumPoints: Number.parseInt(tiers.minimumPoints),
        benefits: tiers.benefits.split(",").map((benefit) => benefit.trim()),
        discountPercentage: Number.parseFloat(tiers.discountPercentage),
      });
    }

    // Update loyalty program
    loyaltyProgram.name = name;
    loyaltyProgram.description = description;
    loyaltyProgram.pointsPerDollar = Number.parseFloat(pointsPerDollar);
    loyaltyProgram.tiers = parsedTiers;
    loyaltyProgram.isActive = isActive === "on" || isActive === true;
    loyaltyProgram.updatedAt = Date.now();

    await loyaltyProgram.save();

    // If this is active, deactivate other programs
    if (loyaltyProgram.isActive) {
      await LoyaltyProgram.updateMany(
        { _id: { $ne: loyaltyProgram._id } },
        { isActive: false }
      );
    }

    req.flash("success", "Loyalty program updated successfully");
    res.redirect("/admin/loyalty");
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to update loyalty program");
    res.redirect(`/admin/loyalty/${req.params.id}/edit`);
  }
});

// Delete loyalty program
router.post("/loyalty/:id/delete", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const loyaltyProgram = await LoyaltyProgram.findById(req.params.id);

    if (loyaltyProgram.isActive) {
      req.flash("error", "Cannot delete an active loyalty program");
      return res.redirect("/admin/loyalty");
    }

    await LoyaltyProgram.findByIdAndDelete(req.params.id);

    req.flash("success", "Loyalty program deleted successfully");
    res.redirect("/admin/loyalty");
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to delete loyalty program");
    res.redirect("/admin/loyalty");
  }
});

// Reports
router.get("/reports", isLoggedIn, isAdmin, (req, res) => {
  res.render("admin/reports", { title: "Reports" });
});

// Booking report
router.get("/reports/bookings", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    console.log("Query params:", { startDate, endDate, status });

    const query = {};

    if (
      startDate && 
      endDate && 
      startDate.trim() !== "" && 
      endDate.trim() !== "" &&
      !isNaN(new Date(startDate)) &&
      !isNaN(new Date(endDate))
    ) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (status && status !== "all") {
      query.status = status;
    }

    console.log("MongoDB query:", query);

    let bookings;
    try {
      bookings = await Booking.find(query)
        .populate({
          path: "customer",
          select: "name email",
          options: { lean: true }
        })
        .populate({
          path: "room",
          select: "roomNumber type price",
          options: { lean: true }
        })
        .sort({ createdAt: -1 })
        .lean();

      // Filter out any bookings with null room data to prevent template errors
      bookings = bookings.filter(booking => booking.room && booking.customer);

      console.log("Found bookings:", bookings.length);
      if (bookings.length > 0) {
        console.log("Sample booking:", bookings[0]);
      }
    } catch (err) {
      console.error("Error fetching bookings:", err);
      throw err;
    }

    // Calculate statistics
    const totalBookings = bookings.length;
    const totalRevenue = bookings.reduce(
      (sum, booking) => sum + (booking.totalPrice || 0),
      0
    );

    const statusCounts = {
      pending: bookings.filter((b) => b.status === "pending").length,
      confirmed: bookings.filter((b) => b.status === "confirmed").length,
      checkedIn: bookings.filter((b) => b.status === "checked-in").length,
      checkedOut: bookings.filter((b) => b.status === "checked-out").length,
      cancelled: bookings.filter((b) => b.status === "cancelled").length,
    };

    console.log("Stats:", { totalBookings, totalRevenue, statusCounts });

    res.render("admin/booking-report", {
      title: "Booking Report",
      bookings,
      startDate: startDate || "",
      endDate: endDate || "",
      currentStatus: status || "all",
      stats: {
        totalBookings,
        totalRevenue,
        statusCounts,
      },
    });
  } catch (err) {
    console.error("Error in booking report:", err);
    req.flash("error", "Failed to generate report: " + err.message);
    res.redirect("/admin/reports");
  }
});

// Revenue report 
router.get("/reports/revenue", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = { status: "completed" };
    
    if (startDate && endDate) {
      query.paymentDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Get payment data
    const payments = await Payment.find(query)
      .populate("booking")
      .populate("processedBy")
      .sort({ paymentDate: -1 });

    // Calculate statistics
    const stats = {
      totalRevenue: payments.reduce((sum, p) => sum + p.amount, 0),
      totalPayments: payments.length,
      paymentMethods: payments.reduce((acc, p) => {
        acc[p.paymentMethod] = (acc[p.paymentMethod] || 0) + 1;
        return acc;
      }, {}),

      // Calculate daily revenue for chart
      dailyRevenue: payments.reduce((acc, p) => {
        const date = p.paymentDate.toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + p.amount;
        return acc;
      }, {})
    };

    res.render("admin/revenue-report", {
      title: "Revenue Report",
      payments,
      stats,
      startDate: startDate || "",
      endDate: endDate || ""
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Không thể tải báo cáo doanh thu");
    res.redirect("/admin/reports");
  }
});

// Room report
router.get("/reports/rooms", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const rooms = await Room.find()
      .populate({
        path: 'bookings',
        populate: { 
          path: 'customer',
          select: 'name email'
        }
      });

    // Tính toán thống kê
    const stats = {
      totalRooms: rooms.length,
      occupancyRate: (rooms.filter(r => r.status === 'occupied').length / rooms.length * 100) || 0,
      typeStats: {
        standard: rooms.filter(r => r.type === 'Standard').length,
        deluxe: rooms.filter(r => r.type === 'Deluxe').length,
        suite: rooms.filter(r => r.type === 'Suite').length,
        presidential: rooms.filter(r => r.type === 'Presidential').length
      }
    };

    res.render("admin/room-report", {
      title: "Room Report",
      rooms,
      stats
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Không thể tải báo cáo phòng");
    res.redirect("/admin/reports");
  }
});

// Customer report
router.get("/reports/customers", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const customers = await User.find({ role: 'customer' }).populate('loyaltyPoints');
    
    const bookings = await Booking.find().populate('customer');
    
    // Tính toán thống kê
    const stats = {
      totalCustomers: customers.length,
      activeCustomers: bookings.filter(b => b.status === 'confirmed' || b.status === 'checked-in')
        .map(b => b.customer._id.toString())
        .filter((v, i, a) => a.indexOf(v) === i).length,
      averageLoyaltyPoints: customers.reduce((acc, curr) => acc + (curr.loyaltyPoints || 0), 0) / customers.length
    };

    res.render("admin/customer-report", {
      title: "Customer Report",
      customers,
      stats
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Không thể tải báo cáo khách hàng");
    res.redirect("/admin/reports");
  }
});

// Service report
router.get("/reports/services", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const services = await Service.find();
    const serviceRequests = await ServiceRequest.find()
      .populate('service')
      .populate('customer');

    // Tính toán thống kê
    const stats = {
      totalServices: services.length,
      totalRequests: serviceRequests.length,
      popularServices: serviceRequests.reduce((acc, curr) => {
        acc[curr.service.name] = (acc[curr.service.name] || 0) + 1;
        return acc;
      }, {})
    };

    res.render("admin/service-report", {
      title: "Service Report",
      services,
      serviceRequests,
      stats
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Không thể tải báo cáo dịch vụ");
    res.redirect("/admin/reports");
  }
});

// Review report
router.get("/reports/reviews", isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get all reviews with proper population
    const reviews = await Review.find()
      .populate('customer')
      .populate({
        path: 'booking',
        populate: { 
          path: 'room',
          select: 'roomNumber type'
        }
      })
      .lean(); // Use lean() for better performance

    // Filter out reviews with missing related data
    const validReviews = reviews.filter(review => 
      review && review.customer && review.booking && review.booking.room
    );

    // Tính toán thống kê chỉ với valid reviews
    const stats = {
      totalReviews: validReviews.length,
      averageRating: validReviews.length > 0 
        ? (validReviews.reduce((acc, curr) => acc + curr.rating, 0) / validReviews.length).toFixed(1)
        : 0,
      ratingDistribution: validReviews.reduce((acc, curr) => {
        acc[curr.rating] = (acc[curr.rating] || 0) + 1;
        return acc;
      }, {})
    };

    res.render("admin/review-report", {
      title: "Review Report",
      reviews: validReviews, // Chỉ truyền các review hợp lệ cho template
      stats
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Không thể tải báo cáo đánh giá");
    res.redirect("/admin/reports");
  }
});

// Get booking details
router.get("/bookings/:id", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("customer")
      .populate("room");

    if (!booking) {
      req.flash("error", "Không tìm thấy thông tin đặt phòng");
      return res.redirect("/admin/reports/bookings");
    }

    // Get service requests for this booking
    const serviceRequests = await ServiceRequest.find({ booking: booking._id })
      .populate("service")
      .populate("assignedStaff")
      .sort({ requestDate: -1 });

    // Get payment history
    const payments = await Payment.find({ booking: booking._id })
      .populate("processedBy")
      .sort({ paymentDate: -1 });

    // Get available services
    const availableServices = await Service.find({ available: true });

    // Get reviews for this booking
    const reviews = await Review.find({ booking: booking._id });

    // Redirect to booking-details template with admin context
    res.render("admin/booking-details", {
      title: "Chi tiết đặt phòng",
      booking,
      serviceRequests,
      payments,
      availableServices,
      reviews,
      currentRoute: "reports/bookings" // Thêm biến để xác định route hiện tại
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Không thể tải thông tin đặt phòng");
    res.redirect("/admin/reports/bookings");
  }
});

// Cancel booking
router.post("/bookings/:id/cancel", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      req.flash("error", "Không tìm thấy thông tin đặt phòng");
      return res.redirect("/admin/reports/bookings");
    }

    // Update booking status
    booking.status = "cancelled";
    booking.updatedBy = req.user._id;
    await booking.save();

    // Update room status
    await Room.findByIdAndUpdate(booking.room, { status: "available" });

    // Create notification for customer
    const notification = new Notification({
      recipient: booking.customer,
      title: "Booking Cancelled",
      message: `Your booking has been cancelled by admin.`,
      type: "booking",
      relatedTo: {
        model: "Booking",
        id: booking._id,
      },
    });
    await notification.save();

    req.flash("success", "Đã hủy đặt phòng thành công");
    res.redirect("/admin/reports/bookings");
  } catch (err) {
    console.error(err);
    req.flash("error", "Không thể hủy đặt phòng");
    res.redirect("/admin/reports/bookings");
  }
});

// Send notification
router.get("/notifications", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const users = await User.find().sort({ name: 1 });

    res.render("admin/notifications", {
      title: "Send Notifications",
      users,
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to load users");
    res.redirect("/admin/dashboard");
  }
});

// Send notification process
router.post("/notifications", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { recipients, title, message, type } = req.body;

    let recipientIds = [];

    if (recipients === "all") {
      // Send to all users
      const allUsers = await User.find({}, "_id");
      recipientIds = allUsers.map((user) => user._id);
    } else if (recipients === "customers") {
      // Send to all customers
      const customers = await User.find({ role: "customer" }, "_id");
      recipientIds = customers.map((customer) => customer._id);
    } else if (recipients === "staff") {
      // Send to all staff
      const staff = await User.find({ role: "staff" }, "_id");
      recipientIds = staff.map((staffMember) => staffMember._id);
    } else {
      // Send to specific user
      recipientIds = [recipients];
    }

    // Create notifications
    const notifications = recipientIds.map((recipientId) => ({
      recipient: recipientId,
      title,
      message,
      type: type || "system",
    }));

    await Notification.insertMany(notifications);

    req.flash("success", "Notifications sent successfully");
    res.redirect("/admin/notifications");
  } catch (err) {da
    console.error(err);
    req.flash("error", "Failed to send notifications");
    res.redirect("/admin/notifications");
  }
});

export default router;