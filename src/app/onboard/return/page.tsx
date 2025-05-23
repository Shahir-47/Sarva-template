"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import LoadingScreen from "@/components/shared/LoadingScreen";

function OnboardingContent() {
	const [status, setStatus] = useState<"loading" | "success" | "error">(
		"loading"
	);
	const [message, setMessage] = useState("");
	const searchParams = useSearchParams();

	useEffect(() => {
		const accountId = searchParams.get("accountId");
		const entityType = searchParams.get("entityType");
		if (!accountId || !entityType) {
			setStatus("error");
			setMessage("Invalid return parameters");
			return;
		}

		const checkOnboardingStatus = async () => {
			try {
				const response = await fetch("/api/onboard-return", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ accountId, entityType }),
				});
				const data = await response.json();

				if (data.success) {
					setStatus("success");
					setMessage(
						data.isComplete
							? "Your account setup is complete! You can now receive payments."
							: "Your account has been created, but some details may be missing. Please check your dashboard."
					);

					// Close this popup window and notify parent window
					if (window.opener && !window.opener.closed) {
						// Send message to parent window
						window.opener.postMessage(
							{
								type: "STRIPE_ONBOARDING_COMPLETE",
								data: {
									success: true,
									accountId,
									entityType,
									isComplete: data.isComplete,
								},
							},
							window.location.origin
						);

						// Close this popup window after a brief delay
						setTimeout(() => {
							window.close();
						}, 1500); // Give user 1.5 seconds to see success message
					}
				} else {
					setStatus("error");
					setMessage(data.error || "Failed to verify onboarding status");
				}
			} catch (error) {
				setStatus("error");
				setMessage("An error occurred while checking your onboarding status");
				console.error(error);
			}
		};

		checkOnboardingStatus();
	}, [searchParams]);

	// Determine the redirect path based on entity type
	const getRedirectPath = () => {
		const entityType = searchParams.get("entityType");
		if (entityType === "vendors") return "/vendor/profile";
		if (entityType === "drivers") return "/driver/profile";
		return "/";
	};

	return (
		<div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
			<h1 className="text-2xl font-bold mb-4">Stripe Onboarding</h1>
			{status === "loading" && (
				<div className="flex flex-col items-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-puce"></div>
					<p className="mt-4 text-gray-600">Verifying your account setup...</p>
				</div>
			)}
			{status === "success" && (
				<div>
					<div className="text-green-500 text-5xl mb-4">✓</div>
					<p className="text-gray-700 mb-6">{message}</p>
					<p className="text-sm text-gray-500">
						This window will close automatically...
					</p>
					<Link
						href={getRedirectPath()}
						className="px-4 py-2 bg-puce hover:bg-rose text-white rounded-md transition-colors"
					>
						Return to your profile
					</Link>
				</div>
			)}
			{status === "error" && (
				<div>
					<div className="text-red-500 text-5xl mb-4">⚠</div>
					<p className="text-red-700 mb-6">{message}</p>
					<Link
						href={getRedirectPath()}
						className="px-4 py-2 bg-puce hover:bg-rose text-white rounded-md transition-colors"
					>
						Return to your profile
					</Link>
				</div>
			)}
		</div>
	);
}

// Loading fallback component
function LoadingFallback() {
	return <LoadingScreen message="Verifying your account setup..." />;
}

export default function OnboardingReturnPage() {
	return (
		<div className="min-h-screen bg-gray-50 flex items-center justify-center">
			<Suspense fallback={<LoadingFallback />}>
				<OnboardingContent />
			</Suspense>
		</div>
	);
}
