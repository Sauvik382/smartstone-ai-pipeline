const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

const { requireAuth } = require('@clerk/express');

const { handleUpload, getJobStatus, getHistory, deleteDocument } = require("../controllers/upload");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); 
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

router.post("/", requireAuth(), upload.single("document"), handleUpload);
router.get("/history", requireAuth(), getHistory);
router.get("/status/:id", requireAuth(), getJobStatus);
router.delete("/:id", requireAuth(), deleteDocument);

module.exports = router;