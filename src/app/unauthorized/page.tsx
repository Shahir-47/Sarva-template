// src/app/unauthorized/page.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import Footer from "@/components/shared/Footer";

export default function UnauthorizedPage() {
	return (
		<div>
			<div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
				<div className="sm:mx-auto sm:w-full sm:max-w-md">
					<Image
						src="/logo-black.png"
						alt="Logo"
						width={200}
						height={100}
						className="mx-auto"
					/>
					<h2 className="mt-2 text-center text-xl text-gray-600">
						Unauthorized Access
					</h2>
				</div>

				<div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
					<div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
						<div className="text-center">
							<p className="text-lg text-gray-700 mb-4">
								You don&apos;t have permission to access this area.
							</p>
							<p className="text-md text-gray-600 mb-6">
								Please sign in with the appropriate account or return to the
								home page.
							</p>
							<div className="flex flex-col space-y-4">
								<div className="flex justify-center space-x-4">
									<Link
										href="/"
										className="bg-sarva hover:bg-rose text-white py-2 px-4 rounded-full"
									>
										Return Home
									</Link>
								</div>
								<div className="flex justify-center space-x-4 pt-4 border-t border-gray-200">
									<Link
										href="/customer/auth/signin"
										className="text-blue-500 hover:text-blue-700"
									>
										Customer Sign In
									</Link>
									<Link
										href="/vendor/auth/signin"
										className="text-puce hover:text-rose"
									>
										Vendor Sign In
									</Link>
									<Link
										href="/driver/auth/signin"
										className="text-sarva hover:text-rose"
									>
										Driver Sign In
									</Link>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
			<Footer />
		</div>
	);
}
