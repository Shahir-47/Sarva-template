// src/app/driver/orders/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
	collection,
	query,
	where,
	onSnapshot,
	updateDoc,
	addDoc,
	doc,
	getDoc,
	getDocs,
	increment,
	Timestamp,
	arrayUnion,
	GeoPoint,
	DocumentData,
	QuerySnapshot,
	FirestoreError,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { useDriverAuth } from "@/hooks/useDriverAuth";
import DriverNavBar from "@/components/driver/DriverNavBar";
import LoadingScreen from "@/components/shared/LoadingScreen";
import DeliveryRouteMap from "@/components/shared/DeliveryRouteMap";
import Footer from "@/components/shared/Footer";

// Define types for our data structures
interface LineItem {
	barcode: string;
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

interface OrderAmount {
	subtotal: number;
	deliveryFee: number;
	tax: number;
	serviceFee: number;
	tip: number;
	total: number;
}

interface Order {
	cancelled_reason: React.JSX.Element;
	cancelled_at: { seconds: number; nanoseconds: number } | null;
	payment_status: React.JSX.Element;
	id: string;
	customerID: string;
	customerName: string;
	customerEmail: string;
	customerPhone: string;
	customerLocation: string;
	customerCoordinates: GeoPoint;

	vendorID: string;
	vendorName: string;
	vendorEmail: string;
	vendorPhone: string;
	vendorLocation: string;
	vendorCoordinates: GeoPoint;

	driverID?: string;
	status: string;
	lineItems: LineItem[];
	deliveryInfo: DeliveryInfo;
	amount: OrderAmount;

	created_at: Timestamp;
	paymentIntentId: string;
	vendorStripeAccountId?: string;
}

interface OrderDetails {
	items: LineItem[];
	subtotal: number;
	total: number;
}

interface DriverEarnings {
	deliveryFee: number;
	tip: number;
	total: number;
}

interface LocationData {
	address: string;
	coordinates: GeoPoint;
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
	deliverTimestamp: Timestamp | null;
	completionTimestamp: Timestamp | null;

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

// Type guard functions to help TypeScript understand our data
const isOrder = (item: Order | DriverTransaction): item is Order => {
	return "amount" in item && !("earned" in item);
};

const isDriverTransaction = (
	item: Order | DriverTransaction
): item is DriverTransaction => {
	return "earned" in item && "orderDetails" in item;
};

// Helper functions
const formatTimestamp = (timestamp: Timestamp | null | undefined): string => {
	if (!timestamp) return "N/A";

	const date = new Date(timestamp.seconds * 1000);
	return date.toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
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

// Safely format an address, handling null/undefined cases
const formatAddress = (address: string | undefined | null): string => {
	if (!address) return "N/A";
	return address.length > 50 ? address.substring(0, 55) + "..." : address;
};

// Safely get address from either Order or DriverTransaction
const getVendorAddress = (item: Order | DriverTransaction): string => {
	if (isOrder(item)) {
		return item.vendorLocation;
	} else {
		return item.storeLocation?.address || "N/A";
	}
};

const getCustomerAddress = (item: Order | DriverTransaction): string => {
	if (isOrder(item)) {
		return item.customerLocation;
	} else {
		return item.customerLocation?.address || "N/A";
	}
};

// Safely get lineItems from either Order or DriverTransaction
const getLineItems = (item: Order | DriverTransaction): LineItem[] => {
	if (isOrder(item)) {
		return item.lineItems || [];
	} else {
		return item.orderDetails?.items || [];
	}
};

// Safely get total amount from either Order or DriverTransaction
const getTotalAmount = (item: Order | DriverTransaction): number => {
	if (isOrder(item)) {
		return item.amount?.total || 0;
	} else {
		return item.orderDetails?.total || 0;
	}
};

// Safely get delivery fee from either Order or DriverTransaction
const getDeliveryFee = (item: Order | DriverTransaction): number => {
	if (isOrder(item)) {
		return item.amount?.deliveryFee || 0;
	} else {
		return item.earned?.deliveryFee || 0;
	}
};

// Safely get tip from either Order or DriverTransaction
const getTip = (item: Order | DriverTransaction): number => {
	if (isOrder(item)) {
		return item.amount?.tip || 0;
	} else {
		return item.earned?.tip || 0;
	}
};

// Safely get delivery info from either Order or DriverTransaction
const getDeliveryInfo = (item: Order | DriverTransaction): DeliveryInfo => {
	return (
		item.deliveryInfo || { distance: 0, distanceInKm: 0, estimatedTime: 0 }
	);
};

const calculateEfficiency = (
	actualTime: number | undefined,
	estimatedTime: number | undefined
): number | null => {
	if (!actualTime || !estimatedTime || estimatedTime === 0) return null;
	return Math.round((actualTime / estimatedTime) * 100);
};

// Status badge component
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
	const getStatusColor = (status: string): string => {
		const statusColors: Record<string, string> = {
			"waiting for a driver to be assigned":
				"bg-yellow-100 text-yellow-800 border-yellow-400",
			"driver coming to pickup": "bg-blue-100 text-blue-800 border-blue-400",
			"driver delivering": "bg-indigo-100 text-indigo-800 border-indigo-400",
			delivered: "bg-green-100 text-green-800 border-green-400",
			cancelled: "bg-red-100 text-red-800 border-red-400",
		};
		return statusColors[status] || "bg-gray-100 text-gray-800 border-gray-400";
	};

	return (
		<span
			className={`ml-3 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
				status
			)}`}
		>
			{status === "waiting for a driver to be assigned" && "Needs Pickup"}
			{status === "driver coming to pickup" && "En Route to Pickup"}
			{status === "driver delivering" && "Out for Delivery"}
			{status === "delivered" && "Delivered"}
			{status === "cancelled" && "Cancelled"}
		</span>
	);
};

// Main component
export default function DriverOrdersPage() {
	const { user, initializing, driverData } = useDriverAuth();
	const router = useRouter();

	const [available, setAvailable] = useState<Order[]>([]);
	const [inProgress, setInProgress] = useState<Order[]>([]);
	const [outForDelivery, setOutForDelivery] = useState<Order[]>([]);
	const [completedOrders, setCompletedOrders] = useState<DriverTransaction[]>(
		[]
	);
	const [activeTab, setActiveTab] = useState<
		"available" | "pickup" | "delivering" | "completed"
	>("available");
	const [busyOrder, setBusyOrder] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedOrder, setSelectedOrder] = useState<
		Order | DriverTransaction | null
	>(null);
	const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
	const [statistics, setStatistics] = useState({
		deliveredToday: 0,
		totalEarnings: 0,
		avgRating: driverData?.stats?.averageRating || 0,
	});

