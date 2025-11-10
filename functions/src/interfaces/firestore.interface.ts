/**
 * Firestore Interface
 * ----------------
 * Defines TypeScript interfaces and type guards for Firestore entities.
 * Works seamlessly with Firestore client (firestore.client.ts).
 */

import { Timestamp, DocumentReference } from 'firebase-admin/firestore';
import type { ArticleStatus } from '../clients/firebase/firestore.client.js';

// ---- Common Reusable Types ----
export interface BaseDoc {
  id?: string;               // Auto-assigned Firestore ID
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ---- Category ----
export interface Category extends BaseDoc {
  name: string;
  slug: string;
  description?: string;
}

// ---- Tag ----
export interface Tag extends BaseDoc {
  name: string;
  slug: string;
  description?: string;
}

// ---- Author ----
export interface Author extends BaseDoc {
  name: string;
  bio?: string;
  avatarUrl?: string;
  socialLinks?: {
    twitter?: string;
    linkedin?: string;
    github?: string;
    website?: string;
  };
}

// ---- Article ----
export interface Article extends BaseDoc {
  title: string;
  slug: string;
  summary?: string;
  content?: string;
  coverImageUrl?: string;
  category: DocumentReference<Category>;
  tags: DocumentReference<Tag>[];
  author: DocumentReference<Author>;
  status: ArticleStatus; // 'scheduled' | 'published' | 'archived' | 'in_review'
  publishedAt?: Timestamp;
  scheduledFor?: Timestamp;
  wordCount?: number;
  readTimeMinutes?: number;
  usedImages?: string[]; // GCS paths or URLs
  metadata?: {
    seoTitle?: string;
    seoDescription?: string;
    keywords?: string[];
  };
}

// ---- Type Guards ----
export function isArticle(doc: any): doc is Article {
  return (
    typeof doc?.title === 'string' &&
    typeof doc?.slug === 'string' &&
    typeof doc?.status === 'string'
  );
}
