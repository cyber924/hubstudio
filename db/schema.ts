import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const reviewMessages = sqliteTable("review_messages", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  articleId: text("article_id").notNull(),
  role: text("role").notNull(),
  kind: text("kind").notNull(),
  body: text("body").notNull(),
  resultJson: text("result_json"),
  createdAt: text("created_at").notNull(),
}, table => [index("idx_review_messages_owner_article_created").on(table.ownerId, table.articleId, table.createdAt)]);
