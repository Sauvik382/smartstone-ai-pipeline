const { Queue } = require('bullmq');
const Redis = require('ioredis');

const connection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null 
});

const documentQueue = new Queue('document-processing', { connection });

console.log("Redis connection established and Queue created!");

module.exports = { documentQueue, connection };