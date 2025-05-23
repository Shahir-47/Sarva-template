// src/app/vendor/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useVendorAuth } from "@/hooks/useVendorAuth";
import { getCurrentVendorData } from "@/firebase/vendorAuth";
import { VendorData } from "@/firebase/vendorAuth";
import VendorNavBar from "@/components/vendor/VendorNavBar";
import { getVendorInventoryItems, InventoryItem } from "@/firebase/inventory";
import Link from "next/link";
import DashboardCharts from "@/components/vendor/DashboardCharts";
import Image from "next/image";
import LoadingScreen from "@/components/shared/LoadingScreen";
import Footer from "@/components/shared/Footer";

export default function VendorDashboardPage() {
	const [vendorData, setVendorData] = useState<VendorData | null>(null);
	const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState("");
	const [retryCount, setRetryCount] = useState(0);

	// Enhanced inventory stats with more metrics
	const [inventoryStats, setInventoryStats] = useState({
		totalItems: 0,
		totalValue: 0,
		lowStockItems: 0,
		outOfStockItems: 0,
		highestPricedItem: { name: "", price: 0 },
		avgPrice: 0,
		avgCost: 0,
		avgProfitMargin: 0,
		popularTags: [] as { tag: string; count: number }[],
		totalRevenue: 0,
		totalProfit: 0,
		profitMargin: 0,
		mostProfitableItems: [] as InventoryItem[],
		bestSellingItems: [] as InventoryItem[],
		topRevenueItems: [] as InventoryItem[],
		topProfitItems: [] as InventoryItem[],
		restockValue: 0,
	});

	const { user, initializing } = useVendorAuth();
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

			// Get vendor data
			try {
				const result = await getCurrentVendorData();

				if (result.success && result.data) {
					console.log("Successfully loaded vendor data");
					setVendorData(result.data);

					// Fetch inventory items to calculate stats
					try {
						const inventoryResult = await getVendorInventoryItems(
							result.data.uid
						);

						if (inventoryResult.success && inventoryResult.data) {
							const items = inventoryResult.data;
							setInventoryItems(items);

							// Calculate basic stats
							const totalItems = items.length;
							const totalValue = items.reduce(
								(sum, item) => sum + item.price * item.units,
								0
							);
							const lowStockItems = items.filter(
								(item) => item.units > 0 && item.units < 10
							).length;
							const outOfStockItems = items.filter(
								(item) => item.units === 0
							).length;

							// Calculate advanced stats
							const highestPricedItem = items.reduce(
								(highest, item) =>
									item.price > highest.price
										? { name: item.name, price: item.price }
										: highest,
								{ name: "", price: 0 }
							);

							const avgPrice =
								items.length > 0
									? items.reduce((sum, item) => sum + item.price, 0) /
									  items.length
									: 0;

							// Calculate average cost and profit margin
							const avgCost =
								items.length > 0
									? items.reduce((sum, item) => sum + (item.cost || 0), 0) /
									  items.length
									: 0;

							// Calculate average profit margin
							const avgProfitMargin =
								items.length > 0
									? items.reduce((sum, item) => {
											const margin =
												item.price > 0
													? ((item.price - (item.cost || 0)) / item.price) * 100
													: 0;
											return sum + margin;
									  }, 0) / items.length
									: 0;

							// Count tag occurrences
							const tagCounts: Record<string, number> = {};
							items.forEach((item) => {
								item.tags.forEach((tag) => {
									tagCounts[tag] = (tagCounts[tag] || 0) + 1;
								});
							});

							// Convert to array and sort
							const popularTags = Object.entries(tagCounts)
								.map(([tag, count]) => ({ tag, count }))
								.sort((a, b) => b.count - a.count)
								.slice(0, 5);

							// Calculate actual revenue and profit using cost data
							const totalRevenue = items.reduce(
								(sum, item) => sum + (item.soldUnits || 0) * item.price,
								0
							);

							// Calculate profit using actual cost data
							const totalProfit = items.reduce(
								(sum, item) =>
									sum + (item.soldUnits || 0) * (item.price - (item.cost || 0)),
								0
							);

							// Overall profit margin percentage
							const profitMarginPercentage =
								totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

							// Find most profitable items
							const mostProfitableItems = [...items]
								.sort((a, b) => {
									const aMargin =
										a.price > 0
											? ((a.price - (a.cost || 0)) / a.price) * 100
											: 0;
									const bMargin =
										b.price > 0
											? ((b.price - (b.cost || 0)) / b.price) * 100
											: 0;
									return bMargin - aMargin;
								})
								.slice(0, 3);

							// Find best selling items
							const bestSellingItems = [...items]
								.sort((a, b) => (b.soldUnits || 0) - (a.soldUnits || 0))
								.slice(0, 3);

							// Find most revenue-generating items
							const topRevenueItems = [...items]
								.sort(
									(a, b) =>
										(b.soldUnits || 0) * b.price - (a.soldUnits || 0) * a.price
								)
								.slice(0, 3);

							// Find most profitable items by total profit
							const topProfitItems = [...items]
								.sort(
									(a, b) =>
										(b.soldUnits || 0) * (b.price - (b.cost || 0)) -
										(a.soldUnits || 0) * (a.price - (a.cost || 0))
								)
								.slice(0, 3);

							// Calculate restock value (cost to restock low inventory)
							const restockValue = items
								.filter((item) => (item.units || 0) < 5) // Consider items with less than 5 units
								.reduce((sum, item) => {
									const unitsToRestock = 10 - (item.units || 0); // Restock to 10
									return (
										sum +
										(unitsToRestock > 0 ? unitsToRestock * (item.cost || 0) : 0)
									);
								}, 0);

							setInventoryStats({
								totalItems,
								totalValue,
								lowStockItems,
								outOfStockItems,
								highestPricedItem,
								avgPrice,
								avgCost,
								avgProfitMargin,
								popularTags,
								totalRevenue,
								totalProfit,
								profitMargin: profitMarginPercentage,
								mostProfitableItems,
								bestSellingItems,
								topRevenueItems,
								topProfitItems,
								restockValue,
							});
						}
					} catch (err) {
						console.error("Error fetching inventory stats:", err);
					}
				} else if (result.error) {
					console.error("Error loading vendor data:", result.error);
					setError(result.error);

					// If we failed to get vendor data but have fewer than 3 retries
					if (retryCount < 3) {
						console.log(`Retry attempt ${retryCount + 1}/3`);
						setRetryCount((prev) => prev + 1);
						// Wait for 1 second before retrying
						setTimeout(() => {
							checkAuth();
						}, 1000);
						return;
					}
				}
			} catch (error) {
				console.error("Error in checkAuth:", error);
				setError("Failed to load vendor data");
			}

			setIsLoading(false);
		};

		checkAuth();
	}, [user, router, retryCount, initializing]);

	if (isLoading && !initializing) {
		return <LoadingScreen message="Loading..." />;
	}

	// Create a safe version of vendorData to prevent "undefined" errors
	const safeVendorData = {
		displayName: vendorData?.displayName || "Not set",
		email: vendorData?.email || user?.email || "Unknown",
		phoneNumber: vendorData?.phoneNumber || "Not set",
		shopName: vendorData?.shopName || "Not set",
		location: vendorData?.location || "Not set",
		businessDescription:
			vendorData?.businessDescription || "No description provided",
		created_at: vendorData?.created_at || null,
		inventory: vendorData?.inventory || [],
	};

	return (
		<div className="min-h-screen bg-gray-50">
			<header>
				<VendorNavBar vendorData={vendorData} />
			</header>

			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
				{error && (
					<div className="bg-red-100 text-red-700 p-4 rounded mb-6">
						{error}
						{retryCount >= 3 && (
							<div className="mt-2">
								<p>
									Unable to retrieve complete vendor data. Some information may
									not be displayed correctly.
								</p>
							</div>
						)}
					</div>
				)}

				{/* Welcome Section */}
				<div className="bg-white rounded-lg shadow-md p-6 mb-6">
					<div className="flex flex-col md:flex-row justify-between">
						<div>
							<h1 className="text-2xl font-bold text-gray-900 mb-2">
								Welcome, {safeVendorData.displayName}
							</h1>
							<p className="text-gray-600">
								Here&apos;s an overview of your shop: {safeVendorData.shopName}
							</p>
						</div>
						<div className="mt-4 md:mt-0">
							<Link
								href="/vendor/inventory/add"
								className="bg-puce hover:bg-rose text-white py-2 px-4 rounded-lg shadow-md flex items-center"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="h-5 w-5 mr-2"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 6v6m0 0v6m0-6h6m-6 0H6"
									/>
								</svg>
								Add New Item
							</Link>
						</div>
					</div>
				</div>

				{/* Stats Cards */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
					<div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-sarva">
						<div className="flex justify-between items-start">
							<div>
								<p className="text-sm font-medium text-gray-500">Total Items</p>
								<p className="text-2xl font-bold text-gray-800">
									{inventoryStats.totalItems}
								</p>
							</div>
							<div className="bg-sarva/10 p-3 rounded-full">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="h-6 w-6 text-sarva"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
									/>
								</svg>
							</div>
						</div>
						<div className="mt-2">
							<Link
								href="/vendor/inventory"
								className="text-sm text-sarva hover:underline"
							>
								View inventory
							</Link>
						</div>
					</div>

					<div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-puce">
						<div className="flex justify-between items-start">
							<div>
								<p className="text-sm font-medium text-gray-500">
									Inventory Value
								</p>
								<p className="text-2xl font-bold text-gray-800">
									${inventoryStats.totalValue.toFixed(2)}
								</p>
							</div>
							<div className="bg-puce/10 p-3 rounded-full">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="h-6 w-6 text-puce"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 -.895 3-2-1.343-2-3-2zm0 8c1.11 0 2.08-.402 2.599-1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
									/>
								</svg>
							</div>
						</div>
						<div className="mt-2">
							<Link
								href="/vendor/inventory?sort=value&order=desc"
								className="text-sm text-puce hover:underline"
							>
								View inventory value
							</Link>
						</div>
					</div>

					<div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-rose">
						<div className="flex justify-between items-start">
							<div>
								<p className="text-sm font-medium text-gray-500">
									Low Stock Items
								</p>
								<p className="text-2xl font-bold text-gray-800">
									{inventoryStats.lowStockItems}
								</p>
							</div>
							<div className="bg-rose/10 p-3 rounded-full">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="h-6 w-6 text-rose"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
									/>
								</svg>
							</div>
						</div>
						<div className="mt-2">
							<Link
								href="/vendor/inventory?filter=lowStock"
								className="text-sm text-rose hover:underline"
							>
								View low stock items
							</Link>
						</div>
					</div>

					<div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
						<div className="flex justify-between items-start">
							<div>
								<p className="text-sm font-medium text-gray-500">
									Out of Stock
								</p>
								<p className="text-2xl font-bold text-gray-800">
									{inventoryStats.outOfStockItems}
								</p>
							</div>
							<div className="bg-red-100 p-3 rounded-full">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="h-6 w-6 text-red-500"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
							</div>
						</div>
						<div className="mt-2">
							<Link
								href="/vendor/inventory?filter=outOfStock"
								className="text-sm text-red-500 hover:underline"
							>
								View out of stock items
							</Link>
						</div>
					</div>
				</div>

				{/* Additional Analytics Section */}
				<div className="bg-white rounded-lg shadow-md p-6 mb-6">
					<h2 className="text-xl font-semibold text-gray-800 mb-4">
						Advanced Metrics
					</h2>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
						{/* Average Product Price */}
						<div className="bg-gray-50 p-4 rounded-lg">
							<p className="text-sm font-medium text-gray-500">Average Price</p>
							<p className="text-2xl font-bold text-gray-800">
								${inventoryStats.avgPrice.toFixed(2)}
							</p>
							<p className="text-xs text-gray-500 mt-1">
								Average price across all products
							</p>
						</div>

						{/* Highest Priced Item */}
						<div className="bg-gray-50 p-4 rounded-lg">
							<p className="text-sm font-medium text-gray-500">
								Highest Priced Item
							</p>
							<p className="text-xl font-bold text-gray-800 truncate">
								{inventoryStats.highestPricedItem.name || "N/A"}
							</p>
							<p className="text-lg text-gray-700">
								${inventoryStats.highestPricedItem.price.toFixed(2)}
							</p>
						</div>

						{/* Restock Value */}
						<div className="bg-gray-50 p-4 rounded-lg">
							<p className="text-sm font-medium text-gray-500">
								Estimated Restock Cost
							</p>
							<p className="text-2xl font-bold text-gray-800">
								${inventoryStats.restockValue.toFixed(2)}
							</p>
							<p className="text-xs text-gray-500 mt-1">
								Cost to restock low inventory items (to 10 units)
							</p>
						</div>

						{/* Popular Tags */}
						<div className="bg-gray-50 p-4 rounded-lg">
							<p className="text-sm font-medium text-gray-500 mb-2">
								Popular Tags
							</p>
							<div className="flex flex-wrap gap-1">
								{inventoryStats.popularTags.map((tag, index) => (
									<span
										key={index}
										className="text-xs bg-white px-2 py-1 rounded-full text-gray-700 border border-gray-200"
									>
										{tag.tag} ({tag.count})
									</span>
								))}
							</div>
						</div>
					</div>
				</div>

				{/* Charts Section */}
				<div className="mb-6">
					{inventoryItems.length > 0 ? (
						<DashboardCharts inventoryItems={inventoryItems} />
					) : (
						<div className="bg-white rounded-lg shadow-md p-6 text-center">
							<p className="text-gray-500">
								Add items to your inventory to see performance charts
							</p>
							<Link
								href="/vendor/inventory/add"
								className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-puce hover:bg-rose focus:outline-none"
							>
								Add Your First Item
							</Link>
						</div>
					)}
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
					{/* Inventory List Preview */}
					<div className="bg-white rounded-lg shadow-md p-6 col-span-1 md:col-span-2">
						<h2 className="text-xl font-semibold text-gray-800 mb-4">
							Inventory Preview
						</h2>
						{inventoryItems && inventoryItems.length > 0 ? (
							<div className="space-y-1">
								<ul className="border border-gray-200 rounded-md divide-y divide-gray-200">
									{inventoryItems.slice(0, 5).map((item) => (
										<li
											key={item.itemID}
											className="pl-3 pr-4 py-3 flex items-center justify-between text-sm"
										>
											<div className="w-0 flex-1 flex items-center">
												<span className="ml-2 flex-1 w-0 truncate">
													{item.name} - ${item.price.toFixed(2)} ({item.units}{" "}
													in stock)
												</span>
											</div>
											<div className="ml-4 flex-shrink-0">
												<Link
													href={`/vendor/inventory/view/${item.itemID}`}
													className="font-medium text-puce hover:text-rose"
												>
													View
												</Link>
											</div>
										</li>
									))}
									{inventoryItems.length > 5 && (
										<li className="pl-3 pr-4 py-3 text-sm text-center text-gray-500">
											+ {inventoryItems.length - 5} more items
										</li>
									)}
								</ul>
								<div className="text-right mt-3">
									<Link
										href="/vendor/inventory"
										className="text-sm font-medium text-puce hover:text-rose"
									>
										View all inventory →
									</Link>
								</div>
							</div>
						) : (
							<div className="text-center py-4">
								<p className="text-gray-500 mb-4">No items in inventory yet</p>
								<Link
									href="/vendor/inventory/add"
									className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-puce hover:bg-rose focus:outline-none"
								>
									Add Your First Item
								</Link>
							</div>
						)}
					</div>

					{/* Quick Links */}
					<div className="bg-white rounded-lg shadow-md p-6">
						<h2 className="text-xl font-semibold text-gray-800 mb-4">
							Quick Links
						</h2>
						<div className="space-y-3">
							<Link
								href="/vendor/inventory/add"
								className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
							>
								<div className="bg-puce/10 p-2 rounded-full mr-3">
									<svg
										className="h-5 w-5 text-puce"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M12 6v6m0 0v6m0-6h6m-6 0H6"
										/>
									</svg>
								</div>
								<div>
									<p className="text-sm font-medium">Add New Item</p>
								</div>
							</Link>
							<Link
								href="/vendor/inventory"
								className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
							>
								<div className="bg-sarva/10 p-2 rounded-full mr-3">
									<svg
										className="h-5 w-5 text-sarva"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
										/>
									</svg>
								</div>
								<div>
									<p className="text-sm font-medium">Manage Inventory</p>
								</div>
							</Link>
							<Link
								href="/vendor/profile"
								className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
							>
								<div className="bg-blue-100 p-2 rounded-full mr-3">
									<svg
										className="h-5 w-5 text-blue-600"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
										/>
									</svg>
								</div>
								<div>
									<p className="text-sm font-medium">Update Profile</p>
								</div>
							</Link>
							<Link
								href="/vendor/orders"
								className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
							>
								<div className="bg-green-100 p-2 rounded-full mr-3">
									<svg
										className="h-5 w-5 text-green-600"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
										/>
									</svg>
								</div>
								<div>
									<p className="text-sm font-medium">View Orders</p>
								</div>
							</Link>
						</div>
					</div>
				</div>

				{/* Analytics Summary Section - Improved with actual data */}
				<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-6">
					{/* Order Stats Card */}
					<div className="bg-white overflow-hidden shadow rounded-lg">
						<div className="px-4 py-5 sm:p-6">
							<dl>
								<dt className="text-sm font-medium text-gray-500 truncate">
									Total Units Sold
								</dt>
								<dd className="mt-1 text-3xl font-semibold text-gray-900">
									{inventoryItems.reduce(
										(sum, item) => sum + (item.soldUnits || 0),
										0
									)}
								</dd>
							</dl>
						</div>
					</div>

					{/* Revenue Stats Card */}
					<div className="bg-white overflow-hidden shadow rounded-lg">
						<div className="px-4 py-5 sm:p-6">
							<dl>
								<dt className="text-sm font-medium text-gray-500 truncate">
									Total Revenue
								</dt>
								<dd className="mt-1 text-3xl font-semibold text-gray-900">
									${inventoryStats.totalRevenue.toFixed(2)}
								</dd>
								<dd className="mt-1 text-sm text-gray-500">
									Profit: ${inventoryStats.totalProfit.toFixed(2)}
									<span className="ml-2 bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
										{inventoryStats.profitMargin.toFixed(1)}% margin
									</span>
								</dd>
							</dl>
						</div>
					</div>

					{/* Inventory Stats Card */}
					<div className="bg-white overflow-hidden shadow rounded-lg">
						<div className="px-4 py-5 sm:p-6">
							<dl>
								<dt className="text-sm font-medium text-gray-500 truncate">
									Products in Inventory
								</dt>
								<dd className="mt-1 text-3xl font-semibold text-gray-900">
									{inventoryStats.totalItems}
								</dd>
								<dd className="mt-1 text-sm text-gray-500">
									Avg. Price: ${inventoryStats.avgPrice.toFixed(2)}
									<span className="ml-2">•</span>
									Avg. Cost: ${inventoryStats.avgCost.toFixed(2)}
								</dd>
							</dl>
						</div>
					</div>
				</div>

				{/* Profit Metrics Section */}
				<div className="bg-white shadow rounded-lg mb-6">
					<div className="px-4 py-5 sm:px-6 border-b border-gray-200">
						<h3 className="text-lg leading-6 font-medium text-gray-900">
							Profit Analytics
						</h3>
						<p className="mt-1 max-w-2xl text-sm text-gray-500">
							Detailed overview of your store&apos;s profitability
						</p>
					</div>

					<div className="px-4 py-5 sm:p-6">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
							{/* Overall Profit Margin */}
							<div className="bg-gray-50 p-4 rounded-lg">
								<h4 className="text-sm font-medium text-gray-500">
									Overall Profit Margin
								</h4>
								<p className="text-2xl font-bold text-green-600">
									{inventoryStats.profitMargin.toFixed(1)}%
								</p>
								<p className="text-sm text-gray-500">
									Avg. Item Margin: {inventoryStats.avgProfitMargin.toFixed(1)}%
								</p>
							</div>

							{/* Most Profitable Items */}
							<div className="bg-gray-50 p-4 rounded-lg">
								<h4 className="text-sm font-medium text-gray-500">
									Most Profitable Items (by margin)
								</h4>
								<ul className="mt-2 space-y-2">
									{inventoryStats.mostProfitableItems.map((item) => {
										const margin =
											((item.price - (item.cost || 0)) / item.price) * 100;
										return (
											<li key={item.itemID} className="flex justify-between">
												<span
													className="text-sm text-gray-600 truncate"
													style={{ maxWidth: "70%" }}
												>
													{item.name}
												</span>
												<span className="text-sm font-medium text-green-600">
													{margin.toFixed(0)}%
												</span>
											</li>
										);
									})}
								</ul>
							</div>

							{/* Top Revenue Generators */}
							<div className="bg-gray-50 p-4 rounded-lg">
								<h4 className="text-sm font-medium text-gray-500">
									Top Profit Generators
								</h4>
								<ul className="mt-2 space-y-2">
									{inventoryStats.topProfitItems.map((item) => {
										const totalProfit =
											(item.soldUnits || 0) * (item.price - (item.cost || 0));
										return (
											<li key={item.itemID} className="flex justify-between">
												<span
													className="text-sm text-gray-600 truncate"
													style={{ maxWidth: "70%" }}
												>
													{item.name}
												</span>
												<span className="text-sm font-medium text-green-600">
													${totalProfit.toFixed(0)}
												</span>
											</li>
										);
									})}
								</ul>
							</div>
						</div>
					</div>
				</div>

				{/* User Details Card */}
				<div className="bg-white shadow overflow-hidden sm:rounded-lg">
					<div className="px-4 py-5 sm:px-6">
						<h3 className="text-lg leading-6 font-medium text-gray-900">
							Vendor Profile
						</h3>
						<p className="mt-1 max-w-2xl text-sm text-gray-500">
							Your account details and preferences.
						</p>
					</div>
					<div className="border-t border-gray-200">
						<dl>
							image
							<div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
								<dt className="text-sm font-medium text-gray-500">
									Profile picture
								</dt>
								<dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
									{vendorData?.profileImage ? (
										<Image
											src={vendorData.profileImage}
											alt="Profile"
											className="h-16 w-16 rounded-full"
											width={64}
											height={64}
										/>
									) : (
										<span className="text-gray-500">No profile picture</span>
									)}
								</dd>
							</div>
							<div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
								<dt className="text-sm font-medium text-gray-500">
									Business name
								</dt>
								<dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
									{safeVendorData.shopName}
								</dd>
							</div>
							<div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
								<dt className="text-sm font-medium text-gray-500">
									Contact person
								</dt>
								<dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
									{safeVendorData.displayName}
								</dd>
							</div>
							<div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
								<dt className="text-sm font-medium text-gray-500">
									Email address
								</dt>
								<a
									className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 hover:underline"
									href={`mailto:${safeVendorData.email}`}
								>
									{safeVendorData.email}
								</a>
							</div>
							<div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
								<dt className="text-sm font-medium text-gray-500">
									Phone number
								</dt>
								<a
									className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 hover:underline"
									href={`tel:${safeVendorData.phoneNumber}`}
								>
									{safeVendorData.phoneNumber}
								</a>
							</div>
							<div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
								<dt className="text-sm font-medium text-gray-500">
									Business address
								</dt>
								<a
									className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 hover:underline"
									href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
										safeVendorData.location
									)}`}
								>
									{safeVendorData.location}
								</a>
							</div>
							<div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
								<dt className="text-sm font-medium text-gray-500">
									Business description
								</dt>
								<dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
									{safeVendorData.businessDescription}
								</dd>
							</div>
						</dl>
					</div>
				</div>
			</main>

			<Footer />
		</div>
	);
}
