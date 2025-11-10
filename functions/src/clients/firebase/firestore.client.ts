/**
 * firestore.client.ts
 * -------------------
 * Central Firestore client initialization + typed helpers.
 * Integrates Zod schema validation (runtime) and TypeScript interfaces (compile-time).
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, Firestore, 
  DocumentReference, collection, CollectionReference, 
  doc, setDoc, getDocs, query, where, QueryDocumentSnapshot,
} from 'firebase/firestore';
import { z } from 'zod';
import { GCP_PROJECT_ID_CONFIG } from '@src/config.js';

// ---- Local Imports ----
// Note: The interfaces might need adjustment if they rely on Admin SDK types.
import { Article, Author, Category, Tag } from '@src/interfaces/firestore.interface.js';
import { ArticleSchema, AuthorSchema, CategorySchema, TagSchema } from '@src/schemas/storage/firestore.schema.js';

let dbInstance: Firestore;

export function getDb(): Firestore {
    if (!dbInstance) {
        console.log('[Firestore] Initializing Firebase app...');
        const projectId = GCP_PROJECT_ID_CONFIG.value();
        const app: FirebaseApp = getApps().length ? getApp() : initializeApp({ projectId });
        
        console.log('[Firestore] Initializing Firestore client...');
        dbInstance = getFirestore(app);
    }
    return dbInstance;
}

// ---- Article Status Enum ----
export type ArticleStatus = 'scheduled' | 'published' | 'archived' | 'in_review';

// ---- Typed Collection Accessors ----
export const collections = {
  articles: () => collection(getDb(), 'articles'),
  authors: () => collection(getDb(), 'authors'),
  categories: () => collection(getDb(), 'categories'),
  tags: () => collection(getDb(), 'tags'),
};

// ---- Validation + CRUD Helpers ----
/**
 * Validate data against the schema before writing to Firestore.
 */
export async function validateAndWrite<T extends { [x: string]: any; }>( // Adjusted type for setDoc
  collectionName: keyof typeof collections,
  data: T,
  schema: z.ZodSchema<T>,
  id?: string
): Promise<DocumentReference> { // Client SDK DocumentReference is not generic
  console.log(`[Firestore] Validating and writing to ${collectionName}...`);
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    console.error(`❌ Validation failed for ${collectionName}:`, parsed.error.format());
    throw new Error(`Validation error for ${collectionName}`);
  }

  const colRef = collections[collectionName]() as CollectionReference;
  const docRef = id ? doc(colRef, id) : doc(colRef);
  await setDoc(docRef, parsed.data); // parsed.data is the validated object
  console.log(`✅ Successfully wrote ${collectionName}/${docRef.id}`);
  return docRef;
}

/**
 * Example typed accessors (optional)
 */
export async function getPublishedArticles(): Promise<Article[]> {
    console.log('[Firestore] Fetching published articles...');
  const articlesCol = collections.articles();
  const q = query(articlesCol, where('status', '==', 'published'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d: QueryDocumentSnapshot) => d.data() as Article);
}

export async function createCategory(data: Category) {
  return validateAndWrite('categories', data, CategorySchema);
}

export async function createTag(data: Tag) {
  return validateAndWrite('tags', data, TagSchema);
}

export async function createAuthor(data: Author) {
  return validateAndWrite('authors', data, AuthorSchema);
}

export async function createArticle(data: Article) {
  // Note: The Article interface's DocumentReference fields will need to point to
  // the client SDK's DocumentReference type, not the admin one.
  return validateAndWrite('articles', data, ArticleSchema as any);
}
