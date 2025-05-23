// src/app/page.tsx
"use client";

import Link from "next/link";
import ImageCard from "@/components/customer/ImageCard";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/firebase/config";
import { doc, getDoc } from "firebase/firestore";
import LoadingScreen from "@/components/shared/LoadingScreen";
import Footer from "@/components/shared/Footer";
import Header from "@/components/shared/publicPageHeader";

export default function HomePage() {
	const [isLoading, setIsLoading] = useState(true);
	const router = useRouter();

	useEffect(() => {
		// Use Firebase's onAuthStateChanged to properly detect auth state
		const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
			if (currentUser) {
				// User is authenticated, determine user type
				try {
					// First check if user is a customer
					const customerDoc = await getDoc(doc(db, "users", currentUser.uid));
					if (customerDoc.exists()) {
						router.replace("/customer/order");
						return;
					}

					// Check if user is a vendor
					const vendorDoc = await getDoc(doc(db, "vendors", currentUser.uid));
					if (vendorDoc.exists()) {
						router.replace("/vendor/dashboard");
						return;
					}

					// Check if user is a driver
					const driverDoc = await getDoc(doc(db, "drivers", currentUser.uid));
					if (driverDoc.exists()) {
						router.replace("/driver/dashboard");
						return;
					}

					// If we can't determine user type, show home page
					setIsLoading(false);
				} catch (error) {
					console.error("Error checking user type:", error);
					setIsLoading(false);
				}
			} else {
				// No user is signed in, show home page
				setIsLoading(false);
			}
		});

		// Set a backup timeout in case auth takes too long
		const timeoutId = setTimeout(() => {
			if (isLoading) {
				setIsLoading(false);
				console.log("Auth check timed out, showing home page anyway");
			}
		}, 3000); // 3 second timeout

		// Clean up the subscription and timeout
		return () => {
			unsubscribe();
			clearTimeout(timeoutId);
		};
	}, [isLoading, router]);

	if (isLoading) {
		return <LoadingScreen />;
	}

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Header Section */}
			<Header />

			{/* Hero section with enhanced design */}
			<section className="relative bg-sarva py-16 sm:py-24">
				<div className="absolute inset-0 bg-[url('/food-pattern-bg.png')] opacity-5"></div>
				<div className="relative pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center">
						<h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl mb-6">
							Fresh. Familiar. Fast.
						</h1>
						<p className="mt-6 max-w-2xl mx-auto text-3xl text-black font-light">
							South Asian groceries from trusted local vendors—delivered to your
							door.
						</p>
						<div className="mt-10">
							<Link
								href="/customer/auth/signup"
								className="bg-puce hover:bg-rose text-white py-4 px-10 rounded-full text-3xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 inline-flex items-center"
							>
								Order Now
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="h-8 w-8 ml-2"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M14 5l7 7m0 0l-7 7m7-7H3"
									/>
								</svg>
							</Link>
						</div>
					</div>
				</div>
			</section>

			{/* Features section with improved cards */}
			<section className="bg-gray-50 py-16">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
						How It Works
					</h2>
					<div className="flex flex-wrap justify-center gap-8 lg:gap-12">
						<div className="w-full md:w-auto flex-1 max-w-md transform transition duration-300 hover:scale-105">
							<ImageCard imgSrc="/customer.png">
								<h3 className="text-gray-900 font-bold text-2xl mb-3">
									Order Food
								</h3>
								<p className="text-gray-700 text-lg mb-6">
									Order food from your favorite local restaurants.
								</p>
								<div className="flex justify-center">
									<Link
										href="/customer/auth/signin"
										className="bg-puce hover:bg-rose text-white py-3 px-8 rounded-full text-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg"
									>
										Order Now
									</Link>
								</div>
							</ImageCard>
						</div>
						<div className="w-full md:w-auto flex-1 max-w-md transform transition duration-300 hover:scale-105">
							<ImageCard imgSrc="/vendor.png">
								<h3 className="text-gray-900 font-bold text-2xl mb-3">
									Become a Vendor
								</h3>
								<p className="text-gray-700 text-lg mb-6">
									Join our platform and reach more customers.
								</p>
								<div className="flex justify-center">
									<Link
										href="/vendor/auth/signup"
										className="bg-puce hover:bg-rose text-white py-3 px-8 rounded-full text-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg"
									>
										Register as Vendor
									</Link>
								</div>
							</ImageCard>
						</div>
						<div className="w-full md:w-auto flex-1 max-w-md transform transition duration-300 hover:scale-105">
							<ImageCard imgSrc="/driver.png">
								<h3 className="text-gray-900 font-bold text-2xl mb-3">
									Deliver
								</h3>
								<p className="text-gray-700 text-lg mb-6">
									Sign up to deliver with us.
								</p>
								<div className="flex justify-center">
									<Link
										href="/driver/auth/signup"
										className="bg-puce hover:bg-rose text-white py-3 px-8 rounded-full text-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg"
									>
										Sign Up to Deliver
									</Link>
								</div>
							</ImageCard>
						</div>
					</div>
				</div>
			</section>

			{/* Footer section */}
			<Footer />
		</div>
	);
}
