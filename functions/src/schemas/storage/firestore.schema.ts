/**
 * firestore.schema.ts
 * -------------------
 * Zod schema definitions for Firestore entities.
 * Ensures runtime validation of article, author, category, and tag documents.
 */

import {z} from "zod";

/**
 * Valid article status values.
 * Enforced both at runtime and via TypeScript inference.
 */
export const ArticleStatusEnum = z.enum([
  "scheduled",
  "published",
  "archived",
  "in_review",
]);
export type ArticleStatus = z.infer<typeof ArticleStatusEnum>;

/**
 * Common base fields across documents.
 */
export const BaseDocSchema = z.object({
  id: z.string().optional(),
  createdAt: z.any().optional(), // Firestore Timestamp
  updatedAt: z.any().optional(),
});

/**
 * Category schema.
 */
export const CategorySchema = BaseDocSchema.extend({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
});
export type Category = z.infer<typeof CategorySchema>;

/**
 * Tag schema.
 */
export const TagSchema = BaseDocSchema.extend({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
});
export type Tag = z.infer<typeof TagSchema>;

/**
 * Author schema.
 */
export const AuthorSchema = BaseDocSchema.extend({
  name: z.string().min(1),
  bio: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  socialLinks: z
    .object({
      twitter: z.string().url().optional(),
      linkedin: z.string().url().optional(),
      github: z.string().url().optional(),
      website: z.string().url().optional(),
    })
    .optional(),
});
export type Author = z.infer<typeof AuthorSchema>;

/**
 * Article schema.
 * Uses document references for related entities.
 */
export const ArticleSchema = BaseDocSchema.extend({
  title: z.string().min(1),
  slug: z.string().min(1),
  summary: z.string().optional(),
  content: z.string().optional(),
  coverImageUrl: z.string().url().optional(),
  category: z.any(), // DocumentReference<Category>
  tags: z.array(z.any()).optional(), // DocumentReference<Tag>[]
  author: z.any(), // DocumentReference<Author>
  status: ArticleStatusEnum,
  publishedAt: z.any().optional(),
  scheduledFor: z.any().optional(),
  wordCount: z.number().optional(),
  readTimeMinutes: z.number().optional(),
  usedImages: z.array(z.string()).optional(),
  metadata: z
    .object({
      seoTitle: z.string().optional(),
      seoDescription: z.string().optional(),
      keywords: z.array(z.string()).optional(),
    })
    .optional(),
});
export type Article = z.infer<typeof ArticleSchema>;
