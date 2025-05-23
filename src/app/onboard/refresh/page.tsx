"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useVendorAuth } from "@/hooks/useVendorAuth";
import { useDriverAuth } from "@/hooks/useDriverAuth";

export default function OnboardingRefreshPage() {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const router = useRouter();
	const { user: vendorUser, vendorData } = useVendorAuth();
	const { user: driverUser, driverData } = useDriverAuth();

	useEffect(() => {
		// Determine if the user is a vendor or driver
		const isVendor = !!vendorUser;
		const isDriver = !!driverUser;
		const userData = isVendor ? vendorData : driverData;
		const entityType = isVendor ? "vendors" : "drivers";

		if (!userData) {
			setLoading(false);
			setError("Unable to determine your account type. Please sign in again.");
			return;
		}

		const refreshOnboarding = async () => {
			try {
				const res = await fetch("/api/onboard-express-account", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						entityId: isVendor ? vendorUser?.uid : driverUser?.uid,
						entityType,
						email: isVendor ? vendorUser?.email : driverUser?.email,
					}),
				});

				if (!res.ok) {
					throw new Error(`Failed to refresh onboarding: ${res.status}`);
				}

				const { url } = await res.json();
				// Redirect to Stripe onboarding
				window.location.href = url;
			} catch (e) {
				console.error("Error refreshing onboarding:", e);
				setError(e instanceof Error ? e.message : "Unknown error occurred");
				setLoading(false);
			}
		};

		if (isVendor || isDriver) {
			refreshOnboarding();
		} else {
			setLoading(false);
			setError("Please log in first to continue onboarding");
		}
	}, [vendorUser, driverUser, vendorData, driverData, router]);

	return (
		<div className="min-h-screen bg-gray-50 flex items-center justify-center">
			<div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
				<h1 className="text-2xl font-bold mb-4">Refreshing Onboarding</h1>

				{loading ? (
					<div className="flex flex-col items-center">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-puce"></div>
						<p className="mt-4 text-gray-600">
							Preparing to continue your onboarding...
						</p>
					</div>
				) : error ? (
					<div>
						<div className="text-red-500 text-5xl mb-4">⚠</div>
						<p className="text-red-700 mb-6">{error}</p>
						<button
							onClick={() => router.push("/")}
							className="cursor-pointer px-4 py-2 bg-puce hover:bg-rose text-white rounded-md transition-colors"
						>
							Return to home
						</button>
					</div>
				) : null}
			</div>
		</div>
	);
}
