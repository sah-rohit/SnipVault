import { mutation, query, internalMutation, action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Helper: Secure SHA-256 password hashing using standard Web Crypto API
async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Helper: Generate a high-entropy cryptographically secure hex string
function generateSecureHex(bytesLength: number): string {
  const array = new Uint8Array(bytesLength);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Helper to verify a session token and retrieve the user ID
export async function getUserIdFromToken(db: any, token: string | undefined): Promise<any | null> {
  if (!token) return null;
  const session = await db
    .query("sessions")
    .withIndex("by_token", (q: any) => q.eq("token", token))
    .unique();
  
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    await db.delete(session._id);
    return null;
  }
  return session.userId;
}

export const signUp = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
    dob: v.string(),
    age: v.number(),
    device: v.string(),
    location: v.string(),
  },
  handler: async (ctx, args) => {
    const emailNormalized = args.email.trim().toLowerCase();
    if (!emailNormalized || args.password.length < 6) {
      throw new Error("Invalid email or password must be at least 6 characters.");
    }

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", emailNormalized))
      .unique();
    if (existingUser) {
      throw new Error("An account with this email already exists.");
    }

    const salt = generateSecureHex(16);
    const passwordHash = await hashPassword(args.password, salt);

    const userId = await ctx.db.insert("users", {
      email: emailNormalized,
      passwordHash,
      salt,
      name: args.name.trim(),
      dob: args.dob,
      age: args.age,
      isVerified: false,
    });

    const defaultCategories = ["General", "Code Snippets", "Recipes", "Bookmarks", "Ideas", "Learning"];
    const now = Date.now();
    for (const catName of defaultCategories) {
      await ctx.db.insert("categories", {
        userId,
        name: catName,
        createdAt: now,
      });
    }

    const token = generateSecureHex(32);
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    await ctx.db.insert("sessions", {
      userId,
      token,
      expiresAt,
      device: args.device,
      location: args.location,
      createdAt: Date.now(),
    });

    return { token, email: emailNormalized };
  },
});

export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    device: v.string(),
    location: v.string(),
  },
  handler: async (ctx, args) => {
    const emailNormalized = args.email.trim().toLowerCase();
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", emailNormalized))
      .unique();
    if (!user || !user.passwordHash || !user.salt) {
      throw new Error("Invalid email or password.");
    }

    const inputHash = await hashPassword(args.password, user.salt);
    if (inputHash !== user.passwordHash) {
      throw new Error("Invalid email or password.");
    }

    const token = generateSecureHex(32);
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    await ctx.db.insert("sessions", {
      userId: user._id,
      token,
      expiresAt,
      device: args.device,
      location: args.location,
      createdAt: Date.now(),
    });

    return { token, email: user.email };
  },
});

export const signOut = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (session) {
      await ctx.db.delete(session._id);
    }
    return { success: true };
  },
});

export const getUser = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromToken(ctx.db, args.token);
    if (!userId) return null;
    
    const user = await ctx.db.get(userId);
    if (!user) return null;
    
    return {
      email: user.email,
      name: user.name || user.email.split('@')[0],
      dob: user.dob || "2000-01-01",
      age: user.age || 26,
      profilePic: user.profilePic,
      isVerified: user.isVerified || false,
    };
  },
});

// --- Profile & Info Mutations ---
export const updateProfilePic = mutation({
  args: {
    token: v.string(),
    profilePic: v.optional(v.string()), // null/undefined deletes profile pic
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromToken(ctx.db, args.token);
    if (!userId) throw new Error("Unauthenticated.");

    await ctx.db.patch(userId, {
      profilePic: args.profilePic || undefined,
    });
    return { success: true };
  },
});

export const verifyEmail = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromToken(ctx.db, args.token);
    if (!userId) throw new Error("Unauthenticated.");

    await ctx.db.patch(userId, { isVerified: true });
    return { success: true };
  },
});

export const updatePassword = mutation({
  args: {
    token: v.string(),
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromToken(ctx.db, args.token);
    if (!userId) throw new Error("Unauthenticated.");

    const user = await ctx.db.get(userId);
    if (!user || !user.passwordHash || !user.salt) throw new Error("User not found.");

    const checkHash = await hashPassword(args.currentPassword, user.salt);
    if (checkHash !== user.passwordHash) {
      throw new Error("Incorrect current password.");
    }

    if (args.newPassword.length < 6) {
      throw new Error("New password must be at least 6 characters.");
    }

    const newSalt = generateSecureHex(16);
    const newHash = await hashPassword(args.newPassword, newSalt);

    await ctx.db.patch(userId, {
      passwordHash: newHash,
      salt: newSalt,
    });
    return { success: true };
  },
});

