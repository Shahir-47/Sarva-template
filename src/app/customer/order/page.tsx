"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getCurrentUserData } from "@/firebase/auth";
import ListingSection from "@/components/customer/ListingSection";
import { InventoryItem } from "@/firebase/inventory";
import NavBar from "@/components/customer/navBar";
import BasketDrawer from "@/components/customer/BasketDrawer";
import { BasketProvider } from "@/components/customer/context/BasketContext";
import { ModalProvider } from "@/components/customer/context/ModalContext";
import ProductModal from "@/components/customer/ProductModal";
import VendorGrid from "@/components/customer/VendorListingSection";
import { Vendor } from "@/components/customer/VendorListingSection";
import { ProductGrid } from "@/components/customer/ProductGrid";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase/config";
import LoadingScreen from "@/components/shared/LoadingScreen";
import { StripeProvider } from "@/components/StripeProvider";
import Footer from "@/components/shared/Footer";

export default function OrderPage() {
	//user
	const { user, initializing } = useAuth();

	//inventory
	const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

	//vendors
	const [vendors, setVendors] = useState<Vendor[]>([]);

	//page
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState("");

	const router = useRouter();

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

			const excludedVendorIds = [
				"4kKTsNNRFbeT2BBdrYmsznSPh863",
				"pe2rS59tleNcWdztp1dpt22HJOX2",
			];

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

							// Filter out excluded vendors
							setVendors(
								allVendors.filter(
									(vendor) => !excludedVendorIds.includes(vendor.uid)
								)
							);
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
				setError("Failed to load vendor data");
			}

			setIsLoading(false);
		};

		checkAuth();
	}, [user, router, initializing]);

	if (isLoading && !initializing) {
		return <LoadingScreen message="Loading..." />;
	}

	return (
		<StripeProvider>
			<ModalProvider>
				<BasketProvider>
					<div className="min-h-screen bg-white">
						<header>
							<NavBar />
						</header>

						<BasketDrawer vendorList={vendors} />
						<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pt-6">
							{error && (
								<div className="bg-red-100 text-red-700 p-4 rounded mb-6">
									{error}
								</div>
							)}
							<h3 className="text-3xl font-bold leading-6 text-gray-900 mb-4">
								Shop By Vendor
							</h3>

							{/* Vendor cards */}
							<VendorGrid vendors={vendors} />

							<h3 className="text-3xl mt-8 mb-4 font-bold leading-6 text-gray-900">
								Popular Items
							</h3>

							<div className="max-w-screen p-4">
								<ListingSection
									items={inventoryItems}
									vendors={vendors}
									displayType="popular"
								></ListingSection>
							</div>

							<div className="max-w-screen rounded-2xl !shadow-md !shadow-gray-300 pl-6 pr-6 p-4">
								<h2 className="text-3xl mt-8 mb-10 font-bold leading-6 text-gray-900 text-center">
									Products Near Me
								</h2>
								<div className="w-full bg-white rounded-2xl">
									<ProductGrid
										products={inventoryItems}
										vendors={vendors}
										displayType="nearby"
									/>
								</div>
							</div>

							<h3 className="text-3xl mt-8 mb-4 font-bold leading-6 text-gray-900">
								New Items
							</h3>
							<div className="max-w-screen p-4">
								<ListingSection
									items={inventoryItems}
									vendors={vendors}
									displayType="new"
								></ListingSection>
							</div>

							<h3 className="text-3xl mt-8 mb-4 font-bold leading-6 text-gray-900">
								On Sale
							</h3>
							<div className="max-w-screen p-4">
								<ListingSection
									items={inventoryItems}
									vendors={vendors}
									displayType="sale"
								></ListingSection>
							</div>
						</main>
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
