// src/app/vendor/inventory/view/[id]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useVendorAuth } from "@/hooks/useVendorAuth";
import VendorNavBar from "@/components/vendor/VendorNavBar";
import { VendorData } from "@/firebase/vendorAuth";
import { getCurrentVendorData } from "@/firebase/vendorAuth";
import { getInventoryItem, InventoryItem } from "@/firebase/inventory";
import Link from "next/link";
import Image from "next/image";
import LoadingScreen from "@/components/shared/LoadingScreen";
import Footer from "@/components/shared/Footer";

export default function ViewInventoryItemPage() {
	const params = useParams();
	const itemId = params.id as string;

	const [vendorData, setVendorData] = useState<VendorData | null>(null);
	const [item, setItem] = useState<InventoryItem | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState("");

	const { user, initializing } = useVendorAuth();
	const router = useRouter();

	useEffect(() => {
		const fetchData = async () => {
			if (initializing) return;

			setIsLoading(true);

			// If no user or email not verified, redirect
			if (!user) {
				router.push("/unauthorized");
				return;
			}

			// Get vendor data
			try {
				const vendorResult = await getCurrentVendorData();
				if (vendorResult.success && vendorResult.data) {
					setVendorData(vendorResult.data);

					// Get item data
					const itemResult = await getInventoryItem(itemId);
					if (itemResult.success && itemResult.data) {
						const itemData = itemResult.data;

						// Verify that this item belongs to this vendor
						if (itemData.vendorID !== vendorResult.data.uid) {
							setError("You don't have permission to view this item");
							setTimeout(() => {
								router.push("/vendor/inventory");
							}, 2000);
							return;
						}

						// Set item data
						setItem(itemData);
					} else {
						setError("Item not found");
						setTimeout(() => {
							router.push("/vendor/inventory");
						}, 2000);
					}
				} else if (vendorResult.error) {
					setError(vendorResult.error);
				}
			} catch {
				setError("Failed to load data");
			}

			setIsLoading(false);
		};

		fetchData();
	}, [user, router, initializing, itemId]);

	if (isLoading) {
		return <LoadingScreen message="Loading..." />;
	}

	if (!item) {
		return (
			<div className="min-h-screen bg-gray-50">
				<header>
					<VendorNavBar vendorData={vendorData} />
				</header>
				<main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
					<div className="bg-red-100 text-red-700 p-4 rounded mb-6">
						{error || "Item not found"}
					</div>
					<div className="text-center mt-6">
						<Link
							href="/vendor/inventory"
							className="text-puce hover:text-rose font-medium"
						>
							Back to Inventory
						</Link>
					</div>
				</main>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<header>
				<VendorNavBar vendorData={vendorData} />
			</header>

			<main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
				<div className="bg-white shadow-md rounded-lg overflow-hidden">
					<div className="px-6 py-4 bg-puce text-white flex justify-between items-center">
						<h1 className="text-xl font-bold">Item Details</h1>
						<div className="flex space-x-2">
							<Link
								href={`/vendor/inventory/edit/${itemId}`}
								className="bg-white text-puce hover:bg-gray-100 py-1 px-3 rounded text-sm"
							>
								Edit
							</Link>
							<Link
								href="/vendor/inventory"
								className="bg-gray-700 text-white hover:bg-gray-800 py-1 px-3 rounded text-sm"
							>
								Back
							</Link>
						</div>
					</div>

					<div className="p-6">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
							<div>
								<div className="h-80 w-full bg-gray-100 rounded-lg overflow-hidden relative">
									<Image
										src={item.image || "/placeholder-image.png"}
										alt={item.name}
										className="w-full h-full object-contain"
										width={320}
										height={320}
										onError={() => {
											setItem((prevItem) =>
												prevItem
													? {
															...prevItem,
															image: "/placeholder-image.png",
													  }
													: prevItem
											);
										}}
										placeholder="empty"
									/>
								</div>

								<div className="mt-4">
									<h2 className="text-lg font-medium text-gray-700 mb-2">
										Tags
									</h2>
									<div className="flex flex-wrap gap-2">
										{item.tags &&
											item.tags.map((tag) => (
												<span
													key={tag}
													className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm"
												>
													{tag}
												</span>
											))}
									</div>
								</div>
							</div>

							<div>
								<h2 className="text-2xl font-bold text-gray-800 mb-2">
									{item.name}
								</h2>

								<div className="mb-4">
									<div className="flex justify-between items-center">
										<p className="text-xl font-bold text-puce">
											${item.price?.toFixed(2)}
										</p>
									</div>

									{/* Cost information */}
									<div className="mt-2 bg-gray-50 p-3 rounded-lg">
										<div className="grid grid-cols-2 gap-4">
											<div>
												<h3 className="text-sm font-medium text-gray-500">
													Cost Price
												</h3>
												<p className="text-lg font-semibold text-gray-800">
													${item.cost?.toFixed(2) || "0.00"}
												</p>
											</div>

											<div>
												<h3 className="text-sm font-medium text-gray-500">
													Profit per Unit
												</h3>
												<p className="text-lg font-semibold text-gray-800">
													${(item.price - (item.cost || 0)).toFixed(2)}
												</p>
											</div>
										</div>

										{/* Profit margin and discount */}
										<div className="grid grid-cols-2 gap-4 mt-2">
											<div>
												<h3 className="text-sm font-medium text-gray-500">
													Profit Margin
												</h3>
												<p className="text-lg font-semibold text-green-600">
													{item.cost && item.price
														? (
																((item.price - item.cost) / item.price) *
																100
														  ).toFixed(1)
														: "0"}
													%
												</p>
											</div>
										</div>
									</div>
								</div>

								<div className="mb-6">
									<h3 className="text-lg font-medium text-gray-700 mb-2">
										Description
									</h3>
									<p className="text-gray-600">{item.description}</p>
								</div>

								<div className="grid grid-cols-2 gap-4 mb-6">
									<div className="bg-gray-50 p-4 rounded-lg">
										<h3 className="text-sm font-medium text-gray-500">
											In Stock
										</h3>
										<p className="text-2xl font-bold text-gray-800">
											{item.units}
										</p>
									</div>

									<div className="bg-gray-50 p-4 rounded-lg">
										<h3 className="text-sm font-medium text-gray-500">Sold</h3>
										<p className="text-2xl font-bold text-gray-800">
											{item.soldUnits || 0}
										</p>
									</div>
								</div>

								{/* Total Revenue and Profit */}
								<div className="bg-gray-50 p-4 rounded-lg mb-6">
									<div className="grid grid-cols-2 gap-4">
										<div>
											<h3 className="text-sm font-medium text-gray-500">
												Total Revenue
											</h3>
											<p className="text-xl font-bold text-gray-800">
												${((item.soldUnits || 0) * item.price).toFixed(2)}
											</p>
										</div>

										<div>
											<h3 className="text-sm font-medium text-gray-500">
												Total Profit
											</h3>
											<p className="text-xl font-bold text-green-600">
												$
												{(
													(item.soldUnits || 0) *
													(item.price - (item.cost || 0))
												).toFixed(2)}
											</p>
										</div>
									</div>
								</div>

								{item.barcode && (
									<div className="mb-6">
										<h3 className="text-lg font-medium text-gray-700 mb-2">
											Barcode
										</h3>
										<p className="text-gray-600 bg-gray-50 p-2 rounded border border-gray-200 font-mono">
											{item.barcode}
										</p>
									</div>
								)}

								<div className="mb-6">
									<h3 className="text-lg font-medium text-gray-700 mb-2">
										Item ID
									</h3>
									<p className="text-gray-600 bg-gray-50 p-2 rounded border border-gray-200 font-mono text-sm">
										{item.itemID}
									</p>
								</div>

								{/* Created and updated timestamps */}
								<div className="grid grid-cols-2 gap-4 mb-6">
									<div>
										<h3 className="text-sm font-medium text-gray-500">
											Created
										</h3>
										<p className="text-sm text-gray-600">
											{item.created_at &&
												new Date(
													item.created_at.seconds * 1000
												).toLocaleString()}
										</p>
									</div>

									<div>
										<h3 className="text-sm font-medium text-gray-500">
											Last Updated
										</h3>
										<p className="text-sm text-gray-600">
											{item.updated_at &&
												new Date(
													item.updated_at.seconds * 1000
												).toLocaleString()}
										</p>
									</div>
								</div>

								<div className="flex space-x-4 mt-8">
									<Link
										href={`/vendor/inventory/edit/${itemId}`}
										className="bg-puce hover:bg-rose text-white py-2 px-4 rounded-md shadow-sm flex-1 text-center"
									>
										Edit Item
									</Link>
									<Link
										href="/vendor/inventory"
										className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 flex-1 text-center"
									>
										Back to Inventory
									</Link>
								</div>
							</div>
						</div>
					</div>
				</div>
			</main>
			<Footer />
		</div>
	);
}
