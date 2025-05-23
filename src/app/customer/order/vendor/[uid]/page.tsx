"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getCurrentUserData } from "@/firebase/auth";
import { InventoryItem } from "@/firebase/inventory";
import NavBar from "@/components/customer/navBar";
import BasketDrawer from "@/components/customer/BasketDrawer";
import { BasketProvider } from "@/components/customer/context/BasketContext";
import { ModalProvider } from "@/components/customer/context/ModalContext";
import BusinessHoursDisplay from "@/components/customer/BusinessHoursDisplay";
import ProductModal from "@/components/customer/ProductModal";
import { Vendor } from "@/components/customer/VendorListingSection";
import { useParams } from "next/navigation";
import { ProductGrid } from "@/components/customer/ProductGrid";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase/config";
import Image from "next/image";
import LoadingScreen from "@/components/shared/LoadingScreen";
import { StripeProvider } from "@/components/StripeProvider";
import Footer from "@/components/shared/Footer";

export default function OrderPage() {
	//user
	const { user, initializing } = useAuth();

	//inventory
	const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

	//vendors
	const [vendor, setVendor] = useState<Vendor>();

	//page
	const [isLoading, setIsLoading] = useState(true);

	//extract uid from the url
	const params = useParams();
	const { uid } = params;

	const router = useRouter();
	const [showMore, setShowMore] = React.useState(false);

	useEffect(() => {
		const checkAuth = async () => {
			if (initializing) return;

			setIsLoading(true);

			// If no user or email not verified, redirect
			if (!user) {
				console.log("No user found, redirecting to vendor signin");
				router.push("/unauthorized");
				return;
			}

			// Get inventory items and vendor items
			try {
				//at some point we should only get items in the users area
				console.log("Getting all Inventory and vendor data");
				const result = await getCurrentUserData();

				if (result.success && result.data) {
					console.log("Successfully loaded vendor data");
					// Fetch inventory items to calculate stats
					(async () => {
						try {
							const snap = await getDocs(collection(db, "vendors"));
							const allVendors = snap.docs.map((d) => ({
								...d.data(),
							})) as Vendor[];
							setVendor(allVendors.find((vendor) => vendor.uid === uid));
						} catch (e) {
							console.error("Failed to load inventory", e);
						}
					})();

					console.log("Successfully loaded inventory data");
					// Fetch inventory items to calculate stats
					(async () => {
						try {
							const snap = await getDocs(collection(db, "inventory"));
							const allItems = snap.docs.map((d) => ({
								...d.data(),
								itemID: d.id,
							})) as InventoryItem[];
							setInventoryItems(allItems);
						} catch (e) {
							console.error("Failed to load inventory", e);
						}
					})();
				}
			} catch (error) {
				console.error("Error in checkAuth:", error);
			}

			setIsLoading(false);
		};

		checkAuth();
	}, [user, router, initializing, uid]);

	if (isLoading && !initializing) {
		return <LoadingScreen message="Loading..." />;
	}

	return (
		<StripeProvider>
			<ModalProvider>
				<BasketProvider>
					<div className="min-h-screen bg-white">
						<header className="pb-6">
							<NavBar />
						</header>
						<BasketDrawer vendorList={vendor ? [vendor] : []} />
						<div className="flex flex-col items-center relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 min-h-screen bg-gray-50 rounded-2xl ">
							<button
								id="close-modal"
								className="cursor-pointer absolute top-15 left-12 bg-white rounded-full p-2 pr-4 !shadow-md hover:bg-gray-200 hover:cursor-pointer flex items-center  border-2 border-gray-300"
								aria-label="close modal"
								onClick={() => router.back()}
							>
								<Image
									src={"/arrow_back.svg"}
									className="ml-2"
									alt="Back Arrow"
									width={50}
									height={50}
								/>
								back
							</button>
							<div className="bg-[#f1dfce] p-8 rounded-lg shadow-md border-2 border-sarva">
								<div className="flex justify-center items-center mb-6">
									{vendor?.profileImage ? (
										<div className="relative w-24 h-24 rounded-full overflow-hidden mr-4">
											<Image
												src={vendor.profileImage}
												alt={`${vendor?.shopName || "Vendor"} logo`}
												layout="fill"
												objectFit="cover"
											/>
										</div>
									) : (
										<div className="w-24 h-24 rounded-full bg-gray-300 flex items-center justify-center mr-4">
											<span className="text-gray-500 text-xl font-semibold">
												{vendor?.shopName?.charAt(0).toUpperCase() || "V"}
											</span>
										</div>
									)}
									<h1 className="text-3xl font-bold text-gray-900">
										{vendor?.shopName}
									</h1>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-6 place-items-center">
									<div>
										<h2 className="text-xl font-semibold text-gray-800 mb-2">
											Business contact
										</h2>
										<p className="text-gray-700 mb-1">
											<span className="font-semibold">Phone Number:</span>{" "}
											{vendor?.phoneNumber}
										</p>
										<p className="text-gray-700 mb-1">
											<span className="font-semibold">Location:</span>{" "}
											{vendor?.location}
										</p>
									</div>
									<div>
										<h2 className="text-xl font-semibold text-gray-800 mb-2">
											Business Details
										</h2>
										<p className="text-gray-700 mb-1">
											<span className="font-semibold">Description:</span>{" "}
											{vendor?.businessDescription}
										</p>

										{vendor?.businessHours && (
											<div className="mt-4">
												<h3 className="text-lg font-semibold text-gray-800 mb-2">
													Business Hours
												</h3>
												<BusinessHoursDisplay hours={vendor.businessHours} />
											</div>
										)}
									</div>
								</div>
								<div className="px-4 text-center mt-10">
									<button
										className="cursor-pointer text-sm text-blue-600 hover:underline hover:cursor-pointer"
										onClick={() => setShowMore((prev) => !prev)}
									>
										{showMore ? "Hide" : "Show"} More Details
									</button>

									{showMore && (
										<div>
											<div>
												<h2 className="text-xl mt-5 font-semibold text-gray-800 mb-2">
													Inventory Details
												</h2>
												{vendor?.inventory && vendor?.inventory.length > 0 ? (
													<p className="text-gray-700">
														Currently, {vendor?.shopName} has{" "}
														{vendor?.inventory.length} items for sale on Sarva.
													</p>
												) : (
													<p className="text-gray-700">
														This vendor has no inventory listed.
													</p>
												)}
											</div>
										</div>
									)}
								</div>
							</div>

							<div className="mt-20 w-full">
								<h2 className="text-5xl font-bold text-gray-900 mb-10 text-center">
									Browse {vendor?.shopName}
								</h2>
								<ProductGrid products={inventoryItems} singleVendor={vendor} />
							</div>
						</div>
					</div>
					<footer>
						<ProductModal />
					</footer>
					<Footer />
				</BasketProvider>
			</ModalProvider>
		</StripeProvider>
	);
}
