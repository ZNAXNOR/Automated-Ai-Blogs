import { HttpsError } from "firebase-functions/v2/https";

export async function hfComplete(prompt: string, model: string): Promise<string> {
  console.log(`Mock hfComplete called with prompt: "${prompt}" and model: "${model}"`);
  
  // Simulate a delay to mimic the async nature of the API call
  await new Promise(resolve => setTimeout(resolve, 100));

  const mockCharacter = {
    "name": "Eldrin",
    "description": "An ancient elf with a mysterious past.",
    "apperance": "Tall and slender, with long silver hair and piercing blue eyes.",
    "lore": "Eldrin has wandered the lands for centuries, witnessing the rise and fall of empires. He carries a staff made of a single, ancient oak branch, and is said to possess knowledge lost to time."
  };

  return JSON.stringify(mockCharacter);
}

export function extractJsonFromText(text: string): string | null {
  try {
    JSON.parse(text);
    return text;
  } catch (e) {
    return null;
  }
}
