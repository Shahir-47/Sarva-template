// src/app/api/cancel-payment-intent/route.ts
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
	try {
		const { paymentIntentId } = await req.json();

		// Retrieve the payment intent to check its status
		const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

		if (paymentIntent.status === "requires_capture") {
			// If payment is still on hold (not captured), cancel it to release the authorization
			await stripe.paymentIntents.cancel(paymentIntentId);

			return NextResponse.json({
				success: true,
				message: "Payment authorization has been released.",
			});
		} else {
			return NextResponse.json(
				{ error: `Cannot cancel payment in status: ${paymentIntent.status}` },
				{ status: 400 }
			);
		}
	} catch (err) {
		console.error("cancel-payment-intent error:", err);
		return NextResponse.json(
			{ error: "Failed to cancel payment authorization" },
			{ status: 500 }
		);
	}
}
