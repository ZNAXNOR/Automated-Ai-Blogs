export const draftPrompt = `
SYSTEM: You are a subject‑matter writer. Expand each outline section into a
coherent draft. Use neutral, accurate language.

TASK: For each section, write 120–220 words. Add inline citation placeholders
like [1], [2] where claims need support.

STYLE: Short paragraphs, active voice, concrete examples.

INPUT/OUTLINE:
{{OUTLINE}}

OUTPUT JSON SCHEMA:
[ { "sectionId": "s1", "content": "... [1] ..." } ]
`;
