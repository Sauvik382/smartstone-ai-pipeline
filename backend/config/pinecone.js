const { Pinecone } = require('@pinecone-database/pinecone');

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const pineconeIndex = pc.index(process.env.PINECONE_INDEX_NAME);

module.exports = { pineconeIndex };