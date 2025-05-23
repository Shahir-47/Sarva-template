// src/components/driver/DeliveryDetailsModal.tsx
import React, { useState, useEffect } from "react";
import {
	doc,
	getDoc,
	collection,
	query,
	where,
	getDocs,
	Timestamp,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import emailjs from "@emailjs/browser";
import DeliveryRouteMap from "../shared/DeliveryRouteMap";

// Define interfaces for our data structures
interface LineItem {
	barcode?: string;
	itemID: string;
	name: string;
	price: number;
	quantity: number;
}

interface DeliveryInfo {
	distance: number;
	distanceInKm: number;
	distanceInMiles?: number;
	estimatedTime: number;
}

interface DriverEarnings {
	deliveryFee: number;
	tip: number;
	total: number;
}

interface LocationData {
	address: string;
	coordinates?: {
		latitude: number;
		longitude: number;
	};
}

interface OrderDetails {
	items: LineItem[];
	subtotal: number;
	total: number;
}

interface RecentDelivery {
	orderId: string;
	timestamp: Timestamp;
	vendorName: string;
	customerName: string;
	amount: number;
	earned: number;
	distance: number;
}

interface DriverTransaction {
	id: string;
	orderId: string;
	driverId: string;

	vendorId: string;
	vendorName: string;
	vendorEmail: string;
	vendorPhone: string;

	customerId: string;
	customerName: string;
	customerEmail: string;
	customerPhone: string;

	acceptTimestamp: Timestamp;
	pickupTimestamp: Timestamp | null;
	deliverTimestamp: Timestamp;
	completionTimestamp: Timestamp;

	status: string;

	storeLocation: LocationData;
	customerLocation: LocationData;

	deliveryInfo: DeliveryInfo;

	earned: DriverEarnings;
	orderDetails: OrderDetails;

	paymentIntentId: string;

	// Performance metrics
	pickupDuration?: number;
	deliveryDuration?: number;
	totalDuration?: number;
	pickupEfficiency?: number | null;
	deliveryEfficiency?: number | null;
	overallEfficiency?: number | null;
}

// Props interface for the DeliveryDetailsModal component
interface DeliveryDetailsModalProps {
	isOpen: boolean;
	onClose: () => void;
	deliveryId: string;
}

// Helper functions
const formatTimestamp = (timestamp: Timestamp): string => {
	if (!timestamp) return "N/A";

	try {
		const date = new Date(timestamp.seconds * 1000);
		return date.toLocaleString("en-US", {
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

const formatMinutes = (minutes: number | undefined): string => {
	if (minutes === undefined || minutes === null) return "N/A";
	if (minutes < 60) return `${minutes} min`;

	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return `${hours}h ${remainingMinutes}m`;
};

const formatDistance = (distanceInKm: number | undefined): string => {
	if (distanceInKm === undefined || distanceInKm === null) return "N/A";
	return `${distanceInKm.toFixed(1)} km`;
};

const formatCurrency = (amount: number | undefined): string => {
	if (amount === undefined || amount === null) return "$0.00";
	return `$${amount.toFixed(2)}`;
};

const formatAddress = (address: string | undefined): string => {
	if (!address) return "N/A";
	return address.length > 35 ? address.substring(0, 35) + "..." : address;
};

const DeliveryDetailsModal: React.FC<DeliveryDetailsModalProps> = ({
	isOpen,
	onClose,
	deliveryId,
}) => {
	const [delivery, setDelivery] = useState<DriverTransaction | null>(null);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);

	// State for the feedback form
	const [rating, setRating] = useState<number>(0);
	const [hoverRating, setHoverRating] = useState<number>(0);
	const [comment, setComment] = useState<string>("");
	const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
	const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
	const [feedbackError, setFeedbackError] = useState<string>("");

	// Fetch delivery details when modal opens
	useEffect(() => {
		if (!isOpen || !deliveryId) return;

		const fetchDeliveryDetails = async () => {
			setLoading(true);
			setError(null);

			try {
				// First, try to find data in driverTransactions collection by orderId
				const driverTransactionQuery = query(
					collection(db, "driverTransactions"),
					where("orderId", "==", deliveryId)
				);

				const transactionSnapshot = await getDocs(driverTransactionQuery);

				if (!transactionSnapshot.empty) {
					// Use the first matching transaction
					const transactionDoc = transactionSnapshot.docs[0];
					setDelivery({
						id: transactionDoc.id,
						...transactionDoc.data(),
					} as DriverTransaction);
					setLoading(false);
					return;
				}

				// If not found in driverTransactions, check orders collection
				const orderRef = doc(db, "orders", deliveryId);
				const orderSnap = await getDoc(orderRef);

				if (orderSnap.exists()) {
					// Convert order data to DriverTransaction format
					const orderData = orderSnap.data();

					// Create a simplified DriverTransaction object from order data
					const simplifiedTransaction: DriverTransaction = {
						id: orderSnap.id,
						orderId: orderSnap.id,
						driverId: orderData.driverID || "",
						vendorId: orderData.vendorID || "",
						vendorName: orderData.vendorName || "",
						vendorEmail: orderData.vendorEmail || "",
						vendorPhone: orderData.vendorPhone || "",
						customerId: orderData.customerID || "",
						customerName: orderData.customerName || "",
						customerEmail: orderData.customerEmail || "",
						customerPhone: orderData.customerPhone || "",
						acceptTimestamp: orderData.driver_assigned_at || null,
						pickupTimestamp: orderData.picked_up_at || null,
						deliverTimestamp: orderData.delivered_at || null,
						completionTimestamp: orderData.delivered_at || null,
						status: orderData.status || "",
						storeLocation: {
							address: orderData.vendorLocation || "",
							coordinates: orderData.vendorCoordinates
								? {
										latitude: Number(orderData.vendorCoordinates.latitude),
										longitude: Number(orderData.vendorCoordinates.longitude),
								  }
								: undefined,
						},
						customerLocation: {
							address: orderData.customerLocation || "",
							coordinates: orderData.customerCoordinates
								? {
										latitude: Number(orderData.customerCoordinates.latitude),
										longitude: Number(orderData.customerCoordinates.longitude),
								  }
								: undefined,
						},
						deliveryInfo: orderData.deliveryInfo || {
							distance: 0,
							distanceInKm: 0,
							estimatedTime: 0,
						},
						earned: {
							deliveryFee: orderData.amount?.deliveryFee || 0,
							tip: orderData.amount?.tip || 0,
							total:
								(orderData.amount?.deliveryFee || 0) +
								(orderData.amount?.tip || 0),
						},
						orderDetails: {
							items: orderData.lineItems || [],
							subtotal: orderData.amount?.subtotal || 0,
							total: orderData.amount?.total || 0,
						},
						paymentIntentId: orderData.paymentIntentId || "",
					};

					setDelivery(simplifiedTransaction);
					setLoading(false);
					return;
				}

				// If we couldn't find the delivery in either collection, try to find related
				// delivery info in the driver's recentDeliveries array
				const driverRef = doc(db, "drivers", "5mmRzIH8UqRmd4wV9LWg4JGuEvO2");
				const driverSnap = await getDoc(driverRef);

				if (driverSnap.exists()) {
					const driverData = driverSnap.data();

					// Find matching delivery in recentDeliveries
					if (
						driverData.recentDeliveries &&
						Array.isArray(driverData.recentDeliveries)
					) {
						const recentDelivery = driverData.recentDeliveries.find(
							(delivery: RecentDelivery) => delivery.orderId === deliveryId
						);

						if (recentDelivery) {
							// Create a simplified transaction from the recentDelivery data
							const simplifiedTransaction: DriverTransaction = {
								id: recentDelivery.orderId,
								orderId: recentDelivery.orderId,
								driverId: driverSnap.id,
								vendorId: "",
								vendorName: recentDelivery.vendorName || "",
								vendorEmail: "",
								vendorPhone: "",
								customerId: "",
								customerName: recentDelivery.customerName || "",
								customerEmail: "",
								customerPhone: "",
								acceptTimestamp: recentDelivery.timestamp,
								pickupTimestamp: null,
								deliverTimestamp: recentDelivery.timestamp,
								completionTimestamp: recentDelivery.timestamp,
								status: "delivered",
								storeLocation: {
									address: "",
									coordinates: undefined,
								},
								customerLocation: {
									address: "",
									coordinates: undefined,
								},
								deliveryInfo: {
									distance: recentDelivery.distance || 0,
									distanceInKm: recentDelivery.distance / 1000 || 0,
									estimatedTime: 0,
								},
								earned: {
									deliveryFee: recentDelivery.earned * 0.9 || 0, // Estimate
									tip: recentDelivery.earned * 0.1 || 0, // Estimate
									total: recentDelivery.earned || 0,
								},
								orderDetails: {
									items: [],
									subtotal: recentDelivery.amount * 0.8 || 0, // Estimate
									total: recentDelivery.amount || 0,
								},
								paymentIntentId: "",
							};

							setDelivery(simplifiedTransaction);
							setLoading(false);
							return;
						}
					}
				}

				// If we get here, we couldn't find the delivery in any collection
				setError("Delivery information not found");
				setLoading(false);
			} catch (err) {
				console.error("Error fetching delivery details:", err);
				setError("Failed to load delivery details. Please try again.");
				setLoading(false);
			}
		};

		fetchDeliveryDetails();
	}, [isOpen, deliveryId]);

	// Handle star rating click
	const handleStarClick = (selectedRating: number) => {
		setRating(selectedRating);
	};

	// Handle feedback submission
	const handleFeedbackSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setFeedbackError("");

		if (rating === 0) {
			setFeedbackError("Please select a rating");
			return;
		}

		setIsSubmitting(true);

		if (!delivery) {
			setFeedbackError("Delivery information not available");
			setIsSubmitting(false);
			return;
		}

		// Prepare template parameters for EmailJS
		const templateParams = {
			order_id: delivery.orderId,
			vendor_name: delivery.vendorName,
			delivery_date: formatTimestamp(delivery.deliverTimestamp),
			rating: rating,
			comments: comment || "No comments provided",
			recipient_email: "feedback@yourcompany.com", // Replace with the actual recipient email
		};

		// Send the feedback using EmailJS
		// Replace these values with your actual EmailJS service, template, and public key
		emailjs
			.send(
				"YOUR_SERVICE_ID",
				"YOUR_TEMPLATE_ID",
				templateParams,
				"YOUR_PUBLIC_KEY"
			)
			.then(() => {
				setIsSubmitted(true);
				setIsSubmitting(false);

				// Close the feedback modal after a short delay
				setTimeout(() => {
					setShowFeedbackModal(false);
					// Reset the form
					setRating(0);
					setComment("");
					setIsSubmitted(false);
				}, 2000);
			})
			.catch((err) => {
				console.error("Failed to submit feedback:", err);
				setFeedbackError("Failed to submit feedback. Please try again.");
				setIsSubmitting(false);
			});
	};

	// If modal is not open, don't render anything
	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 overflow-y-auto backdrop-blur-lg bg-opacity-50 flex items-center justify-center p-4">
			<div className="bg-white border border-gray-300 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
				{/* Header */}
				<div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
					<div className="flex items-center">
						<h2 className="text-xl font-bold text-gray-900">
							Delivery #{deliveryId?.slice(-6) || ""}
						</h2>
						{delivery && (
							<span
								className={`ml-3 px-3 py-1 rounded-full text-xs font-semibold border ${
									delivery.status === "delivered"
										? "bg-green-100 text-green-800 border-green-400"
										: "bg-gray-100 text-gray-800 border-gray-400"
								}`}
							>
								{delivery.status === "delivered"
									? "Delivered"
									: delivery.status}
							</span>
						)}
					</div>
					<button
						onClick={onClose}
						className="text-gray-400 hover:text-gray-500 focus:outline-none cursor-pointer"
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

				{/* Content */}
				<div className="p-6">
					{loading ? (
						<div className="flex justify-center items-center h-40">
							<div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sarva"></div>
							<p className="ml-3 text-gray-600">Loading delivery details...</p>
						</div>
					) : error ? (
						<div className="bg-red-100 text-red-700 p-4 rounded-lg">
							{error}
						</div>
					) : delivery ? (
						<>
							{/* Map visualization - replaced placeholder with actual map */}
							<div className="mb-6">
								<DeliveryRouteMap
									sourceAddress={delivery.storeLocation?.address}
									sourceCoordinates={delivery.storeLocation?.coordinates}
									destinationAddress={delivery.customerLocation?.address}
									destinationCoordinates={
										delivery.customerLocation?.coordinates
									}
									className="rounded-lg overflow-hidden"
								/>
							</div>

							{/* Delivery timeline */}
							<div className="mb-6 border-t border-b border-gray-200 py-4">
								<h3 className="font-semibold text-gray-900 mb-4">
									Delivery Timeline
								</h3>

								{/* Accept */}
								<div className="flex mb-4">
									<div className="flex flex-col items-center mr-4">
										<div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white">
											<svg
												className="w-5 h-5"
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
										</div>
										<div className="h-full w-0.5 bg-gray-200 mt-2 mb-2"></div>
									</div>
									<div>
										<p className="font-medium">Order Accepted</p>
										<p className="text-sm text-gray-500">
											{formatTimestamp(delivery.acceptTimestamp)}
										</p>
									</div>
								</div>

								{/* Pickup */}
								<div className="flex mb-4">
									<div className="flex flex-col items-center mr-4">
										<div
											className={`w-8 h-8 rounded-full flex items-center justify-center ${
												delivery.pickupTimestamp
													? "bg-green-500 text-white"
													: "bg-gray-200 text-gray-500"
											}`}
										>
											<svg
												className="w-5 h-5"
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
										<div className="h-full w-0.5 bg-gray-200 mt-2 mb-2"></div>
									</div>
									<div>
										<p className="font-medium">Picked Up from Vendor</p>
										<p className="text-sm text-gray-500">
											{delivery.pickupTimestamp
												? formatTimestamp(delivery.pickupTimestamp)
												: "Pending"}
										</p>
										{delivery.pickupDuration && (
											<p className="text-xs text-gray-500">
												Time to pickup:{" "}
												{Math.floor(delivery.pickupDuration / 60)} min
												{delivery.pickupEfficiency !== undefined &&
													delivery.pickupEfficiency !== null &&
													` (${delivery.pickupEfficiency}% of estimate)`}
											</p>
										)}
									</div>
								</div>

								{/* Delivery */}
								<div className="flex">
									<div className="flex flex-col items-center mr-4">
										<div
											className={`w-8 h-8 rounded-full flex items-center justify-center ${
												delivery.deliverTimestamp
													? "bg-green-500 text-white"
													: "bg-gray-200 text-gray-500"
											}`}
										>
											<svg
												className="w-5 h-5"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
												/>
											</svg>
										</div>
									</div>
									<div>
										<p className="font-medium">Delivered to Customer</p>
										<p className="text-sm text-gray-500">
											{delivery.deliverTimestamp
												? formatTimestamp(delivery.deliverTimestamp)
												: "Pending"}
										</p>
										{delivery.deliveryDuration && (
											<p className="text-xs text-gray-500">
												Delivery time:{" "}
												{Math.floor(delivery.deliveryDuration / 60)} min
												{delivery.deliveryEfficiency !== undefined &&
													delivery.deliveryEfficiency !== null &&
													` (${delivery.deliveryEfficiency}% of estimate)`}
											</p>
										)}
										{delivery.totalDuration && (
											<p className="text-xs text-gray-500">
												Total time: {Math.floor(delivery.totalDuration / 60)}{" "}
												min
											</p>
										)}
									</div>
								</div>
							</div>

							{/* Locations grid */}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
								{/* Vendor details */}
								<div className="border rounded-lg p-4">
									<h3 className="font-medium text-gray-900 mb-2">
										Pickup From
									</h3>
									<p className="font-medium">{delivery.vendorName}</p>
									<p className="text-sm text-gray-600">
										{formatAddress(delivery.storeLocation?.address)}
									</p>
									{delivery.vendorPhone && (
										<div className="mt-3">
											<a
												href={`tel:${delivery.vendorPhone}`}
												className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 cursor-pointer"
											>
												<svg
													className="w-4 h-4 mr-1"
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
												{delivery.vendorPhone}
											</a>
										</div>
									)}
								</div>

								{/* Customer details */}
								<div className="border rounded-lg p-4">
									<h3 className="font-medium text-gray-900 mb-2">
										Delivered To
									</h3>
									<p className="font-medium">{delivery.customerName}</p>
									<p className="text-sm text-gray-600">
										{formatAddress(delivery.customerLocation?.address)}
									</p>
									{delivery.customerPhone && (
										<div className="mt-3">
											<a
												href={`tel:${delivery.customerPhone}`}
												className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 cursor-pointer"
											>
												<svg
													className="w-4 h-4 mr-1"
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
												{delivery.customerPhone}
											</a>
										</div>
									)}
								</div>
							</div>

							{/* Order items */}
							<div className="mb-6 border rounded-lg overflow-hidden">
								<div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
									<h3 className="font-medium text-gray-900">Order Items</h3>
								</div>
								<div className="divide-y divide-gray-200">
									{delivery.orderDetails?.items &&
									delivery.orderDetails.items.length > 0 ? (
										delivery.orderDetails.items.map((item, index) => (
											<div
												key={index}
												className="px-4 py-3 flex justify-between items-center"
											>
												<div>
													<p className="font-medium">
														{item.quantity} × {item.name}
													</p>
													{item.barcode && (
														<p className="text-xs text-gray-500">
															SKU: {item.barcode}
														</p>
													)}
												</div>
												<div className="text-gray-700">
													{formatCurrency(item.price * item.quantity)}
												</div>
											</div>
										))
									) : (
										<div className="px-4 py-3 text-gray-500">
											No items found
										</div>
									)}
								</div>
								<div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-between">
									<span className="font-medium">Total</span>
									<span className="font-medium">
										{formatCurrency(delivery.orderDetails?.total)}
									</span>
								</div>
							</div>

							{/* Delivery details and earnings */}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
								<div className="border rounded-lg p-4">
									<h3 className="font-medium text-gray-900 mb-3">
										Delivery Details
									</h3>
									<div className="grid grid-cols-2 gap-4">
										<div>
											<p className="text-sm text-gray-500">Distance</p>
											<p className="font-medium">
												{formatDistance(delivery.deliveryInfo?.distanceInKm)}
											</p>
										</div>
										<div>
											<p className="text-sm text-gray-500">Estimated Time</p>
											<p className="font-medium">
												{formatMinutes(delivery.deliveryInfo?.estimatedTime)}
											</p>
										</div>
									</div>
								</div>

								<div className="border rounded-lg p-4 bg-green-50">
									<h3 className="font-medium text-gray-900 mb-3">
										Your Earnings
									</h3>
									<div className="grid grid-cols-2 gap-4">
										<div>
											<p className="text-sm text-gray-600">Delivery Fee</p>
											<p className="font-medium">
												{formatCurrency(delivery.earned?.deliveryFee)}
											</p>
										</div>
										<div>
											<p className="text-sm text-gray-600">Tip</p>
											<p className="font-medium">
												{formatCurrency(delivery.earned?.tip)}
											</p>
										</div>
									</div>
									<div className="mt-3 pt-3 border-t border-green-100">
										<div className="flex justify-between">
											<p className="font-medium">Total Earnings</p>
											<p className="font-medium text-green-700">
												{formatCurrency(delivery.earned?.total)}
											</p>
										</div>
									</div>
								</div>
							</div>

							{/* Action buttons */}
							<div className="flex flex-col sm:flex-row gap-3 border-t border-gray-200 pt-6">
								<button
									className="flex-1 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition cursor-pointer"
									onClick={onClose}
								>
									Close Details
								</button>
							</div>
						</>
					) : (
						<div className="text-center p-6">
							<p className="text-gray-500">No delivery information found.</p>
						</div>
					)}
				</div>
			</div>

			{/* Feedback Modal */}
			{showFeedbackModal && delivery && (
				<div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-75">
					<div className="bg-white rounded-lg p-6 w-96 max-w-full">
						<div className="flex justify-between items-center mb-4">
							<h3 className="text-lg font-semibold">Leave Feedback</h3>
							<button
								onClick={() => setShowFeedbackModal(false)}
								className="text-gray-400 hover:text-gray-500"
							>
								<svg
									className="h-5 w-5"
									viewBox="0 0 20 20"
									fill="currentColor"
								>
									<path
										fillRule="evenodd"
										d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
										clipRule="evenodd"
									/>
								</svg>
							</button>
						</div>

						{isSubmitted ? (
							<div className="text-center py-6">
								<div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
									<svg
										className="h-6 w-6 text-green-600"
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
								</div>
								<h3 className="mt-2 text-sm font-medium text-gray-900">
									Thank you for your feedback!
								</h3>
								<p className="mt-1 text-sm text-gray-500">
									Your feedback helps us improve our service.
								</p>
							</div>
						) : (
							<form onSubmit={handleFeedbackSubmit}>
								<p className="text-sm text-gray-500 mb-4">
									Your feedback is anonymous and helps us improve our service.
									Delivery #{delivery.orderId.slice(-6)} from{" "}
									{delivery.vendorName}.
								</p>

								{/* Star rating */}
								<div className="mb-4">
									<label className="block text-sm font-medium text-gray-700 mb-2">
										How would you rate your experience?
									</label>
									<div className="flex space-x-1">
										{[1, 2, 3, 4, 5].map((star) => (
											<button
												key={star}
												type="button"
												className="focus:outline-none transition-transform hover:scale-110"
												onClick={() => handleStarClick(star)}
												onMouseEnter={() => setHoverRating(star)}
												onMouseLeave={() => setHoverRating(0)}
											>
												<svg
													className={`h-8 w-8 ${
														hoverRating >= star
															? "text-yellow-400"
															: rating >= star
															? "text-yellow-400"
															: "text-gray-300"
													} transition-colors duration-150`}
													fill="currentColor"
													viewBox="0 0 20 20"
													xmlns="http://www.w3.org/2000/svg"
												>
													<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
												</svg>
											</button>
										))}
									</div>
									<p className="mt-1 text-sm text-gray-500">
										{hoverRating === 1 && "Poor"}
										{hoverRating === 2 && "Fair"}
										{hoverRating === 3 && "Good"}
										{hoverRating === 4 && "Very Good"}
										{hoverRating === 5 && "Excellent"}
										{!hoverRating && rating === 1 && "Poor"}
										{!hoverRating && rating === 2 && "Fair"}
										{!hoverRating && rating === 3 && "Good"}
										{!hoverRating && rating === 4 && "Very Good"}
										{!hoverRating && rating === 5 && "Excellent"}
									</p>
								</div>

								{/* Comment */}
								<div className="mb-4">
									<label
										htmlFor="comment"
										className="block text-sm font-medium text-gray-700 mb-2"
									>
										Additional Comments (Optional)
									</label>
									<textarea
										id="comment"
										rows={3}
										className="shadow-sm focus:ring-blue-500 focus:border-blue-500 mt-1 block w-full sm:text-sm border border-gray-300 rounded-md p-2"
										placeholder="Tell us more about your experience..."
										value={comment}
										onChange={(e) => setComment(e.target.value)}
									></textarea>
								</div>

								{/* Error message */}
								{feedbackError && (
									<div className="mb-4 p-2 bg-red-50 text-red-500 text-sm rounded">
										{feedbackError}
									</div>
								)}

								{/* Submit button */}
								<div className="mt-5 sm:mt-6">
									<button
										type="submit"
										disabled={isSubmitting}
										className={`inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm ${
											isSubmitting ? "opacity-75 cursor-not-allowed" : ""
										}`}
									>
										{isSubmitting ? (
											<>
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
												Submitting...
											</>
										) : (
											"Submit Feedback"
										)}
									</button>
								</div>
							</form>
						)}
					</div>
				</div>
			)}
		</div>
	);
};

export default DeliveryDetailsModal;
