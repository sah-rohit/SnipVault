import { action } from "./_generated/server";
import { v } from "convex/values";

const BREVO_API_KEY = process.env.BREVO_API_KEY;

export const sendSystemEmail = action({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;

    if (!apiKey) {
      throw new Error("BREVO_API_KEY environment variable is not configured on the Convex deployment.");
    }
    if (!senderEmail) {
      throw new Error("BREVO_SENDER_EMAIL environment variable is not configured on the Convex deployment.");
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "SnipVault Support", email: senderEmail },
        to: [{ email: args.to }],
        subject: args.subject,
        htmlContent: args.html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send email via Brevo: ${errorText}`);
    }

    return { success: true };
  },
});
