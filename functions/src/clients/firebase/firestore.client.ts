/**
 * firestore.client.ts
 * -------------------
 * Central Firestore client initialization + typed helpers.
 * Integrates Zod schema validation (runtime) and TypeScript interfaces
 * (compile-time).
 */

import {
  initializeApp, getApps, getApp, FirebaseApp,
} from "firebase/app";
import {
  getFirestore, connectFirestoreEmulator, Firestore, DocumentReference,
  collection, CollectionReference, doc, setDoc, getDocs, query, where,
  QueryDocumentSnapshot, DocumentData,
} from "firebase/firestore";
import {z} from "zod";

// ---- Local Imports ----
// Note: The interfaces might need adjustment if they rely on Admin SDK types.
import {
  Article, Author, Category, Tag,
} from "@src/interfaces/firestore.interface";
import {
  ArticleSchema, AuthorSchema, CategorySchema, TagSchema,
} from "@src/schemas/storage/firestore.schema";

// ---- Environment Variables ----
const projectId = process.env.GCP_PROJECT_ID;

// ---- Initialize Firebase App (Singleton) ----
console.log("[Firestore] Initializing Firebase app...");
const app: FirebaseApp = getApps().length ?
  getApp() :
  initializeApp({projectId});

// ---- Initialize Firestore ----
console.log("[Firestore] Initializing Firestore client...");
export const db: Firestore = getFirestore(app);

// Connect to local emulator if applicable
if (process.env.USE_FIREBASE_EMULATOR === "true") {
  console.log("⚙️ Using Firestore Emulator at localhost:8080");
  connectFirestoreEmulator(db, "localhost", 8080);
}

// ---- Article Status Enum ----
export type ArticleStatus =
  "scheduled" | "published" | "archived" | "in_review";

// ---- Typed Collection Accessors ----
export const collections = {
  articles: () => collection(db, "articles"),
  authors: () => collection(db, "authors"),
  categories: () => collection(db, "categories"),
  tags: () => collection(db, "tags"),
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
