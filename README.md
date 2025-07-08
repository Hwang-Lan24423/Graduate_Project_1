# Hotel Management System

A comprehensive full-stack web application for managing hotel operations including room bookings, customer management, service requests, and administrative functions.

## 🚀 Features

### Multi-Role Authentication System
- **Customer**: Room booking, service requests, booking history, reviews, loyalty program participation
- **Staff**: Booking management, room status updates, service request processing, customer management
- **Admin**: Complete system control, user management, reporting, analytics dashboard

### Core Functionality
- **Room Management**: Support for 4 room types (Standard, Deluxe, Suite, Presidential) with detailed information [1](#7-0) 
- **Booking System**: Real-time availability checking, automatic pricing with loyalty discounts [2](#7-1) 
- **Service Management**: 6 service categories including room service, spa, transport, and cleaning [3](#7-2) 
- **Loyalty Program**: Points-based system with tier-based discounts
- **Real-time Notifications**: Automated alerts for bookings, service requests, and reviews
- **Comprehensive Reporting**: 6 detailed report types for analytics and business intelligence

## 🛠 Tech Stack

### Backend
- **Node.js** with Express.js framework
- **MongoDB** with Mongoose ODM
- **Passport.js** for authentication
- **bcrypt** for password hashing
- **Multer** for file uploads

### Frontend
- **EJS** templating engine
- **Bootstrap** for responsive design
- **Font Awesome** for icons

### Development Tools
- **Nodemon** for development
- **dotenv** for environment configuration

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn package manager

## ⚙️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Hwang-Lan24423/Graduate_Project_1.git
   cd Graduate_Project_1
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/hotel_management
   SESSION_SECRET=your-secret-key
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ```

4. **Database Setup**
   ```bash
   # Initialize database
   npm run init-db
   
   # Seed sample data
   npm run seed
   
   # Seed users (optional)
   npm run seed:users
   ```

## 🚀 Usage

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The application will be available at `http://localhost:3000`

## 📊 Database Schema

### Core Models
- **User**: Customer, staff, and admin accounts with role-based permissions [4](#7-3) 
- **Room**: Room information with types, pricing, and availability status
- **Booking**: Reservation management with status tracking [5](#7-4) 
- **Service**: Hotel services and categories
- **Review**: Customer feedback system
- **Notification**: Real-time messaging system
- **LoyaltyProgram**: Customer rewards and discounts
- **Payment**: Transaction tracking
- **ServiceRequest**: Service order management

## 🎯 Key Features Implementation

### Booking System
The booking system includes intelligent availability checking and automatic pricing with loyalty discounts [6](#7-5) 

### Admin Dashboard
Comprehensive analytics dashboard with real-time statistics [7](#7-6) 

### File Upload System
Sophisticated file handling for room and service images using Multer [8](#7-7) 

## 📁 Project Structure

```
├── app.js                 # Main application entry point
├── models/               # Database models
├── routes/               # API routes and controllers
├── views/                # EJS templates
├── public/               # Static assets
├── middleware/           # Custom middleware
├── config/               # Configuration files
├── seeds/                # Database seeding scripts
└── scripts/              # Utility scripts
```

## 🔐 Authentication & Authorization

The system implements a three-tier role-based access control:
- Session-based authentication using Passport.js
- Role-based route protection middleware [9](#7-8) 
- Secure password hashing with bcrypt

## 📈 Reporting & Analytics

Six comprehensive report types available for administrators:
- Booking reports with cancellation rates and revenue
- Revenue analysis by day, month, and year
- Customer analytics and satisfaction metrics
- Room utilization and occupancy rates
- Service performance and popularity
- Review trends and ratings analysis

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the ISC License [10](#7-9) 

## 👥 Author

Graduate Project - Hotel Management System

## 🆘 Support

For support and questions, please open an issue in the GitHub repository.

---

**Note**: This is a graduate project demonstrating full-stack web development capabilities with modern technologies and best practices for hotel management systems.

Wiki pages you might want to explore:
- [Hotel Management System Overview (Hwang-Lan24423/Graduate_Project_1)](/wiki/Hwang-Lan24423/Graduate_Project_1#1)
