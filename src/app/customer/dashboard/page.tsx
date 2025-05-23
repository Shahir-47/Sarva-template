// src/app/customer/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { getCurrentUserData } from "@/firebase/auth";
import { UserData } from "@/firebase/auth";
import NavBar from "@/components/customer/navBar";
import LoadingScreen from "@/components/shared/LoadingScreen";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/firebase/config";
import Link from "next/link";
import Footer from "@/components/shared/Footer";

// Interface for order summary data
interface OrderSummary {
	id: string;
	vendorName: string;
	date: Date;
	total: number;
	status: string;
}

// Interface for vendor analytics
interface VendorAnalytics {
	vendorId: string;
	vendorName: string;
	orderCount: number;
	totalSpent: number;
	lastOrderDate: Date;
}

// Interface for dashboard analytics
interface DashboardAnalytics {
	orderCount: number;
	totalSpent: number;
	favoriteVendor: string | null;
	recentOrders: OrderSummary[];
	vendorAnalytics: VendorAnalytics[];
	avgOrderValue: number;
}

export default function DashboardPage() {
	const [userData, setUserData] = useState<UserData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState("");
	const [retryCount, setRetryCount] = useState(0);
	const [analytics, setAnalytics] = useState<DashboardAnalytics>({
		orderCount: 0,
		totalSpent: 0,
		favoriteVendor: null,
		recentOrders: [],
		vendorAnalytics: [],
		avgOrderValue: 0,
	});

	const { user, initializing } = useAuth();
	const router = useRouter();

	// Format phone number for display
	const formatPhoneNumber = (phoneNumber: string) => {
		if (!phoneNumber) return "";

		// Strip non-numeric characters
		const cleaned = phoneNumber.replace(/\D/g, "");

		// Format as (XXX) XXX-XXXX for US numbers
		if (cleaned.length === 10) {
			return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(
				6
			)}`;
		} else if (cleaned.length === 11 && cleaned.startsWith("1")) {
			// Format for numbers with country code 1
			return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(
				4,
				7
			)}-${cleaned.slice(7)}`;
		}

		return phoneNumber;
	};

	// Format date for display
	const formatDate = (timestamp: { seconds: number } | null) => {
		if (!timestamp) return "N/A";
		try {
			const date = new Date(timestamp.seconds * 1000);
			return date.toLocaleString("en-US", {
				month: "long",
				day: "numeric",
				year: "numeric",
				hour: "numeric",
				minute: "2-digit",
				hour12: true,
			});
		} catch (error) {
			console.error("Error formatting date:", error);
			return "Invalid Date";
		}
	};

	// Format currency
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 2,
		}).format(amount);
	};

	useEffect(() => {
		const checkAuth = async () => {
			if (initializing) return;

			setIsLoading(true);

			// If no user or email not verified, redirect
			if (!user) {
				console.log("No user found, redirecting to signin");
				router.push("/unauthorized");
				return;
			}

			// Get user data
			try {
				const result = await getCurrentUserData();

				if (result.success && result.data) {
					console.log("Successfully loaded user data");
					setUserData(result.data);

					// If user has orders, fetch order analytics
					if (result.data.order_ids && result.data.order_ids.length > 0) {
						await fetchOrderAnalytics(result.data.order_ids);
					}
				} else if (result.error) {
					console.error("Error loading user data:", result.error);
					setError(result.error);

					// If we failed to get user data but have fewer than 3 retries
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
				setError("Failed to load user data");
			}

			setIsLoading(false);
		};

		checkAuth();
	}, [user, router, retryCount, initializing]);

	// Fetch order analytics data
	const fetchOrderAnalytics = async (orderIds: string[]) => {
		try {
			if (!orderIds || orderIds.length === 0) return;

			// Create a temporary vendorMap to accumulate vendor data
			const vendorMap = new Map<string, VendorAnalytics>();
			let totalSpent = 0;
			const recentOrders: OrderSummary[] = [];

			// Get orders data
			for (const orderId of orderIds) {
				const orderQuery = query(
					collection(db, "orders"),
					where("__name__", "==", orderId)
				);

				const orderSnapshot = await getDocs(orderQuery);

				if (!orderSnapshot.empty) {
					const orderData = orderSnapshot.docs[0].data();
					const vendorId = orderData.vendorID;
					const orderAmount = orderData.amount?.total || 0;
					const vendorName = orderData.vendorName || "Unknown Vendor";
					const orderDate = orderData.created_at
						? new Date(orderData.created_at.seconds * 1000)
						: new Date();

					// Add to total spent
					totalSpent += orderAmount;

					// Gather recent order data
					if (recentOrders.length < 5) {
						recentOrders.push({
							id: orderId,
							vendorName: vendorName,
							date: orderDate,
							total: orderAmount,
							status: orderData.status,
						});
					}

					// Update vendor analytics
					if (vendorId) {
						if (vendorMap.has(vendorId)) {
							const vendorData = vendorMap.get(vendorId)!;
							vendorData.orderCount += 1;
							vendorData.totalSpent += orderAmount;
							if (orderDate > vendorData.lastOrderDate) {
								vendorData.lastOrderDate = orderDate;
							}
						} else {
							vendorMap.set(vendorId, {
								vendorId: vendorId,
								vendorName: vendorName,
								orderCount: 1,
								totalSpent: orderAmount,
								lastOrderDate: orderDate,
							});
						}
					}
				}
			}

			// Sort recent orders by date (newest first)
			recentOrders.sort((a, b) => b.date.getTime() - a.date.getTime());

			// Convert vendorMap to array and sort by order count
			const vendorAnalytics = Array.from(vendorMap.values()).sort(
				(a, b) => b.orderCount - a.orderCount
			);

			// Find favorite vendor (most orders)
			const favoriteVendor =
				vendorAnalytics.length > 0 ? vendorAnalytics[0].vendorName : null;

			// Calculate average order value
			const avgOrderValue = totalSpent / orderIds.length;

			// Set analytics state
			setAnalytics({
				orderCount: orderIds.length,
				totalSpent: totalSpent,
				favoriteVendor: favoriteVendor,
				recentOrders: recentOrders,
				vendorAnalytics: vendorAnalytics,
				avgOrderValue: avgOrderValue,
			});
		} catch (error) {
			console.error("Error fetching order analytics:", error);
		}
	};

	if (isLoading && !initializing) {
		return <LoadingScreen message="Loading your dashboard..." />;
	}

	// Create a safe version of userData to prevent "undefined" errors
	const safeUserData = {
		displayName: userData?.displayName || "Not set",
		email: userData?.email || user?.email || "Unknown",
		phoneNumber: userData?.phoneNumber || "Not set",
		location: userData?.location || "Not set",
		created_at: userData?.created_at || null,
		updated_at: userData?.updated_at || null,
		order_ids: userData?.order_ids || [],
		profileImage: userData?.profileImage || null,
	};

	return (
		<div className="min-h-screen bg-gray-50">
			<header>
				<NavBar />
			</header>

			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
				{error && (
					<div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6 flex items-center">
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
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/>
						</svg>
						{error}
						{retryCount >= 3 && (
							<div className="mt-2">
								<p>
									Unable to retrieve complete user data. Some information may
									not be displayed correctly.
								</p>
							</div>
						)}
					</div>
				)}

				{/* Welcome Banner */}
				<div className="mt-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg shadow-lg mb-6 text-white p-6">
					<div className="flex flex-col md:flex-row justify-between items-start md:items-center">
						<div>
							<h1 className="text-3xl font-bold">
								Welcome back, {safeUserData.displayName.split(" ")[0]}!
							</h1>
							<p className="mt-2 text-blue-100">
								Here&apos;s a summary of your ordering activity
							</p>
						</div>
						<div className="mt-4 md:mt-0">
							<Link href="/customer/my-orders">
								<button className="bg-white text-blue-600 py-2 px-4 rounded-lg shadow hover:bg-blue-50 transition-colors font-medium cursor-pointer">
									View Your Orders
								</button>
							</Link>
						</div>
					</div>
				</div>

				{/* Stats Grid */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
					{/* Total Orders */}
					<div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
						<div className="flex justify-between items-start">
							<div>
								<p className="text-sm font-medium text-gray-500 uppercase tracking-wider">
									Total Orders
								</p>
								<p className="mt-2 text-3xl font-bold text-gray-900">
									{analytics.orderCount}
								</p>
							</div>
							<span className="bg-blue-100 p-3 rounded-lg">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="h-6 w-6 text-blue-600"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
									/>
								</svg>
							</span>
						</div>
						<p className="mt-2 text-sm text-gray-500">
							Since{" "}
							{safeUserData.created_at
								? new Date(
										safeUserData.created_at.seconds * 1000
								  ).toLocaleDateString()
								: "joining"}
						</p>
					</div>

					{/* Total Spent */}
					<div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
						<div className="flex justify-between items-start">
							<div>
								<p className="text-sm font-medium text-gray-500 uppercase tracking-wider">
									Total Spent
								</p>
								<p className="mt-2 text-3xl font-bold text-gray-900">
									{formatCurrency(analytics.totalSpent)}
								</p>
							</div>
							<span className="bg-green-100 p-3 rounded-lg">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="h-6 w-6 text-green-600"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
							</span>
						</div>
						<p className="mt-2 text-sm text-gray-500">
							Avg. {formatCurrency(analytics.avgOrderValue)} per order
						</p>
					</div>

					{/* Favorite Vendor */}
					<div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
						<div className="flex justify-between items-start">
							<div>
								<p className="text-sm font-medium text-gray-500 uppercase tracking-wider">
									Favorite Vendor
								</p>
								<p className="mt-2 text-3xl font-bold text-gray-900 truncate max-w-[200px]">
									{analytics.favoriteVendor || "N/A"}
								</p>
							</div>
							<span className="bg-purple-100 p-3 rounded-lg">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="h-6 w-6 text-purple-600"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
									/>
								</svg>
							</span>
						</div>
						<p className="mt-2 text-sm text-gray-500">
							{analytics.vendorAnalytics.length > 0 && analytics.favoriteVendor
								? `${analytics.vendorAnalytics[0].orderCount} orders placed`
								: "No orders yet"}
						</p>
					</div>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* Recent Orders */}
					<div className="lg:col-span-2 bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
						<div className="px-6 py-4 border-b border-gray-200">
							<h2 className="text-lg font-medium text-gray-900">
								Recent Orders
							</h2>
						</div>
						<div className="divide-y divide-gray-200">
							{analytics.recentOrders.length > 0 ? (
								analytics.recentOrders.map((order) => (
									<div
										key={order.id}
										className="p-6 hover:bg-gray-50 transition-colors"
									>
										<div className="flex justify-between items-start">
											<div>
												<h3 className="text-base font-medium text-gray-900">
													{order.vendorName}
												</h3>
												<p className="text-sm text-gray-500">
													{order.date.toLocaleDateString()} at{" "}
													{order.date.toLocaleTimeString([], {
														hour: "2-digit",
														minute: "2-digit",
													})}
												</p>
											</div>
											<div className="flex flex-col items-end">
												<span className="text-base font-medium text-gray-900">
													{formatCurrency(order.total)}
												</span>
												<span
													className={`px-2 py-1 text-xs rounded-full mt-1 ${
														order.status === "delivered"
															? "bg-green-100 text-green-800"
															: order.status === "cancelled"
															? "bg-red-100 text-red-800"
															: "bg-blue-100 text-blue-800"
													}`}
												>
													{order.status.charAt(0).toUpperCase() +
														order.status.slice(1)}
												</span>
											</div>
										</div>
										<div className="mt-3">
											<Link
												href={`/customer/my-orders?order=${order.id}`}
												className="text-sm text-blue-600 hover:text-blue-800"
											>
												View Order Details →
											</Link>
										</div>
									</div>
								))
							) : (
								<div className="p-6 text-center">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										className="h-12 w-12 text-gray-400 mx-auto"
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
									<p className="mt-2 text-gray-500">
										You haven&apos;t placed any orders yet.
									</p>
									<button
										className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md cursor-pointer"
										onClick={() => router.push("/customer/order")}
									>
										Browse Vendors
									</button>
								</div>
							)}
						</div>
					</div>

					{/* User Profile */}
					<div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
						<div className="px-6 py-4 border-b border-gray-200">
							<h2 className="text-lg font-medium text-gray-900">
								Your Profile
							</h2>
						</div>
						<div className="p-6">
							<div className="flex items-center mb-6">
								{/* Profile Image */}
								<div className="w-16 h-16 bg-gray-100 rounded-full overflow-hidden flex items-center justify-center border-2 border-white shadow-md mr-4">
									{safeUserData.profileImage ? (
										<Image
											src={safeUserData.profileImage}
											alt="Profile"
											width={64}
											height={64}
											className="w-full h-full object-cover"
										/>
									) : (
										<div className="text-center">
											<svg
												className="w-10 h-10 text-gray-300 mx-auto"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
												xmlns="http://www.w3.org/2000/svg"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
												/>
											</svg>
										</div>
									)}
								</div>
								<h3 className="text-xl font-medium text-gray-900">
									{safeUserData.displayName}
								</h3>
							</div>

							<div className="space-y-4">
								<div className="flex items-start">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										className="h-5 w-5 text-gray-500 mt-0.5 mr-3"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
										/>
									</svg>
									<div>
										<p className="text-sm text-gray-500">Email</p>
										<a
											href={`mailto:${safeUserData.email}`}
											className="text-base text-gray-900 hover:underline"
										>
											{safeUserData.email}
										</a>
									</div>
								</div>

								<div className="flex items-start">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										className="h-5 w-5 text-gray-500 mt-0.5 mr-3"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
										/>
									</svg>
									<div>
										<p className="text-sm text-gray-500">Phone</p>
										<a
											className="text-base text-gray-900 hover:underline"
											href={`tel:${safeUserData.phoneNumber}`}
										>
											{formatPhoneNumber(safeUserData.phoneNumber)}
										</a>
									</div>
								</div>

								<div className="flex items-start">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										className="h-5 w-5 text-gray-500 mt-0.5 mr-3"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
										/>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
										/>
									</svg>
									<div>
										<p className="text-sm text-gray-500">Delivery Address</p>
										<a
											className="text-base text-gray-900 hover:underline"
											href={`https://www.google.com/maps/search/?api=1&query=${safeUserData.location}`}
										>
											{safeUserData.location}
										</a>
									</div>
								</div>

								<div className="flex items-start">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										className="h-5 w-5 text-gray-500 mt-0.5 mr-3"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
										/>
									</svg>
									<div>
										<p className="text-sm text-gray-500">Member Since</p>
										<p className="text-base text-gray-900">
											{formatDate(safeUserData.created_at)}
										</p>
									</div>
								</div>
							</div>

							<div className="mt-6">
								<Link href="/customer/profile">
									<button className="w-full py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer">
										Edit Profile
									</button>
								</Link>
							</div>
						</div>
					</div>
				</div>

				{/* Vendor Analytics */}
				{analytics.vendorAnalytics.length > 0 && (
					<div className="mt-6 bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
						<div className="px-6 py-4 border-b border-gray-200">
							<h2 className="text-lg font-medium text-gray-900">
								Your Favorite Vendors
							</h2>
						</div>
						<div className="overflow-x-auto">
							<table className="min-w-full divide-y divide-gray-200">
								<thead className="bg-gray-50">
									<tr>
										<th
											scope="col"
											className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>
											Vendor
										</th>
										<th
											scope="col"
											className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>
											Orders
										</th>
										<th
											scope="col"
											className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>
											Total Spent
										</th>
										<th
											scope="col"
											className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>
											Last Order
										</th>
										<th
											scope="col"
											className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>
											Actions
										</th>
									</tr>
								</thead>
								<tbody className="bg-white divide-y divide-gray-200">
									{analytics.vendorAnalytics.map((vendor) => (
										<tr key={vendor.vendorId} className="hover:bg-gray-50">
											<td className="px-6 py-4 whitespace-nowrap">
												<div className="text-sm font-medium text-gray-900">
													{vendor.vendorName}
												</div>
											</td>
											<td className="px-6 py-4 whitespace-nowrap">
												<div className="text-sm text-gray-900">
													{vendor.orderCount}
												</div>
											</td>
											<td className="px-6 py-4 whitespace-nowrap">
												<div className="text-sm text-gray-900">
													{formatCurrency(vendor.totalSpent)}
												</div>
											</td>
											<td className="px-6 py-4 whitespace-nowrap">
												<div className="text-sm text-gray-500">
													{vendor.lastOrderDate.toLocaleDateString()}
												</div>
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-sm">
												<Link
													href={`/customer/vendors/${vendor.vendorId}`}
													className="text-blue-600 hover:text-blue-900"
												>
													Order Again
												</Link>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				)}
			</main>

			<Footer />
		</div>
	);
}
