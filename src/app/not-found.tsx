"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function NotFound() {
	const [countdown, setCountdown] = useState(10);
	const router = useRouter();

	useEffect(() => {
		// Automatically redirect after countdown
		const timer =
			countdown > 0 &&
			setInterval(() => {
				setCountdown((prev) => prev - 1);
			}, 1000);

		if (countdown === 0) {
			router.push("/");
		}

		return () => {
			if (timer) clearInterval(timer);
		};
	}, [countdown, router]);

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
			<div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
				<h1 className="text-6xl font-bold text-puce mb-4">404</h1>
				<h2 className="text-2xl font-semibold text-gray-800 mb-4">
					Page Not Found
				</h2>

				<div className="mb-6">
					<p className="text-gray-600 mb-2">
						The page you are looking for doesn&apos;t exist or has been moved.
					</p>
					<p className="text-gray-600">
						Redirecting to homepage in {countdown} seconds...
					</p>
				</div>

				<div className="flex flex-col sm:flex-row justify-center gap-4">
					<Link
						href="/"
						className="bg-puce hover:bg-rose text-white py-2 px-6 rounded-full text-lg font-medium"
					>
						Go Home
					</Link>
					<button
						onClick={() => router.back()}
						className="cursor-pointer border border-puce text-puce hover:bg-gray-100 py-2 px-6 rounded-full text-lg font-medium"
					>
						Go Back
					</button>
				</div>
			</div>
		</div>
	);
}
