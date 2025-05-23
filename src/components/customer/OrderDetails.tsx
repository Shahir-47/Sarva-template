// src/components/customer/OrderDetails.tsx
import React, { useState, useEffect } from "react";
import DeliveryRouteMap from "../shared/DeliveryRouteMap";

// Define order status and interfaces
export enum OrderStatus {
	PENDING = "pending_payment",
	PREPARING = "preparing",
	AWAITING_DRIVER = "waiting for a driver to be assigned",
	PICKING_UP = "driver coming to pickup",
	DELIVERING = "driver delivering",
	DELIVERED = "delivered",
	CANCELLED = "cancelled",
}

interface OrderItem {
	itemID: string;
	name: string;
	quantity: number;
	price: number;
	barcode?: string;
}

interface OrderAmounts {
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
	customerCoordinates?: {
		latitude: number;
		longitude: number;
	};
	vendorID: string;
	vendorName?: string;
	vendorLocation?: string;
	vendorCoordinates?: {
		latitude: number;
		longitude: number;
	};
	vendorEmail?: string;
	vendorPhone?: string;
	lineItems: OrderItem[];
	status: OrderStatus | string;
	amount: OrderAmounts;
	created_at: { seconds: number; nanoseconds: number };
	updated_at?: Date | null;
	estimated_delivery?: Date | null;
	driverID?: string | null;
	driverName?: string;
	driverPhone?: string;
	paymentIntentId?: string;
	special_instructions?: string;
	deliveryInfo?: {
		distance: number;
		distanceInKm: number;
		distanceInMiles?: number;
		estimatedTime: number;
	};
}

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
const formatDate = (
	timestamp: { seconds: number; nanoseconds: number } | null | undefined
) => {
	if (!timestamp) return "N/A";

	try {
		const date = new Date(timestamp.seconds * 1000);
		return date.toLocaleString("en-US", {
			weekday: "short",
			day: "numeric",
			month: "short",
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
		pending_payment: 10,
		preparing: 30,
		"waiting for a driver to be assigned": 50,
		"driver coming to pickup": 65,
		"driver delivering": 80,
		delivered: 100,
		cancelled: 0,
	};

	return percentages[status] || 0;
};

// Helper function to format phone number
const formatPhone = (phone: string | undefined) => {
	if (!phone) return "";

	// Check if it's already formatted
	if (phone.includes("-") || phone.includes("(")) return phone;

	// Format: (XXX) XXX-XXXX
	if (phone.length === 10) {
		return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
	}

	// Format with country code: +1 (XXX) XXX-XXXX
	if (phone.length === 11 && phone.startsWith("1")) {
		return `+1 (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7)}`;
	}

	// If it starts with + assume it's already in international format
	if (phone.startsWith("+")) return phone;

	return phone;
};

// Helper function to format distance
const formatDistance = (distanceInKm: number | undefined): string => {
	if (distanceInKm === undefined || distanceInKm === null) return "N/A";
	return `${distanceInKm.toFixed(1)} km`;
};

// Helper function to format time in minutes
const formatMinutes = (minutes: number | undefined): string => {
	if (minutes === undefined || minutes === null) return "N/A";
	if (minutes < 60) return `${minutes} min`;

	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return `${hours}h ${remainingMinutes}m`;
};

interface OrderDetailsProps {
	order: Order;
	onClose: () => void;
	onRefresh?: () => void;
}

const OrderDetails: React.FC<OrderDetailsProps> = ({
	order,
	onClose,
	onRefresh,
}) => {
	const [liveOrder, setLiveOrder] = useState<Order>(order);
	const [isLoading, setIsLoading] = useState(false);

	// This would be replaced with a real-time subscription in production
	useEffect(() => {
		// Simulate real-time updates for demo purposes
		const interval = setInterval(() => {
			// In a real app, this would be a subscription to Firestore or other real-time DB
			// Here we just update the current order data with any changes from props
			setLiveOrder(order);
		}, 5000);

		return () => clearInterval(interval);
	}, [order]);

	const handleRefresh = () => {
		setIsLoading(true);

		// Simulate refresh
		setTimeout(() => {
			if (onRefresh) {
				onRefresh();
			}
			setIsLoading(false);
		}, 1000);
	};

	const handleContactSupport = () => {
		// Implement support contact functionality
		window.location.href = `mailto:customercontact@sarvabazaar.com?subject=Support Request for Order ${liveOrder.id}&body=Hello, I need assistance with my order (ID: ${liveOrder.id}). Please provide support.`;
	};

	const handleContactVendor = () => {
		// Implement vendor contact functionality
		if (liveOrder.vendorPhone) {
			window.location.href = `tel:${liveOrder.vendorPhone}`;
		} else if (liveOrder.vendorEmail) {
			window.location.href = `mailto:${liveOrder.vendorEmail}?subject=Question about Order ${liveOrder.id}`;
		}
	};

	const handleContactDriver = () => {
		// Implement driver contact functionality
		if (liveOrder.driverPhone) {
			window.location.href = `tel:${liveOrder.driverPhone}`;
		}
	};

	const statusPercentage = getStatusPercentage(liveOrder.status);
	const isActiveOrder =
		liveOrder.status !== OrderStatus.DELIVERED &&
		liveOrder.status !== OrderStatus.CANCELLED;

	// Check if we have coordinates to display the map
	const hasCoordinates =
		liveOrder.vendorCoordinates &&
		liveOrder.customerCoordinates &&
		(liveOrder.status === OrderStatus.PICKING_UP ||
			liveOrder.status === OrderStatus.DELIVERING ||
			liveOrder.status === OrderStatus.DELIVERED);

	// Only show map for orders that are being picked up, delivering, or delivered
	const showMap = hasCoordinates;

	return (
		<div className="fixed inset-0 bg-opacity-75 backdrop-blur-lg z-50 flex items-center justify-center overflow-y-auto">
			<div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-xl border border-gray-200">
				{/* Header */}
				<div className="px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10 flex justify-between items-center">
					<div className="flex items-center">
						<h3 className="text-xl font-bold text-gray-900">Order Details</h3>
						<span
							className={`ml-3 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
								liveOrder.status
							)}`}
						>
							{getReadableStatus(liveOrder.status)}
						</span>
					</div>
					<div className="flex items-center space-x-2">
						<button
							onClick={handleRefresh}
							className="p-2 cursor-pointer text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100"
							disabled={isLoading}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`}
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
						<button
							onClick={onClose}
							className="p-2 cursor-pointer text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="h-5 w-5"
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
				</div>

				<div className="p-6">
					{/* Delivery Route Map - Only show for active delivery */}
					{showMap && (
						<div className="mb-6">
							<h5 className="text-base font-medium text-gray-900 mb-3">
								Delivery Route
							</h5>
							<div className="rounded-lg overflow-hidden border border-gray-200">
								<DeliveryRouteMap
									sourceAddress={liveOrder.vendorLocation || ""}
									sourceCoordinates={liveOrder.vendorCoordinates}
									destinationAddress={liveOrder.customerLocation || ""}
									destinationCoordinates={liveOrder.customerCoordinates}
									className="w-full rounded-lg"
								/>
							</div>
							{liveOrder.deliveryInfo && (
								<div className="flex justify-between mt-2 text-sm text-gray-600">
									<div>
										<span className="font-medium">Distance:</span>{" "}
										{liveOrder.deliveryInfo.distanceInMiles
											? `${liveOrder.deliveryInfo.distanceInMiles.toFixed(
													1
											  )} miles`
											: formatDistance(liveOrder.deliveryInfo.distanceInKm)}
									</div>
									<div>
										<span className="font-medium">Est. Time:</span>{" "}
										{formatMinutes(liveOrder.deliveryInfo.estimatedTime)}
									</div>
								</div>
							)}
						</div>
					)}

					{/* Order Header Info */}
					<div className="bg-gray-50 rounded-lg p-4 mb-6">
						<div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
							<div>
								<h4 className="text-lg font-semibold text-gray-900">
									{liveOrder.vendorName}
								</h4>
								<p className="text-sm text-gray-500">Order #{liveOrder.id}</p>
								<p className="text-sm text-gray-500 mt-1">
									Placed on {formatDate(liveOrder.created_at)}
								</p>
							</div>

							<div className="flex flex-col items-start md:items-end">
								<p className="text-2xl font-bold text-gray-900">
									${liveOrder.amount.total.toFixed(2)}
								</p>
								<p className="text-sm text-gray-500">
									{liveOrder.lineItems.reduce(
										(total, item) => total + item.quantity,
										0
									)}{" "}
									items
								</p>
							</div>
						</div>

						{/* Order Progress */}
						{isActiveOrder && (
							<div className="mt-4">
								<div className="flex justify-between text-xs text-gray-500 mb-1">
									<span>Ordered</span>
									<span>Preparing</span>
									<span>On the way</span>
									<span>Delivered</span>
								</div>
								<div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
									<div
										className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-in-out"
										style={{ width: `${statusPercentage}%` }}
									></div>
								</div>
								<p className="text-sm font-medium text-gray-700 mt-2">
									{liveOrder.status === OrderStatus.PENDING &&
										"Waiting for payment confirmation..."}
									{liveOrder.status === OrderStatus.PREPARING &&
										"The vendor is preparing your order..."}
									{liveOrder.status === OrderStatus.AWAITING_DRIVER &&
										"Looking for a driver to pick up your order..."}
									{liveOrder.status === OrderStatus.PICKING_UP &&
										"Driver is headed to pick up your order..."}
									{liveOrder.status === OrderStatus.DELIVERING &&
										"Your order is on the way to you!"}
								</p>
							</div>
						)}
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
						{/* Delivery Details */}
						<div className="bg-white rounded-lg border border-gray-200 p-4">
							<h5 className="text-sm font-medium text-gray-500 uppercase mb-3">
								Delivery Details
							</h5>

							<div className="space-y-3">
								<div>
									<p className="text-xs text-gray-500">Delivering To</p>
									<p className="font-medium">{liveOrder.customerName}</p>
									<p className="text-sm">{liveOrder.customerLocation}</p>
								</div>

								<div>
									<p className="text-xs text-gray-500">Contact</p>
									<p className="font-medium">
										{formatPhone(liveOrder.customerPhone)}
									</p>
									<p className="text-sm">{liveOrder.customerEmail}</p>
								</div>
							</div>
						</div>

						{/* Vendor Details */}
						<div className="bg-white rounded-lg border border-gray-200 p-4">
							<h5 className="text-sm font-medium text-gray-500 uppercase mb-3">
								Vendor Details
							</h5>

							<div className="space-y-3">
								<div>
									<p className="text-xs text-gray-500">Vendor</p>
									<p className="font-medium">{liveOrder.vendorName}</p>
									<p className="text-sm">{liveOrder.vendorLocation}</p>
								</div>

								<div>
									<p className="text-xs text-gray-500">Contact</p>
									<p className="font-medium">
										{formatPhone(liveOrder.vendorPhone)}
									</p>
									<p className="text-sm">{liveOrder.vendorEmail}</p>
								</div>

								{isActiveOrder && (
									<button
										onClick={handleContactVendor}
										className="mt-2 cursor-pointer inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											className="h-4 w-4 mr-1.5"
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
										Contact Vendor
									</button>
								)}
							</div>
						</div>

						{/* Driver Details - Only show if driver is assigned */}
						{(liveOrder.status === OrderStatus.PICKING_UP ||
							liveOrder.status === OrderStatus.DELIVERING) &&
							liveOrder.driverID && (
								<div className="md:col-span-2 bg-blue-50 rounded-lg border border-blue-200 p-4">
									<h5 className="text-sm font-medium text-blue-800 uppercase mb-3">
										Driver Information
									</h5>

									<div className="flex flex-col md:flex-row md:items-center md:justify-between">
										<div>
											<p className="font-medium text-blue-900">
												{liveOrder.driverName || "Driver"}
											</p>
											{liveOrder.driverPhone && (
												<p className="text-sm text-blue-800">
													{formatPhone(liveOrder.driverPhone)}
												</p>
											)}
										</div>

										{liveOrder.driverPhone && (
											<button
												onClick={handleContactDriver}
												className="mt-3 cursor-pointer md:mt-0 inline-flex items-center px-4 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100"
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													className="h-4 w-4 mr-2"
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
												Call Driver
											</button>
										)}
									</div>
								</div>
							)}
					</div>

					{/* Order Items */}
					<div className="mb-6">
						<h5 className="text-base font-medium text-gray-900 mb-3">
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
									{liveOrder.lineItems.map((item, index) => (
										<tr key={index} className="hover:bg-gray-50">
											<td className="px-4 py-3 whitespace-normal">
												<div>
													<p className="text-sm font-medium text-gray-900">
														{item.name}
													</p>
													{item.barcode && (
														<p className="text-xs text-gray-500">
															SKU: {item.barcode}
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
									))}
								</tbody>
							</table>
						</div>
					</div>

					{/* Payment Summary */}
					<div className="mb-6">
						<h5 className="text-base font-medium text-gray-900 mb-3">
							Payment Summary
						</h5>
						<div className="bg-white rounded-lg border border-gray-200 p-4">
							<div className="space-y-2">
								<div className="flex justify-between text-sm">
									<span className="text-gray-600">Subtotal</span>
									<span>${liveOrder.amount.subtotal.toFixed(2)}</span>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-gray-600">Delivery Fee</span>
									<span>${liveOrder.amount.deliveryFee.toFixed(2)}</span>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-gray-600">Service Fee</span>
									<span>${liveOrder.amount.serviceFee.toFixed(2)}</span>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-gray-600">Tax</span>
									<span>${liveOrder.amount.tax.toFixed(2)}</span>
								</div>
								{liveOrder.amount.tip !== undefined &&
									liveOrder.amount.tip > 0 && (
										<div className="flex justify-between text-sm">
											<span className="text-gray-600">Tip</span>
											<span>${liveOrder.amount.tip.toFixed(2)}</span>
										</div>
									)}
								<div className="pt-2 mt-2 border-t border-gray-200">
									<div className="flex justify-between">
										<span className="text-base font-bold">Total</span>
										<span className="text-base font-bold">
											${liveOrder.amount.total.toFixed(2)}
										</span>
									</div>
									<div className="text-xs text-gray-500 text-right mt-1">
										{liveOrder.paymentIntentId
											? `Payment ID: ${liveOrder.paymentIntentId.slice(
													0,
													8
											  )}...`
											: "Pending payment confirmation"}
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* Special Instructions */}
					{liveOrder.special_instructions && (
						<div className="mb-6">
							<h5 className="text-base font-medium text-gray-900 mb-3">
								Special Instructions
							</h5>
							<div className="bg-white rounded-lg border border-gray-200 p-4">
								<p className="text-sm text-gray-700">
									{liveOrder.special_instructions}
								</p>
							</div>
						</div>
					)}

					{/* Cancellation Details - Only show if order is cancelled */}
					{liveOrder.status === OrderStatus.CANCELLED && (
						<div className="mb-6">
							<h5 className="text-base font-medium text-red-600 mb-3">
								Cancellation Details
							</h5>
							<div className="bg-red-50 rounded-lg border border-red-200 p-4">
								<div className="space-y-3">
									{liveOrder.cancelled_reason && (
										<div>
											<p className="text-xs text-red-700">Reason</p>
											<p className="text-sm font-medium text-red-800">
												{liveOrder.cancelled_reason}
											</p>
										</div>
									)}

									{liveOrder.cancelled_at && (
										<div>
											<p className="text-xs text-red-700">Cancelled On</p>
											<p className="text-sm font-medium">
												{formatDate(liveOrder.cancelled_at)}
											</p>
										</div>
									)}

									{liveOrder.payment_status && (
										<div>
											<p className="text-xs text-red-700">Payment Status</p>
											<p className="text-sm font-medium">
												{typeof liveOrder.payment_status === "string" &&
												liveOrder.payment_status ===
													"authorization_released" ? (
													<span className="text-green-700">
														Payment authorization has been released. No charge
														will appear on your statement.
													</span>
												) : (
													<span className="text-yellow-700">
														Payment status: {liveOrder.payment_status}
													</span>
												)}
											</p>
										</div>
									)}
								</div>
							</div>
						</div>
					)}

					{/* Action Buttons */}
					<div className="mt-6 flex flex-col sm:flex-row gap-3">
						{isActiveOrder && (
							<button
								onClick={handleContactSupport}
								className="flex-1 cursor-pointer inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="h-5 w-5 mr-2 text-gray-500"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
									/>
								</svg>
								Get Help
							</button>
						)}

						<button
							onClick={onClose}
							className="flex-1 cursor-pointer inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
						>
							Close Details
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default OrderDetails;
