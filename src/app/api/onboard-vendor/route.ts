// src/app/api/onboard-vendor/route.ts
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
	const { email } = await req.json();

	// 1) create an Express account in test mode
	const account = await stripe.accounts.create({
		type: "express",
		country: "US",
		email,
		capabilities: {
			transfers: { requested: true },
		},
	});

	// 2) return the new account ID
	return NextResponse.json({ accountId: account.id });
}
