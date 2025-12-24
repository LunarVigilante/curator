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
    isFeatured: integer('is_featured', { mode: 'boolean' }).notNull().default(false),
    cachedAnalysis: text('cached_analysis'), // JSON string of last successful analysis
    analysisHash: text('analysis_hash'), // Fingerprint of the list state (items + ranks)
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const globalItems = sqliteTable('global_items', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    externalId: text('external_id').unique(), // e.g. 'tmdb-123'
    title: text('title').notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    releaseYear: integer('release_year'),
    metadata: text('metadata'), // JSON for cast, director, etc.
    categoryType: text('category_type'), // ANIME, GAME, MOVIE, etc.
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const items = sqliteTable('items', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    // Temporary name field for migration
    name: text('name'),
    description: text('description'),
    image: text('image'),
    metadata: text('metadata'),
    status: text('status').notNull().default('ACTIVE'), // 'ACTIVE', 'IGNORED', 'SEEN', 'WISHLIST'

    // New Master/Instance fields
    globalItemId: text('global_item_id').references(() => globalItems.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    tier: text('tier'), // Storing tier directly here now
    rank: integer('rank'), // Custom sort rank within tier
    notes: text('notes'),

    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    eloScore: real('elo_score').notNull().default(1200),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`).$onUpdate(() => new Date()),
});

export const users = sqliteTable('user', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull().default(false),
    image: text('image'),
    bio: text('bio'),
    preferences: text('preferences'), // JSON string for { theme, visibility, etc. }
    role: text('role').notNull().default('USER'), // 'ADMIN' | 'USER'
    requiredPasswordChange: integer('required_password_change', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`).$onUpdate(() => new Date()),
});

export const sessions = sqliteTable('session', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`).$onUpdate(() => new Date()),
});

export const accounts = sqliteTable('account', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    accountId: text('accountId').notNull(),
    providerId: text('providerId').notNull(),
    userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('accessToken'),
    refreshToken: text('refreshToken'),
    idToken: text('idToken'),
    expiresAt: integer('expiresAt', { mode: 'timestamp' }),
    password: text('password'), // For credential auth
    createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`).$onUpdate(() => new Date()),
});

export const verifications = sqliteTable('verification', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
    createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`).$onUpdate(() => new Date()),
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

export const systemSettings = sqliteTable('system_settings', {
    key: text('key').primaryKey(), // e.g., 'openai_api_key'
    value: text('value').notNull(), // Encrypted value
    category: text('category').notNull(), // 'LLM', 'SECURITY', 'GENERAL'
    isSecret: integer('is_secret', { mode: 'boolean' }).notNull().default(false), // e.g. true for API keys
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`).$onUpdate(() => new Date()),
});

export const emailTemplates = sqliteTable('email_templates', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull().unique(), // e.g., 'password-reset', 'invite-user'
    subject: text('subject').notNull(),
    bodyHtml: text('body_html').notNull(),
    variables: text('variables'), // JSON string listing available placeholders
    lastUpdated: integer('last_updated', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`).$onUpdate(() => new Date()),
});

export const invites = sqliteTable('invites', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    code: text('code').notNull().unique(),
    createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
    isUsed: integer('is_used', { mode: 'boolean' }).notNull().default(false),
    usedBy: text('used_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    usedAt: integer('used_at', { mode: 'timestamp' }),
});

// Deprecated: Old settings table, keeping for now to avoid breaking existing users until full migration
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
    globalItem: one(globalItems, {
        fields: [items.globalItemId],
        references: [globalItems.id],
    }),
    user: one(users, {
        fields: [items.userId],
        references: [users.id],
    }),
}));

export const globalItemsRelations = relations(globalItems, ({ many }) => ({
    instances: many(items),
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
