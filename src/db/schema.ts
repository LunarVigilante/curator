import { sqliteTable, text, real, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql, relations } from 'drizzle-orm';

export const categories = sqliteTable('categories', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    description: text('description'),
    image: text('image'),
    color: text('color'), // Hex color for placeholders
    metadata: text('metadata'), // JSON string for custom field schema
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

export const ratings = sqliteTable('ratings', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    value: real('value').notNull(),
    tier: text('tier'),
    type: text('type').notNull(), // "NUMERICAL", "TIER", "HYBRID"
    itemId: text('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
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

export const categoriesRelations = relations(categories, ({ many }) => ({
    items: many(items),
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
