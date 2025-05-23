// src/app/api/onboard-return/route.ts
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase/config";

export async function POST(req: NextRequest) {
	const { accountId, entityType } = await req.json();

	try {
		// Fetch Stripe account details
		const account = await stripe.accounts.retrieve(accountId);

		// Determine required capabilities
		const canReceivePayments = account.capabilities?.card_payments === "active";
		const canTransferFunds = account.capabilities?.transfers === "active";
		const isComplete =
			account.details_submitted && canReceivePayments && canTransferFunds;

		// Locate the Firestore document by UID stored in metadata
		const firebaseUid = account.metadata?.firebaseUid;
		if (!firebaseUid)
			throw new Error("Missing firebaseUid metadata on Stripe account");

		const ref = doc(db, entityType, firebaseUid);
		const snapshot = await getDoc(ref);
		if (!snapshot.exists()) {
			return NextResponse.json(
				{ success: false, error: "Document not found" },
				{ status: 404 }
			);
		}

		// Prepare merged update including nested capabilities
		const updateData = {
			stripeOnboardingComplete: isComplete,
			stripeAccountId: account.id,
			stripeCapabilities: {
				card_payments: canReceivePayments,
				transfers: canTransferFunds,
			},
			updatedAt: serverTimestamp(),
		};

		// Merge all fields (including nested map) in one operation
		await setDoc(ref, updateData, { merge: true });

		return NextResponse.json({
			success: true,
			isComplete,
			accountId,
			stripeAccountId: account.id,
		});
	} catch (error: unknown) {
		console.error("Error in onboard-return:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		return NextResponse.json(
			{ success: false, error: errorMessage },
			{ status: 500 }
		);
	}
}
