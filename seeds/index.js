import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Room from "../models/Room.js";
import Service from "../models/Service.js";
import LoyaltyProgram from "../models/LoyaltyProgram.js";

// Connect to MongoDB
mongoose
  .connect("mongodb://localhost:27017/hotel_management", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
    seedDatabase();
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Seed database with initial data
async function seedDatabase() {
  try {
    // Clear existing data
    await User.deleteMany({});
    await Room.deleteMany({});
    await Service.deleteMany({});
    await LoyaltyProgram.deleteMany({});

    console.log("Cleared existing data");

    // Create admin user
    const admin = new User({
      name: "Admin User",
      email: "admin@gmail.com",
      password: "admin123456",
      role: "admin",
      phone: "0123456789",
      address: "123 Admin Street",
      createdAt: Date.now(),
    });
    await admin.save();
    console.log(
      "Admin user created with email: admin@gmail.com and password: admin123456"
    );

    // Create staff user
    const staff = new User({
      name: "Staff User",
      email: "staff@gmail.com",
      password: "staff123456",
      role: "staff",
      phone: "0123456788",
      address: "456 Staff Street",
      createdAt: Date.now(),
    });
    await staff.save();
    console.log(
      "Staff user created with email: staff@gmail.com and password: staff123456"
    );

    // Create customer user
    const customer = new User({
      name: "Customer User",
      email: "customer@gmail.com",
      password: "customer123456",
      role: "customer",
      phone: "0123456787",
      address: "789 Customer Street",
      loyaltyPoints: 100,
      createdAt: Date.now(),
    });
    await customer.save();
    console.log(
      "Customer user created with email: customer@gmail.com and password: customer123456"
    );

    // Create rooms
    const roomTypes = ["Standard", "Deluxe", "Suite", "Presidential"];
    const roomAmenities = [
      ["Wi-Fi", "TV", "Air Conditioning"],
      ["Wi-Fi", "TV", "Air Conditioning", "Mini Bar", "Safe"],
      [
        "Wi-Fi",
        "TV",
        "Air Conditioning",
        "Mini Bar",
        "Safe",
        "Jacuzzi",
        "Balcony",
      ],
      [
        "Wi-Fi",
        "TV",
        "Air Conditioning",
        "Mini Bar",
        "Safe",
        "Jacuzzi",
        "Balcony",
        "Private Pool",
        "Butler Service",
      ],
    ];
    const roomPrices = [100, 200, 350, 600];
    const roomCapacities = [2, 2, 4, 6];

    for (let floor = 1; floor <= 5; floor++) {
      for (let roomNum = 1; roomNum <= 10; roomNum++) {
        const roomTypeIndex = Math.floor(Math.random() * roomTypes.length);
        const roomNumber = `${floor}${roomNum.toString().padStart(2, "0")}`;

        const room = new Room({
          roomNumber,
          type: roomTypes[roomTypeIndex],
          price: roomPrices[roomTypeIndex],
          capacity: roomCapacities[roomTypeIndex],
          amenities: roomAmenities[roomTypeIndex],
          status: "available",
          floor,
          description: `Beautiful ${roomTypes[roomTypeIndex]} room with amazing views.`,
        });

        await room.save();
      }
    }

    console.log("Rooms created");

    // Create services
    const services = [
      {
        name: "Room Cleaning",
        description: "Standard room cleaning service",
        price: 0,
        category: "cleaning",
        available: true,
      },
      {
        name: "Breakfast in Bed",
        description: "Enjoy a delicious breakfast in the comfort of your room",
        price: 25,
        category: "food",
        available: true,
      },
      {
        name: "Spa Treatment",
        description: "Relaxing spa treatment with professional therapists",
        price: 120,
        category: "spa",
        available: true,
      },
      {
        name: "Airport Transfer",
        description: "Comfortable transfer between the hotel and airport",
        price: 50,
        category: "transport",
        available: true,
      },
      {
        name: "Laundry Service",
        description: "Professional laundry and dry cleaning service",
        price: 30,
        category: "cleaning",
        available: true,
      },
      {
        name: "Room Service",
        description:
          "24/7 room service with a variety of food and beverage options",
        price: 15,
        category: "food",
        available: true,
      },
    ];

    await Service.insertMany(services);
    console.log("Services created");

    // Create loyalty program
    const loyaltyProgram = new LoyaltyProgram({
      name: "Luxury Rewards",
      description: "Earn points for every stay and enjoy exclusive benefits",
      pointsPerDollar: 1,
      tiers: [
        {
          name: "Silver",
          minimumPoints: 0,
          benefits: ["Free Wi-Fi", "10% discount on dining"],
          discountPercentage: 0,
        },
        {
          name: "Gold",
          minimumPoints: 1000,
          benefits: [
            "Free Wi-Fi",
            "15% discount on dining",
            "Late checkout",
            "Room upgrade when available",
          ],
          discountPercentage: 5,
        },
        {
          name: "Platinum",
          minimumPoints: 5000,
          benefits: [
            "Free Wi-Fi",
            "20% discount on dining",
            "Late checkout",
            "Room upgrade when available",
            "Free spa access",
            "Welcome gift",
          ],
          discountPercentage: 10,
        },
        {
          name: "Diamond",
          minimumPoints: 10000,
          benefits: [
            "Free Wi-Fi",
            "25% discount on dining",
            "Late checkout",
            "Room upgrade when available",
            "Free spa access",
            "Welcome gift",
            "Airport transfer",
            "Personal concierge",
          ],
          discountPercentage: 15,
        },
      ],
      isActive: true,
    });

    await loyaltyProgram.save();
    console.log("Loyalty program created");

    console.log("Database seeded successfully");
    process.exit(0);
  } catch (err) {
    console.error("Error seeding database:", err);
    process.exit(1);
  }
}
