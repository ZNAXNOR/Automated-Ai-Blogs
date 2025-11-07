/**
 * firestore.client.ts
 * -------------------
 * Central Firestore client initialization for a production environment.
 * Integrates Zod schema validation (runtime) and TypeScript interfaces
 * (compile-time).
 */

import {
  initializeApp, getApps, getApp, FirebaseApp,
} from "firebase/app";
import {
  getFirestore, Firestore, DocumentReference,
  collection, CollectionReference, doc, setDoc, getDocs, query, where,
  QueryDocumentSnapshot, DocumentData,
} from "firebase/firestore";
import {z} from "zod";
import fs from "fs";
import os from "os";
import path from "path";
import {defineSecret} from "firebase-functions/params";

// ---- Local Imports ----
import {
  Article, Author, Category, Tag,
} from "@src/interfaces/firestore.interface.js";
import {
  ArticleSchema, AuthorSchema, CategorySchema, TagSchema,
} from "@src/schemas/storage/firestore.schema.js";

// ---- Environment Variables & Secret Definition ----
const gcpServiceAccountJsonSecret = defineSecret("GCP_SERVICE_ACCOUNT_JSON");

let dbInstance: Firestore | null = null;

function getFirestoreDb(): Firestore {
    if (dbInstance) {
        return dbInstance;
    }

    const secretValue = gcpServiceAccountJsonSecret.value();
    if (!secretValue) {
        throw new Error("GCP_SERVICE_ACCOUNT_JSON secret not available in deployed environment. Ensure it is set.");
    }

    const tempPath = path.join(os.tmpdir(), `sa-${Date.now()}.json`);
    fs.writeFileSync(tempPath, secretValue);
    process.env.GOOGLE_APPLICATION_CREDENTIALS = tempPath;
    console.log("[Firestore] Authenticating using credentials from secret.");
    
    const app: FirebaseApp = getApps().length ? getApp() : initializeApp();
    dbInstance = getFirestore(app);
    console.log("[Firestore] Firestore client initialized for production.");

    return dbInstance;
}

export { getFirestoreDb as db };

// ---- Article Status Enum ----
export type ArticleStatus =
  "scheduled" | "published" | "archived" | "in_review";

// ---- Typed Collection Accessors ----
export const collections = {
  articles: () => collection(getFirestoreDb(), "articles"),
  authors: () => collection(getFirestoreDb(), "authors"),
  categories: () => collection(getFirestoreDb(), "categories"),
  tags: () => collection(getFirestoreDb(), "tags"),
};

// ---- Validation + CRUD Helpers ----
export async function validateAndWrite<T extends DocumentData>(
  collectionName: keyof typeof collections,
  data: T,
  schema: z.ZodSchema<T>,
  id?: string
): Promise<DocumentReference> { // Client SDK DocumentReference is not generic
  console.log(`[Firestore] Validating and writing to ${collectionName}...`);
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    console.error(`❌ Validation failed for ${collectionName}:`,
      parsed.error.format());
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
 * @return {Promise<Article[]>} A promise that resolves to an array of
 * articles.
 */
export async function getPublishedArticles(): Promise<Article[]> {
  console.log("[Firestore] Fetching published articles...");
  const articlesCol = collections.articles();
  const q = query(articlesCol, where("status", "==", "published"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d: QueryDocumentSnapshot) => d.data() as Article);
}

/**
* @param {Category} data The category data.
* @return {Promise<DocumentReference>} A promise that resolves to the document
* reference.
*/
export async function createCategory(data: Category) {
  return validateAndWrite("categories", data, CategorySchema);
}

/**
* @param {Tag} data The tag data.
* @return {Promise<DocumentReference>} A promise that resolves to the document
* reference.
*/
export async function createTag(data: Tag) {
  return validateAndWrite("tags", data, TagSchema);
}

/**
* @param {Author} data The author data.
* @return {Promise<DocumentReference>} A promise that resolves to the document
* reference.
*/
export async function createAuthor(data: Author) {
  return validateAndWrite("authors", data, AuthorSchema);
}

/**
* @param {Article} data The article data.
* @return {Promise<DocumentReference>} A promise that resolves to the document
* reference.
*/
export async function createArticle(data: Article) {
  // Note: The Article interface's DocumentReference fields will need to
  // point to the client SDK's DocumentReference type, not the admin one.
  return validateAndWrite("articles", data,
    ArticleSchema as z.ZodSchema<Article>);
}