	// Authentication check and redirect
	useEffect(() => {
		if (initializing) return;

		if (!user) {
			router.push("/unauthorized");
			return;
		}

		// Continue with data loading once authenticated
		setIsLoading(false);
	}, [user, initializing, router]);

	// 1) Orders waiting for pickup
	useEffect(() => {
		const q = query(
			collection(db, "orders"),
			where("status", "==", "waiting for a driver to be assigned")
		);

		try {
			return onSnapshot(
				q,
				(snapshot: QuerySnapshot<DocumentData>) => {
					const ordersList = snapshot.docs.map((doc) => ({
						id: doc.id,
						...(doc.data() as Omit<Order, "id">),
					}));
					setAvailable(ordersList);
					setError(null);
				},
				(err: FirestoreError) => {
					console.error("Error fetching available orders:", err);
					setError("Failed to load available orders. Please refresh the page.");
				}
			);
		} catch (err) {
			console.error("Error setting up orders listener:", err);
			setError("Failed to set up orders listener. Please refresh the page.");
		}
	}, []);

	// 2) Orders claimed but not yet picked up
	useEffect(() => {
		if (!user) return;

		const q = query(
			collection(db, "orders"),
			where("driverID", "==", user.uid),
			where("status", "==", "driver coming to pickup")
		);

		try {
			return onSnapshot(
				q,
				(snapshot: QuerySnapshot<DocumentData>) => {
					const ordersList = snapshot.docs.map((doc) => ({
						id: doc.id,
						...(doc.data() as Omit<Order, "id">),
					}));
					setInProgress(ordersList);
				},
				(err: FirestoreError) => {
					console.error("Error fetching in-progress orders:", err);
					setError("Failed to load your assignments. Please refresh the page.");
				}
			);
		} catch (err) {
			console.error("Error setting up in-progress listener:", err);
		}
	}, [user]);

	// 3) Orders out for delivery
	useEffect(() => {
		if (!user) return;

		const q = query(
			collection(db, "orders"),
			where("driverID", "==", user.uid),
			where("status", "==", "driver delivering")
		);

		try {
			return onSnapshot(
				q,
				(snapshot: QuerySnapshot<DocumentData>) => {
					const ordersList = snapshot.docs.map((doc) => ({
						id: doc.id,
						...(doc.data() as Omit<Order, "id">),
					}));
					setOutForDelivery(ordersList);
				},
				(err: FirestoreError) => {
					console.error("Error fetching delivery orders:", err);
					setError("Failed to load your deliveries. Please refresh the page.");
				}
			);
		} catch (err) {
			console.error("Error setting up delivery listener:", err);
		}
	}, [user]);

