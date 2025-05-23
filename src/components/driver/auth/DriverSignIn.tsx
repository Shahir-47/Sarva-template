// src/components/driver/auth/DriverSignIn.tsx
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInDriverWithEmail } from "../../../firebase/driverAuth";
import { useDriverAuth } from "../../../hooks/useDriverAuth";
import LoadingScreen from "@/components/shared/LoadingScreen";
import BackButton from "@/components/shared/BackButton";
import { db } from "../../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";

const DriverSignIn: React.FC = () => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [errorMessage, setErrorMessage] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [authChecked, setAuthChecked] = useState(false);

	const router = useRouter();
	const { user, error, clearError, initializing } = useDriverAuth();

	// Redirect if driver is already signed in
	useEffect(() => {
		if (!initializing) {
			setAuthChecked(true);
			if (user) {
				router.replace("/driver/dashboard");
			}
		}
	}, [user, router, initializing]);

	// Show error from auth context if any
	useEffect(() => {
		if (error) {
			setErrorMessage(error);
		}
	}, [error]);

	// Show loading screen while checking auth or redirecting
	if (!authChecked || (user && authChecked)) {
		return <LoadingScreen message="Checking authentication status..." />;
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!email || !password) {
			setErrorMessage("Please enter both email and password");
			return;
		}

		setIsLoading(true);
		setErrorMessage("");
		clearError();

		try {
			// First check if the email belongs to a customer account
			// Before signing in, we can check if there's a document in the users collection
			const userQuery = query(
				collection(db, "drivers"),
				where("email", "==", email)
			);
			const userSnapshot = await getDocs(userQuery);

			if (userSnapshot.empty) {
				// No driver account found with this email
				setErrorMessage(
					"No driver account found with this email. Please use the correct sign-in page for your account type."
				);
				setIsLoading(false);
				return;
			}

			// Now proceed with sign in
			const { success, error, user } = await signInDriverWithEmail(
				email,
				password
			);

			if (success && user) {
				// Redirect to dashboard
				router.replace("/driver/dashboard");
			} else if (error) {
				setErrorMessage(error);
			}
		} catch (error) {
			setErrorMessage((error as Error).message);
		}

		setIsLoading(false);
	};

	return (
		<div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md text-gray-700">
			<div className="mb-4">
				<BackButton href="/" label="Back to Home" />
			</div>

			<h2 className="text-2xl font-bold mb-6 text-center">Driver Sign In</h2>

			{errorMessage && (
				<div className="bg-red-100 text-red-700 p-3 rounded mb-4">
					{errorMessage}
					<button
						className="float-right font-bold cursor-pointer"
						onClick={() => {
							setErrorMessage("");
							clearError();
						}}
					>
						&times;
					</button>
				</div>
			)}

			<form onSubmit={handleSubmit}>
				<div className="mb-4">
					<label className="block text-gray-700 mb-2" htmlFor="email">
						Email
					</label>
					<input
						id="email"
						type="email"
						className="w-full px-3 py-2 border border-gray-300 rounded text-gray-700"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
					/>
				</div>

				<div className="mb-6">
					<label className="block text-gray-700 mb-2" htmlFor="password">
						Password
					</label>
					<input
						id="password"
						type="password"
						className="w-full px-3 py-2 border border-gray-300 rounded"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
					/>
				</div>

				<button
					type="submit"
					className="w-full cursor-pointer bg-sarva hover:bg-rose text-white py-2 px-4 rounded-full shadow-md"
					disabled={isLoading}
				>
					{isLoading ? "Signing In..." : "Sign In"}
				</button>
			</form>

			<div className="mt-4 text-center">
				Don&apos;t have a driver account?{" "}
				<a href="/driver/auth/signup" className="text-sarva hover:text-rose">
					Sign Up
				</a>
			</div>
		</div>
	);
};

export default DriverSignIn;
