const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

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

router.post("/", upload.single("document"), handleUpload);
router.get("/history", getHistory);
router.get("/status/:id", getJobStatus);
router.delete("/:id", deleteDocument);

module.exports = router;