	// 4) Completed orders
	useEffect(() => {
		if (!user) return;

		const q = query(
			collection(db, "driverTransactions"),
			where("driverId", "==", user.uid),
			where("status", "==", "delivered")
		);

		try {
			return onSnapshot(
				q,
				(snapshot: QuerySnapshot<DocumentData>) => {
					const transactions = snapshot.docs.map((doc) => ({
						id: doc.id,
						...(doc.data() as Omit<DriverTransaction, "id">),
					}));
					setCompletedOrders(transactions);

					// Calculate statistics
					const today = new Date();
					const startOfDay = new Date(today.setHours(0, 0, 0, 0));

					const deliveredToday = transactions.filter(
						(tx) =>
							tx.completionTimestamp &&
							tx.completionTimestamp.toDate() >= startOfDay
					).length;

					const totalEarnings = transactions.reduce(
						(sum, tx) => sum + (tx.earned?.total || 0),
						0
					);

					setStatistics({
						deliveredToday,
						totalEarnings,
						avgRating: driverData?.stats?.averageRating || 0,
					});
				},
				(err: FirestoreError) => {
					console.error("Error fetching completed orders:", err);
				}
			);
		} catch (err) {
			console.error("Error setting up completed orders listener:", err);
		}
	}, [user, driverData]);

	const acceptOrder = async (orderId: string) => {
		if (!user) return;
		setBusyOrder(orderId);

		try {
			// 1) update order status & assign driver
			await updateDoc(doc(db, "orders", orderId), {
				driverID: user.uid,
				status: "driver coming to pickup",
				driver_assigned_at: Timestamp.now(),
			});

			// 2) create enhanced driver transaction with richer data
			const order = available.find((o) => o.id === orderId);
			if (!order) {
				throw new Error("Order not found");
			}

			const now = Timestamp.now();

			// Create the enhanced transaction record
			await addDoc(collection(db, "driverTransactions"), {
				orderId,
				driverId: user.uid,

				// Enriched vendor data
				vendorId: order.vendorID,
				vendorName: order.vendorName,
				vendorEmail: order.vendorEmail,
				vendorPhone: order.vendorPhone,

				// Enriched customer data
				customerId: order.customerID,
				customerName: order.customerName,
				customerEmail: order.customerEmail,
				customerPhone: order.customerPhone,

				// Timestamps
				acceptTimestamp: now,
				pickupTimestamp: null,
				deliverTimestamp: null,

				status: "accepted",

				// Location data
				storeLocation: {
					address: order.vendorLocation,
					coordinates: order.vendorCoordinates,
				},
				customerLocation: {
					address: order.customerLocation,
					coordinates: order.customerCoordinates,
				},

				// Delivery metrics
				deliveryInfo: order.deliveryInfo,

				// Financial data
				earned: {
					deliveryFee: order.amount.deliveryFee,
					tip: order.amount.tip,
					total: order.amount.deliveryFee + order.amount.tip,
				},

				// Order details
				orderDetails: {
					items: order.lineItems,
					subtotal: order.amount.subtotal,
					total: order.amount.total,
				},

				paymentIntentId: order.paymentIntentId,
			});

			// 3) add to driver's deliveryIds
			await updateDoc(doc(db, "drivers", user.uid), {
				deliveryIds: arrayUnion(orderId),
			});
		} catch (err) {
			console.error("Error accepting order:", err);
			setError("Failed to accept order. Please try again.");
		} finally {
			setBusyOrder(null);
		}
	};

