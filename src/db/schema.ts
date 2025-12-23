import { sqliteTable, text, real, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql, relations } from 'drizzle-orm';

export const categories = sqliteTable('categories', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    description: text('description'),
    image: text('image'),
    color: text('color'), // Hex color for placeholders
    emoji: text('emoji'), // Emoji for placeholder display
    sortOrder: integer('sort_order').notNull().default(0),
    metadata: text('metadata'), // JSON string for custom field schema
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),
    cachedAnalysis: text('cached_analysis'), // JSON string of last successful analysis
    analysisHash: text('analysis_hash'), // Fingerprint of the list state (items + ranks)
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const items = sqliteTable('items', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    description: text('description'),
    image: text('image'),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    metadata: text('metadata'), // JSON string for custom field values
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`).$onUpdate(() => new Date()),
});

export const users = sqliteTable('users', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    username: text('username').notNull().unique(),
    password: text('password').notNull(),
    role: text('role').notNull().default('USER'), // 'ADMIN' | 'USER'
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const sessions = sqliteTable('sessions', {
    sessionToken: text('sessionToken').primaryKey(),
    userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
    expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
});

export const ratings = sqliteTable('ratings', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    value: real('value').notNull(),
    tier: text('tier'),
    customRank: text('custom_rank'), // Custom rank name for category-specific ranks
    type: text('type').notNull(), // "NUMERICAL", "TIER", "HYBRID"
    itemId: text('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const customRanks = sqliteTable('custom_ranks', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    categoryId: text('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sentiment: text('sentiment').notNull(), // "positive", "neutral", "negative"
    sortOrder: integer('sort_order').notNull().default(0),
    color: text('color'), // Optional color for visual distinction
    type: text('type').notNull().default('RANKED'), // 'RANKED' | 'UTILITY'
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const tags = sqliteTable('tags', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull().unique(),
});

export const itemsToTags = sqliteTable('items_to_tags', {
    itemId: text('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
    tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (t) => ({
    pk: primaryKey({ columns: [t.itemId, t.tagId] }),
}));

export const settings = sqliteTable('settings', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    key: text('key').notNull().unique(),
    value: text('value').notNull(),
});

export const categoriesRelations = relations(categories, ({ many, one }) => ({
    items: many(items),
    customRanks: many(customRanks),
    owner: one(users, {
        fields: [categories.userId],
        references: [users.id],
    }),
}));

export const itemsRelations = relations(items, ({ many, one }) => ({
    ratings: many(ratings),
    tags: many(itemsToTags),
    category: one(categories, {
        fields: [items.categoryId],
        references: [categories.id],
    }),
}));

export const ratingsRelations = relations(ratings, ({ one }) => ({
    item: one(items, {
        fields: [ratings.itemId],
        references: [items.id],
    }),
    user: one(users, {
        fields: [ratings.userId],
        references: [users.id],
    }),
}));

export const usersRelations = relations(users, ({ many }) => ({
    ratings: many(ratings),
    sessions: many(sessions),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
    items: many(itemsToTags),
}));

export const itemsToTagsRelations = relations(itemsToTags, ({ one }) => ({
    item: one(items, {
        fields: [itemsToTags.itemId],
        references: [items.id],
    }),
    tag: one(tags, {
        fields: [itemsToTags.tagId],
        references: [tags.id],
    }),
}));

export const customRanksRelations = relations(customRanks, ({ one }) => ({
    category: one(categories, {
        fields: [customRanks.categoryId],
        references: [categories.id],
    }),
}));
