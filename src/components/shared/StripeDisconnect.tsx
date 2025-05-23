// src/components/shared/StripeDisconnect.tsx
import { useState } from "react";
import { getAuth } from "firebase/auth";

interface StripeDisconnectProps {
	entityId: string;
	entityType: "vendors" | "drivers";
	onSuccess: () => Promise<void>;
	onError: (error: string) => void;
}

export default function StripeDisconnect({
	entityId,
	entityType,
	onSuccess,
	onError,
}: StripeDisconnectProps) {
	const [isDisconnecting, setIsDisconnecting] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);

	const handleDisconnect = async () => {
		if (!entityId) return;

		setIsDisconnecting(true);

		try {
			// Get current user
			const auth = getAuth();
			const currentUser = auth.currentUser;

			if (!currentUser) {
				throw new Error(
					"You must be logged in to disconnect your Stripe account"
				);
			}

			// Client-side validation to match entityId with current user
			if (currentUser.uid !== entityId) {
				throw new Error("You can only disconnect your own Stripe account");
			}

			const res = await fetch("/api/disconnect-stripe-account", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					entityId,
					entityType,
					userId: currentUser.uid,
				}),
			});

			if (!res.ok) {
				const text = await res.text();
				let errorMsg;
				try {
					errorMsg = JSON.parse(text).error || JSON.parse(text).message;
				} catch {
					errorMsg = text || `Error: ${res.status}`;
				}
				throw new Error(errorMsg);
			}

			// Call the success callback to refresh data
			await onSuccess();

			// Hide confirmation dialog
			setShowConfirm(false);
		} catch (e) {
			console.error(e);
			if (e instanceof Error) {
				onError(e.message || "Failed to disconnect Stripe account");
			} else {
				onError("Failed to disconnect Stripe account");
			}
		} finally {
			setIsDisconnecting(false);
		}
	};

	if (showConfirm) {
		return (
			<div className="mt-2">
				<p className="text-gray-700 mb-2">
					Are you sure you want to disconnect your Stripe account? This will
					prevent you from receiving payments until you reconnect.
				</p>
				<div className="flex space-x-2">
					<button
						type="button"
						onClick={handleDisconnect}
						className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md shadow-sm cursor-pointer"
						disabled={isDisconnecting}
					>
						{isDisconnecting ? "Disconnecting..." : "Disconnect"}
					</button>
					<button
						type="button"
						onClick={() => setShowConfirm(false)}
						className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 cursor-pointer"
					>
						Cancel
					</button>
				</div>
			</div>
		);
	}

	return (
		<button
			type="button"
			onClick={() => setShowConfirm(true)}
			className="text-red-600 hover:text-red-800 cursor-pointer text-sm font-medium"
		>
			Disconnect Stripe Account
		</button>
	);
}
