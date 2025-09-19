/**
* Generates long-form drafts from outlines and stores them in Firestore.
* Designed for dependency injection so tests can mock Firestore and the text generator.
*/
import { env } from "../utils/config";
import fetch from "node-fetch";

export type OutlineItem = {
    trend: string;
    idea: string;
    outline: string;
    // optional id from previous rounds
    id?: string;
};


export type DraftDocument = {
    trend: string;
    idea: string;
    outline: string;
    draft: string;
    metadata: {
        wordCount: number;
        createdAt: number; // epoch ms
    };
}; 


/** Count words in a text (simple whitespace split). */
export function wordCount(text: string): number {
    if (!text) return 0;
    // collapse whitespace and split
    return text.trim().split(/\s+/).filter(Boolean).length;
}


/**
* Default text generator using fetch -> Hugging Face or any remote LLM endpoint.
*/
export async function callHuggingFace(prompt: string): Promise<string> {
    const HF_API_URL = `https://api-inference.huggingface.co/models/${env.hfModelR3}`;

    const response = await fetch(HF_API_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${env.HF_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            inputs: prompt,
            parameters: {
                max_new_tokens: 1024,
                temperature: 0.7,
            },
        }),
    });

    if (!response.ok) {
        throw new Error(`HF API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as any;

    let text: string;
    if (Array.isArray(data) && data.length > 0 && data[0].generated_text) {
        text = data[0].generated_text;
    } else if (typeof data === "object" && data.generated_text) {
        text = data.generated_text;
    } else {
        text = JSON.stringify(data);
    }
    // The model sometimes includes the prompt in the response, so we need to remove it.
    if (text.startsWith(prompt)) {
        text = text.substring(prompt.length);
    }

    return text.trim();
}


/**
* Generate a draft for a single outline. Ensures draft meets min/max word constraints.
* The generator function should accept a prompt and return generated text.
*/
export async function generateDraftForOutline(
    item: OutlineItem,
    generator: (prompt: string) => Promise<string> = callHuggingFace,
    opts?: { minWords?: number; maxWords?: number }
): Promise<DraftDocument> {
    const minWords = opts?.minWords ?? 250;
    const maxWords = opts?.maxWords ?? 2000;


    if (!item.outline || !item.idea || !item.trend) {
        throw new Error('Outline item must contain trend, idea, and outline.');
    }


    const basePrompt = `Write a long-form, engaging, coherent draft based on the following outline. Aim for between ${minWords} and ${maxWords} words, prefer closer to the upper half but not exceeding ${maxWords}. Make the content useful and avoid empty output.\n\nTRENDS: ${item.trend}\nIDEA: ${item.idea}\nOUTLINE:\n${item.outline}\n\nDraft:`;


    let draft = await generator(basePrompt);


    // sanitize
    draft = (draft ?? '').trim();
    if (!draft) throw new Error('Generator returned empty draft.');


    const doc: DraftDocument = {
        trend: item.trend,
        idea: item.idea,
        outline: item.outline,
        draft,
        metadata: {
            wordCount: wordCount(draft),
            createdAt: Date.now(),
        },
    };


    // final validation
    if (doc.metadata.wordCount < minWords || doc.metadata.wordCount > maxWords) {
        // simple retry once for now
        draft = await generator(basePrompt);
        draft = (draft ?? '').trim();
        doc.draft = draft;
        doc.metadata.wordCount = wordCount(draft);
    }


    // if still invalid, throw
    if (doc.metadata.wordCount < minWords || doc.metadata.wordCount > maxWords) {
        throw new Error(`Generated draft word count (${doc.metadata.wordCount}) is outside the range ${minWords}-${maxWords}.`);
    }


    return doc;
}


/**
* Process a batch of outlines, generating a draft for each.
* This is the main orchestrator for the drafting round.
* It uses a Firestore-like DB interface for storing results.
*/
export async function processOutlines(
    outlines: OutlineItem[],
    db: { collection: (name: string) => { add: (doc: any) => Promise<any> } },
    generator: (prompt: string) => Promise<string> = callHuggingFace,
    opts?: {
        minWords?: number;
        maxWords?: number;
        maxTotalDrafts?: number;
    }
): Promise<DraftDocument[]> {
    const results: DraftDocument[] = [];
    let draftsCount = 0;
    const maxTotalDrafts = opts?.maxTotalDrafts ?? 1000; // safety cap


    for (const item of outlines) {
        if (draftsCount >= maxTotalDrafts) {
            console.log(`Total drafts limit (${maxTotalDrafts}) reached.`);
            break;
        }


        try {
            const draftDoc = await generateDraftForOutline(item, generator, opts);


            // store in Firestore
            await db.collection('r3_drafts').add(draftDoc);


            results.push(draftDoc);
            draftsCount++;
        } catch (error) {
            console.error(`Error processing outline for trend "${item.trend}":`, error);
            // continue to next item
        }
    }


    return results;
}
