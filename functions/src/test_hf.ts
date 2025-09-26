
import { hfComplete } from './clients/hf';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
try {
  admin.initializeApp();
} catch (e) {
  // Ignore re-initialization error
}

async function runTest() {
  const testPrompt = "Hello, who are you?";
  const model = "gpt2"; // Using a known, basic model for the test
  console.log(`Testing Hugging Face API with model: ${model}`);
  try {
    const result = await hfComplete(testPrompt, model);
    console.log("API call successful!");
    console.log("Result:", result);
    process.exit(0);
  } catch (error) {
    console.error("API call failed:", error);
    process.exit(1);
  }
}

runTest();
