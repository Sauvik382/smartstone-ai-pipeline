const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true  
  },
  filename: { 
    type: String, 
    required: true 
  },
  originalName: { 
    type: String, 
    required: true 
  },
  extractedText: { 
    type: String 
  },
  aiSummary: { 
    type: String 
  },
  jobId: {
    type: String
  },
  status: { 
    type: String, 
    enum: ['processing', 'completed', 'failed'],
    default: 'processing'
  }
}, { timestamps: true });

module.exports = mongoose.model('Document', documentSchema);