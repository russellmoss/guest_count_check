// server.js - Backend server for guest count check

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const dotenvPath = path.resolve(__dirname, ".env");

console.log("Looking for .env at:", dotenvPath);
if (!fs.existsSync(dotenvPath)) {
    console.error("🚨 ERROR: .env file not found at", dotenvPath);
} else {
    console.log("✅ .env file found!");
}

require("dotenv").config(); // Automatically loads .env if present (not needed on Kinsta)

console.log("Loaded ENV Variables:");
console.log("C7_APP_ID:", process.env.C7_APP_ID);
console.log("C7_API_KEY:", process.env.C7_API_KEY ? "Loaded" : "Missing");
console.log("C7_TENANT_ID:", process.env.C7_TENANT_ID);

// Validate required environment variables
const requiredEnvVars = ['C7_APP_ID', 'C7_API_KEY', 'C7_TENANT_ID'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error('🚨 Missing required environment variables:', missingVars.join(', '));
    console.error('Please check your Kinsta environment variables configuration');
    process.exit(1);
}

console.log('✅ All required environment variables loaded');

const axios = require("axios");
const XLSX = require("xlsx");

const app = express();
const PORT = process.env.PORT || 8080;

const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://guestcountcheck-as5e4.kinsta.app'] 
        : true,
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, ".")));

const authConfig = {
  auth: {
    username: process.env.C7_APP_ID,
    password: process.env.C7_API_KEY,
  },
  headers: {
    Tenant: process.env.C7_TENANT_ID || "milea-estate-vineyard",
    "Content-Type": "application/json",
  },
};

// Test endpoint to verify Commerce7 connection
app.get("/test-connection", async (req, res) => {
    try {
        console.log("Testing Commerce7 connection...");
        const response = await axios.get(
            "https://api.commerce7.com/v1/order?limit=1",
            authConfig
        );
        res.json({ 
            success: true, 
            message: "Commerce7 connection successful",
            orderCount: response.data.orders ? response.data.orders.length : 0
        });
    } catch (error) {
        console.error("Commerce7 connection test failed:", error.response?.data || error.message);
        res.status(500).json({ 
            success: false, 
            message: "Commerce7 connection failed",
            error: error.response?.data || error.message 
        });
    }
});

app.get("/export", async (req, res) => {
  let { from, to } = req.query;
  let url = "";
  let startDate = undefined;
  let endDate = undefined;

  // Ensure the date is formatted correctly for Commerce7 API (YYYY-MM-DD)
  function formatDate(date) {
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) {
        throw new Error(`Invalid date: ${date}`);
      }
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (err) {
      console.error("Date formatting error:", err);
      throw new Error(`Failed to format date: ${date}`);
    }
  }

  try {
    if (!from && !to) {
      return res.status(400).json({ message: "At least one date is required." });
    }

    startDate = from ? formatDate(from) : undefined;
    endDate = to ? formatDate(to) : undefined;

    console.log(`Fetching orders from ${startDate} to ${endDate}...`);

    // Build the URL (don't use 'let' here, just assign to existing variable)
    url = `https://api.commerce7.com/v1/order?`;
    if (startDate && endDate) {
      url += `orderPaidDate=btw:${startDate}|${endDate}`;
    } else if (startDate) {
      url += `orderPaidDate=gte:${startDate}`;
    } else if (endDate) {
      url += `orderPaidDate=lte:${endDate}`;
    }
    console.log("Commerce7 Request URL:", url);

    const response = await axios.get(url, authConfig);

    console.log("Commerce7 API Response:", response.data);

    if (!response.data.orders) {
      throw new Error("Invalid response from Commerce7 API: Missing 'orders' field");
    }

    // ❌ Define the products to exclude (from guest_count_check.ps1)
    const excludedProductIDs = [
      "fe778da9-5164-4688-acd2-98d044d7ce84", // NCG
      "718b9fbb-4e23-48c7-8b2d-da86d2624b36", // Trade Guest
      "75d4f6cf-cf69-4e76-8f3b-bb35cc7ddeb3"  // Club Member
    ];

    // ✅ Filter out orders missing guest counts and ensure they DO NOT contain the excluded products
    const filteredOrders = response.data.orders
      .filter(order => 
        !order.guestCount && // Ensure guest count is missing
        !order.items.some(item => excludedProductIDs.includes(item.productId)) // Exclude specific products
      )
      .map(order => ({
        OrderNumber: order.orderNumber,
        SalesAssociate: order.salesAssociate?.name || "Unknown", // Use 'Unknown' if null
      }));

    if (filteredOrders.length === 0) {
      return res.status(400).json({ message: "No orders missing guest counts found." });
    }

    // ✅ Convert to Excel format
    const worksheet = XLSX.utils.json_to_sheet(filteredOrders);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Missing Guest Counts");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", "attachment; filename=guest_count_report.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    console.error("Detailed error:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      url: url,
      startDate: startDate,
      endDate: endDate
    });
    
    res.status(500).json({ 
      message: "Error fetching orders", 
      error: error.response?.data?.message || error.message,
      details: process.env.NODE_ENV === 'development' ? {
        url: url,
        dates: { from: startDate, to: endDate }
      } : undefined
    });
  }
});


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

