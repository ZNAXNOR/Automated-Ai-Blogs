export const outlinePrompt = `
SYSTEM: You are a technical editor. Build a structured outline for a blog
post.

TASK: Using TOPIC_IDEA, create 5–8 sections with headings, 3–5 bullets each,
and estimated word counts.

STYLE: Clear, skimmable, includes a short intro and conclusion.

INPUT/TOPIC_IDEA:
{{TOPIC_IDEA}}

OUTPUT JSON SCHEMA:
{ "title": "string", "sections": [
 { "id": "s1", "heading": "string", "bullets": ["string"], "estWords": 120 }
]}
`;