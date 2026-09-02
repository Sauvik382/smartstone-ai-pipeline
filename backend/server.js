const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

require("./config/queue");
require("./workers/documentWorker");

const uploadRoutes = require("./routes/upload");

const app = express();
app.use(express.json());
app.use(cors());

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("📁 Created missing uploads directory for Render.");
}

mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    bufferCommands: false,         
  })
  .then(() => console.log("🗄️  MongoDB Vault is securely locked and loaded!"))
  .catch((err) => console.error("❌ MongoDB Connection Error on Render:", err));
  
app.use("/api/upload", uploadRoutes);

app.get("/", (req, res) => {
  res.send("🚀 Smartstone API is live and running!");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Treehouse Post Office is OPEN on port ${PORT}`);
});