// --- GDPR GDPR GDPR Data Download ---
export const getUserExportData = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromToken(ctx.db, args.token);
    if (!userId) throw new Error("Unauthenticated.");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found.");

    const categories = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const snippets = await ctx.db
      .query("snippets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return {
      profile: {
        email: user.email,
        name: user.name,
        dob: user.dob,
        age: user.age,
        isVerified: user.isVerified,
        profilePicSize: user.profilePic ? user.profilePic.length : 0,
      },
      categories: categories.map(c => ({ name: c.name, createdAt: c._creationTime })),
      snippets: snippets.map(s => ({
        text: s.text,
        url: s.url,
        category: s.category,
        note: s.note,
        createdAt: s._creationTime,
      })),
      exportTime: Date.now(),
      compliance: "GDPR / CCPA Data Export",
    };
  },
});

// --- Active Session Manager ---
export const listSessions = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromToken(ctx.db, args.token);
    if (!userId) throw new Error("Unauthenticated.");

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return sessions.map(s => ({
      id: s._id,
      device: s.device,
      location: s.location,
      createdAt: s.createdAt || s._creationTime,
      isCurrent: s.token === args.token,
    }));
  },
});

export const revokeSession = mutation({
  args: {
    token: v.string(),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromToken(ctx.db, args.token);
    if (!userId) throw new Error("Unauthenticated.");

    const targetSession = await ctx.db.get(args.sessionId);
    if (!targetSession || targetSession.userId !== userId) {
      throw new Error("Session not found or access denied.");
    }

    await ctx.db.delete(args.sessionId);
    return { success: true, revokedSelf: targetSession.token === args.token };
  },
});

export const revokeAllOtherSessions = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromToken(ctx.db, args.token);
    if (!userId) throw new Error("Unauthenticated.");

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let count = 0;
    for (const s of sessions) {
      if (s.token !== args.token) {
        await ctx.db.delete(s._id);
        count++;
      }
    }
    return { count };
  },
});

// --- Permanent Account Deletion ---
export const deleteAccount = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdFromToken(ctx.db, args.token);
    if (!userId) throw new Error("Unauthenticated.");

    // 1. Delete all user categories
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const cat of categories) {
      await ctx.db.delete(cat._id);
    }

    // 2. Delete all user snippets
    const snippets = await ctx.db
      .query("snippets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const snip of snippets) {
      await ctx.db.delete(snip._id);
    }

    // 3. Delete all active sessions
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const ses of sessions) {
      await ctx.db.delete(ses._id);
    }

    // 4. Delete user account record itself
    await ctx.db.delete(userId);

    return { success: true };
  },
});

