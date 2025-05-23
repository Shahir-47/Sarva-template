// src/app/api/onboard-express-account/route.ts
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/firebase/config";

export async function POST(req: NextRequest) {
	const { entityId, entityType, email } = await req.json();

	// 1) create an Express account requesting both payment & transfer capabilities
	const account = await stripe.accounts.create({
		type: "express",
		email,
		country: "US",
		capabilities: {
			card_payments: { requested: true },
			transfers: { requested: true },
		},
		metadata: { firebaseUid: entityId, entityType },
	});

	// 2) persist acct_… ID and reset onboarding flag
	await setDoc(
		doc(db, entityType, entityId),
		{
			stripeAccountId: account.id,
			stripeOnboardingComplete: false,
			updatedAt: new Date(),
		},
		{ merge: true }
	);

	// 3) generate an onboarding link
	const link = await stripe.accountLinks.create({
		account: account.id,
		refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/onboard/refresh`,
		return_url: `${process.env.NEXT_PUBLIC_APP_URL}/onboard/return?accountId=${account.id}&entityType=${entityType}`,
		type: "account_onboarding",
	});

	return NextResponse.json({ url: link.url, accountId: account.id });
}
