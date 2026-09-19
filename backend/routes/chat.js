// backend/routes/chat.js
const express = require("express");
const router = express.Router();

const { askQuestion } = require("../controllers/chat");

// When a POST request hits this route, run the askQuestion function
router.post("/", askQuestion);

module.exports = router;