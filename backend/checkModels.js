async function getModels() {
  const key = process.env.GEMINI_API_KEY;
  
  if (!key) {
    console.log("❌ API Key not found. Make sure your .env file is loaded.");
    return;
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const data = await res.json();
    
    const validModels = data.models
      .filter(m => m.supportedGenerationMethods.includes("generateContent"))
      .map(m => m.name.replace('models/', '')); // The SDK automatically adds the 'models/' part
    
    console.log("\n🎯 EXACT MODELS YOU CAN USE:");
    validModels.forEach(m => console.log(`- ${m}`));
    console.log("\n");
    
  } catch (error) {
    console.log("❌ Error fetching from Google:", error);
  }
}

getModels();