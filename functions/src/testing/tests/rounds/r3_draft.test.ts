import { wordCount, OutlineItem, generateDraftForOutline, DraftDocument, processOutlines } from '../../../rounds/r3_draft';

const mockGenerator = async (prompt: string): Promise<string> => {
    return 'This is a generated draft. '.repeat(20);
  };
  
  const makeMockDb = () => {
    const writes: { doc: any }[] = [];
    return {
      collection: (_name: string) => ({
        add: async (doc: any) => {
          writes.push({ doc });
          return { id: 'mock-id' };
        },
      }),
      writes,
    };
  };

describe('Round 3 drafts processing', () => {
    test('wordCount utility works', () => {
    expect(wordCount('')).toBe(0);
    expect(wordCount('one two three')).toBe(3);
    });
    
    
    test('generateDraftForOutline produces a draft meeting constraints', async () => {
    const item: OutlineItem = { trend: 'trend x', idea: 'idea y', outline: '1. intro\n2. body\n3. conclusion' };
    const doc = await generateDraftForOutline(item, mockGenerator, { minWords: 50, maxWords: 2000 });
    expect(doc.trend).toBe(item.trend);
    expect(doc.idea).toBe(item.idea);
    expect(doc.outline).toBe(item.outline);
    expect(typeof doc.draft).toBe('string');
    expect(doc.draft.trim().length).toBeGreaterThan(0);
    expect(doc.metadata.wordCount).toBeGreaterThanOrEqual(50);
    expect(doc.metadata.wordCount).toBeLessThanOrEqual(2000);
    });
    
    
    test('processOutlines writes one draft per outline and respects total limit', async () => {
    const outlines: OutlineItem[] = Array.from({ length: 5 }).map((_, i) => ({
    trend: `trend ${i}`,
    idea: `idea ${i}`,
    outline: `outline ${i}`,
    }));
    
    
    const db = makeMockDb();
    const results = await processOutlines(outlines, db as any, mockGenerator, { minWords: 50, maxWords: 2000, maxTotalDrafts: 60 });
    
    
    expect(results.length).toBe(5);
    expect(db.writes.length).toBe(5);
    
    
    // check structure of stored docs
    for (const w of db.writes) {
    const d = w.doc as DraftDocument;
    expect(d.trend).toBeDefined();
    expect(d.idea).toBeDefined();
    expect(d.outline).toBeDefined();
    expect(typeof d.draft).toBe('string');
    expect(d.draft.trim()).not.toHaveLength(0);
    expect(d.metadata).toBeDefined();
    expect(typeof d.metadata.wordCount).toBe('number');
    expect(d.metadata.wordCount).toBeGreaterThanOrEqual(50);
    expect(d.metadata.wordCount).toBeLessThanOrEqual(2000);
    }
    });
    
    
    test('total drafts limited to 60', async () => {
    const outlines: OutlineItem[] = Array.from({ length: 100 }).map((_, i) => ({
    trend: `trend ${i}`,
    idea: `idea ${i}`,
    outline: `outline ${i}`,
    }));
    const db = makeMockDb();
    const results = await processOutlines(outlines, db as any, mockGenerator, { minWords: 50, maxWords: 2000, maxTotalDrafts: 60 });
    expect(results.length).toBeLessThanOrEqual(60);
    expect(db.writes.length).toBeLessThanOrEqual(60);
    });
    
    
    test('throws when generator returns empty', async () => {
    const badGen = async (_: string) => '';
    const item: OutlineItem = { trend: 't', idea: 'i', outline: 'o' };
    await expect(generateDraftForOutline(item, badGen)).rejects.toThrow(/empty/);
    });
});