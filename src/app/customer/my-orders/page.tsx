/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/customer/my-orders/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import NavBar from "@/components/customer/navBar";
import LoadingScreen from "@/components/shared/LoadingScreen";
import FeedbackModal from "@/components/customer/FeedbackModal";
import OrderDetails from "@/components/customer/OrderDetails";
import {
	collection,
	query,
	where,
	onSnapshot,
	orderBy,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { OrderStatus } from "@/lib/types/order";
import Footer from "@/components/shared/Footer";

// Interfaces for order-related types
export interface OrderItem {
	itemID: string;
	name: string;
	quantity: number;
	price: number;
	barcode?: string;
}

export interface OrderAmounts {
	subtotal: number;
	tax: number;
	serviceFee: number;
	deliveryFee: number;
	tip?: number;
	total: number;
}

export interface Order {
	cancelled_reason: React.JSX.Element;
	cancelled_at: { seconds: number; nanoseconds: number } | null;
	payment_status: React.JSX.Element;
	id?: string;
	customerID: string;
	customerName?: string;
	customerEmail?: string;
	customerPhone?: string;
	customerLocation?: string;
	vendorID: string;
	vendorName?: string;
	vendorLocation?: string;
	vendorEmail?: string;
	vendorPhone?: string;
	lineItems: OrderItem[];
	status: OrderStatus | string;
	amount: OrderAmounts;
	created_at: any;
	updated_at?: any;
	estimated_delivery?: any;
	driverID?: string | null;
	driverName?: string;
	driverPhone?: string;
	paymentIntentId?: string;
	special_instructions?: string;
	delivered_at?: any;
}

// Toast notification component
const Toast = ({
	message,
	onClose,
}: {
	message: string;
	onClose: () => void;
}) => {
	useEffect(() => {
		const timer = setTimeout(() => {
			onClose();
		}, 5000);

		return () => clearTimeout(timer);
	}, [onClose]);

	return (
		<div className="fixed top-24 right-4 z-50 flex items-center p-4 mb-4 text-gray-500 bg-white rounded-lg shadow max-w-xs dark:text-gray-400 border-l-4 border-green-500 dark:bg-gray-800 transition-all duration-300 ease-in-out transform translate-x-0">
			<div className="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 text-green-500 bg-green-100 rounded-lg dark:bg-green-800 dark:text-green-200">
				<svg
					className="w-5 h-5"
					fill="currentColor"
					viewBox="0 0 20 20"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						fillRule="evenodd"
						d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
						clipRule="evenodd"
					></path>
				</svg>
			</div>
			<div className="ml-3 text-sm font-normal">{message}</div>
			<button
				type="button"
				className="cursor-pointer ml-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex h-8 w-8 dark:text-gray-500 dark:hover:text-white dark:bg-gray-800 dark:hover:bg-gray-700"
				onClick={onClose}
				aria-label="Close"
			>
				<span className="sr-only">Close</span>
				<svg
					className="w-5 h-5"
					fill="currentColor"
					viewBox="0 0 20 20"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						fillRule="evenodd"
						d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
						clipRule="evenodd"
					></path>
				</svg>
			</button>
		</div>
	);
};

// Helper function to get status color
const getStatusColor = (status: string) => {
	const statusColors: { [key: string]: string } = {
		pending_payment: "bg-yellow-100 text-yellow-800",
		preparing: "bg-yellow-100 text-yellow-800",
		"waiting for a driver to be assigned": "bg-purple-100 text-purple-800",
		"driver coming to pickup": "bg-indigo-100 text-indigo-800",
		"driver delivering": "bg-teal-100 text-teal-800",
		delivered: "bg-green-100 text-green-800",
		cancelled: "bg-red-100 text-red-800",
	};

	return statusColors[status] || "bg-gray-100 text-gray-800";
};

// Helper function to format date
const formatDate = (timestamp: any) => {
	if (!timestamp) return "N/A";

	try {
		const date = new Date(timestamp.seconds * 1000);
		return date.toLocaleString("en-US", {
			weekday: "short",
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		});
	} catch (error) {
		console.error("Error formatting date:", error);
		return "Invalid Date";
	}
};

// Helper function to get readable status
const getReadableStatus = (status: string) => {
	const statusMap: { [key: string]: string } = {
		pending_payment: "Pending Payment",
		preparing: "Preparing",
		"waiting for a driver to be assigned": "Awaiting Driver",
		"driver coming to pickup": "Driver Headed to Store",
		"driver delivering": "Out for Delivery",
		delivered: "Delivered",
		cancelled: "Cancelled",
	};

	return statusMap[status] || status;
};

// Helper function to get status percentage for progress bar
const getStatusPercentage = (status: string) => {
	const percentages: { [key: string]: number } = {
		pending_payment: 2,
		preparing: 13,
		"waiting for a driver to be assigned": 28,
		"driver coming to pickup": 60,
		"driver delivering": 85,
		delivered: 100,
		cancelled: 0,
	};

	return percentages[status] || 0;
};

export default function MyOrdersPage() {
	const [orders, setOrders] = useState<Order[]>([]);
	const [activeOrder, setActiveOrder] = useState<Order | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState("");
	const [activeTab, setActiveTab] = useState("active");
	const [feedbackModal, setFeedbackModal] = useState<{
		isOpen: boolean;
		orderID: string;
		vendorName: string;
		deliveryDate: string;
	}>({
		isOpen: false,
		orderID: "",
		vendorName: "",
		deliveryDate: "",
	});
	const [toast, setToast] = useState<{
		show: boolean;
		message: string;
		orderId: string;
	}>({
		show: false,
		message: "",
		orderId: "",
	});

	const handleFeedbackClick = (order: Order, e: React.MouseEvent) => {
		e.stopPropagation(); // Prevent the order details from opening

		setFeedbackModal({
			isOpen: true,
			orderID: order.id || "",
			vendorName: order.vendorName || "",
			deliveryDate: formatDate(order.delivered_at),
		});
	};

	const handleCloseFeedbackModal = () => {
		setFeedbackModal({
			...feedbackModal,
			isOpen: false,
		});
	};

	// Keep track of order status changes
	const previousOrderStatusesRef = useRef<Map<string, string>>(new Map());
	// Store the active order ID rather than the whole object
	const activeOrderIdRef = useRef<string | null>(null);

	const { user } = useAuth();
	const router = useRouter();

	// Update the activeOrderIdRef when activeOrder changes
	useEffect(() => {
		activeOrderIdRef.current = activeOrder?.id || null;
	}, [activeOrder]);

	// Set up real-time listeners for orders
	useEffect(() => {
		if (!user) {
			router.push("/unauthorized");
			return;
		}

		setIsLoading(true);
		let unsubscribe: (() => void) | undefined;

		try {
			// Create a query for this customer's orders
			const ordersQuery = query(
				collection(db, "orders"),
				where("customerID", "==", user.uid),
				orderBy("created_at", "desc")
			);

			// Set up the real-time listener
			unsubscribe = onSnapshot(
				ordersQuery,
				(snapshot) => {
					const ordersList: Order[] = snapshot.docs.map((doc) => {
						const data = doc.data();
						return {
							id: doc.id,
							...data,
							lineItems: data.lineItems || [],
							amount: data.amount || {
								subtotal: 0,
								tax: 0,
								serviceFee: 0,
								deliveryFee: 0,
								total: 0,
							},
						} as Order;
					});

					// Check for status changes and show notifications for newly delivered orders
					ordersList.forEach((order) => {
						const orderId = order.id || "";
						const currentStatus = order.status;
						const previousStatus =
							previousOrderStatusesRef.current.get(orderId);

						// If we have a previous status and it's changed to delivered
						if (
							previousStatus &&
							previousStatus !== currentStatus &&
							currentStatus === OrderStatus.DELIVERED
						) {
							// Show toast notification for delivered order
							setToast({
								show: true,
								message: `Your order from ${order.vendorName} has been delivered! View it in Past Orders.`,
								orderId: orderId,
							});
						}

						// Update the previous status
						previousOrderStatusesRef.current.set(orderId, currentStatus);
					});

					setOrders(ordersList);

					// If there's an active order being viewed, update it with fresh data
					if (activeOrderIdRef.current) {
						const updatedActiveOrder = ordersList.find(
							(o) => o.id === activeOrderIdRef.current
						);
						if (updatedActiveOrder) {
							setActiveOrder(updatedActiveOrder);
						}
					}

					setIsLoading(false);
					setError("");
				},
				(err) => {
					console.error("Error fetching orders:", err);
					setError("Failed to load your orders. Please refresh the page.");
					setIsLoading(false);
				}
			);
		} catch (err) {
			console.error("Error setting up orders listener:", err);
			setError("Something went wrong. Please refresh the page.");
			setIsLoading(false);
		}

		// Clean up listener on unmount
		return () => {
			if (unsubscribe) {
				unsubscribe();
			}
		};
	}, [user, router]); // Removed activeOrder from dependencies

	const handleOrderClick = (order: Order) => {
		setActiveOrder(order);
	};

	const handleCloseDetails = () => {
		setActiveOrder(null);
	};

	const handleCloseToast = () => {
		setToast({ show: false, message: "", orderId: "" });
	};

	// Filter orders correctly for active and past tabs
	const activeOrders = orders.filter(
		(order) =>
			order.status !== OrderStatus.DELIVERED &&
			order.status !== OrderStatus.CANCELLED
	);

	const pastOrders = orders.filter(
		(order) =>
			order.status === OrderStatus.DELIVERED ||
			order.status === OrderStatus.CANCELLED
	);

	// Automatically switch to the past orders tab when viewing toast
	useEffect(() => {
		if (toast.show && toast.orderId) {
			// Find the delivered order
			const deliveredOrder = orders.find(
				(order) =>
					order.id === toast.orderId && order.status === OrderStatus.DELIVERED
			);

			if (deliveredOrder) {
				// Switch to past orders tab after a short delay
				const tabTimer = setTimeout(() => {
					setActiveTab("past");
				}, 1000);

				return () => clearTimeout(tabTimer);
			}
		}
	}, [toast, orders]);

	if (isLoading) {
		return <LoadingScreen message="Loading your orders..." />;
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<header>
				<NavBar />
			</header>

			{/* Toast Notification */}
			{toast.show && (
				<Toast message={toast.message} onClose={handleCloseToast} />
			)}

			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
				{error && (
					<div className="bg-red-100 border border-red-200 text-red-700 p-4 rounded-lg mb-6 flex items-center">
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
					</div>
				)}

				<div className="bg-white shadow-sm rounded-lg overflow-hidden">
					<div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center">
						<div>
							<h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
							<p className="mt-1 text-sm text-gray-500">
								View and track your orders in real-time
							</p>
						</div>
					</div>

					{/* Tabs */}
					<div className="border-b border-gray-200">
						<nav className="flex -mb-px" aria-label="Tabs">
							<button
								onClick={() => setActiveTab("active")}
								className={`${
									activeTab === "active"
										? "border-blue-500 text-blue-600"
										: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
								} cursor-pointer whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm flex items-center`}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className={`h-5 w-5 mr-2 ${
										activeTab === "active" ? "text-blue-500" : "text-gray-400"
									}`}
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
								Active Orders
								<span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
									{activeOrders.length}
								</span>
							</button>
							<button
								onClick={() => setActiveTab("past")}
								className={`${
									activeTab === "past"
										? "border-blue-500 text-blue-600"
										: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
								} cursor-pointer whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm flex items-center`}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className={`h-5 w-5 mr-2 ${
										activeTab === "past" ? "text-blue-500" : "text-gray-400"
									}`}
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M5 13l4 4L19 7"
									/>
								</svg>
								Past Orders
								<span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
									{pastOrders.length}
								</span>
							</button>
						</nav>
					</div>

					{/* Order list */}
					<div className="py-4">
						{activeTab === "active" ? (
							activeOrders.length > 0 ? (
								<div className="space-y-4 p-4">
									{activeOrders.map((order) => (
										<div
											key={order.id}
											className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer bg-white"
											onClick={() => handleOrderClick(order)}
										>
											<div className="p-5">
												<div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
													<div>
														<div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
															<h4 className="text-lg font-bold text-gray-900">
																{order.vendorName}
															</h4>
															<span
																className={`px-3 py-1 rounded-full text-xs font-medium inline-flex items-center ${getStatusColor(
																	order.status
																)}`}
															>
																{order.status === "pending_payment" && (
																	<svg
																		xmlns="http://www.w3.org/2000/svg"
																		className="h-3 w-3 mr-1"
																		fill="none"
																		viewBox="0 0 24 24"
																		stroke="currentColor"
																	>
																		<path
																			strokeLinecap="round"
																			strokeLinejoin="round"
																			strokeWidth={2}
																			d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
																		/>
																	</svg>
																)}
																{getReadableStatus(order.status)}
															</span>
														</div>
														<p className="text-sm text-gray-500 mt-1">
															Ordered on {formatDate(order.created_at)}
														</p>
														<div className="flex flex-wrap gap-4 mt-2">
															<p className="text-sm">
																<span className="font-medium">
																	{order.lineItems.length}
																</span>{" "}
																{order.lineItems.length === 1
																	? "item"
																	: "items"}
															</p>
															<p className="text-sm font-medium">
																${order.amount.total.toFixed(2)}
															</p>
														</div>
													</div>
													<div className="flex items-center justify-between sm:justify-end w-full sm:w-auto">
														<div className="flex items-center">
															<button
																onClick={(e) => {
																	e.stopPropagation();
																	handleOrderClick(order);
																}}
																className="cursor-pointer inline-flex items-center px-3 py-1.5 text-sm text-blue-700 hover:text-blue-800"
															>
																View Details
																<svg
																	xmlns="http://www.w3.org/2000/svg"
																	className="h-4 w-4 ml-1"
																	fill="none"
																	viewBox="0 0 24 24"
																	stroke="currentColor"
																>
																	<path
																		strokeLinecap="round"
																		strokeLinejoin="round"
																		strokeWidth={2}
																		d="M9 5l7 7-7 7"
																	/>
																</svg>
															</button>
														</div>
													</div>
												</div>
											</div>

											{/* Progress bar */}
											{order.status !== "cancelled" && (
												<div className="px-5 pb-5">
													<div className="w-full bg-gray-200 rounded-full h-2.5">
														<div
															className="bg-blue-600 h-2.5 rounded-full transition-all duration-700 ease-in-out"
															style={{
																width: `${getStatusPercentage(order.status)}%`,
															}}
														></div>
													</div>
													<div className="flex justify-between text-xs text-gray-500 mt-1">
														<span>Ordered</span>
														<span>Preparing</span>
														<span>Awaiting Driver Assignment</span>
														<span>Driver Assigned</span>
														<span>En route to store</span>
														<span>picked up</span>
														<span>Out for Delivery</span>
														<span>Delivered</span>
													</div>
												</div>
											)}
										</div>
									))}
								</div>
							) : (
								<div className="py-12 text-center">
									<div className="mx-auto w-24 h-24 rounded-full bg-blue-50 flex items-center justify-center">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											className="h-12 w-12 text-blue-400"
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
									</div>
									<h3 className="mt-4 text-lg font-medium text-gray-900">
										No active orders
									</h3>
									<p className="mt-1 text-sm text-gray-500 max-w-sm mx-auto">
										You don&apos;t have any active orders at the moment. Browse
										our vendors to place an order!
									</p>
									<div className="mt-6">
										<button
											type="button"
											className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
											onClick={() => router.push("/customer/order")}
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
													d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
												/>
											</svg>
											Browse Vendors
										</button>
									</div>
								</div>
							)
						) : pastOrders.length > 0 ? (
							<div className="space-y-4 p-4">
								{pastOrders.map((order) => (
									<div
										key={order.id}
										className={`border rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer bg-white ${
											toast.orderId === order.id
												? "border-green-500 shadow-lg"
												: ""
										}`}
										onClick={() => handleOrderClick(order)}
									>
										<div className="p-5">
											<div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
												<div>
													<div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
														<h4 className="text-lg font-bold text-gray-900">
															{order.vendorName}
														</h4>
														<span
															className={`px-3 py-1 rounded-full text-xs font-medium inline-flex items-center ${getStatusColor(
																order.status
															)}`}
														>
															{order.status === "delivered" && (
																<svg
																	xmlns="http://www.w3.org/2000/svg"
																	className="h-3 w-3 mr-1"
																	fill="none"
																	viewBox="0 0 24 24"
																	stroke="currentColor"
																>
																	<path
																		strokeLinecap="round"
																		strokeLinejoin="round"
																		strokeWidth={2}
																		d="M5 13l4 4L19 7"
																	/>
																</svg>
															)}
															{order.status === "cancelled" && (
																<svg
																	xmlns="http://www.w3.org/2000/svg"
																	className="h-3 w-3 mr-1"
																	fill="none"
																	viewBox="0 0 24 24"
																	stroke="currentColor"
																>
																	<path
																		strokeLinecap="round"
																		strokeLinejoin="round"
																		strokeWidth={2}
																		d="M6 18L18 6M6 6l12 12"
																	/>
																</svg>
															)}
															{getReadableStatus(order.status)}
														</span>
													</div>
													<p className="text-sm text-gray-500 mt-1">
														Ordered on {formatDate(order.created_at)}
													</p>
													{order.delivered_at && (
														<p className="text-sm text-gray-500">
															Delivered on {formatDate(order.delivered_at)}
														</p>
													)}
													<div className="flex flex-wrap gap-4 mt-2">
														<p className="text-sm">
															<span className="font-medium">
																{order.lineItems.length}
															</span>{" "}
															{order.lineItems.length === 1 ? "item" : "items"}
														</p>
														<p className="text-sm font-medium">
															${order.amount.total.toFixed(2)}
														</p>
													</div>
												</div>
												<div className="flex items-center justify-between sm:justify-end w-full sm:w-auto">
													<div className="flex items-center space-x-2">
														{/* Add feedback button only for delivered orders */}
														{order.status === "delivered" && (
															<button
																onClick={(e) => handleFeedbackClick(order, e)}
																className="cursor-pointer inline-flex items-center px-3 py-1.5 text-sm text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 rounded-md transition-colors"
															>
																<svg
																	xmlns="http://www.w3.org/2000/svg"
																	className="h-4 w-4 mr-1"
																	fill="none"
																	viewBox="0 0 24 24"
																	stroke="currentColor"
																>
																	<path
																		strokeLinecap="round"
																		strokeLinejoin="round"
																		strokeWidth={2}
																		d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
																	/>
																</svg>
																Leave Feedback
															</button>
														)}
														<button
															onClick={(e) => {
																e.stopPropagation();
																handleOrderClick(order);
															}}
															className="cursor-pointer inline-flex items-center px-3 py-1.5 text-sm text-blue-700 hover:text-blue-800"
														>
															View Details
															<svg
																xmlns="http://www.w3.org/2000/svg"
																className="h-4 w-4 ml-1"
																fill="none"
																viewBox="0 0 24 24"
																stroke="currentColor"
															>
																<path
																	strokeLinecap="round"
																	strokeLinejoin="round"
																	strokeWidth={2}
																	d="M9 5l7 7-7 7"
																/>
															</svg>
														</button>
													</div>
												</div>
											</div>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="py-12 text-center">
								<div className="mx-auto w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										className="h-12 w-12 text-gray-400"
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
								<h3 className="mt-4 text-lg font-medium text-gray-900">
									No past orders
								</h3>
								<p className="mt-1 text-sm text-gray-500 max-w-sm mx-auto">
									You haven&apos;t completed any orders yet. Browse our vendors
									to place your first order!
								</p>
								<div className="mt-6">
									<button
										type="button"
										className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
										onClick={() => router.push("/customer/order")}
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
												d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
											/>
										</svg>
										Browse Vendors
									</button>
								</div>
							</div>
						)}
					</div>
				</div>
			</main>
			<Footer />

			{/* Order details modal */}
			{activeOrder && (
				<OrderDetails
					order={activeOrder}
					onClose={handleCloseDetails}
					// No need for onRefresh since we have real-time updates
				/>
			)}

			{/* Feedback Modal */}
			<FeedbackModal
				isOpen={feedbackModal.isOpen}
				onClose={handleCloseFeedbackModal}
				orderID={feedbackModal.orderID}
				vendorName={feedbackModal.vendorName}
				deliveryDate={feedbackModal.deliveryDate}
			/>
		</div>
	);
}
