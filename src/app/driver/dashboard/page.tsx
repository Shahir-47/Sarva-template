// src/app/driver/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDriverAuth } from "@/hooks/useDriverAuth";
import { getCurrentDriverData } from "@/firebase/driverAuth";
import { DriverData } from "@/firebase/driverAuth";
import {
	collection,
	query,
	where,
	getDocs,
	doc,
	getDoc,
	Timestamp,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import DriverNavBar from "@/components/driver/DriverNavBar";
import LoadingScreen from "@/components/shared/LoadingScreen";
import DeliveryDetailsModal from "@/components/driver/DeliveryDetailsModal";
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
	PieChart,
	Pie,
	Cell,
} from "recharts";
import {
	Truck,
	DollarSign,
	MapPin,
	Package,
	User,
	Calendar,
	Clock,
	Star,
	Car,
} from "lucide-react";
import Image from "next/image";
import Footer from "@/components/shared/Footer";

// Interface for recent delivery data
interface RecentDelivery {
	orderId: string;
	customerName: string;
	vendorName: string;
	amount: number;
	earned: number;
	distance: number;
	timestamp: Timestamp;
}

export default function DriverDashboardPage() {
	const [driverData, setDriverData] = useState<DriverData | null>(null);
	const [recentDeliveries, setRecentDeliveries] = useState<RecentDelivery[]>(
		[]
	);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState("");
	const [retryCount, setRetryCount] = useState(0);
	const [activeTab, setActiveTab] = useState<
		"overview" | "earnings" | "deliveries" | "vehicle"
	>("overview");
	const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
	const [selectedDeliveryId, setSelectedDeliveryId] = useState<string>("");

	const { user, initializing } = useDriverAuth();
	const router = useRouter();

	// Fetch driver data with retries
	useEffect(() => {
		const checkAuth = async () => {
			if (initializing) return;

			setIsLoading(true);

			// If no user or email not verified, redirect
			if (!user) {
				console.log("No user found, redirecting to driver signin");
				router.push("/unauthorized");
				return;
			}

			// Get driver data
			try {
				console.log("Getting driver data for UID:", user.uid);
				const result = await getCurrentDriverData();

				if (result.success && result.data) {
					console.log("Successfully loaded driver data");
					setDriverData(result.data);

					// Fetch recent deliveries from the delivery IDs if any
					if (result.data.deliveryIds && result.data.deliveryIds.length > 0) {
						await fetchRecentDeliveries(result.data.deliveryIds.slice(-10)); // Get last 10 delivery IDs
					}
				} else if (result.error) {
					console.error("Error loading driver data:", result.error);
					setError(result.error);

					// If we failed to get driver data but have fewer than 3 retries
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
				setError("Failed to load driver data");
			}

			setIsLoading(false);
		};

		checkAuth();
	}, [user, router, retryCount, initializing]);

	// Handler for opening delivery details modal
	const handleViewDelivery = (deliveryId: string) => {
		setSelectedDeliveryId(deliveryId);
		setIsModalOpen(true);
	};

	// Fetch recent deliveries based on delivery IDs
	const fetchRecentDeliveries = async (deliveryIds: string[]) => {
		try {
			const fetchPromises = deliveryIds.map(async (deliveryId) => {
				// First try to find it in the orders collection
				const orderDoc = await getDoc(doc(db, "orders", deliveryId));

				if (orderDoc.exists()) {
					const orderData = orderDoc.data();

					// Try to find the earned amount in driverTransactions
					let earnedAmount = 0;
					const transactionsQuery = query(
						collection(db, "driverTransactions"),
						where("orderId", "==", deliveryId)
					);

					const transactionsSnapshot = await getDocs(transactionsQuery);
					if (!transactionsSnapshot.empty) {
						const transactionData = transactionsSnapshot.docs[0].data();
						// Correctly accessing the nested earned.total property
						earnedAmount = transactionData.earned?.total || 0;
					}

					return {
						orderId: deliveryId,
						customerName: orderData.customerName || "Unknown Customer",
						vendorName: orderData.vendorName || "Unknown Vendor",
						amount: orderData.amount?.total || 0,
						earned: earnedAmount, // Use the value from driver transactions
						distance: orderData.deliveryInfo?.distance || 0,
						timestamp: orderData.delivered_at || orderData.created_at,
					};
				}

				// If not found in orders, try driver transactions
				const transactionsQuery = query(
					collection(db, "driverTransactions"),
					where("orderId", "==", deliveryId)
				);

				const transactionsSnapshot = await getDocs(transactionsQuery);

				if (!transactionsSnapshot.empty) {
					const transactionData = transactionsSnapshot.docs[0].data();
					return {
						orderId: deliveryId,
						customerName: transactionData.customerName || "Unknown Customer",
						vendorName: transactionData.vendorName || "Unknown Vendor",
						amount: transactionData.total || 0,
						earned: transactionData.earned?.total || 0, // Correctly accessing nested property
						distance: transactionData.deliveryInfo?.distance || 0,
						timestamp:
							transactionData.deliverTimestamp ||
							transactionData.completionTimestamp ||
							transactionData.acceptTimestamp,
					};
				}

				// Return placeholder data if not found
				return null;
			});

			const deliveryResults = await Promise.all(fetchPromises);
			const validDeliveries = deliveryResults.filter(
				(delivery): delivery is RecentDelivery => delivery !== null
			);

			// Sort by timestamp (newest first)
			const sortedDeliveries = validDeliveries.sort((a, b) => {
				return b.timestamp.seconds - a.timestamp.seconds;
			});

			console.log("Fetched recent deliveries:", sortedDeliveries);

			setRecentDeliveries(sortedDeliveries);
		} catch (error) {
			console.error("Error fetching recent deliveries:", error);
		}
	};

	if (isLoading && !initializing) {
		return <LoadingScreen message="Loading..." />;
	}

	// Safe access to data
	const safeDriverData = {
		uid: driverData?.uid || "",
		profileImage: driverData?.profileImage || "",
		displayName: driverData?.displayName || "Not set",
		email: driverData?.email || user?.email || "Unknown",
		phoneNumber: driverData?.phoneNumber || "Not set",
		alternatePhoneNumber: driverData?.alternatePhoneNumber || "Not set",
		location: driverData?.location || "Not set",
		address: driverData?.address || "Not set",
		vehicleInfo: driverData?.vehicleInfo || {},
		driverLicense: driverData?.driverLicense || {},
		stats: driverData?.stats || {
			totalDeliveries: 0,
			totalEarnings: 0,
			totalMilesDriven: 0,
			totalDistance: 0,
			totalItems: 0,
			averageRating: 0,
		},
		created_at: driverData?.created_at || null,
		updated_at: driverData?.updated_at || null,
		deliveryIds: driverData?.deliveryIds || [],
		stripeAccountId: driverData?.stripeAccountId || "",
		stripeCapabilities: driverData?.stripeCapabilities || {
			card_payments: false,
			transfers: false,
		},
		stripeOnboardingComplete: driverData?.stripeOnboardingComplete || false,
		coordinates: driverData?.coordinates || null,
	};

	// Helper functions
	const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

	const formatDistance = (distanceInMeters: number) => {
		if (distanceInMeters == undefined || distanceInMeters == null)
			return "0 mi";
		const miles = distanceInMeters / 1609.34;
		return `${miles.toFixed(1)} mi`;
	};

	const formatDate = (timestamp: Timestamp | null) => {
		if (!timestamp) return "N/A";
		return new Date(timestamp.seconds * 1000).toLocaleDateString();
	};

	// Calculate today's earnings from recent deliveries
	const calculateTodaysEarnings = () => {
		if (recentDeliveries.length === 0) return 0;

		const today = new Date().setHours(0, 0, 0, 0);

		return recentDeliveries.reduce((sum, delivery) => {
			const deliveryDate = new Date(delivery.timestamp.seconds * 1000);
			if (deliveryDate.setHours(0, 0, 0, 0) === today) {
				return sum + delivery.earned;
			}
			return sum;
		}, 0);
	};

	// Prepare data for charts based on actual data
	const prepareEarningsChartData = () => {
		if (recentDeliveries.length === 0) return [];

		const earningsByDate: Record<string, number> = {};

		recentDeliveries.forEach((delivery) => {
			const date = new Date(
				delivery.timestamp.seconds * 1000
			).toLocaleDateString();
			earningsByDate[date] = (earningsByDate[date] || 0) + delivery.earned;
		});

		return Object.entries(earningsByDate).map(([date, earnings]) => ({
			date,
			earnings,
		}));
	};

	const prepareVendorDistributionData = () => {
		if (recentDeliveries.length === 0) return [];

		const vendorCounts: Record<string, number> = {};

		recentDeliveries.forEach((delivery) => {
			vendorCounts[delivery.vendorName] =
				(vendorCounts[delivery.vendorName] || 0) + 1;
		});

		return Object.entries(vendorCounts).map(([name, value]) => ({
			name,
			value,
		}));
	};

	const prepareEarningsToAmountData = () => {
		return recentDeliveries.map((delivery) => ({
			id: delivery.orderId.substring(0, 6),
			orderAmount: delivery.amount,
			earned: delivery.earned,
		}));
	};

	// Prepare chart data
	const earningsChartData = prepareEarningsChartData();
	const vendorDistributionData = prepareVendorDistributionData();
	const earningsToAmountData = prepareEarningsToAmountData();

	// Chart colors
	const COLORS = ["#4CAF50", "#2196F3", "#FF9800", "#F44336", "#9C27B0"];

	return (
		<div className="min-h-screen bg-gray-50">
			<header>
				<DriverNavBar />
			</header>

			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
				{error && (
					<div className="bg-red-100 text-red-700 p-4 rounded mb-6">
						{error}
						{retryCount >= 3 && (
							<div className="mt-2">
								<p>
									Unable to retrieve complete driver data. Some information may
									not be displayed correctly.
								</p>
							</div>
						)}
					</div>
				)}

				{/* Driver Profile Header */}
				<div className="bg-white shadow rounded-lg mb-6">
					<div className="px-6 py-5 flex flex-col md:flex-row justify-between items-start md:items-center">
						<div className="flex items-center">
							{safeDriverData.profileImage ? (
								<div className="h-16 w-16 rounded-full overflow-hidden mr-4">
									<Image
										src={safeDriverData.profileImage}
										alt={safeDriverData.displayName}
										className="h-full w-full object-cover"
										width={64}
										height={64}
									/>
								</div>
							) : (
								<div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center mr-4">
									<User className="h-8 w-8 text-gray-400" />
								</div>
							)}
							<div>
								<h1 className="text-2xl font-bold text-gray-900">
									{safeDriverData.displayName}
								</h1>
								<div className="text-gray-500 flex items-center">
									<MapPin className="h-4 w-4 mr-1" />
									{safeDriverData.location}
								</div>
							</div>
						</div>
						<div className="mt-4 md:mt-0 flex space-x-2">
							<button
								onClick={() => router.push("/driver/profile")}
								className="bg-sarva hover:bg-rose text-white px-4 py-2 rounded-md shadow-sm"
							>
								Edit Profile
							</button>
							<button
								onClick={() => router.push("/driver/orders")}
								className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md shadow-sm"
							>
								Find Deliveries
							</button>
						</div>
					</div>
				</div>

				{/* Stats Cards */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
					<div className="bg-white rounded-lg shadow px-6 py-5 flex items-center">
						<div className="rounded-full bg-blue-100 p-3 mr-4">
							<Truck className="h-8 w-8 text-blue-600" />
						</div>
						<div>
							<p className="text-sm font-medium text-gray-500">
								Total Deliveries
							</p>
							<p className="text-2xl font-bold text-gray-900">
								{safeDriverData.stats.totalDeliveries}
							</p>
						</div>
					</div>

					<div className="bg-white rounded-lg shadow px-6 py-5 flex items-center">
						<div className="rounded-full bg-green-100 p-3 mr-4">
							<DollarSign className="h-8 w-8 text-green-600" />
						</div>
						<div>
							<p className="text-sm font-medium text-gray-500">
								Total Earnings
							</p>
							<p className="text-2xl font-bold text-gray-900">
								${safeDriverData.stats.totalEarnings.toFixed(2)}
							</p>
						</div>
					</div>

					<div className="bg-white rounded-lg shadow px-6 py-5 flex items-center">
						<div className="rounded-full bg-purple-100 p-3 mr-4">
							<MapPin className="h-8 w-8 text-purple-600" />
						</div>
						<div>
							<p className="text-sm font-medium text-gray-500">
								Total Distance
							</p>
							<p className="text-2xl font-bold text-gray-900">
								{formatDistance(safeDriverData.stats.totalDistance)}
							</p>
						</div>
					</div>

					<div className="bg-white rounded-lg shadow px-6 py-5 flex items-center">
						<div className="rounded-full bg-yellow-100 p-3 mr-4">
							<Package className="h-8 w-8 text-yellow-600" />
						</div>
						<div>
							<p className="text-sm font-medium text-gray-500">
								Items Delivered
							</p>
							<p className="text-2xl font-bold text-gray-900">
								{safeDriverData.stats.totalItems}
							</p>
						</div>
					</div>
				</div>

				{/* Dashboard Tabs */}
				<div className="bg-white rounded-lg shadow mb-6">
					<div className="border-b border-gray-200">
						<nav className="flex -mb-px">
							<button
								onClick={() => setActiveTab("overview")}
								className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
									activeTab === "overview"
										? "border-sarva text-sarva"
										: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
								}`}
							>
								Overview
							</button>
							<button
								onClick={() => setActiveTab("earnings")}
								className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
									activeTab === "earnings"
										? "border-sarva text-sarva"
										: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
								}`}
							>
								Earnings
							</button>
							<button
								onClick={() => setActiveTab("deliveries")}
								className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
									activeTab === "deliveries"
										? "border-sarva text-sarva"
										: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
								}`}
							>
								Deliveries
							</button>
							<button
								onClick={() => setActiveTab("vehicle")}
								className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
									activeTab === "vehicle"
										? "border-sarva text-sarva"
										: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
								}`}
							>
								Vehicle
							</button>
						</nav>
					</div>

					<div className="p-6">
						{/* Overview Tab */}
						{activeTab === "overview" && (
							<div>
								{/* Today's Summary */}
								<div className="mb-8">
									<h2 className="text-lg font-medium text-gray-900 mb-4">
										Today&apos;s Summary
									</h2>
									<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
										<div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
											<div className="flex justify-between">
												<p className="text-sm font-medium opacity-90">
													Today&apos;s Earnings
												</p>
												<DollarSign className="h-6 w-6 opacity-80" />
											</div>
											<p className="text-3xl font-bold mt-2">
												${calculateTodaysEarnings().toFixed(2)}
											</p>
											<div className="mt-4 text-sm">
												<span className="text-white  bg-opacity-20 px-2 py-1 rounded-full">
													Account Status: Active
												</span>
											</div>
										</div>

										<div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow p-6 text-white">
											<div className="flex justify-between">
												<p className="text-sm font-medium opacity-90">
													Account Status
												</p>
												<Star className="h-6 w-6 opacity-80" />
											</div>
											<div className="mt-4 text-sm">
												<a
													className="text-white bg-opacity-20 px-2 py-1 rounded-full hover:underline"
													href={`mailto:${safeDriverData.email}`}
												>
													Email: {safeDriverData.email}
												</a>
											</div>
										</div>

										<div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg shadow p-6 text-white">
											<div className="flex justify-between">
												<p className="text-sm font-medium opacity-90">
													Payment Status
												</p>
												<DollarSign className="h-6 w-6 opacity-80" />
											</div>
											<p className="text-3xl font-bold mt-2">
												{safeDriverData.stripeAccountId
													? "Connected"
													: "Not Set"}
											</p>
											<div className="mt-4 text-sm">
												<span className="text-white bg-opacity-20 px-2 py-1 rounded-full">
													{safeDriverData.stripeOnboardingComplete
														? "Onboarding Complete"
														: "Setup Required"}
												</span>
											</div>
										</div>
									</div>
								</div>

								{/* Recent Deliveries */}
								<div className="mb-8">
									<h2 className="text-lg font-medium text-gray-900 mb-4">
										Recent Deliveries
									</h2>
									<div className="bg-white border rounded-lg shadow-sm overflow-hidden">
										{recentDeliveries.length > 0 ? (
											<div className="overflow-x-auto">
												<table className="min-w-full divide-y divide-gray-200">
													<thead className="bg-gray-50">
														<tr>
															<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
																Date
															</th>
															<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
																Order ID
															</th>
															<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
																Customer
															</th>
															<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
																Vendor
															</th>
															<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
																Amount
															</th>
															<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
																Earned
															</th>
															<th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
																Action
															</th>
														</tr>
													</thead>
													<tbody className="bg-white divide-y divide-gray-200">
														{recentDeliveries
															.slice(0, 5)
															.map((delivery, index) => (
																<tr
																	key={`recent-delivery-${delivery.orderId}-${index}`}
																	className="hover:bg-gray-50"
																>
																	<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
																		{formatDate(delivery.timestamp)}
																	</td>
																	<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
																		{delivery.orderId.substring(0, 8)}...
																	</td>
																	<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
																		{delivery.customerName}
																	</td>
																	<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
																		{delivery.vendorName}
																	</td>
																	<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
																		${delivery.amount.toFixed(2)}
																	</td>
																	<td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
																		${delivery.earned.toFixed(2)}
																	</td>
																	<td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
																		<button
																			onClick={() =>
																				handleViewDelivery(delivery.orderId)
																			}
																			className="text-blue-600 hover:text-blue-900"
																		>
																			View
																		</button>
																	</td>
																</tr>
															))}
													</tbody>
												</table>
											</div>
										) : (
											<div className="py-10 text-center">
												<p className="text-gray-500">
													No recent deliveries found
												</p>
											</div>
										)}
									</div>
									{recentDeliveries.length > 5 && (
										<div className="mt-3 text-right">
											<button
												onClick={() => setActiveTab("deliveries")}
												className="text-sarva hover:text-rose font-medium text-sm"
											>
												View All Deliveries →
											</button>
										</div>
									)}
								</div>

								{/* Vendor Distribution */}
								{recentDeliveries.length > 0 && (
									<div className="mb-8">
										<h2 className="text-lg font-medium text-gray-900 mb-4">
											Deliveries by Vendor
										</h2>
										<div className="bg-white border rounded-lg shadow-sm">
											<div className="p-4">
												<ResponsiveContainer width="100%" height={300}>
													<PieChart>
														<Pie
															data={vendorDistributionData}
															cx="50%"
															cy="50%"
															labelLine={false}
															outerRadius={100}
															fill="#8884d8"
															dataKey="value"
															label={({ name, percent }) =>
																`${name}: ${(percent * 100).toFixed(0)}%`
															}
														>
															{vendorDistributionData.map((entry, index) => (
																<Cell
																	key={`cell-${index}`}
																	fill={COLORS[index % COLORS.length]}
																/>
															))}
														</Pie>
														<Tooltip />
													</PieChart>
												</ResponsiveContainer>
											</div>
										</div>
									</div>
								)}
							</div>
						)}

						{/* Earnings Tab */}
						{activeTab === "earnings" && (
							<div>
								{/* Earning Stats */}
								<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
									<div className="bg-white rounded-lg shadow px-6 py-5">
										<div className="flex items-center">
											<div className="p-3 rounded-full bg-green-100 text-green-600">
												<DollarSign className="h-8 w-8" />
											</div>
											<div className="ml-5">
												<p className="text-sm font-medium text-gray-500">
													Total Earnings
												</p>
												<p className="text-2xl font-bold text-gray-900">
													${safeDriverData.stats.totalEarnings.toFixed(2)}
												</p>
											</div>
										</div>
									</div>

									<div className="bg-white rounded-lg shadow px-6 py-5">
										<div className="flex items-center">
											<div className="p-3 rounded-full bg-blue-100 text-blue-600">
												<Calendar className="h-8 w-8" />
											</div>
											<div className="ml-5">
												<p className="text-sm font-medium text-gray-500">
													Today
												</p>
												<p className="text-2xl font-bold text-gray-900">
													${calculateTodaysEarnings().toFixed(2)}
												</p>
											</div>
										</div>
									</div>

									<div className="bg-white rounded-lg shadow px-6 py-5">
										<div className="flex items-center">
											<div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
												<Clock className="h-8 w-8" />
											</div>
											<div className="ml-5">
												<p className="text-sm font-medium text-gray-500">
													Avg. Per Delivery
												</p>
												<p className="text-2xl font-bold text-gray-900">
													$
													{safeDriverData.stats.totalDeliveries > 0
														? (
																safeDriverData.stats.totalEarnings /
																safeDriverData.stats.totalDeliveries
														  ).toFixed(2)
														: "0.00"}
												</p>
											</div>
										</div>
									</div>
								</div>

								{/* Earnings Chart */}
								{recentDeliveries.length > 0 && (
									<div className="bg-white rounded-lg shadow mb-6">
										<div className="px-6 py-4 border-b border-gray-200">
											<h3 className="text-lg font-medium text-gray-900">
												Earnings by Date
											</h3>
										</div>
										<div className="p-6">
											<ResponsiveContainer width="100%" height={400}>
												<BarChart
													data={earningsChartData}
													margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
												>
													<CartesianGrid strokeDasharray="3 3" />
													<XAxis dataKey="date" />
													<YAxis />
													<Tooltip
														formatter={(value) => formatCurrency(Number(value))}
													/>
													<Legend />
													<Bar
														dataKey="earnings"
														name="Earnings"
														fill="#4CAF50"
													/>
												</BarChart>
											</ResponsiveContainer>
										</div>
									</div>
								)}

								{/* Payment Information */}
								<div className="bg-white rounded-lg shadow mb-6">
									<div className="px-6 py-4 border-b border-gray-200">
										<h3 className="text-lg font-medium text-gray-900">
											Payment Information
										</h3>
									</div>
									<div className="p-6">
										<div className="bg-gray-50 p-6 rounded-lg">
											<div className="flex items-center justify-between mb-4">
												<div>
													<h4 className="text-md font-medium text-gray-900">
														Stripe Account
													</h4>
													<p className="text-sm text-gray-500 mt-1">
														{safeDriverData.stripeAccountId
															? "Your Stripe account is connected for receiving payments"
															: "No payment account configured"}
													</p>
												</div>
												<div
													className={`px-3 py-1 rounded-full ${
														safeDriverData.stripeAccountId
															? "bg-green-100 text-green-800"
															: "bg-red-100 text-red-800"
													}`}
												>
													{safeDriverData.stripeAccountId
														? "Connected"
														: "Not Connected"}
												</div>
											</div>

											{safeDriverData.stripeAccountId && (
												<div className="border-t border-gray-200 pt-4 mt-4">
													<div className="flex justify-between items-center">
														<span className="text-sm text-gray-600">
															Account ID:
														</span>
														<span className="text-sm font-medium text-gray-900">
															{safeDriverData.stripeAccountId.substring(0, 10)}
															...
														</span>
													</div>

													{safeDriverData.stripeOnboardingComplete && (
														<div className="flex justify-between items-center mt-2">
															<span className="text-sm text-gray-600">
																Status:
															</span>
															<span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
																Onboarding Complete
															</span>
														</div>
													)}

													{safeDriverData.stripeCapabilities && (
														<div className="mt-4">
															<p className="text-sm font-medium text-gray-600 mb-2">
																Capabilities:
															</p>
															<div className="flex flex-wrap gap-2">
																{safeDriverData.stripeCapabilities
																	.card_payments && (
																	<span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
																		Card Payments
																	</span>
																)}
																{safeDriverData.stripeCapabilities
																	.transfers && (
																	<span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded">
																		Transfers
																	</span>
																)}
															</div>
														</div>
													)}
												</div>
											)}

											<div className="mt-6 text-right">
												<button
													onClick={() => router.push("/driver/profile")}
													className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sarva hover:bg-rose focus:outline-none"
												>
													{safeDriverData.stripeAccountId
														? "Manage Payment Settings"
														: "Set Up Payment Account"}
												</button>
											</div>
										</div>
									</div>
								</div>

								{/* Order Amount vs Earnings */}
								{recentDeliveries.length > 0 && (
									<div className="bg-white rounded-lg shadow">
										<div className="px-6 py-4 border-b border-gray-200">
											<h3 className="text-lg font-medium text-gray-900">
												Order Amount vs Earnings
											</h3>
										</div>
										<div className="p-6">
											<ResponsiveContainer width="100%" height={400}>
												<BarChart
													data={earningsToAmountData}
													margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
												>
													<CartesianGrid strokeDasharray="3 3" />
													<XAxis dataKey="id" />
													<YAxis />
													<Tooltip
														formatter={(value) => formatCurrency(Number(value))}
													/>
													<Legend />
													<Bar
														dataKey="orderAmount"
														name="Order Amount"
														fill="#8884d8"
													/>
													<Bar
														dataKey="earned"
														name="Earnings"
														fill="#82ca9d"
													/>
												</BarChart>
											</ResponsiveContainer>
										</div>
									</div>
								)}
							</div>
						)}

						{/* Deliveries Tab */}
						{activeTab === "deliveries" && (
							<div>
								{/* Performance Metrics */}
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
									<div className="bg-white rounded-lg shadow p-6">
										<div className="flex flex-col items-center">
											<div className="rounded-full bg-blue-100 p-3 mb-4">
												<Truck className="h-8 w-8 text-blue-600" />
											</div>
											<p className="text-lg font-medium text-gray-900">
												Total Deliveries
											</p>
											<p className="text-3xl font-bold text-blue-600 mt-2">
												{safeDriverData.stats.totalDeliveries}
											</p>
										</div>
									</div>

									<div className="bg-white rounded-lg shadow p-6">
										<div className="flex flex-col items-center">
											<div className="rounded-full bg-green-100 p-3 mb-4">
												<Package className="h-8 w-8 text-green-600" />
											</div>
											<p className="text-lg font-medium text-gray-900">
												Items Delivered
											</p>
											<p className="text-3xl font-bold text-green-600 mt-2">
												{safeDriverData.stats.totalItems}
											</p>
										</div>
									</div>

									<div className="bg-white rounded-lg shadow p-6">
										<div className="flex flex-col items-center">
											<div className="rounded-full bg-yellow-100 p-3 mb-4">
												<MapPin className="h-8 w-8 text-yellow-600" />
											</div>
											<p className="text-lg font-medium text-gray-900">
												Miles Driven
											</p>
											<p className="text-3xl font-bold text-yellow-600 mt-2">
												{
													formatDistance(
														safeDriverData.stats.totalDistance
													).split(" ")[0]
												}
											</p>
										</div>
									</div>

									<div className="bg-white rounded-lg shadow p-6">
										<div className="flex flex-col items-center">
											<div className="rounded-full bg-purple-100 p-3 mb-4">
												<Star className="h-8 w-8 text-purple-600" />
											</div>
											<p className="text-lg font-medium text-gray-900">
												Rating
											</p>
											<p className="text-3xl font-bold text-purple-600 mt-2">
												{safeDriverData.stats.averageRating > 0
													? safeDriverData.stats.averageRating.toFixed(1)
													: "N/A"}
											</p>
										</div>
									</div>
								</div>

								{/* All Deliveries Table */}
								<div className="bg-white rounded-lg shadow mb-6">
									<div className="px-6 py-4 border-b border-gray-200">
										<h3 className="text-lg font-medium text-gray-900">
											All Recent Deliveries
										</h3>
									</div>
									<div className="overflow-hidden">
										{recentDeliveries.length > 0 ? (
											<div className="overflow-x-auto">
												<table className="min-w-full divide-y divide-gray-200">
													<thead className="bg-gray-50">
														<tr>
															<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
																Date
															</th>
															<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
																Order ID
															</th>
															<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
																Customer
															</th>
															<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
																Vendor
															</th>
															<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
																Distance
															</th>
															<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
																Amount
															</th>
															<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
																Earned
															</th>
															<th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
																Action
															</th>
														</tr>
													</thead>
													<tbody className="bg-white divide-y divide-gray-200">
														{recentDeliveries.map((delivery, index) => (
															<tr
																key={`all-delivery-${delivery.orderId}-${index}`}
																className="hover:bg-gray-50"
															>
																<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
																	{formatDate(delivery.timestamp)}
																</td>
																<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
																	{delivery.orderId.substring(0, 8)}...
																</td>
																<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
																	{delivery.customerName}
																</td>
																<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
																	{delivery.vendorName}
																</td>
																<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
																	{formatDistance(delivery.distance)}
																</td>
																<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
																	${delivery.amount.toFixed(2)}
																</td>
																<td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
																	${delivery.earned.toFixed(2)}
																</td>
																<td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
																	<button
																		onClick={() =>
																			handleViewDelivery(delivery.orderId)
																		}
																		className="text-blue-600 hover:text-blue-900"
																	>
																		Details
																	</button>
																</td>
															</tr>
														))}
													</tbody>
												</table>
											</div>
										) : (
											<div className="py-10 text-center">
												<div className="mx-auto h-12 w-12 text-gray-400">
													<Truck className="h-12 w-12" />
												</div>
												<h3 className="mt-2 text-sm font-medium text-gray-900">
													No deliveries yet
												</h3>
												<p className="mt-1 text-sm text-gray-500">
													Get started by accepting your first delivery.
												</p>
												<div className="mt-6">
													<button
														onClick={() => router.push("/driver/orders")}
														className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-sarva hover:bg-rose focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sarva"
													>
														<Truck className="-ml-1 mr-2 h-5 w-5" />
														Find Available Deliveries
													</button>
												</div>
											</div>
										)}
									</div>
								</div>

								{/* Delivery IDs */}
								<div className="bg-white rounded-lg shadow">
									<div className="px-6 py-4 border-b border-gray-200">
										<h3 className="text-lg font-medium text-gray-900">
											Delivery History
										</h3>
									</div>
									<div className="p-6">
										<div className="bg-gray-50 p-6 rounded-lg">
											<div className="flex justify-between items-center mb-4">
												<h4 className="text-md font-medium text-gray-900">
													All Delivery IDs
												</h4>
												<span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
													{safeDriverData.deliveryIds.length} total
												</span>
											</div>

											<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
												{safeDriverData.deliveryIds
													.slice(0, 9)
													.map((id, index) => (
														<div
															key={`delivery-id-${id}-${index}`}
															className="bg-white p-3 rounded-md border border-gray-200 text-sm"
														>
															<div className="flex justify-between items-center">
																<span className="text-gray-600">
																	#{index + 1}
																</span>
																<button
																	onClick={() => handleViewDelivery(id)}
																	className="text-blue-600 hover:underline text-xs"
																>
																	View
																</button>
															</div>
															<p className="text-gray-900 mt-1 truncate">
																{id}
															</p>
														</div>
													))}
											</div>

											{safeDriverData.deliveryIds.length > 9 && (
												<div className="mt-4 text-center">
													<button
														onClick={() => router.push("/driver/orders")}
														className="text-sm font-medium text-blue-600 hover:text-blue-500"
													>
														View all {safeDriverData.deliveryIds.length}{" "}
														deliveries
													</button>
												</div>
											)}
										</div>
									</div>
								</div>
							</div>
						)}

						{/* Vehicle Tab */}
						{activeTab === "vehicle" && (
							<div>
								<div className="bg-white rounded-lg shadow mb-6">
									<div className="px-6 py-4 border-b border-gray-200">
										<h3 className="text-lg font-medium text-gray-900">
											Vehicle Information
										</h3>
									</div>
									<div className="p-6">
										<div className="flex flex-col md:flex-row">
											<div className="md:w-1/3 mb-6 md:mb-0 pr-0 md:pr-8">
												<div className="bg-gray-100 rounded-lg p-4 flex justify-center items-center h-48">
													<Car size={80} className="text-gray-400" />
												</div>
											</div>
											<div className="md:w-2/3">
												<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
													{Object.keys(safeDriverData.vehicleInfo).length >
													0 ? (
														<>
															<div className="bg-gray-50 rounded-lg p-4">
																<p className="text-sm font-medium text-gray-500 mb-1">
																	Make
																</p>
																<p className="text-lg font-semibold text-gray-900">
																	{safeDriverData.vehicleInfo.make || "Not set"}
																</p>
															</div>
															<div className="bg-gray-50 rounded-lg p-4">
																<p className="text-sm font-medium text-gray-500 mb-1">
																	Model
																</p>
																<p className="text-lg font-semibold text-gray-900">
																	{safeDriverData.vehicleInfo.model ||
																		"Not set"}
																</p>
															</div>
															<div className="bg-gray-50 rounded-lg p-4">
																<p className="text-sm font-medium text-gray-500 mb-1">
																	Year
																</p>
																<p className="text-lg font-semibold text-gray-900">
																	{safeDriverData.vehicleInfo.year || "Not set"}
																</p>
															</div>
															<div className="bg-gray-50 rounded-lg p-4">
																<p className="text-sm font-medium text-gray-500 mb-1">
																	Color
																</p>
																<p className="text-lg font-semibold text-gray-900">
																	{safeDriverData.vehicleInfo.color ||
																		"Not set"}
																</p>
															</div>
															<div className="bg-gray-50 rounded-lg p-4">
																<p className="text-sm font-medium text-gray-500 mb-1">
																	License Plate
																</p>
																<p className="text-lg font-semibold text-gray-900">
																	{safeDriverData.vehicleInfo.licensePlate ||
																		"Not set"}
																</p>
															</div>
															{safeDriverData.vehicleInfo.vin && (
																<div className="bg-gray-50 rounded-lg p-4">
																	<p className="text-sm font-medium text-gray-500 mb-1">
																		VIN
																	</p>
																	<p className="text-lg font-semibold text-gray-900">
																		{safeDriverData.vehicleInfo.vin}
																	</p>
																</div>
															)}
														</>
													) : (
														<div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 col-span-2">
															<div className="flex">
																<div className="flex-shrink-0">
																	<svg
																		className="h-5 w-5 text-yellow-400"
																		viewBox="0 0 20 20"
																		fill="currentColor"
																	>
																		<path
																			fillRule="evenodd"
																			d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
																			clipRule="evenodd"
																		/>
																	</svg>
																</div>
																<div className="ml-3">
																	<p className="text-sm text-yellow-700">
																		No vehicle information has been added yet.
																		Please update your profile.
																	</p>
																</div>
															</div>
														</div>
													)}
												</div>

												<div className="mt-6 text-right">
													<button
														onClick={() => router.push("/driver/profile")}
														className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sarva hover:bg-rose focus:outline-none"
													>
														Update Vehicle Info
													</button>
												</div>
											</div>
										</div>
									</div>
								</div>

								{/* Driver License Info */}
								<div className="bg-white rounded-lg shadow mb-6">
									<div className="px-6 py-4 border-b border-gray-200">
										<h3 className="text-lg font-medium text-gray-900">
											Driver License Information
										</h3>
									</div>
									<div className="p-6">
										{Object.keys(safeDriverData.driverLicense).length > 0 ? (
											<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
												<div className="bg-gray-50 rounded-lg p-4">
													<p className="text-sm font-medium text-gray-500 mb-1">
														License Number
													</p>
													<p className="text-lg font-semibold text-gray-900">
														{safeDriverData.driverLicense.number
															? safeDriverData.driverLicense.number.slice(
																	0,
																	4
															  ) + "***"
															: "Not set"}
													</p>
												</div>
												<div className="bg-gray-50 rounded-lg p-4">
													<p className="text-sm font-medium text-gray-500 mb-1">
														State
													</p>
													<p className="text-lg font-semibold text-gray-900">
														{safeDriverData.driverLicense.state || "Not set"}
													</p>
												</div>
												<div className="bg-gray-50 rounded-lg p-4">
													<p className="text-sm font-medium text-gray-500 mb-1">
														Expiry Date
													</p>
													<p className="text-lg font-semibold text-gray-900">
														{safeDriverData.driverLicense.expiryDate ||
															"Not set"}
													</p>
												</div>
											</div>
										) : (
											<div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
												<div className="flex">
													<div className="flex-shrink-0">
														<svg
															className="h-5 w-5 text-yellow-400"
															viewBox="0 0 20 20"
															fill="currentColor"
														>
															<path
																fillRule="evenodd"
																d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
																clipRule="evenodd"
															/>
														</svg>
													</div>
													<div className="ml-3">
														<p className="text-sm text-yellow-700">
															No driver license information has been added yet.
															Please update your profile.
														</p>
													</div>
												</div>
											</div>
										)}

										<div className="mt-6 text-right">
											<button
												onClick={() => router.push("/driver/profile")}
												className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sarva hover:bg-rose focus:outline-none"
											>
												Update License Info
											</button>
										</div>
									</div>
								</div>

								{/* Driver Address */}
								<div className="bg-white rounded-lg shadow">
									<div className="px-6 py-4 border-b border-gray-200">
										<h3 className="text-lg font-medium text-gray-900">
											Location Information
										</h3>
									</div>
									<div className="p-6">
										<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
											<div className="bg-gray-50 rounded-lg p-4">
												<p className="text-sm font-medium text-gray-500 mb-1">
													Service Area
												</p>
												<p className="text-lg font-semibold text-gray-900">
													{safeDriverData.location}
												</p>
											</div>

											<div className="bg-gray-50 rounded-lg p-4">
												<p className="text-sm font-medium text-gray-500 mb-1">
													Coordinates
												</p>
												<p className="text-lg font-semibold text-gray-900">
													{safeDriverData.coordinates
														? (() => {
																try {
																	// Safe access to coordinates
																	const lat =
																		safeDriverData.coordinates.latitude;
																	const lng =
																		safeDriverData.coordinates.longitude;
																	return `${lat?.toString()}, ${lng?.toString()}`;
																} catch {
																	return "Coordinates format error";
																}
														  })()
														: "Not set"}
												</p>
											</div>

											<div className="bg-gray-50 rounded-lg p-4 md:col-span-2">
												<p className="text-sm font-medium text-gray-500 mb-1">
													Address
												</p>
												<p className="text-lg font-semibold text-gray-900">
													{safeDriverData.address}
												</p>
											</div>
										</div>

										<div className="mt-6 text-right">
											<button
												onClick={() => router.push("/driver/profile")}
												className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sarva hover:bg-rose focus:outline-none"
											>
												Update Location
											</button>
										</div>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			</main>

			<Footer />

			{/* Delivery Details Modal */}
			<DeliveryDetailsModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				deliveryId={selectedDeliveryId}
			/>
		</div>
	);
}
