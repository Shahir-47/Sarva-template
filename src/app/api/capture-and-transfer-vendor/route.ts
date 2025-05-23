import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
	try {
		const { paymentIntentId, vendorStripeAccountId, vendorAmount } =
			await req.json();

		// 1) Capture the full hold into your balance
		const pi = await stripe.paymentIntents.capture(paymentIntentId);

		// 2) Transfer vendor's slice
		const vendorTransfer = await stripe.transfers.create({
			amount: vendorAmount, // in cents
			currency: pi.currency,
			destination: vendorStripeAccountId, // "acct_..."
			transfer_group: pi.transfer_group ?? undefined,
			source_transaction:
				typeof pi.latest_charge === "string" ? pi.latest_charge : undefined,
		});

		return NextResponse.json({ success: true, transferId: vendorTransfer.id });
	} catch (err) {
		console.error("capture-and-transfer-vendor error:", err);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
