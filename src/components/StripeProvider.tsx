// src/components/StripeProvider.tsx
"use client";

import { ReactNode, useEffect, useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { stripePromise } from "@/lib/stripeClient";

export function StripeProvider({ children }: { children: ReactNode }) {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
		return () => setMounted(false);
	}, []);

	if (!mounted) {
		// Return children without Stripe wrapping during unmount
		return <>{children}</>;
	}

	return <Elements stripe={stripePromise}>{children}</Elements>;
}
