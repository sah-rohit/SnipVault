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

    return await ctx.db
      .query("snippets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc") // Order by creation timestamp descending (matches index structure)
      .collect();
  },
});

export const create = mutation({
  args: {
    token: v.string(),
    text: v.string(),
    url: v.optional(v.string()),
    category: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromToken(ctx.db, args.token);
    if (!userId) {
      throw new Error("Unauthenticated request.");
    }

    const textTrimmed = args.text.trim();
    if (!textTrimmed) {
      throw new Error("Snippet content cannot be empty.");
    }

    return await ctx.db.insert("snippets", {
      userId,
      text: textTrimmed,
      url: args.url?.trim() || undefined,
      category: args.category.trim() || "General",
      note: args.note?.trim() || undefined,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    token: v.string(),
    id: v.id("snippets"),
    text: v.string(),
    url: v.optional(v.string()),
    category: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromToken(ctx.db, args.token);
    if (!userId) {
      throw new Error("Unauthenticated request.");
    }

    const snippet = await ctx.db.get(args.id);
    if (!snippet || snippet.userId !== userId) {
      throw new Error("Snippet not found or unauthorized access.");
    }

    const textTrimmed = args.text.trim();
    if (!textTrimmed) {
      throw new Error("Snippet content cannot be empty.");
    }

    await ctx.db.patch(args.id, {
      text: textTrimmed,
      url: args.url?.trim() || undefined,
      category: args.category.trim() || "General",
      note: args.note?.trim() || undefined,
    });

    return args.id;
  },
});

export const deleteSnippet = mutation({
  args: {
    token: v.string(),
    id: v.id("snippets"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromToken(ctx.db, args.token);
    if (!userId) {
      throw new Error("Unauthenticated request.");
    }

    const snippet = await ctx.db.get(args.id);
    if (!snippet || snippet.userId !== userId) {
      throw new Error("Snippet not found or unauthorized access.");
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});
