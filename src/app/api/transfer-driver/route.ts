import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
	try {
		const { paymentIntentId, driverStripeAccountId, driverAmount } =
			await req.json();

		// Retrieve to get latest_charge and currency
		const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

		// Transfer driver's slice
		const driverTransfer = await stripe.transfers.create({
			amount: driverAmount, // in cents
			currency: pi.currency,
			destination: driverStripeAccountId, // "acct_..."
			transfer_group: pi.transfer_group ?? paymentIntentId,
			source_transaction:
				typeof pi.latest_charge === "string" ? pi.latest_charge : undefined,
		});

		return NextResponse.json({ success: true, transferId: driverTransfer.id });
	} catch (err) {
		console.error("transfer-driver error:", err);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
