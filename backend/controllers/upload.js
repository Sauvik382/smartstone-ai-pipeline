const Document = require('../models/Document');
const { documentQueue } = require('../config/queue');
const { getAuth } = require('@clerk/express'); // 🔑 Import getAuth

const handleUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Hey! The box is empty!" });
    }
    
    const { userId } = getAuth(req); // Use getAuth here too

    const job = await documentQueue.add('process-pdf', {
      filename: req.file.filename,
      originalname: req.file.originalname,
      path: req.file.path,
      userId: userId
    },{
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5000 
      }
    });

    res.status(200).json({
      message: "Got the secret blueprint! It is in the processing queue.",
      jobId: job.id,
      filename: req.file.filename
    });

  } catch (error) {
    console.error(error); 
    res.status(500).json({ error: "Oh no, something broke while queueing!" });
  }
};

const getJobStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await documentQueue.getJob(id);

    if (!job) {
      return res.status(404).json({ error: "Job not found in the queue!" });
    }

    const state = await job.getState(); 
    const result = job.returnvalue;

    res.status(200).json({ id, state, result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch job status" });
  }
};

const getHistory = async (req, res) => {
  try {
    const { userId } = getAuth(req); // Safely extract userId
    
    console.log(`📡 Fetching document history for user: ${userId}...`);
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const documents = await Document.find({ userId: userId }).sort({ createdAt: -1 }); 
    
    res.status(200).json(documents);
  } catch (error) {
    console.error('❌ Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch document history' });
  }
};

const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = getAuth(req); // Safely extract userId
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const deletedDoc = await Document.findOneAndDelete({ _id: id, userId: userId });
    
    if (!deletedDoc) {
      return res.status(404).json({ error: "Document not found, or you don't own it!" });
    }
    
    console.log(`🗑️ Deleted document: ${id}`);
    res.status(200).json({ message: "Document permanently deleted", id });
  } catch (error) {
    console.error('❌ Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
};

module.exports = { handleUpload, getJobStatus, getHistory, deleteDocument };