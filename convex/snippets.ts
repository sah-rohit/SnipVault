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

    const snippets = await ctx.db
      .query("snippets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Filter out soft-deleted snippets
    return snippets.filter(s => !s.isDeleted);
  },
});

export const listTrash = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromToken(ctx.db, args.token);
    if (!userId) return [];

    const snippets = await ctx.db
      .query("snippets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Filter to only return soft-deleted snippets
    return snippets.filter(s => s.isDeleted === true);
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

// deleteSnippet now acts as soft delete (moving to Trash Pile)
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

    await ctx.db.patch(args.id, {
      isDeleted: true,
      deletedAt: Date.now(),
    });
    return { success: true };
  },
});

export const restoreSnippet = mutation({
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

    await ctx.db.patch(args.id, {
      isDeleted: false,
      deletedAt: 0,
    });
    return { success: true };
  },
});

export const deleteSnippetPermanently = mutation({
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

export const cleanExpiredTrash = mutation({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromToken(ctx.db, args.token);
    if (!userId) return { count: 0 };

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const allSnippets = await ctx.db
      .query("snippets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let count = 0;
    for (const s of allSnippets) {
      if (s.isDeleted === true && s.deletedAt && s.deletedAt < sevenDaysAgo) {
        await ctx.db.delete(s._id);
        count++;
      }
    }
    return { count };
  },
});

export const restoreAllSnippets = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromToken(ctx.db, args.token);
    if (!userId) throw new Error("Unauthenticated request.");

    const snippets = await ctx.db
      .query("snippets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let count = 0;
    for (const s of snippets) {
      if (s.isDeleted) {
        await ctx.db.patch(s._id, { isDeleted: false, deletedAt: 0 });
        count++;
      }
    }
    return { count };
  },
});

export const emptyTrashPermanently = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromToken(ctx.db, args.token);
    if (!userId) throw new Error("Unauthenticated request.");

    const snippets = await ctx.db
      .query("snippets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let count = 0;
    for (const s of snippets) {
      if (s.isDeleted) {
        await ctx.db.delete(s._id);
        count++;
      }
    }
    return { count };
  },
});
