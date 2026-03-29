const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
  try {
    const response = await ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: 'A boy with silver hair, anime style',
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: '16:9'
        }
    });

    for (const image of response.generatedImages) {
        console.log("SUCCESS! Image base64 length:", image.image.imageBytes.length);
    }
  } catch (e) {
    console.error("ERROR:", e.message);
  }
}

run();
