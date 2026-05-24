import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getUserIdFromToken } from "./auth";

export const list = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromToken(ctx.db, args.token);
    if (!userId) return [];

    const categories = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Sort by name case-insensitively
    return categories.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const create = mutation({
  args: {
    token: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromToken(ctx.db, args.token);
    if (!userId) {
      throw new Error("Unauthenticated request.");
    }

    const nameTrimmed = args.name.trim();
    if (!nameTrimmed) {
      throw new Error("Category name cannot be empty.");
    }

    // Check if category already exists for this user
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("name"), nameTrimmed))
      .first();

    if (existing) {
      return existing._id;
    }

    const catId = await ctx.db.insert("categories", {
      userId,
      name: nameTrimmed,
      createdAt: Date.now(),
    });

    return catId;
  },
});
