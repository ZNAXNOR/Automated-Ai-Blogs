import {collections, db} from "../clients/firebase/firestore.client";
import {Article} from "../interfaces/firestore.interface";
import {Timestamp, doc, setDoc, query, where, getDocs} from "firebase/firestore";

// ---- Create Article ----
export async function createArticle(data: Omit<Article, "id" | "createdAt" | "updatedAt">) {
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

// ---- Fetch Published Articles ----
export async function getPublishedArticles(): Promise<Article[]> {
  const q = query(collections.articles(), where("status", "==", "published"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d:any) => d.data() as Article);
}
