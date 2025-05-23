// src/lib/stripe.ts
import Stripe from "stripe";

// make sure STRIPE_SECRET_KEY is set in .env.local
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
	apiVersion: "2025-04-30.basil",
});
