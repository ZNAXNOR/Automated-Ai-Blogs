
export class LLMClient {
  async generate(options: {
    model: string;
    prompt: string;
    max_tokens: number;
    temperature: number;
  }): Promise<{ text: string }> {
    // This is a placeholder and will be mocked in tests.
    return { text: "" };
  }
}