// --- Guest Data Migration & Merge Conflict Resolver ---
export const checkMigrationConflicts = query({
  args: {
    email: v.string(),
    localSnippets: v.array(v.object({
      text: v.string(),
      category: v.string(),
    })),
    localCategories: v.array(v.object({
      name: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const emailNormalized = args.email.trim().toLowerCase();
    
    // Check if target email already has an account
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", emailNormalized))
      .unique();

    if (!user) {
      return { exists: false, categoryConflicts: [], snippetConflicts: [] };
    }

    // If account exists, gather all existing categories and snippets
    const cloudCategories = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const cloudSnippets = await ctx.db
      .query("snippets")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const cloudCategoryNames = new Set(cloudCategories.map(c => c.name.toLowerCase()));
    const cloudSnippetTexts = new Set(cloudSnippets.map(s => s.text.trim().toLowerCase()));

    // Find conflicts
    const categoryConflicts: string[] = [];
    const snippetConflicts: string[] = [];

    args.localCategories.forEach(c => {
      if (cloudCategoryNames.has(c.name.toLowerCase())) {
        categoryConflicts.push(c.name);
      }
    });

    args.localSnippets.forEach(s => {
      if (cloudSnippetTexts.has(s.text.trim().toLowerCase())) {
        snippetConflicts.push(s.text);
      }
    });

    return {
      exists: true,
      categoryConflicts,
      snippetConflicts,
    };
  },
});

export const migrateGuestData = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.optional(v.string()), // Optional because for merge we only need password
    dob: v.optional(v.string()),
    age: v.optional(v.number()),
    localSnippets: v.array(v.object({
      text: v.string(),
      url: v.optional(v.string()),
      category: v.string(),
      note: v.optional(v.string()),
      createdAt: v.number(),
    })),
    localCategories: v.array(v.object({
      name: v.string(),
      createdAt: v.number(),
    })),
    mergeAction: v.boolean(),
    device: v.string(),
    location: v.string(),
  },
  handler: async (ctx, args) => {
    const emailNormalized = args.email.trim().toLowerCase();
    let userId: any;

    if (args.mergeAction) {
      // 1. Merge Mode: Verify credentials of existing account
      const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", emailNormalized))
        .unique();
      if (!user || !user.passwordHash || !user.salt) {
        throw new Error("Account not found.");
      }

      const checkHash = await hashPassword(args.password, user.salt);
      if (checkHash !== user.passwordHash) {
        throw new Error("Incorrect account password.");
      }
      userId = user._id;

      // 2. Load existing cloud categories
      const cloudCategories = await ctx.db
        .query("categories")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      const cloudCategoryNames = new Map(cloudCategories.map(c => [c.name.toLowerCase(), c.name]));

      // 3. Load existing cloud snippets
      const cloudSnippets = await ctx.db
        .query("snippets")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      const cloudSnippetTexts = new Set(cloudSnippets.map(s => s.text.trim().toLowerCase()));

      // 4. Merge categories (Insert only non-conflicting ones)
      for (const localCat of args.localCategories) {
        if (!cloudCategoryNames.has(localCat.name.toLowerCase())) {
          await ctx.db.insert("categories", {
            userId,
            name: localCat.name.trim(),
            createdAt: localCat.createdAt || Date.now(),
          });
        }
      }

      // 5. Merge snippets (Rename conflicting ones with "[Guest] " prefix)
      for (const localSnip of args.localSnippets) {
        let finalText = localSnip.text.trim();
        if (cloudSnippetTexts.has(finalText.toLowerCase())) {
          finalText = `[Guest] ${finalText}`;
        }

        await ctx.db.insert("snippets", {
          userId,
          text: finalText,
          url: localSnip.url,
          category: localSnip.category,
          note: localSnip.note,
          createdAt: localSnip.createdAt || Date.now(),
        });
      }

    } else {
      // 1. Fresh Account Creation Mode
      if (!args.name || !args.dob || !args.age) {
        throw new Error("Missing required registration details.");
      }

      const existingUser = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", emailNormalized))
        .unique();
      if (existingUser) {
        throw new Error("An account with this email already exists.");
      }

      const salt = generateSecureHex(16);
      const passwordHash = await hashPassword(args.password, salt);

      userId = await ctx.db.insert("users", {
        email: emailNormalized,
        passwordHash,
        salt,
        name: args.name.trim(),
        dob: args.dob,
        age: args.age,
        isVerified: false,
      });

      // 2. Upload Categories
      const uploadedCategories = new Set<string>();
      for (const localCat of args.localCategories) {
        await ctx.db.insert("categories", {
          userId,
          name: localCat.name.trim(),
          createdAt: localCat.createdAt || Date.now(),
        });
        uploadedCategories.add(localCat.name.toLowerCase());
      }

      // Populate default categories if not already present
      const defaultCategories = ["General", "Code Snippets", "Recipes", "Bookmarks", "Ideas", "Learning"];
      for (const defCat of defaultCategories) {
        if (!uploadedCategories.has(defCat.toLowerCase())) {
          await ctx.db.insert("categories", {
            userId,
            name: defCat,
            createdAt: Date.now(),
          });
        }
      }

      // 3. Upload Snippets
      for (const localSnip of args.localSnippets) {
        await ctx.db.insert("snippets", {
          userId,
          text: localSnip.text.trim(),
          url: localSnip.url,
          category: localSnip.category,
          note: localSnip.note,
          createdAt: localSnip.createdAt || Date.now(),
        });
      }
    }

    // Generate session token valid for 30 days
    const token = generateSecureHex(32);
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    await ctx.db.insert("sessions", {
      userId,
      token,
      expiresAt,
      device: args.device,
      location: args.location,
      createdAt: Date.now(),
    });

    return { token, email: emailNormalized };
  },
});
