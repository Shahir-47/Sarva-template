import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
	try {
		const { amount, currency, orderId, customerEmail } = await req.json();

		const paymentIntent = await stripe.paymentIntents.create({
			amount, // total in cents
			currency, // e.g. "usd"
			capture_method: "manual", // hold until pickup
			receipt_email: customerEmail,
			description: `Order ${orderId}`,
			metadata: { orderId },
			transfer_group: orderId, // group for later transfers
		});

		return NextResponse.json({
			clientSecret: paymentIntent.client_secret,
			paymentIntentId: paymentIntent.id,
		});
	} catch (err) {
		console.error("create-payment-intent error:", err);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
