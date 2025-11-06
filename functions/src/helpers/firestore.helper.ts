import {collections} from "../clients/firebase/firestore.client";
import {Article} from "../interfaces/firestore.interface";
import {Timestamp, doc, setDoc, query, where,
  getDocs, QueryDocumentSnapshot, DocumentData}
  from "firebase/firestore";

/**
 * Creates a new article in Firestore.
 * @param {Omit<Article, "id" | "createdAt" | "updatedAt">} data The
 * article data to be created.
 * @return {Promise<Article>} The created article with all its fields.
 */
export async function createArticle(
  data: Omit<Article, "id" | "createdAt" | "updatedAt">
): Promise<Article> {
  const docRef = doc(collections.articles());
  const now = Timestamp.now();

  const article: Article = {
    ...data,
    id: docRef.id,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(docRef, article);
  return article;
}

/**
 * Fetches all published articles from Firestore.
 * @return {Promise<Article[]>} A promise that resolves to an array
 * of published articles.
 */
export async function getPublishedArticles(): Promise<Article[]> {
  const q = query(collections.articles(), where(
    "status", "==", "published"
  ));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(
    (d: QueryDocumentSnapshot<DocumentData>) => d.data() as Article
  );
}
