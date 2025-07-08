import express from "express";
import Room from "../models/Room.js";
import LoyaltyProgram from "../models/LoyaltyProgram.js";
import mongoose from "mongoose";

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      throw new Error("Database not connected");
    }

    // Get featured rooms with error handling
    let featuredRooms = [];
    try {
      featuredRooms = await Room.find()
        .where("status")
        .equals("available")
        .sort("-price")
        .limit(3)
        .lean();
    } catch (err) {
      console.error("Error fetching rooms:", err);
    }

    // Get loyalty program with error handling
    let loyaltyProgram = null;
    try {
      loyaltyProgram = await LoyaltyProgram.findOne({ isActive: true }).lean();
    } catch (err) {
      console.error("Error fetching loyalty program:", err);
    }

    return res.render("index", {
      title: "Welcome to Luxury Hotel",
      featuredRooms,
      loyaltyProgram,
      currentUser: req.user || null,
    });
  } catch (err) {
    next(err); // Pass error to error handling middleware
  }
});

// About page
router.get("/about", (req, res) => {
  res.render("about", { title: "About Us" });
});

// Contact page
router.get("/contact", (req, res) => {
  res.render("contact", { title: "Contact Us" });
});

// Rooms page (public view)
router.get("/rooms", async (req, res) => {
  try {
    const { type, capacity, priceMin, priceMax } = req.query;

    // Build query
    const query = { status: "available" };

    if (type && type !== "all") {
      query.type = type;
    }

    if (capacity && capacity !== "all") {
      query.capacity = Number(capacity);
    }

    if (priceMin) {
      query.price = { ...query.price, $gte: Number(priceMin) };
    }

    if (priceMax) {
      query.price = { ...query.price, $lte: Number(priceMax) };
    }

    const rooms = await Room.find(query).sort({ price: 1 });

    

    res.render("rooms", {
      title: "Our Rooms",
      rooms,
      filters: { type, capacity, priceMin, priceMax },
    });
  } catch (err) {
    console.error("Rooms page error:", err); 
    res.status(500).render("error/500");
  }
});

// Room details page (public view)
router.get("/rooms/:id", async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      req.flash("error", "Room not found");
      return res.redirect("/rooms");
    }
    res.render("room-details", { title: `${room.type} Room`, room });
  } catch (err) {
    console.error(err);
    req.flash("error", "Something went wrong");
    res.redirect("/rooms");
  }
});

export default router;
