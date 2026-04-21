// Headless commerce schema. Amounts are integer cents. Line-item prices are
// snapshot at add-to-cart time so catalog edits don't retroactively change
// open carts. Webhooks are idempotency-locked via webhook_events.eventId UNIQUE.
import { pgTable, uuid, varchar, timestamp, integer, text, boolean, jsonb, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const productStatusEnum = pgEnum('product_status', ['active', 'draft', 'archived'])
export const cartStatusEnum = pgEnum('cart_status', ['active', 'checked_out', 'abandoned'])
export const orderStatusEnum = pgEnum('order_status', ['pending', 'paid', 'fulfilled', 'refunded', 'cancelled'])
export const paymentStatusEnum = pgEnum('payment_status', ['requires_action', 'processing', 'succeeded', 'failed', 'refunded'])

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    handle: varchar('handle', { length: 100 }).notNull(), // URL slug
    title: varchar('title', { length: 300 }).notNull(),
    description: text('description'),
    status: productStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ handleUniq: uniqueIndex('products_handle_uniq').on(t.handle) }),
)

export const variants = pgTable(
  'variants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    sku: varchar('sku', { length: 100 }).notNull(),
    title: varchar('title', { length: 200 }),
    priceCents: integer('price_cents').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    inventoryQty: integer('inventory_qty').notNull().default(0),
    // Variant attributes like { color: 'red', size: 'M' } — shape is product-dependent.
    attributes: jsonb('attributes').$type<Record<string, string>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ skuUniq: uniqueIndex('variants_sku_uniq').on(t.sku) }),
)

export const carts = pgTable(
  'carts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: varchar('customer_id', { length: 128 }),
    status: cartStatusEnum('status').notNull().default('active'),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ customerIdx: index('carts_customer_idx').on(t.customerId) }),
)

export const lineItems = pgTable(
  'line_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cartId: uuid('cart_id').notNull().references(() => carts.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id').notNull().references(() => variants.id, { onDelete: 'restrict' }),
    qty: integer('qty').notNull(),
    // Snapshot at add-to-cart time — do NOT recompute from variants.priceCents.
    unitPriceCents: integer('unit_price_cents').notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    cartIdx: index('line_items_cart_idx').on(t.cartId),
    cartVariantUniq: uniqueIndex('line_items_cart_variant_uniq').on(t.cartId, t.variantId),
  }),
)

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cartId: uuid('cart_id').notNull().references(() => carts.id, { onDelete: 'restrict' }),
    customerId: varchar('customer_id', { length: 128 }),
    orderNumber: varchar('order_number', { length: 64 }).notNull(),
    subtotalCents: integer('subtotal_cents').notNull(),
    taxCents: integer('tax_cents').notNull().default(0),
    shippingCents: integer('shipping_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    status: orderStatusEnum('status').notNull().default('pending'),
    placedAt: timestamp('placed_at', { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    fulfilledAt: timestamp('fulfilled_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  },
  (t) => ({
    orderNumberUniq: uniqueIndex('orders_order_number_uniq').on(t.orderNumber),
    customerIdx: index('orders_customer_idx').on(t.customerId),
    statusIdx: index('orders_status_idx').on(t.status),
  }),
)

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'restrict' }),
    processor: varchar('processor', { length: 32 }).notNull().default('stripe'),
    processorId: varchar('processor_id', { length: 200 }).notNull(), // pi_... (Stripe PaymentIntent id)
    amountCents: integer('amount_cents').notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    status: paymentStatusEnum('status').notNull().default('requires_action'),
    capturedAt: timestamp('captured_at', { withTimezone: true }),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    processorIdUniq: uniqueIndex('payments_processor_id_uniq').on(t.processor, t.processorId),
    orderIdx: index('payments_order_idx').on(t.orderId),
  }),
)

/**
 * Webhook idempotency log. Every incoming webhook is deduped on processor+event_id.
 * If a duplicate arrives, we skip processing and 200 back so the processor stops retrying.
 */
export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    processor: varchar('processor', { length: 32 }).notNull(),
    eventId: varchar('event_id', { length: 200 }).notNull(),
    type: varchar('type', { length: 100 }).notNull(),
    payload: jsonb('payload').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    error: text('error'),
  },
  (t) => ({
    processorEventUniq: uniqueIndex('webhook_events_processor_event_uniq').on(t.processor, t.eventId),
    typeIdx: index('webhook_events_type_idx').on(t.type),
  }),
)

export const productsRelations = relations(products, ({ many }) => ({
  variants: many(variants),
}))

export const cartsRelations = relations(carts, ({ many }) => ({
  lineItems: many(lineItems),
}))

export const ordersRelations = relations(orders, ({ one, many }) => ({
  cart: one(carts, { fields: [orders.cartId], references: [carts.id] }),
  payments: many(payments),
}))

export type Product = typeof products.$inferSelect
export type Variant = typeof variants.$inferSelect
export type Cart = typeof carts.$inferSelect
export type LineItem = typeof lineItems.$inferSelect
export type Order = typeof orders.$inferSelect
export type Payment = typeof payments.$inferSelect
export type WebhookEvent = typeof webhookEvents.$inferSelect
