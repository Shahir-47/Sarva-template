// src/app/vendor/orders/page.tsx
"use client";

import { useEffect, useState } from "react";
import {
	collection,
	query,
	where,
	onSnapshot,
	updateDoc,
	doc,
	Timestamp,
	orderBy,
	limit,
	getDocs,
	FirestoreError,
	GeoPoint,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { useVendorAuth } from "@/hooks/useVendorAuth";
import VendorNavBar from "@/components/vendor/VendorNavBar";
import { useRouter } from "next/navigation";
import Footer from "@/components/shared/Footer";

interface LineItem {
	barcode: string;
	itemID: string;
	name: string;
	price: number;
	quantity: number;
	payment_status?: string;
}

interface OrderAmount {
	subtotal: number;
	deliveryFee: number;
	tax: number;
	serviceFee: number;
	tip: number;
	total: number;
}

interface DeliveryInfo {
	distance: number;
	distanceInKm: number;
	distanceInMiles?: number;
	estimatedTime: number;
}

interface Order {
	id: string;
	customerID: string;
	customerName: string;
	customerEmail: string;
	customerPhone: string;
	customerLocation: string;
	customerCoordinates: GeoPoint; // GeoPoint
	payment_status?: string; // Added property

	vendorID: string;
	vendorName: string;
	vendorEmail: string;
	vendorPhone: string;
	vendorLocation: string;
	vendorCoordinates: GeoPoint; // GeoPoint

	status: string;
	lineItems: LineItem[];
	deliveryInfo: DeliveryInfo;
	amount: OrderAmount;

	created_at: Timestamp;
	vendor_ready_at?: Timestamp;
	delivered_at?: Timestamp;
	cancelled_at?: Timestamp;
	cancelled_reason?: string;

	paymentIntentId: string;
	driverID?: string;
	driverName?: string;
	driverPhone?: string;
}

export default function VendorOrdersPage() {
	const { user, vendorData, initializing } = useVendorAuth();
	const [activeOrders, setActiveOrders] = useState<Order[]>([]);
	const [pastOrders, setPastOrders] = useState<Order[]>([]);
	const [loading, setLoading] = useState(true);
	const [historyLoading, setHistoryLoading] = useState(false);
	const [processing, setProcessing] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<"incoming" | "history">(
		"incoming"
	);
	const [error, setError] = useState("");
	const [indexError, setIndexError] = useState(false);
	const [indexUrl, setIndexUrl] = useState("");
	const [successMessage, setSuccessMessage] = useState("");
	const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [cancelReason, setCancelReason] = useState("");
	const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
	const router = useRouter();

	// Helper function to extract index URL from Firebase error message
	const extractIndexUrl = (errorMsg: string): string => {
		const urlMatch = errorMsg.match(
			/https:\/\/console\.firebase\.google\.com[^\s]+/
		);
		return urlMatch ? urlMatch[0] : "";
	};

	// Fetch active orders (preparing status)
	useEffect(() => {
		if (initializing) return;
		if (!user) {
			router.push("/vendor/auth/signin");
			return;
		}

		let unsub: (() => void) | undefined;

		const fetchActiveOrders = () => {
			try {
				// Try with compound query first (requires index)
				const q = query(
					collection(db, "orders"),
					where("vendorID", "==", user.uid),
					where("status", "==", "preparing"),
					orderBy("created_at", "desc")
				);

				unsub = onSnapshot(
					q,
					(snap) => {
						const list = snap.docs.map((d) => ({
							id: d.id,
							...(d.data() as Omit<Order, "id">),
						}));
						setActiveOrders(list);
						setLoading(false);
						setIndexError(false);
					},
					(err: FirestoreError) => {
						console.error("Error loading active orders:", err);

						// Check if this is an index error
						if (
							err.code === "failed-precondition" &&
							err.message.includes("index")
						) {
							setIndexError(true);
							setIndexUrl(extractIndexUrl(err.message));

							// Fallback to simpler query without ordering
							const fallbackQuery = query(
								collection(db, "orders"),
								where("vendorID", "==", user.uid),
								where("status", "==", "preparing")
							);

							unsub = onSnapshot(
								fallbackQuery,
								(snap) => {
									const list = snap.docs.map((d) => ({
										id: d.id,
										...(d.data() as Omit<Order, "id">),
									}));
									// Sort client-side instead
									list.sort(
										(a, b) => b.created_at.seconds - a.created_at.seconds
									);
									setActiveOrders(list);
									setLoading(false);
								},
								(fallbackErr) => {
									console.error("Fallback query also failed:", fallbackErr);
									setError(
										"Failed to load active orders. Please refresh the page."
									);
									setLoading(false);
								}
							);
						} else {
							setError(
								"Failed to load active orders. Please refresh the page."
							);
							setLoading(false);
						}
					}
				);
			} catch (err) {
				console.error("Error setting up active orders listener:", err);
				setError("Failed to set up orders listener. Please refresh the page.");
				setLoading(false);
			}
		};

		fetchActiveOrders();
		return () => {
			if (unsub) unsub();
		};
	}, [user, initializing, router]);

	// Function to fetch past orders (called when switching to history tab)
	const fetchPastOrders = async () => {
		if (!user) return;

		setHistoryLoading(true);
		setError("");

		try {
			// Try with a simpler approach to avoid index requirements
			const querySnapshot = await getDocs(
				query(
					collection(db, "orders"),
					where("vendorID", "==", user.uid),
					limit(100) // Fetch more since we'll filter client-side
				)
			);

			const orders = querySnapshot.docs
				.map((doc) => ({
					id: doc.id,
					...(doc.data() as Omit<Order, "id">),
				}))
				// Filter client-side for completed/cancelled orders
				.filter((order) =>
					[
						"delivered",
						"cancelled",
						"waiting for a driver to be assigned",
						"driver coming to pickup",
						"driver delivering",
					].includes(order.status)
				)
				// Sort by created_at client-side
				.sort((a, b) => b.created_at.seconds - a.created_at.seconds)
				.slice(0, 50); // Take only the first 50 after filtering

			setPastOrders(orders);
		} catch (err) {
			console.error("Error fetching past orders:", err);
			setError("Failed to load order history. Please refresh the page.");
		} finally {
			setHistoryLoading(false);
		}
	};

	// Handle tab change
	const handleTabChange = (tab: "incoming" | "history") => {
		setActiveTab(tab);
		if (tab === "history") {
			fetchPastOrders();
		}
	};

	// Mark order as ready for pickup
	const markReady = async (orderId: string) => {
		setProcessing(orderId);
		setError("");
		setSuccessMessage("");

		try {
			await updateDoc(doc(db, "orders", orderId), {
				status: "waiting for a driver to be assigned",
				vendor_ready_at: Timestamp.now(),
			});
			setSuccessMessage("Order marked as ready for pickup!");

			// Update local state to remove this order from active list
			setActiveOrders((prev) => prev.filter((order) => order.id !== orderId));

			// Add to past orders list (since it's now awaiting driver)
			const completedOrder = activeOrders.find((order) => order.id === orderId);
			if (completedOrder) {
				const updatedOrder = {
					...completedOrder,
					status: "waiting for a driver to be assigned",
					vendor_ready_at: Timestamp.now(),
				};
				setPastOrders((prev) => [updatedOrder, ...prev]);
			}
		} catch (err) {
			console.error("Error updating order status:", err);
			setError("Failed to update order status. Please try again.");
		} finally {
			setProcessing(null);
		}
	};

	// Cancel order
	const cancelOrder = async () => {
		if (!selectedOrder) return;

		setProcessing(selectedOrder.id);
		setError("");
		setSuccessMessage("");

		try {
			// First release the payment authorization
			let paymentResult;
			if (selectedOrder.paymentIntentId) {
				const response = await fetch("/api/cancel-payment-intent", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						paymentIntentId: selectedOrder.paymentIntentId,
					}),
				});

				paymentResult = await response.json();

				if (!response.ok) {
					console.error("Payment cancellation failed:", paymentResult.error);
					setError(`Payment cancellation failed: ${paymentResult.error}`);
					// We still proceed with order cancellation, but log the error
				}
			}

			// Update order status to cancelled
			await updateDoc(doc(db, "orders", selectedOrder.id), {
				status: "cancelled",
				cancelled_at: Timestamp.now(),
				cancelled_reason: cancelReason || "Cancelled by vendor",
				payment_status: paymentResult?.success
					? "authorization_released"
					: "unknown",
			});

			setSuccessMessage(
				`Order has been cancelled successfully. ${
					paymentResult?.success
						? "Customer's payment authorization has been released."
						: "Payment status could not be updated."
				}`
			);

			// Update local state to remove from active orders
			setActiveOrders((prev) =>
				prev.filter((order) => order.id !== selectedOrder.id)
			);

			// Add to past orders with updated status
			const cancelledOrder = {
				...selectedOrder,
				status: "cancelled",
				cancelled_at: Timestamp.now(),
				cancelled_reason: cancelReason || "Cancelled by vendor",
				payment_status: paymentResult?.success
					? "authorization_released"
					: "unknown",
			};

			setPastOrders((prev) => [cancelledOrder, ...prev]);

			// Close modals
			setIsCancelModalOpen(false);
			setIsModalOpen(false);
			setCancelReason("");
		} catch (err) {
			console.error("Error cancelling order:", err);
			setError("Failed to cancel order. Please try again.");
		} finally {
			setProcessing(null);
		}
	};

	// Open order details modal
	const openOrderDetails = (order: Order) => {
		setSelectedOrder(order);
		setIsModalOpen(true);
	};

	// Open cancel confirmation modal
	const openCancelModal = () => {
		setIsCancelModalOpen(true);
	};

	// Calculate time since order was placed
	const getOrderTime = (timestamp: Timestamp) => {
		const now = new Date();
		const orderTime = timestamp.toDate();
		const diffInMinutes = Math.floor(
			(now.getTime() - orderTime.getTime()) / (1000 * 60)
		);

		if (diffInMinutes < 60) {
			return `${diffInMinutes} min ago`;
		} else {
			const hours = Math.floor(diffInMinutes / 60);
			const minutes = diffInMinutes % 60;
			return `${hours}h ${minutes}m ago`;
		}
	};

	// Format date for order history
	const formatDate = (timestamp: Timestamp | undefined) => {
		if (!timestamp) return "N/A";

		return timestamp.toDate().toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	// Calculate preparation time
	const getPreparationTime = (order: Order) => {
		if (!order.vendor_ready_at || !order.created_at) return "N/A";

		const startTime = order.created_at.toDate();
		const endTime = order.vendor_ready_at.toDate();
		const diffInMinutes = Math.floor(
			(endTime.getTime() - startTime.getTime()) / (1000 * 60)
		);

		return `${diffInMinutes} min`;
	};

	// Get the total item count from lineItems
	const getTotalItemCount = (lineItems: LineItem[]): number => {
		if (!lineItems || !Array.isArray(lineItems)) return 0;
		return lineItems.reduce((total, item) => total + item.quantity, 0);
	};

	// Get status badge color
	const getStatusColor = (status: string) => {
		const colors = {
			preparing: "bg-yellow-100 text-yellow-800",
			"waiting for a driver to be assigned": "bg-blue-100 text-blue-800",
			"driver coming to pickup": "bg-indigo-100 text-indigo-800",
			"driver delivering": "bg-purple-100 text-purple-800",
			delivered: "bg-green-100 text-green-800",
			cancelled: "bg-red-100 text-red-800",
		};

		return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
	};

	// Get readable status text
	const getReadableStatus = (status: string) => {
		const statusMap = {
			preparing: "Preparing",
			"waiting for a driver to be assigned": "Awaiting Driver",
			"driver coming to pickup": "Driver En Route",
			"driver delivering": "Out for Delivery",
			delivered: "Delivered",
			cancelled: "Cancelled",
		};

		return statusMap[status as keyof typeof statusMap] || status;
	};

	// Calculate completed vs cancelled orders for stats
	const completedOrdersCount = pastOrders.filter(
		(order) => order.status === "delivered" || order.status === "picked up"
	).length;

	const cancelledOrdersCount = pastOrders.filter(
		(order) => order.status === "cancelled"
	).length;

	const awaitingDriverCount = pastOrders.filter(
		(order) => order.status === "waiting for a driver to be assigned"
	).length;

	const inDeliveryCount = pastOrders.filter(
		(order) =>
			order.status === "driver coming to pickup" ||
			order.status === "driver delivering"
	).length;

	// Calculate average preparation time for completed orders
	const getAveragePreparationTime = () => {
		const completedWithTime = pastOrders.filter(
			(order) =>
				(order.status === "delivered" ||
					order.status === "waiting for a driver to be assigned") &&
				order.vendor_ready_at &&
				order.created_at
		);

		if (completedWithTime.length === 0) return "-";

		const totalTime = completedWithTime.reduce((sum, order) => {
			const startTime = order.created_at.toDate();
			const endTime = order.vendor_ready_at!.toDate();
			return sum + (endTime.getTime() - startTime.getTime());
		}, 0);

		const avgMinutes = Math.round(
			totalTime / completedWithTime.length / (1000 * 60)
		);
		return `${avgMinutes} min`;
	};

	// Order Details Modal Component
	const OrderDetailsModal = () => {
		if (!selectedOrder) return null;

		return (
			<div className="fixed inset-0 backdrop-blur-lg bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
				<div className="bg-white rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
					{/* Modal Header */}
					<div className="px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10 flex justify-between items-center">
						<div className="flex items-center">
							<h3 className="text-lg font-bold text-gray-900">Order Details</h3>
							<span
								className={`ml-3 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
									selectedOrder.status
								)}`}
							>
								{getReadableStatus(selectedOrder.status)}
							</span>
						</div>
						<button
							onClick={() => setIsModalOpen(false)}
							className="text-gray-400 hover:text-gray-600 focus:outline-none"
						>
							<svg
								className="h-6 w-6"
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
						</button>
					</div>

					<div className="p-6">
						{/* Order Header Info */}
						<div className="bg-gray-50 rounded-lg p-4 mb-6">
							<div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
								<div>
									<h4 className="text-lg font-semibold text-gray-900">
										Order #{selectedOrder.id.slice(-6)}
									</h4>
									<p className="text-sm text-gray-600 mt-1">
										Placed on {formatDate(selectedOrder.created_at)}
									</p>
									{selectedOrder.vendor_ready_at && (
										<p className="text-sm text-gray-600">
											Ready at {formatDate(selectedOrder.vendor_ready_at)}
										</p>
									)}
									{selectedOrder.delivered_at && (
										<p className="text-sm text-gray-600">
											Delivered at {formatDate(selectedOrder.delivered_at)}
										</p>
									)}
									{selectedOrder.cancelled_at && (
										<p className="text-sm text-gray-600">
											Cancelled at {formatDate(selectedOrder.cancelled_at)}
										</p>
									)}
								</div>

								<div className="flex flex-col items-start md:items-end">
									<p className="text-2xl font-bold text-gray-900">
										${selectedOrder.amount.total.toFixed(2)}
									</p>
									<p className="text-sm text-gray-600">
										{getTotalItemCount(selectedOrder.lineItems)} total items
									</p>
								</div>
							</div>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
							{/* Customer Details */}
							<div className="bg-white rounded-lg border border-gray-200 p-4">
								<h5 className="text-sm font-medium text-gray-500 uppercase mb-3">
									Customer Details
								</h5>

								<div className="space-y-3">
									<div>
										<p className="text-xs text-gray-500">Customer Name</p>
										<p className="font-medium">{selectedOrder.customerName}</p>
									</div>

									<div>
										<p className="text-xs text-gray-500">Delivery Address</p>
										<p className="text-sm">{selectedOrder.customerLocation}</p>
									</div>

									<div>
										<p className="text-xs text-gray-500">Contact</p>
										<p className="font-medium">{selectedOrder.customerPhone}</p>
										<p className="text-sm">{selectedOrder.customerEmail}</p>
									</div>
								</div>
							</div>

							{/* Driver Details (if assigned) */}
							<div className="bg-white rounded-lg border border-gray-200 p-4">
								<h5 className="text-sm font-medium text-gray-500 uppercase mb-3">
									Delivery Details
								</h5>

								{(selectedOrder.status === "driver coming to pickup" ||
									selectedOrder.status === "driver delivering") &&
								selectedOrder.driverID ? (
									<div className="space-y-3">
										<div>
											<p className="text-xs text-gray-500">Driver</p>
											<p className="font-medium">
												{selectedOrder.driverName || "Assigned Driver"}
											</p>
										</div>

										{selectedOrder.driverPhone && (
											<div>
												<p className="text-xs text-gray-500">Contact</p>
												<p className="font-medium">
													{selectedOrder.driverPhone}
												</p>
											</div>
										)}

										<div>
											<p className="text-xs text-gray-500">
												Estimated Delivery Time
											</p>
											<p className="font-medium">
												{selectedOrder.deliveryInfo?.estimatedTime
													? `${Math.round(
															selectedOrder.deliveryInfo.estimatedTime / 60
													  )} hours ${
															selectedOrder.deliveryInfo.estimatedTime % 60
													  } minutes`
													: "Not available"}
											</p>
										</div>
									</div>
								) : (
									<div className="space-y-3">
										<div>
											<p className="text-xs text-gray-500">Distance</p>
											<p className="font-medium">
												{selectedOrder.deliveryInfo?.distanceInKm
													? `${selectedOrder.deliveryInfo.distanceInKm.toFixed(
															1
													  )} km / ${
															selectedOrder.deliveryInfo.distanceInMiles?.toFixed(
																1
															) || "N/A"
													  } miles`
													: "Not available"}
											</p>
										</div>

										<div>
											<p className="text-xs text-gray-500">
												Estimated Delivery Time
											</p>
											<p className="font-medium">
												{selectedOrder.deliveryInfo?.estimatedTime
													? `${Math.round(
															selectedOrder.deliveryInfo.estimatedTime / 60
													  )} hours ${
															selectedOrder.deliveryInfo.estimatedTime % 60
													  } minutes`
													: "Not available"}
											</p>
										</div>

										{selectedOrder.status === "cancelled" && (
											<>
												{selectedOrder.cancelled_reason && (
													<div>
														<p className="text-xs text-gray-500">
															Cancellation Reason
														</p>
														<p className="text-sm text-red-600 font-medium">
															{selectedOrder.cancelled_reason}
														</p>
													</div>
												)}

												{selectedOrder.payment_status && (
													<div className="mt-2">
														<p className="text-xs text-gray-500">
															Payment Status
														</p>
														<p className="text-sm font-medium">
															{selectedOrder.payment_status ===
															"authorization_released" ? (
																<span className="text-green-600">
																	Customer&apos;s payment authorization has been
																	released successfully.
																</span>
															) : (
																<span className="text-yellow-600">
																	Payment status: {selectedOrder.payment_status}
																</span>
															)}
														</p>
													</div>
												)}
											</>
										)}
									</div>
								)}
							</div>
						</div>

						{/* Order Items */}
						<div className="mb-6">
							<h5 className="text-sm font-medium text-gray-700 uppercase mb-3">
								Order Items
							</h5>
							<div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
								<table className="min-w-full divide-y divide-gray-200">
									<thead className="bg-gray-50">
										<tr>
											<th
												scope="col"
												className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
											>
												Item
											</th>
											<th
												scope="col"
												className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase"
											>
												Qty
											</th>
											<th
												scope="col"
												className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase"
											>
												Price
											</th>
											<th
												scope="col"
												className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase"
											>
												Total
											</th>
										</tr>
									</thead>
									<tbody className="bg-white divide-y divide-gray-200">
										{selectedOrder.lineItems &&
										Array.isArray(selectedOrder.lineItems) ? (
											selectedOrder.lineItems.map((item, index) => (
												<tr key={index}>
													<td className="px-4 py-3 whitespace-normal">
														<div>
															<p className="text-sm font-medium text-gray-900">
																{item.name}
															</p>
															{item.barcode && (
																<p className="text-xs text-gray-500">
																	ID: {item.itemID}
																</p>
															)}
														</div>
													</td>
													<td className="px-4 py-3 text-center text-sm">
														{item.quantity}
													</td>
													<td className="px-4 py-3 text-right text-sm">
														${item.price.toFixed(2)}
													</td>
													<td className="px-4 py-3 text-right text-sm font-medium">
														${(item.price * item.quantity).toFixed(2)}
													</td>
												</tr>
											))
										) : (
											<tr>
												<td
													colSpan={4}
													className="px-4 py-3 text-center text-sm text-gray-500"
												>
													No items found
												</td>
											</tr>
										)}
									</tbody>
								</table>
							</div>
						</div>

						{/* Payment Summary */}
						<div className="mb-6">
							<h5 className="text-sm font-medium text-gray-700 uppercase mb-3">
								Payment Summary
							</h5>
							<div className="bg-white rounded-lg border border-gray-200 p-4">
								<div className="space-y-2">
									<div className="flex justify-between text-sm">
										<span className="text-gray-600">Subtotal</span>
										<span>${selectedOrder.amount.subtotal.toFixed(2)}</span>
									</div>
									<div className="flex justify-between text-sm">
										<span className="text-gray-600">Delivery Fee</span>
										<span>${selectedOrder.amount.deliveryFee.toFixed(2)}</span>
									</div>
									<div className="flex justify-between text-sm">
										<span className="text-gray-600">Service Fee</span>
										<span>${selectedOrder.amount.serviceFee.toFixed(2)}</span>
									</div>
									<div className="flex justify-between text-sm">
										<span className="text-gray-600">Tax</span>
										<span>${selectedOrder.amount.tax.toFixed(2)}</span>
									</div>
									{selectedOrder.amount.tip !== undefined && (
										<div className="flex justify-between text-sm">
											<span className="text-gray-600">Tip</span>
											<span>${selectedOrder.amount.tip.toFixed(2)}</span>
										</div>
									)}
									<div className="pt-2 mt-2 border-t border-gray-200">
										<div className="flex justify-between">
											<span className="text-base font-bold">Total</span>
											<span className="text-base font-bold">
												${selectedOrder.amount.total.toFixed(2)}
											</span>
										</div>
										<div className="text-xs text-gray-500 text-right mt-1">
											{selectedOrder.paymentIntentId
												? `Payment ID: ${selectedOrder.paymentIntentId.slice(
														0,
														8
												  )}...`
												: "Pending payment confirmation"}
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* Action Buttons */}
						<div className="flex flex-col sm:flex-row gap-3 mt-6 pt-4 border-t border-gray-200">
							{/* Only show Mark Ready button for orders in preparing status */}
							{selectedOrder.status === "preparing" && (
								<>
									<button
										onClick={() => markReady(selectedOrder.id)}
										disabled={processing === selectedOrder.id}
										className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md transition-colors cursor-pointer disabled:opacity-50"
									>
										{processing === selectedOrder.id ? (
											<span className="flex items-center justify-center">
												<svg
													className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
													xmlns="http://www.w3.org/2000/svg"
													fill="none"
													viewBox="0 0 24 24"
												>
													<circle
														className="opacity-25"
														cx="12"
														cy="12"
														r="10"
														stroke="currentColor"
														strokeWidth="4"
													></circle>
													<path
														className="opacity-75"
														fill="currentColor"
														d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
													></path>
												</svg>
												Processing...
											</span>
										) : (
											"Mark as Ready for Pickup"
										)}
									</button>

									<button
										onClick={openCancelModal}
										className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md transition-colors cursor-pointer"
									>
										Cancel Order
									</button>
								</>
							)}

							<button
								onClick={() => setIsModalOpen(false)}
								className="flex-1 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-md transition-colors cursor-pointer"
							>
								Close Details
							</button>
						</div>
					</div>
				</div>
			</div>
		);
	};

	// Cancel Confirmation Modal
	const CancelConfirmationModal = () => {
		if (!isCancelModalOpen || !selectedOrder) return null;

		return (
			<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
				<div className="bg-white rounded-lg shadow-lg max-w-md w-full">
					<div className="px-6 py-4 border-b border-gray-200">
						<h3 className="text-lg font-bold text-gray-900">Cancel Order</h3>
					</div>

					<div className="p-6">
						<p className="text-gray-700 mb-4">
							Are you sure you want to cancel order{" "}
							<span className="font-bold">#{selectedOrder.id.slice(-6)}</span>?
							This action cannot be undone.
						</p>

						<p className="text-gray-600 mt-2 mb-4">
							When you cancel this order, the customer&apos;s payment
							authorization will be released immediately. No charge will appear
							on their statement.
						</p>

						<div className="mb-4">
							<label className="block text-gray-700 text-sm font-medium mb-2">
								Reason for cancellation (optional)
							</label>
							<textarea
								className="border border-gray-300 rounded-md p-2 w-full focus:ring-blue-500 focus:border-blue-500"
								rows={3}
								value={cancelReason}
								onChange={(e) => setCancelReason(e.target.value)}
								placeholder="Enter reason for cancellation..."
							></textarea>
						</div>

						<div className="flex flex-col sm:flex-row gap-3 mt-6">
							<button
								onClick={cancelOrder}
								disabled={processing === selectedOrder.id}
								className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md transition-colors cursor-pointer disabled:opacity-50"
							>
								{processing === selectedOrder.id ? (
									<span className="flex items-center justify-center">
										<svg
											className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
										>
											<circle
												className="opacity-25"
												cx="12"
												cy="12"
												r="10"
												stroke="currentColor"
												strokeWidth="4"
											></circle>
											<path
												className="opacity-75"
												fill="currentColor"
												d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
											></path>
										</svg>
										Processing...
									</span>
								) : (
									"Confirm Cancellation"
								)}
							</button>

							<button
								onClick={() => setIsCancelModalOpen(false)}
								className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-md transition-colors cursor-pointer"
							>
								Cancel
							</button>
						</div>
					</div>
				</div>
			</div>
		);
	};

	// Loading state
	if (initializing) {
		return (
			<div className="min-h-screen bg-gray-50 flex justify-center items-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-puce mx-auto"></div>
					<p className="mt-4 text-gray-600">Loading orders...</p>
				</div>
			</div>
		);
	}

	// Not authenticated
	if (!user) {
		return (
			<div className="min-h-screen bg-gray-50 flex justify-center items-center">
				<div className="text-center p-8 bg-white rounded-lg shadow-md">
					<p className="mb-4">
						Please sign in as a vendor to view your orders.
					</p>
					<button
						onClick={() => router.push("/vendor/auth/signin")}
						className="px-4 py-2 bg-puce hover:bg-rose text-white rounded-md shadow-sm cursor-pointer"
					>
						Sign In
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<header>
				<VendorNavBar vendorData={vendorData} />
			</header>

			<main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
				<div className="bg-white shadow-md rounded-lg overflow-hidden">
					<div className="px-6 py-4 bg-puce text-white">
						<h1 className="text-xl font-bold">Order Management</h1>
					</div>

					<div className="p-6">
						{indexError && (
							<div className="bg-yellow-100 text-yellow-800 p-4 rounded mb-6">
								<h3 className="font-medium mb-1">Firestore Index Required</h3>
								<p className="text-sm mb-2">
									This page requires a Firestore index to function properly. The
									page will still work, but some functionality might be limited.
								</p>
								{indexUrl && (
									<p className="text-sm">
										<a
											href={indexUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="text-blue-600 hover:text-blue-800 underline"
										>
											Click here to create the required index
										</a>
									</p>
								)}
							</div>
						)}

						{error && (
							<div className="bg-red-100 text-red-700 p-4 rounded mb-6">
								{error}
							</div>
						)}

						{successMessage && (
							<div className="bg-green-100 text-green-700 p-4 rounded mb-6">
								{successMessage}
							</div>
						)}

						{/* Tab Navigation */}
						<div className="border-b border-gray-200 mb-6">
							<nav className="flex -mb-px">
								<button
									className={`mr-8 py-4 px-1 cursor-pointer border-b-2 font-medium text-sm ${
										activeTab === "incoming"
											? "border-puce text-puce"
											: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
									}`}
									onClick={() => setActiveTab("incoming")}
								>
									Incoming Orders
									{activeOrders.length > 0 && (
										<span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-puce rounded-full">
											{activeOrders.length}
										</span>
									)}
								</button>
								<button
									className={`mr-8 py-4 px-1 border-b-2 font-medium cursor-pointer text-sm ${
										activeTab === "history"
											? "border-puce text-puce"
											: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
									}`}
									onClick={() => handleTabChange("history")}
								>
									Order History
								</button>
							</nav>
						</div>

						{/* Dashboard Stats */}
						<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
							<div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
								<div className="flex justify-between items-center">
									<h3 className="text-sm font-medium text-gray-500">
										Active Orders
									</h3>
									<span className="text-puce">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											className="h-5 w-5"
											viewBox="0 0 20 20"
											fill="currentColor"
										>
											<path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
										</svg>
									</span>
								</div>
								<p className="text-2xl font-bold mt-2">{activeOrders.length}</p>
								<p className="text-sm text-gray-500 mt-1">
									Orders being prepared
								</p>
							</div>

							<div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
								<div className="flex justify-between items-center">
									<h3 className="text-sm font-medium text-gray-500">
										Awaiting Pickup
									</h3>
									<span className="text-blue-500">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											className="h-5 w-5"
											viewBox="0 0 20 20"
											fill="currentColor"
										>
											<path
												fillRule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
												clipRule="evenodd"
											/>
										</svg>
									</span>
								</div>
								<p className="text-2xl font-bold mt-2">{awaitingDriverCount}</p>
								<p className="text-sm text-gray-500 mt-1">
									Awaiting driver assignment
								</p>
							</div>

							<div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
								<div className="flex justify-between items-center">
									<h3 className="text-sm font-medium text-gray-500">
										In Delivery
									</h3>
									<span className="text-indigo-500">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											className="h-5 w-5"
											viewBox="0 0 20 20"
											fill="currentColor"
										>
											<path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
											<path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1v-1h6.5a1 1 0 00.8-.4l3-4a1 1 0 00.2-.6V8a1 1 0 00-1-1h-3.8L11.35 3.4A1 1 0 0010.5 3H4a1 1 0 00-1 1z" />
										</svg>
									</span>
								</div>
								<p className="text-2xl font-bold mt-2">{inDeliveryCount}</p>
								<p className="text-sm text-gray-500 mt-1">Orders in transit</p>
							</div>

							<div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
								<div className="flex justify-between items-center">
									<h3 className="text-sm font-medium text-gray-500">
										Avg. Prep Time
									</h3>
									<span className="text-green-500">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											className="h-5 w-5"
											viewBox="0 0 20 20"
											fill="currentColor"
										>
											<path
												fillRule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
												clipRule="evenodd"
											/>
										</svg>
									</span>
								</div>
								<p className="text-2xl font-bold mt-2">
									{getAveragePreparationTime()}
								</p>
								<p className="text-sm text-gray-500 mt-1">Preparation time</p>
							</div>
						</div>

						{/* Main Content - Active Orders Tab */}
						{activeTab === "incoming" && (
							<div>
								<div className="flex justify-between items-center mb-4">
									<h2 className="text-lg font-medium text-gray-800">
										Orders To Prepare
									</h2>
									{activeOrders.length > 0 && (
										<span className="px-3 py-1 bg-puce text-white rounded-full text-sm">
											{activeOrders.length} active
										</span>
									)}
								</div>

								{loading ? (
									<div className="text-center py-8">
										<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-puce mx-auto"></div>
										<p className="mt-2 text-gray-500">Loading orders...</p>
									</div>
								) : activeOrders.length === 0 ? (
									<div className="bg-gray-50 p-8 rounded-lg text-center">
										<svg
											className="mx-auto h-12 w-12 text-gray-400"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
											xmlns="http://www.w3.org/2000/svg"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
											/>
										</svg>
										<p className="mt-2 text-gray-500">
											No orders currently needing preparation.
										</p>
									</div>
								) : (
									<div className="space-y-4">
										{activeOrders.map((order) => (
											<div
												key={order.id}
												className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition duration-150 cursor-pointer"
												onClick={() => openOrderDetails(order)}
											>
												<div className="bg-gray-50 px-4 py-2 flex justify-between items-center">
													<div>
														<span className="font-medium">
															Order #{order.id.slice(-6)}
														</span>
														<span className="ml-2 text-sm text-gray-500">
															{getOrderTime(order.created_at)}
														</span>
													</div>
													<span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
														Preparing
													</span>
												</div>

												<div className="p-4">
													<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
														{/* Customer Info */}
														<div>
															<h3 className="font-medium text-gray-900 mb-1">
																Customer
															</h3>
															<p className="text-sm text-gray-600">
																{order.customerName}
															</p>
															<p className="text-sm text-gray-600">
																{order.customerPhone}
															</p>
														</div>

														{/* Order Items */}
														<div>
															<h3 className="font-medium text-gray-900 mb-1">
																Items ({getTotalItemCount(order.lineItems)})
															</h3>
															<ul className="text-sm text-gray-600 max-h-20 overflow-hidden">
																{order.lineItems &&
																	order.lineItems
																		.slice(0, 3)
																		.map((item, idx) => (
																			<li key={idx}>
																				{item.quantity} × {item.name}
																			</li>
																		))}
																{order.lineItems &&
																	order.lineItems.length > 3 && (
																		<li className="text-blue-600">
																			+ {order.lineItems.length - 3} more
																			items...
																		</li>
																	)}
															</ul>
														</div>

														{/* Order Total */}
														<div>
															<h3 className="font-medium text-gray-900 mb-1">
																Order Summary
															</h3>
															<div className="text-sm text-gray-600">
																<p>
																	Subtotal: ${order.amount.subtotal.toFixed(2)}
																</p>
																<p className="font-medium text-gray-900 mt-1">
																	Total: ${order.amount.total.toFixed(2)}
																</p>
															</div>
														</div>
													</div>

													<div className="flex justify-end">
														<button
															className="px-4 py-2 mr-2 cursor-pointer border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
															onClick={(e) => {
																e.stopPropagation();
																openOrderDetails(order);
															}}
														>
															View Details
														</button>
														<button
															className="px-4 py-2 mr-2 cursor-pointer bg-red-600 hover:bg-red-700 text-white rounded-md shadow-sm"
															onClick={(e) => {
																e.stopPropagation();
																setSelectedOrder(order);
																openCancelModal();
															}}
															disabled={processing === order.id}
														>
															Cancel
														</button>
														<button
															className="px-4 py-2 cursor-pointer bg-puce hover:bg-rose text-white rounded-md shadow-sm disabled:opacity-50"
															disabled={processing === order.id}
															onClick={(e) => {
																e.stopPropagation();
																markReady(order.id);
															}}
														>
															{processing === order.id ? (
																<span className="flex items-center">
																	<svg
																		className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
																		xmlns="http://www.w3.org/2000/svg"
																		fill="none"
																		viewBox="0 0 24 24"
																	>
																		<circle
																			className="opacity-25"
																			cx="12"
																			cy="12"
																			r="10"
																			stroke="currentColor"
																			strokeWidth="4"
																		></circle>
																		<path
																			className="opacity-75"
																			fill="currentColor"
																			d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
																		></path>
																	</svg>
																	Processing...
																</span>
															) : (
																"Mark Ready"
															)}
														</button>
													</div>
												</div>
											</div>
										))}
									</div>
								)}
							</div>
						)}

						{/* Order History Tab */}
						{activeTab === "history" && (
							<div>
								<div className="flex justify-between items-center mb-4">
									<h2 className="text-lg font-medium text-gray-800 mb-4">
										Order History
										<button
											onClick={fetchPastOrders}
											className="ml-2 p-1 rounded-full hover:bg-gray-200 focus:outline-none"
											title="Refresh order history"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												className="h-5 w-5 text-gray-500"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
												/>
											</svg>
										</button>
									</h2>

									{!historyLoading && pastOrders.length > 0 && (
										<div className="flex space-x-2">
											<span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
												{completedOrdersCount} Completed
											</span>
											<span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">
												{cancelledOrdersCount} Cancelled
											</span>
										</div>
									)}
								</div>

								{historyLoading ? (
									<div className="text-center py-8">
										<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-puce mx-auto"></div>
										<p className="mt-2 text-gray-500">
											Loading order history...
										</p>
									</div>
								) : pastOrders.length === 0 ? (
									<div className="bg-gray-50 p-8 rounded-lg text-center">
										<svg
											className="mx-auto h-12 w-12 text-gray-400"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
											xmlns="http://www.w3.org/2000/svg"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
											/>
										</svg>
										<p className="mt-2 text-gray-500">
											No order history available yet.
										</p>
									</div>
								) : (
									<div className="space-y-4">
										{pastOrders.map((order) => (
											<div
												key={order.id}
												className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition duration-150 cursor-pointer"
												onClick={() => openOrderDetails(order)}
											>
												<div className="bg-gray-50 px-4 py-2 flex justify-between items-center">
													<div>
														<span className="font-medium">
															Order #{order.id.slice(-6)}
														</span>
														<span className="ml-2 text-sm text-gray-500">
															{formatDate(order.created_at)}
														</span>
													</div>
													<span
														className={`px-3 py-1 rounded-full text-sm ${getStatusColor(
															order.status
														)}`}
													>
														{getReadableStatus(order.status)}
													</span>
												</div>

												<div className="p-4">
													<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
														{/* Customer Info */}
														<div>
															<h3 className="font-medium text-gray-900 mb-1">
																Customer
															</h3>
															<p className="text-sm text-gray-600">
																{order.customerName}
															</p>
															<p className="text-sm text-gray-600">
																{order.customerPhone}
															</p>
														</div>

														{/* Order Info */}
														<div>
															<h3 className="font-medium text-gray-900 mb-1">
																Order Details
															</h3>
															<p className="text-sm text-gray-600">
																Items: {getTotalItemCount(order.lineItems)}
															</p>
															<p className="text-sm text-gray-600">
																Prep Time: {getPreparationTime(order)}
															</p>
															{order.cancelled_reason && (
																<p className="text-sm text-red-600">
																	Reason: {order.cancelled_reason}
																</p>
															)}
														</div>

														{/* Order Total */}
														<div>
															<h3 className="font-medium text-gray-900 mb-1">
																Payment
															</h3>
															<p className="text-sm text-gray-600">
																Subtotal: ${order.amount.subtotal.toFixed(2)}
															</p>
															<p className="font-medium text-gray-900">
																Total: ${order.amount.total.toFixed(2)}
															</p>
														</div>
													</div>
												</div>
											</div>
										))}
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			</main>

			<Footer />

			{/* Render modals */}
			{isModalOpen && <OrderDetailsModal />}
			{isCancelModalOpen && <CancelConfirmationModal />}
		</div>
	);
}
