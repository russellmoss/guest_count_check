// server.js - Backend server for guest count check

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { createClient } = require('@supabase/supabase-js');
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

// Supabase configuration
const SUPABASE_URL = 'https://ggfpkczvvnubjiuiqllv.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnZnBrY3p2dm51YmppdWlxbGx2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzA5Mjc4NywiZXhwIjoyMDY4NjY4Nzg3fQ.ql3zEAdkKyQcJS3t0-il4YITVpsQcPmfJbajNy6EeqM';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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

// Authentication middleware
async function authenticateUser(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        const token = authHeader.substring(7);
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(401).json({ error: 'Authentication failed' });
    }
}

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

// New API endpoint to fetch orders for dashboard display
app.get("/api/orders", authenticateUser, async (req, res) => {
  let { from, to } = req.query;
  let url = "";
  let startDate = undefined;
  let endDate = undefined;

  // Ensure the date is formatted correctly for Commerce7 API (YYYY-MM-DD)
  function formatDate(date) {
    try {
      const dateStr = date.toString();
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateStr; // Already in YYYY-MM-DD format
      }
      
      const d = new Date(date);
      if (isNaN(d.getTime())) {
        throw new Error(`Invalid date: ${date}`);
      }
      
      // Use UTC methods to avoid timezone shifts
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
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

    console.log(`[KINSTA DEBUG] Raw date inputs - from: "${from}", to: "${to}"`);
    
    startDate = from ? formatDate(from) : undefined;
    endDate = to ? formatDate(to) : undefined;
    
    console.log(`[KINSTA DEBUG] Formatted dates - startDate: "${startDate}", endDate: "${endDate}"`);
    
    // Debug: Test with a smaller date range if the range is too large
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      console.log(`[KINSTA DEBUG] Date range spans ${daysDiff} days`);
      
      if (daysDiff > 30) {
        console.log(`[KINSTA WARNING] Large date range (${daysDiff} days) - this might cause API issues`);
      }
    }

    console.log(`[KINSTA] Fetching orders from ${startDate} to ${endDate}...`);

    // Fetch all orders with pagination
    let allOrders = [];
    let page = 1;
    let hasMorePages = true;
    const pageSize = 50; // Commerce7 maximum is 50 per page

    while (hasMorePages) {
      // Build the URL with pagination
      url = `https://api.commerce7.com/v1/order?`;
      if (startDate && endDate) {
        // For date ranges, use btw: with pipe separator
        url += `orderPaidDate=btw:${startDate}|${endDate}`;
      } else if (startDate && !endDate) {
        // From a specific date onwards
        url += `orderPaidDate=gte:${startDate}`;
      } else if (!startDate && endDate) {
        // Up to a specific date
        url += `orderPaidDate=lte:${endDate}`;
      }
      
      // Add pagination parameters
      url += `&page=${page}&limit=${pageSize}`;
      
      console.log(`[KINSTA DEBUG] Fetching page ${page} - URL: ${url}`);

      try {
        const response = await axios.get(url, authConfig);
        
        if (!response.data.orders || response.data.orders.length === 0) {
          hasMorePages = false;
          break;
        }

        allOrders = allOrders.concat(response.data.orders);
        console.log(`[KINSTA DEBUG] Page ${page}: ${response.data.orders.length} orders (Total so far: ${allOrders.length})`);

        // Check if there are more pages
        if (response.data.orders.length < pageSize) {
          hasMorePages = false;
        } else {
          page++;
          
          // Add delay between requests to avoid rate limiting
          if (hasMorePages) {
            console.log(`[KINSTA DEBUG] Waiting 500ms before next request...`);
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        // Safety check to prevent infinite loops
        if (page > 100) {
          console.log(`[KINSTA WARNING] Reached page limit (100) - stopping pagination`);
          hasMorePages = false;
        }
      } catch (error) {
        console.error(`[KINSTA ERROR] Failed to fetch page ${page}:`, error.message);
        if (error.response?.status === 422) {
          console.error(`[KINSTA ERROR] API validation error:`, error.response.data);
        }
        throw error; // Re-throw to be handled by the outer try-catch
      }
    }

    console.log(`[KINSTA] Total orders fetched: ${allOrders.length} across ${page} pages`);

    if (allOrders.length === 0) {
      throw new Error("No orders found for the specified date range");
    }

    // Debug: Log the structure of the first order's items to understand the data format
    if (allOrders.length > 0 && allOrders[0].items) {
      console.log("[KINSTA DEBUG] First order items structure:", JSON.stringify(allOrders[0].items[0], null, 2));
    }
    
    // Debug: Log the date range of returned orders
    if (allOrders.length > 0) {
      const orderDates = allOrders.map(order => ({
        orderNumber: order.orderNumber,
        orderDate: order.orderDate,
        orderPaidDate: order.orderPaidDate,
        orderSubmittedDate: order.orderSubmittedDate
      }));
      console.log("[KINSTA DEBUG] Sample order dates:", orderDates.slice(0, 5));
      
      // Debug: Log financial fields for the first order
      const firstOrder = allOrders[0];
      console.log("[KINSTA DEBUG] Order financial fields:", {
        orderNumber: firstOrder.orderNumber,
        subTotal: firstOrder.subTotal,
        taxTotal: firstOrder.taxTotal,
        tipTotal: firstOrder.tipTotal,
        total: firstOrder.total,
        totalAmount: firstOrder.totalAmount,
        shippingTotal: firstOrder.shippingTotal,
        dutyTotal: firstOrder.dutyTotal
      });
      
      // Check date range coverage
      const dates = allOrders.map(order => order.orderPaidDate || order.orderDate).filter(Boolean);
      if (dates.length > 0) {
        const minDate = new Date(Math.min(...dates.map(d => new Date(d))));
        const maxDate = new Date(Math.max(...dates.map(d => new Date(d))));
        console.log(`[KINSTA DEBUG] Date range of returned orders: ${minDate.toISOString().split('T')[0]} to ${maxDate.toISOString().split('T')[0]}`);
      }
    }

    // Define the products to exclude (from guest_count_check.ps1)
    const excludedProductIDs = [
      "fe778da9-5164-4688-acd2-98d044d7ce84", // NCG
      "718b9fbb-4e23-48c7-8b2d-da86d2624b36", // Trade Guest
      "75d4f6cf-cf69-4e76-8f3b-bb35cc7ddeb3", // Club Member
      "7a5d9556-33e4-4d97-a3e8-37adefc6dcf0"  // Guests
    ];

    // Filter out orders missing guest counts and ensure they DO NOT contain the excluded products
    const filteredOrders = allOrders
      .filter(order => 
        !order.guestCount && // Ensure guest count is missing
        !order.items.some(item => excludedProductIDs.includes(item.productId)) // Exclude specific products
      );

    console.log(`[KINSTA] Found ${filteredOrders.length} orders missing guest counts (from ${allOrders.length} total)`);

    // Return JSON with the full order objects instead of just OrderNumber and SalesAssociate
    res.json({ 
      orders: filteredOrders,
      total: filteredOrders.length,
      dateRange: { from: startDate, to: endDate }
    });

  } catch (error) {
    console.error("[KINSTA ERROR] Orders endpoint error:", {
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

// API endpoint to fetch detailed order information
app.get("/api/order/:orderId", async (req, res) => {
  const { orderId } = req.params;

  try {
    console.log(`[KINSTA] Fetching details for order ID: ${orderId}`);

    // Use the Commerce7 endpoint: GET https://api.commerce7.com/v1/order/{orderId}
    const detailUrl = `https://api.commerce7.com/v1/order/${orderId}`;
    const detailResponse = await axios.get(detailUrl, authConfig);

    const detailedOrder = detailResponse.data;
    console.log(`[KINSTA] Retrieved order details for ${orderId}`);
    
    // Debug: Log the structure of the detailed order's items
    if (detailedOrder.items && detailedOrder.items.length > 0) {
      console.log("[KINSTA DEBUG] Detailed order items structure:", JSON.stringify(detailedOrder.items[0], null, 2));
    }

    // Return the full order object with all nested data including items array
    res.json(detailedOrder);

  } catch (error) {
    console.error("[KINSTA ERROR] Order details endpoint error:", {
      orderId: orderId,
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    res.status(500).json({ 
      message: "Error fetching order details", 
      error: error.response?.data?.message || error.message
    });
  }
});

// API endpoint to get unique list of associates from filtered orders
app.get("/api/associates", async (req, res) => {
  let { from, to } = req.query;
  let url = "";
  let startDate = undefined;
  let endDate = undefined;

  // Ensure the date is formatted correctly for Commerce7 API (YYYY-MM-DD)
  function formatDate(date) {
    try {
      const dateStr = date.toString();
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateStr; // Already in YYYY-MM-DD format
      }
      
      const d = new Date(date);
      if (isNaN(d.getTime())) {
        throw new Error(`Invalid date: ${date}`);
      }
      
      // Use UTC methods to avoid timezone shifts
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
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

    console.log(`[KINSTA] Fetching associates from orders ${startDate} to ${endDate}...`);

    // Build the URL
    url = `https://api.commerce7.com/v1/order?`;
    if (startDate && endDate) {
      url += `orderPaidDate=btw:${startDate}|${endDate}`;
    } else if (startDate) {
      url += `orderPaidDate=gte:${startDate}`;
    } else if (endDate) {
      url += `orderPaidDate=lte:${endDate}`;
    }

    const response = await axios.get(url, authConfig);

    console.log(`[KINSTA] Loaded ${response.data.orders?.length || 0} orders for associate filtering`);

    if (!response.data.orders) {
      throw new Error("Invalid response from Commerce7 API: Missing 'orders' field");
    }

    // Define the products to exclude (from guest_count_check.ps1)
    const excludedProductIDs = [
      "fe778da9-5164-4688-acd2-98d044d7ce84", // NCG
      "718b9fbb-4e23-48c7-8b2d-da86d2624b36", // Trade Guest
      "75d4f6cf-cf69-4e76-8f3b-bb35cc7ddeb3", // Club Member
      "7a5d9556-33e4-4d97-a3e8-37adefc6dcf0"  // Guests
    ];

    // Filter out orders missing guest counts and ensure they DO NOT contain the excluded products
    const filteredOrders = response.data.orders
      .filter(order => 
        !order.guestCount && // Ensure guest count is missing
        !order.items.some(item => excludedProductIDs.includes(item.productId)) // Exclude specific products
      );

    // Extract unique values from order.salesAssociate?.name (same as current code does)
    const uniqueAssociates = [...new Set(filteredOrders.map(order => 
      order.salesAssociate?.name || "Unknown"
    ))].sort();

    console.log(`[KINSTA] Found ${uniqueAssociates.length} unique associates`);

    res.json({ 
      associates: uniqueAssociates,
      total: uniqueAssociates.length,
      dateRange: { from: startDate, to: endDate }
    });

  } catch (error) {
    console.error("[KINSTA ERROR] Associates endpoint error:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      url: url,
      startDate: startDate,
      endDate: endDate
    });
    
    res.status(500).json({ 
      message: "Error fetching associates", 
      error: error.response?.data?.message || error.message,
      details: process.env.NODE_ENV === 'development' ? {
        url: url,
        dates: { from: startDate, to: endDate }
      } : undefined
    });
  }
});

app.get("/export", authenticateUser, async (req, res) => {
  let { from, to, associates, search } = req.query;
  let url = "";
  let startDate = undefined;
  let endDate = undefined;

  // Ensure the date is formatted correctly for Commerce7 API (YYYY-MM-DD)
  function formatDate(date) {
    try {
      const dateStr = date.toString();
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateStr; // Already in YYYY-MM-DD format
      }
      
      const d = new Date(date);
      if (isNaN(d.getTime())) {
        throw new Error(`Invalid date: ${date}`);
      }
      
      // Use UTC methods to avoid timezone shifts
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
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

    console.log(`[KINSTA] Export: Fetching orders from ${startDate} to ${endDate}...`);

    // Build the URL (don't use 'let' here, just assign to existing variable)
    url = `https://api.commerce7.com/v1/order?`;
    if (startDate && endDate) {
      url += `orderPaidDate=btw:${startDate}|${endDate}`;
    } else if (startDate) {
      url += `orderPaidDate=gte:${startDate}`;
    } else if (endDate) {
      url += `orderPaidDate=lte:${endDate}`;
    }

    const response = await axios.get(url, authConfig);

    console.log(`[KINSTA] Export: Loaded ${response.data.orders?.length || 0} orders for export`);

    if (!response.data.orders) {
      throw new Error("Invalid response from Commerce7 API: Missing 'orders' field");
    }

    // ❌ Define the products to exclude (from guest_count_check.ps1)
    const excludedProductIDs = [
      "fe778da9-5164-4688-acd2-98d044d7ce84", // NCG
      "718b9fbb-4e23-48c7-8b2d-da86d2624b36", // Trade Guest
      "75d4f6cf-cf69-4e76-8f3b-bb35cc7ddeb3", // Club Member
      "7a5d9556-33e4-4d97-a3e8-37adefc6dcf0"  // Guests
    ];

    // ✅ Filter out orders missing guest counts and ensure they DO NOT contain the excluded products
    let filteredOrders = response.data.orders
      .filter(order => 
        !order.guestCount && // Ensure guest count is missing
        !order.items.some(item => excludedProductIDs.includes(item.productId)) // Exclude specific products
      );

    // Apply additional filters from dashboard
    if (associates) {
      const associateList = associates.split(',').filter(Boolean);
      if (associateList.length > 0) {
        filteredOrders = filteredOrders.filter(order => 
          associateList.includes(order.salesAssociate?.name)
        );
      }
    }

    if (search) {
      filteredOrders = filteredOrders.filter(order => 
        order.orderNumber.toLowerCase().includes(search.toLowerCase())
      );
    }

    const exportOrders = filteredOrders.map(order => ({
        OrderNumber: order.orderNumber,
      SalesAssociate: order.salesAssociate?.name || "Unknown",
      OrderDate: order.orderPaidDate || order.orderDate,
      TotalAmount: order.totalAmount || 0,
      GuestCount: order.guestCount || "Missing"
      }));

    console.log(`[KINSTA] Export: Found ${exportOrders.length} orders for Excel export`);

    if (exportOrders.length === 0) {
      return res.status(400).json({ message: "No orders missing guest counts found." });
    }

    // ✅ Convert to Excel format
    const worksheet = XLSX.utils.json_to_sheet(exportOrders);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Missing Guest Counts");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    console.log(`[KINSTA] Export: Generated Excel file with ${exportOrders.length} orders`);

    res.setHeader("Content-Disposition", "attachment; filename=guest_count_report.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    console.error("[KINSTA ERROR] Export endpoint error:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      url: url,
      startDate: startDate,
      endDate: endDate
    });
    
    res.status(500).json({ 
      message: "Error generating Excel report", 
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

