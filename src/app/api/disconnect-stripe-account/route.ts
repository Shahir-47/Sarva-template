// src/app/api/disconnect-stripe-account/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/firebase/config";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import Stripe from "stripe";

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
	apiVersion: "2025-04-30.basil",
});

export async function POST(request: NextRequest) {
	try {
		// Parse request body
		const body = await request.json();
		const { entityId, entityType, userId } = body;

		// Validate input
		if (!entityId || !entityType || !userId) {
			return NextResponse.json(
				{ error: "Missing required fields" },
				{ status: 400 }
			);
		}

		// Check if the user is trying to modify their own account
		if (userId !== entityId) {
			return NextResponse.json(
				{ error: "You can only disconnect your own Stripe account" },
				{ status: 403 }
			);
		}

		if (!["vendors", "drivers"].includes(entityType)) {
			return NextResponse.json(
				{ error: "Invalid entity type" },
				{ status: 400 }
			);
		}

		// Get the entity document reference
		const entityRef = doc(db, entityType, entityId);

		// Get current entity data
		const entitySnap = await getDoc(entityRef);

		if (!entitySnap.exists()) {
			return NextResponse.json({ error: "Entity not found" }, { status: 404 });
		}

		const entityData = entitySnap.data();
		const stripeAccountId = entityData?.stripeAccountId;

		if (!stripeAccountId) {
			return NextResponse.json(
				{ error: "No Stripe account connected" },
				{ status: 400 }
			);
		}

		try {
			// If you wanted to actually deactivate the account on Stripe's end:
			await stripe.accounts.update(stripeAccountId, {
				capabilities: {
					card_payments: { requested: false },
					transfers: { requested: false },
				},
			});
		} catch (stripeError) {
			console.error("Error deactivating Stripe account:", stripeError);
			// Continue with local disconnection even if Stripe API fails
		}

		// Update Firestore: Remove Stripe account ID from the entity
		await updateDoc(entityRef, {
			stripeAccountId: null,
			stripeAccountStatus: "disconnected",
			stripeOnboardingComplete: false,
			stripeDisconnectedAt: new Date().toISOString(),
		});

		return NextResponse.json({
			success: true,
			message: "Stripe account disconnected successfully",
		});
	} catch (error) {
		console.error("Error disconnecting Stripe account:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		return NextResponse.json(
			{ error: `Failed to disconnect Stripe account: ${errorMessage}` },
			{ status: 500 }
		);
	}
}
