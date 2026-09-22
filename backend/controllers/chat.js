const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");
const { pineconeIndex } = require("../config/pinecone");
const {
  generateWithRetry,
  isRetryableGoogleError,
  RateLimitExceededError,
} = require("../utils/geminiClient");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const embeddingsClient = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GEMINI_API_KEY,
  model: "gemini-embedding-001",
});

const TARGET_DIMENSION = 768;

// ---------------------------------------------------------------------------
// Embedding helpers (kept identical to documentWorker.js — the query vector
// and the stored document vectors MUST go through the same extraction,
// truncation, and normalization path or cosine similarity in Pinecone will
// be comparing vectors that were prepared two different ways).
// ---------------------------------------------------------------------------

function extractEmbeddingArray(raw) {
  let arr = raw;

  if (!Array.isArray(arr)) {
    if (ArrayBuffer.isView(arr)) {
      arr = Array.from(arr);
    } else if (arr && Array.isArray(arr.values)) {
      arr = arr.values;
    } else if (arr && Array.isArray(arr.embedding)) {
      arr = arr.embedding;
    } else if (arr && arr.embedding && Array.isArray(arr.embedding.values)) {
      arr = arr.embedding.values;
    } else {
      arr = [];
    }
  }

  const nums = Array.from(arr, Number);

  if (nums.length === 0) {
    throw new Error("Embedding extraction produced an empty array — check the embeddings client response shape.");
  }
  if (nums.some((n) => Number.isNaN(n))) {
    throw new Error("Embedding array contains NaN values after casting — refusing to search with a corrupt vector.");
  }

  return nums;
}

function l2Normalize(vec) {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}

function enforceDimension(vec, targetDim = TARGET_DIMENSION) {
  if (vec.length === targetDim) return vec;

  if (vec.length > targetDim) {
    return l2Normalize(vec.slice(0, targetDim));
  }

  throw new Error(
    `Embedding vector has ${vec.length} dimensions, expected ${targetDim}. ` +
      `This usually means the embedding model/config changed — do not pad it, fix the source.`
  );
}

// ---------------------------------------------------------------------------
// Plain-text formatting helper
// ---------------------------------------------------------------------------

/**
 * Strips common Markdown syntax so the response reads as plain conversational
 * text in a UI that doesn't render Markdown (e.g. a plain React <div>/<p>).
 * This is a safety net — the prompt below also asks Gemini not to use
 * Markdown in the first place, but models don't always comply 100%, so this
 * catches whatever slips through. It intentionally does not try to be a full
 * Markdown parser; it just removes the symbols so nothing stray is visible.
 */
function stripMarkdown(text) {
  if (!text) return text;

  let output = text;

  // Fenced code blocks: drop the ``` fences, keep the inner text
  output = output.replace(/```[a-zA-Z]*\n?/g, "");
  output = output.replace(/```/g, "");

  // Inline code: `code` -> code
  output = output.replace(/`([^`]+)`/g, "$1");

  // Bold: **text** or __text__ -> text
  output = output.replace(/\*\*(.*?)\*\*/g, "$1");
  output = output.replace(/__(.*?)__/g, "$1");

  // Italic: *text* or _text_ -> text
  output = output.replace(/\*(.*?)\*/g, "$1");
  output = output.replace(/_(.*?)_/g, "$1");

  // Headers: "## Heading" -> "Heading"
  // (uses [ \t] rather than \s so this never reaches across a line break)
  output = output.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "");

  // Blockquotes: "> text" -> "text"
  output = output.replace(/^[ \t]{0,3}>[ \t]?/gm, "");

  // Horizontal rules: standalone lines of ---, ***, or ___
  output = output.replace(/^[ \t]{0,3}([-*_])\1{2,}[ \t]*$/gm, "");

  // Bullet list markers: "- item" / "* item" / "+ item" -> "item"
  // (uses [ \t] rather than \s so a blank line right before a list isn't
  // accidentally consumed along with the marker)
  output = output.replace(/^[ \t]*[-*+][ \t]+/gm, "");

  // Links: [text](url) -> text (url)
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");

  // Catch-all: remove any leftover markdown symbols the rules above missed
  // (e.g. mismatched/nested emphasis markers)
  output = output.replace(/[*_`#]/g, "");

  // Tidy up whitespace left behind by the removals above
  output = output.replace(/[ \t]+$/gm, "");
  output = output.replace(/\n{3,}/g, "\n\n");

  return output.trim();
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