	const markPickedUp = async (orderId: string) => {
		if (!user) return;
		setBusyOrder(orderId);

		try {
			const now = Timestamp.now();

			// a) update order
			await updateDoc(doc(db, "orders", orderId), {
				status: "driver delivering",
				picked_up_at: now,
			});

			// b) update driver transaction with enhanced data
			const txQuery = query(
				collection(db, "driverTransactions"),
				where("orderId", "==", orderId),
				where("driverId", "==", user.uid)
			);

			const txSnap = await getDocs(txQuery);

			if (!txSnap.empty) {
				const txRef = doc(db, "driverTransactions", txSnap.docs[0].id);
				const txData = txSnap.docs[0].data() as DriverTransaction;

				// Calculate time from acceptance to pickup
				const acceptTime = txData.acceptTimestamp;
				const pickupDuration = now.seconds - acceptTime.seconds;

				// Get delivery info safely
				const deliveryInfo = txData.deliveryInfo || { estimatedTime: 0 };

				await updateDoc(txRef, {
					pickupTimestamp: now,
					status: "picked_up",
					pickupDuration: pickupDuration, // Time taken to reach store
					pickupEfficiency: calculateEfficiency(
						pickupDuration,
						deliveryInfo.estimatedTime
					),
				});
			}

			// c) deduct inventory using actual line items
			const order = inProgress.find((o) => o.id === orderId);
			if (order && order.lineItems && Array.isArray(order.lineItems)) {
				await Promise.all(
					order.lineItems.map((item) =>
						updateDoc(doc(db, "inventory", item.itemID), {
							units: increment(-item.quantity),
							soldUnits: increment(item.quantity),
						})
					)
				);

				// d) capture payment and transfer vendor cut
				const vendorSnap = await getDoc(doc(db, "vendors", order.vendorID));
				const vendorData = vendorSnap.data();
				const vendorStripeAccountId = vendorData?.stripeAccountId;

				if (order.amount && order.amount.subtotal !== undefined) {
					await fetch("/api/capture-and-transfer-vendor", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							paymentIntentId: order.paymentIntentId,
							vendorStripeAccountId,
							vendorAmount: Math.round(order.amount.subtotal * 100),
						}),
					});
				}
			}
		} catch (err) {
			console.error("Error marking order as picked up:", err);
			setError("Failed to update order status. Please try again.");
		} finally {
			setBusyOrder(null);
		}
	};

	const markDelivered = async (orderId: string) => {
		if (!user) return;
		setBusyOrder(orderId);

		try {
			const now = Timestamp.now();

			// a) update order
			await updateDoc(doc(db, "orders", orderId), {
				status: "delivered",
				delivered_at: now,
			});

			// b) finalize driver transaction with enhanced data
			const txQuery = query(
				collection(db, "driverTransactions"),
				where("orderId", "==", orderId),
				where("driverId", "==", user.uid)
			);

			const txSnap = await getDocs(txQuery);

			if (!txSnap.empty) {
				const txRef = doc(db, "driverTransactions", txSnap.docs[0].id);
				const txData = txSnap.docs[0].data() as DriverTransaction;

				// Calculate delivery metrics
				const pickupTime = txData.pickupTimestamp;
				const deliveryDuration = pickupTime
					? now.seconds - pickupTime.seconds
					: null;
				const totalDuration = txData.acceptTimestamp
					? now.seconds - txData.acceptTimestamp.seconds
					: null;

				// Get delivery info safely
				const deliveryInfo = txData.deliveryInfo || { estimatedTime: 0 };

				// Calculate delivery efficiency if we have the estimated time
				const deliveryEfficiency = calculateEfficiency(
					deliveryDuration || 0,
					deliveryInfo.estimatedTime
				);

				await updateDoc(txRef, {
					deliverTimestamp: now,
					status: "delivered",
					deliveryDuration: deliveryDuration, // Time from pickup to delivery
					totalDuration: totalDuration, // Total time from acceptance to delivery
					deliveryEfficiency: deliveryEfficiency,
					overallEfficiency: calculateEfficiency(
						totalDuration || 0,
						deliveryInfo.estimatedTime ? deliveryInfo.estimatedTime * 2 : 0
					),
					distance: txData.deliveryInfo?.distance || 0,
					distanceInKm: txData.deliveryInfo?.distanceInKm || 0,
					distanceInMiles: txData.deliveryInfo?.distanceInMiles || 0,
					estimatedTime: deliveryInfo.estimatedTime,

					completionTimestamp: now,
				});
			}

			// c) bump driver stats with enriched data
			const order = outForDelivery.find((o) => o.id === orderId);
			if (order) {
				const deliveryDistance = order.deliveryInfo?.distance || 0;

				const deliveryFee = order.amount?.deliveryFee || 0;
				const tipAmount = order.amount?.tip || 0;
				const totalEarned = deliveryFee + tipAmount;
				const itemCount =
					order.lineItems?.reduce((total, item) => total + item.quantity, 0) ||
					0;

				await updateDoc(doc(db, "drivers", user.uid), {
					"stats.totalDeliveries": increment(1),
					"stats.totalEarnings": increment(totalEarned),
					"stats.totalDistance": increment(deliveryDistance),
					"stats.totalItems": increment(itemCount),
					"stats.totalTime": increment(order.deliveryInfo?.estimatedTime || 0),
					"stats.totalMilesDriven": increment(
						order.deliveryInfo?.distanceInMiles || 0
					),
					recentDeliveries: arrayUnion({
						orderId: order.id,
						timestamp: now,
						vendorName: order.vendorName,
						customerName: order.customerName,
						amount: order.amount?.total || 0,
						earned: totalEarned,
						distance: deliveryDistance,
					}),
				});

				// d) transfer driver's cut
				const driverSnap = await getDoc(doc(db, "drivers", user.uid));
				const driverData = driverSnap.data();
				const driverStripeAccountId = driverData?.stripeAccountId as string;

				if (deliveryFee !== undefined && tipAmount !== undefined) {
					await fetch("/api/transfer-driver", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							paymentIntentId: order.paymentIntentId,
							driverStripeAccountId,
							driverAmount: Math.round(totalEarned * 100),
						}),
					});
				}
			}
		} catch (err) {
			console.error("Error marking order as delivered for some reason:", err);
			setError("Failed to complete delivery. Please try again.");
		} finally {
			setBusyOrder(null);
		}
	};

	// Order card component
	const OrderCard: React.FC<{
		order: Order | DriverTransaction;
		type: "available" | "pickup" | "delivering" | "completed";
	}> = ({ order, type }) => {
		// Extract data using our safe accessor functions
		const orderId = isOrder(order) ? order.id : order.orderId;
		const status = isOrder(order) ? order.status : order.status;
		const vendorName = order.vendorName;
		const customerName = order.customerName;
		const vendorLocation = getVendorAddress(order);
		const customerLocation = getCustomerAddress(order);
		const deliveryInfo = getDeliveryInfo(order);
		const lineItems = getLineItems(order);
		const totalAmount = getTotalAmount(order);
		const deliveryFee = getDeliveryFee(order);
		const tip = getTip(order);
		const earnings = deliveryFee + tip;

		return (
			<div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden mb-4 hover:shadow-md transition-shadow">
				{/* Header with order ID and status */}
				<div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
					<div className="flex items-center">
						<span className="font-medium text-gray-900">
							Order #{orderId.slice(-6)}
						</span>
						<StatusBadge status={status} />
					</div>
					<div className="text-right">
						<div className="text-lg font-bold">
							{formatCurrency(totalAmount)}
						</div>
						<div className="text-sm text-green-600 font-medium">
							Earn: {formatCurrency(earnings)}
						</div>
					</div>
				</div>

				{/* Order details */}
				<div className="p-4">
					<div className="grid grid-cols-2 gap-4 mb-4">
						<div>
							<p className="text-xs text-gray-500">From</p>
							<p className="font-medium">{vendorName}</p>
							<p className="text-sm text-gray-600 truncate">
								{formatAddress(vendorLocation)}
							</p>
						</div>

						<div>
							<p className="text-xs text-gray-500">To</p>
							<p className="font-medium">{customerName}</p>
							<p className="text-sm text-gray-600 truncate">
								{formatAddress(customerLocation)}
							</p>
						</div>
					</div>

					{/* Trip details */}
					<div className="border-t border-gray-100 pt-3 mt-2">
						<div className="flex justify-between text-sm">
							<div>
								<p className="text-gray-600">
									<span className="font-medium">Distance:</span>{" "}
									{formatDistance(deliveryInfo.distanceInKm)}
								</p>
								<p className="text-gray-600">
									<span className="font-medium">Est. Time:</span>{" "}
									{formatMinutes(deliveryInfo.estimatedTime)}
								</p>
							</div>
							<div className="text-right">
								<p className="text-gray-600">
									<span className="font-medium">Items:</span>{" "}
									{Array.isArray(lineItems) ? lineItems.length : 0}
								</p>
								{isDriverTransaction(order) && order.totalDuration && (
									<p className="text-gray-600">
										<span className="font-medium">Completed in:</span>{" "}
										{formatMinutes(Math.floor(order.totalDuration / 60))}
									</p>
								)}
							</div>
						</div>
					</div>

					{/* Action buttons */}
					<div className="mt-4 flex gap-2">
						<button
							className="flex-1 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
							onClick={() => {
								setSelectedOrder(order);
								setIsModalOpen(true);
							}}
						>
							View Details
						</button>

						{type === "available" && isOrder(order) && (
							<button
								className="flex-1 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
								disabled={busyOrder === order.id}
								onClick={() => acceptOrder(order.id)}
							>
								{busyOrder === order.id ? "Accepting..." : "Accept Order"}
							</button>
						)}

						{type === "pickup" && isOrder(order) && (
							<button
								className="flex-1 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
								disabled={busyOrder === order.id}
								onClick={() => markPickedUp(order.id)}
							>
								{busyOrder === order.id ? "Processing..." : "Mark Picked Up"}
							</button>
						)}

						{type === "delivering" && isOrder(order) && (
							<button
								className="flex-1 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
								disabled={busyOrder === order.id}
								onClick={() => markDelivered(order.id)}
							>
								{busyOrder === order.id ? "Completing..." : "Mark Delivered"}
							</button>
						)}
					</div>
				</div>
			</div>
		);
	};

	// OrderDetailsModal component with DeliveryRouteMap
	const OrderDetailsModal: React.FC = () => {
		if (!selectedOrder) return null;

		// Extract data using our safe accessor functions
		const orderId = isOrder(selectedOrder)
			? selectedOrder.id
			: selectedOrder.orderId;
		const status = isOrder(selectedOrder)
			? selectedOrder.status
			: selectedOrder.status;
		const vendorName = selectedOrder.vendorName;
		const customerName = selectedOrder.customerName;
		const vendorLocation = getVendorAddress(selectedOrder);
		const customerLocation = getCustomerAddress(selectedOrder);
		const vendorPhone = selectedOrder.vendorPhone;
		const customerPhone = selectedOrder.customerPhone;
		const deliveryInfo = getDeliveryInfo(selectedOrder);
		const lineItems = getLineItems(selectedOrder);
		const totalAmount = getTotalAmount(selectedOrder);
		const deliveryFee = getDeliveryFee(selectedOrder);
		const tip = getTip(selectedOrder);

		// Get coordinates for map
		const getVendorCoordinates = () => {
			if (isOrder(selectedOrder)) {
				return selectedOrder.vendorCoordinates;
			} else {
				return selectedOrder.storeLocation?.coordinates;
			}
		};

		const getCustomerCoordinates = () => {
			if (isOrder(selectedOrder)) {
				return selectedOrder.customerCoordinates;
			} else {
				return selectedOrder.customerLocation?.coordinates;
			}
		};

		const vendorCoordinates = getVendorCoordinates();
		const customerCoordinates = getCustomerCoordinates();

		return (
			<div className="fixed inset-0 z-50 overflow-y-auto backdrop-blur-lg bg-opacity-50 flex items-center justify-center p-4">
				<div className="bg-white border border-gray-600 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
					{/* Header */}
					<div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
						<div className="flex items-center">
							<h2 className="text-xl font-bold text-gray-900">
								Order #{orderId.slice(-6)}
							</h2>
							<StatusBadge status={status} />
						</div>
						<button
							onClick={() => setIsModalOpen(false)}
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

					<div className="p-6">
						{/* Map visualization using DeliveryRouteMap */}
						<div className="mb-6">
							{vendorCoordinates && customerCoordinates ? (
								<DeliveryRouteMap
									sourceAddress={vendorLocation}
									sourceCoordinates={vendorCoordinates}
									destinationAddress={customerLocation}
									destinationCoordinates={customerCoordinates}
									className="rounded-lg"
								/>
							) : (
								<div className="bg-gray-100 rounded-lg overflow-hidden h-40 mb-6 flex items-center justify-center">
									<div className="text-center">
										<svg
											className="h-10 w-10 text-gray-400 mx-auto mb-2"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={1.5}
												d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
											/>
										</svg>
										<p className="text-gray-500">
											Route map would display here
										</p>
										<p className="text-sm text-gray-500">
											{vendorLocation} → {customerLocation}
										</p>
									</div>
								</div>
							)}
						</div>

						{/* Order timeline */}
						{isDriverTransaction(selectedOrder) && (
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
											{formatTimestamp(selectedOrder.acceptTimestamp)}
										</p>
									</div>
								</div>

								{/* Pickup */}
								<div className="flex mb-4">
									<div className="flex flex-col items-center mr-4">
										<div
											className={`w-8 h-8 rounded-full flex items-center justify-center ${
												selectedOrder.pickupTimestamp
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
											{selectedOrder.pickupTimestamp
												? formatTimestamp(selectedOrder.pickupTimestamp)
												: "Pending"}
										</p>
										{selectedOrder.pickupDuration && (
											<p className="text-xs text-gray-500">
												Time to pickup:{" "}
												{Math.floor(selectedOrder.pickupDuration / 60)} min
												{selectedOrder.pickupEfficiency !== undefined &&
													selectedOrder.pickupEfficiency !== null &&
													` (${selectedOrder.pickupEfficiency}% of estimate)`}
											</p>
										)}
									</div>
								</div>

								{/* Delivery */}
								<div className="flex">
									<div className="flex flex-col items-center mr-4">
										<div
											className={`w-8 h-8 rounded-full flex items-center justify-center ${
												selectedOrder.deliverTimestamp
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
											{selectedOrder.deliverTimestamp
												? formatTimestamp(selectedOrder.deliverTimestamp)
												: "Pending"}
										</p>
										{selectedOrder.deliveryDuration && (
											<p className="text-xs text-gray-500">
												Delivery time:{" "}
												{Math.floor(selectedOrder.deliveryDuration / 60)} min
												{selectedOrder.deliveryEfficiency !== undefined &&
													selectedOrder.deliveryEfficiency !== null &&
													` (${selectedOrder.deliveryEfficiency}% of estimate)`}
											</p>
										)}
										{selectedOrder.totalDuration && (
											<p className="text-xs text-gray-500">
												Total time:{" "}
												{Math.floor(selectedOrder.totalDuration / 60)} min
											</p>
										)}
									</div>
								</div>
							</div>
						)}

						{/* Order details grid */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
							{/* Vendor details */}
							<div className="border rounded-lg p-4">
								<h3 className="font-medium text-gray-900 mb-2">Pickup From</h3>
								<p className="font-medium">{vendorName}</p>
								<p className="text-sm text-gray-600">
									{formatAddress(vendorLocation)}
								</p>
								{vendorPhone && (
									<div className="mt-3">
										<a
											href={`tel:${vendorPhone}`}
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
											{vendorPhone}
										</a>
									</div>
								)}
							</div>

							{/* Customer details */}
							<div className="border rounded-lg p-4">
								<h3 className="font-medium text-gray-900 mb-2">Deliver To</h3>
								<p className="font-medium">{customerName}</p>
								<p className="text-sm text-gray-600">
									{formatAddress(customerLocation)}
								</p>
								{customerPhone && (
									<div className="mt-3">
										<a
											href={`tel:${customerPhone}`}
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
											{customerPhone}
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
								{Array.isArray(lineItems) && lineItems.length > 0 ? (
									lineItems.map((item, index) => (
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
									<div className="px-4 py-3 text-gray-500">No items found</div>
								)}
							</div>
							<div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-between">
								<span className="font-medium">Total</span>
								<span className="font-medium">
									{formatCurrency(totalAmount)}
								</span>
							</div>
						</div>

						{/* Delivery details */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
							<div className="border rounded-lg p-4">
								<h3 className="font-medium text-gray-900 mb-3">
									Delivery Details
								</h3>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<p className="text-sm text-gray-500">Distance</p>
										<p className="font-medium">
											{formatDistance(deliveryInfo.distanceInKm)}
										</p>
									</div>
									<div>
										<p className="text-sm text-gray-500">Estimated Time</p>
										<p className="font-medium">
											{formatMinutes(deliveryInfo.estimatedTime)}
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
										<p className="font-medium">{formatCurrency(deliveryFee)}</p>
									</div>
									<div>
										<p className="text-sm text-gray-600">Tip</p>
										<p className="font-medium">{formatCurrency(tip)}</p>
									</div>
								</div>
								<div className="mt-3 pt-3 border-t border-green-100">
									<div className="flex justify-between">
										<p className="font-medium">Total Earnings</p>
										<p className="font-medium text-green-700">
											{formatCurrency(deliveryFee + tip)}
										</p>
									</div>
								</div>
							</div>
						</div>

						{/* Action buttons */}
						<div className="flex flex-col sm:flex-row gap-3 border-t border-gray-200 pt-6">
							{isOrder(selectedOrder) &&
								selectedOrder.status ===
									"waiting for a driver to be assigned" && (
									<button
										className="flex-1 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
										disabled={busyOrder === selectedOrder.id}
										onClick={() => {
											acceptOrder(selectedOrder.id);
											setIsModalOpen(false);
										}}
									>
										{busyOrder === selectedOrder.id
											? "Accepting..."
											: "Accept Order"}
									</button>
								)}

							{isOrder(selectedOrder) &&
								selectedOrder.status === "driver coming to pickup" && (
									<button
										className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
										disabled={busyOrder === selectedOrder.id}
										onClick={() => {
											markPickedUp(selectedOrder.id);
											setIsModalOpen(false);
										}}
									>
										{busyOrder === selectedOrder.id
											? "Processing..."
											: "Mark as Picked Up"}
									</button>
								)}

							{isOrder(selectedOrder) &&
								selectedOrder.status === "driver delivering" && (
									<button
										className="flex-1 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
										disabled={busyOrder === selectedOrder.id}
										onClick={() => {
											markDelivered(selectedOrder.id);
											setIsModalOpen(false);
										}}
									>
										{busyOrder === selectedOrder.id
											? "Completing..."
											: "Mark as Delivered"}
									</button>
								)}

							<button
								className="flex-1 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition cursor-pointer"
								onClick={() => setIsModalOpen(false)}
							>
								Close Details
							</button>
						</div>
					</div>
				</div>
			</div>
		);
	};

	// Empty state component
	const EmptyState: React.FC<{ type: string }> = ({ type }) => {
		let icon, title, message;

		switch (type) {
			case "available":
				icon = (
					<svg
						className="w-16 h-16 text-gray-400 mx-auto"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={1.5}
							d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
						/>
					</svg>
				);
				title = "No Available Orders";
				message =
					"There are no orders available for pickup at the moment. Check back soon!";
				break;
			case "pickup":
				icon = (
					<svg
						className="w-16 h-16 text-gray-400 mx-auto"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={1.5}
							d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
						/>
					</svg>
				);
				title = "No Pickups In Progress";
				message =
					"You don't have any orders to pick up. Find available orders to start delivering!";
				break;
			case "delivering":
				icon = (
					<svg
						className="w-16 h-16 text-gray-400 mx-auto"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={1.5}
							d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				);
				title = "No Deliveries In Progress";
				message =
					"You don't have any orders out for delivery. Pick up orders to start delivering!";
				break;
			case "completed":
				icon = (
					<svg
						className="w-16 h-16 text-gray-400 mx-auto"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={1.5}
							d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
						/>
					</svg>
				);
				title = "No Completed Orders";
				message =
					"Your delivery history will appear here after you complete deliveries.";
				break;
			default:
				icon = (
					<svg
						className="w-16 h-16 text-gray-400 mx-auto"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={1.5}
							d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
						/>
					</svg>
				);
				title = "No Orders";
				message = "There are no orders to display.";
		}

		return (
			<div className="bg-white rounded-lg shadow border border-gray-200 p-8 text-center">
				{icon}
				<h3 className="mt-4 text-lg font-medium text-gray-900">{title}</h3>
				<p className="mt-2 text-gray-500">{message}</p>
			</div>
		);
	};

	// If initializing or loading, show loading screen
	if (initializing || isLoading) {
		return <LoadingScreen message="Loading orders..." />;
	}

	// If no user, redirect to auth (handled in useEffect)
	if (!user) {
		return null;
	}

	return (
		<div className="min-h-screen bg-gray-100">
			<header>
				<DriverNavBar />
			</header>

			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
				{error && (
					<div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
						<div className="flex">
							<div className="flex-shrink-0">
								<svg
									className="h-5 w-5 text-red-500"
									viewBox="0 0 20 20"
									fill="currentColor"
								>
									<path
										fillRule="evenodd"
										d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
										clipRule="evenodd"
									/>
								</svg>
							</div>
							<div className="ml-3">
								<p className="text-sm">{error}</p>
							</div>
						</div>
					</div>
				)}

				{/* Statistics Cards */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
					<div className="bg-white rounded-lg shadow p-6 border border-gray-200">
						<div className="flex items-start">
							<div className="rounded-md bg-blue-50 p-3 text-blue-600">
								<svg
									className="h-6 w-6"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									aria-hidden="true"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
							</div>
							<div className="ml-4">
								<h3 className="text-sm font-medium text-gray-500">
									Deliveries Today
								</h3>
								<p className="mt-1 text-3xl font-semibold text-gray-900">
									{statistics.deliveredToday}
								</p>
							</div>
						</div>
					</div>

					<div className="bg-white rounded-lg shadow p-6 border border-gray-200">
						<div className="flex items-start">
							<div className="rounded-md bg-green-50 p-3 text-green-600">
								<svg
									className="h-6 w-6"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									aria-hidden="true"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
							</div>
							<div className="ml-4">
								<h3 className="text-sm font-medium text-gray-500">
									Total Earnings
								</h3>
								<p className="mt-1 text-3xl font-semibold text-gray-900">
									{formatCurrency(statistics.totalEarnings)}
								</p>
							</div>
						</div>
					</div>

					<div className="bg-white rounded-lg shadow p-6 border border-gray-200">
						<div className="flex items-start">
							<div className="rounded-md bg-yellow-50 p-3 text-yellow-600">
								<svg
									className="h-6 w-6"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									aria-hidden="true"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
									/>
								</svg>
							</div>
							<div className="ml-4">
								<h3 className="text-sm font-medium text-gray-500">Rating</h3>
								<p className="mt-1 text-3xl font-semibold text-gray-900">
									{statistics.avgRating > 0
										? statistics.avgRating.toFixed(1)
										: "N/A"}
								</p>
							</div>
						</div>
					</div>
				</div>

				{/* Tab Navigation */}
				<div className="bg-white rounded-lg shadow border border-gray-200 mb-6">
					<div className="border-b border-gray-200">
						<nav className="flex">
							<button
								className={`px-6 py-4 text-sm font-medium border-b-2 ${
									activeTab === "available"
										? "border-blue-500 text-blue-600"
										: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200"
								} cursor-pointer`}
								onClick={() => setActiveTab("available")}
							>
								Available Orders
								{available.length > 0 && (
									<span className="ml-2 bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
										{available.length}
									</span>
								)}
							</button>

							<button
								className={`px-6 py-4 text-sm font-medium border-b-2 ${
									activeTab === "pickup"
										? "border-blue-500 text-blue-600"
										: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200"
								} cursor-pointer`}
								onClick={() => setActiveTab("pickup")}
							>
								Pickups
								{inProgress.length > 0 && (
									<span className="ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
										{inProgress.length}
									</span>
								)}
							</button>

							<button
								className={`px-6 py-4 text-sm font-medium border-b-2 ${
									activeTab === "delivering"
										? "border-blue-500 text-blue-600"
										: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200"
								} cursor-pointer`}
								onClick={() => setActiveTab("delivering")}
							>
								Delivering
								{outForDelivery.length > 0 && (
									<span className="ml-2 bg-indigo-100 text-indigo-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
										{outForDelivery.length}
									</span>
								)}
							</button>

							<button
								className={`px-6 py-4 text-sm font-medium border-b-2 ${
									activeTab === "completed"
										? "border-blue-500 text-blue-600"
										: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200"
								} cursor-pointer`}
								onClick={() => setActiveTab("completed")}
							>
								History
							</button>
						</nav>
					</div>
				</div>

				{/* Main content based on active tab */}
				<div>
					{activeTab === "available" && (
						<>
							{available.length > 0 ? (
								available.map((order) => (
									<OrderCard key={order.id} order={order} type="available" />
								))
							) : (
								<EmptyState type="available" />
							)}
						</>
					)}

					{activeTab === "pickup" && (
						<>
							{inProgress.length > 0 ? (
								inProgress.map((order) => (
									<OrderCard key={order.id} order={order} type="pickup" />
								))
							) : (
								<EmptyState type="pickup" />
							)}
						</>
					)}

					{activeTab === "delivering" && (
						<>
							{outForDelivery.length > 0 ? (
								outForDelivery.map((order) => (
									<OrderCard key={order.id} order={order} type="delivering" />
								))
							) : (
								<EmptyState type="delivering" />
							)}
						</>
					)}

					{activeTab === "completed" && (
						<>
							{completedOrders.length > 0 ? (
								completedOrders.map((order) => (
									<OrderCard key={order.id} order={order} type="completed" />
								))
							) : (
								<EmptyState type="completed" />
							)}
						</>
					)}
				</div>
			</main>

			<Footer />

			{/* Order Details Modal */}
			{isModalOpen && selectedOrder && <OrderDetailsModal />}
		</div>
	);
}
