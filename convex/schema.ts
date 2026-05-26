import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    passwordHash: v.optional(v.string()), // Optional so that we can support migrating accounts cleanly
    salt: v.optional(v.string()),
    name: v.optional(v.string()),
    dob: v.optional(v.string()),
    age: v.optional(v.number()),
    profilePic: v.optional(v.string()), // Base64 encoded cropped avatar
    isVerified: v.optional(v.boolean()), // Simulated verification badge status
    lastResetRequestAt: v.optional(v.number()),
    resetRequestTimestamps: v.optional(v.array(v.number())),
    resendContactSynced: v.optional(v.boolean()),
    created_at: v.optional(v.number()),
  }).index("by_email", ["email"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(), // timestamp
    device: v.string(), // e.g., "Firefox on macOS"
    location: v.string(), // e.g., "London, UK"
    createdAt: v.number(), // timestamp
  }).index("by_token", ["token"])
    .index("by_user", ["userId"]),

  categories: defineTable({
    userId: v.id("users"),
    name: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  snippets: defineTable({
    userId: v.id("users"),
    text: v.string(),
    url: v.optional(v.string()),
    category: v.string(),
    note: v.optional(v.string()),
    createdAt: v.number(),
    isDeleted: v.optional(v.boolean()),
    deletedAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  verificationTokens: defineTable({
    email: v.string(),
    token: v.string(),
    type: v.string(), // "verify_email" | "reset_password"
    expiresAt: v.number(),
  }).index("by_token", ["token"]),
});
