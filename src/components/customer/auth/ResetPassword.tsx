// src/components/customer/auth/ResetPassword.tsx
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { resetPassword } from "../../../firebase/auth";
import { useAuth } from "../../../hooks/useAuth";

const ResetPassword: React.FC = () => {
	const [email, setEmail] = useState("");
	const [errorMessage, setErrorMessage] = useState("");
	const [successMessage, setSuccessMessage] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const router = useRouter();
	const { user, error, clearError } = useAuth();

	// Redirect if user is already signed in
	useEffect(() => {
		if (user) {
			router.push("/customer/order");
		}
	}, [user, router]);

	// Show error from auth context if any
	useEffect(() => {
		if (error) {
			setErrorMessage(error);
		}
	}, [error]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!email) {
			setErrorMessage("Please enter your email address");
			return;
		}

		setIsLoading(true);
		setErrorMessage("");
		setSuccessMessage("");
		clearError();

		const { success, error } = await resetPassword(email);

		if (success) {
			setSuccessMessage("Password reset email sent! Please check your inbox.");
			setEmail(""); // Clear the form
		} else if (error) {
			setErrorMessage(error);
		}

		setIsLoading(false);
	};

	return (
		<div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md text-gray-700">
			<h2 className="text-2xl font-bold mb-6 text-center">Reset Password</h2>

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

			{successMessage && (
				<div className="bg-green-100 text-green-700 p-3 rounded mb-4 cursor-pointer">
					{successMessage}
					<button
						className="float-right font-bold"
						onClick={() => setSuccessMessage("")}
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
						className="w-full px-3 py-2 border border-gray-300 rounded"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="Enter your email address"
						required
					/>
				</div>

				<button
					type="submit"
					className="w-full bg-blue-500 cursor-pointer text-white py-2 px-4 rounded hover:bg-blue-600 disabled:bg-blue-300"
					disabled={isLoading}
				>
					{isLoading ? "Sending..." : "Send Reset Link"}
				</button>
			</form>

			<div className="mt-4 text-center">
				<a
					href="/customer/auth/signin"
					className="text-blue-500 hover:text-blue-700"
				>
					Back to Sign In
				</a>
			</div>
		</div>
	);
};

export default ResetPassword;