const askQuestion = async (req, res) => {
  try {
    const { docId, question } = req.body;

    // Grab device ID from header
    const userId = req.headers["x-user-id"] || "anonymous-user";

    if (!docId || !question) {
      return res.status(400).json({ error: "Missing document ID or question." });
    }

    console.log(`[Chat] 🔎 Searching vectors for question: "${question}"`);

    // 1. Convert user's question into vector using active model
    let questionVector;
    try {
      const rawVector = await embeddingsClient.embedQuery(question);
      const extracted = extractEmbeddingArray(rawVector);
      questionVector = enforceDimension(extracted, TARGET_DIMENSION);
    } catch (embedErr) {
      console.error(`[Chat] ❌ Failed to build a valid search vector:`, embedErr.message);
      return res.status(500).json({ error: "AI returned an invalid search vector." });
    }

    // 2. Query Pinecone for top matching chunks
    const searchResults = await pineconeIndex.query({
      vector: questionVector,
      topK: 3,
      includeMetadata: true,
      filter: {
        userId: userId,
        docId: String(docId),
      },
    });

    // 3. Extract text from matches
    const contextChunks = searchResults.matches
      .map((match) => match.metadata?.text)
      .filter(Boolean)
      .join("\n\n---\n\n");

    if (!contextChunks) {
      return res.status(404).json({ answer: "I couldn't find any relevant information in the document to answer that." });
    }

    // 4. Build strict grounded prompt — explicitly asks for plain text so the
    //    model produces fewer Markdown symbols in the first place
    const prompt = `You are an intelligent document assistant. Use the provided context extracted from the user's document to answer their question. If the answer cannot be found in the context, clearly state that you do not know.

Respond in plain conversational text only. Do not use Markdown formatting: no **bold**, no *italics*, no bullet points, no numbered lists, no headers, no backticks. Write it as plain sentences and paragraphs, the way you'd speak to someone.

DOCUMENT CONTEXT:
${contextChunks}

USER QUESTION: ${question}`;

    console.log(`[Chat] 🧠 Sending context to Gemini for evaluation...`);

    let aiAnswer = "";

    // 🛡️ Primary + fallback, each going through the shared free-tier
    // rate limiter and retry-with-backoff (see utils/geminiClient.js)
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
      aiAnswer = await generateWithRetry(model, "gemini-3.6-flash", prompt);
    } catch (primaryError) {
      console.warn(`[Chat] ⚠️ Primary model failed: ${primaryError.message}`);
      try {
        const fallbackModel = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
        aiAnswer = await generateWithRetry(fallbackModel, "gemini-3.5-flash", prompt);
      } catch (fallbackError) {
        console.error(`[Chat] ❌ Fallback model also failed: ${fallbackError.message}`);

        if (fallbackError instanceof RateLimitExceededError) {
          return res.status(429).json({
            error: "You've hit today's free-tier limit for the AI model. Please try again later.",
            retryAfterSeconds: fallbackError.retryAfterSeconds,
          });
        }

        if (isRetryableGoogleError(fallbackError)) {
          return res.status(503).json({
            error: "Our AI provider is experiencing high demand right now. Please try again in a moment.",
          });
        }

        return res.status(500).json({ error: "Failed to generate answer." });
      }
    }

    // 5. Safety net: strip any Markdown symbols that slipped through anyway
    aiAnswer = stripMarkdown(aiAnswer);

    res.status(200).json({ answer: aiAnswer });
  } catch (error) {
    console.error("❌ Chat error:", error);
    res.status(500).json({ error: "Failed to generate answer." });
  }
};

module.exports = { askQuestion };
 