// src/components/driver/OrderCard.tsx
import React from "react";
import { GeoPoint, Timestamp } from "firebase/firestore";

// Define common interfaces
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

interface EarnedAmount {
	deliveryFee: number;
	tip: number;
	total: number;
}

interface OrderDetails {
	items: LineItem[];
	subtotal: number;
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
	earned: EarnedAmount;
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

// Helper functions
const formatMinutes = (minutes: number | undefined): string => {
	if (!minutes) return "N/A";
	if (minutes < 60) return `${minutes} min`;

	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return `${hours}h ${remainingMinutes}m`;
};

const formatDistance = (distanceInKm: number | undefined): string => {
	if (!distanceInKm) return "N/A";
	return `${distanceInKm.toFixed(1)} km`;
};

const formatCurrency = (amount: number | undefined): string => {
	if (amount === undefined) return "$0.00";
	return `$${amount.toFixed(2)}`;
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
			accepted: "bg-blue-100 text-blue-800 border-blue-400",
			picked_up: "bg-indigo-100 text-indigo-800 border-indigo-400",
		};

		return statusColors[status] || "bg-gray-100 text-gray-800 border-gray-400";
	};

	const getReadableStatus = (status: string): string => {
		const statusMap: Record<string, string> = {
			"waiting for a driver to be assigned": "Needs Pickup",
			"driver coming to pickup": "En Route to Pickup",
			"driver delivering": "Out for Delivery",
			delivered: "Delivered",
			cancelled: "Cancelled",
			accepted: "Accepted",
			picked_up: "Picked Up",
		};

		return statusMap[status] || status;
	};

	return (
		<span
			className={`ml-3 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
				status
			)}`}
		>
			{getReadableStatus(status)}
		</span>
	);
};

// Component props
interface OrderCardProps {
	order: Order | DriverTransaction;
	type: "available" | "pickup" | "delivering" | "completed";
	busyOrder: string | null;
	onViewDetails: (order: Order | DriverTransaction) => void;
	onAccept?: (orderId: string) => Promise<void>;
	onPickUp?: (orderId: string) => Promise<void>;
	onDeliver?: (orderId: string) => Promise<void>;
}

// Main component
const OrderCard: React.FC<OrderCardProps> = ({
	order,
	type,
	busyOrder,
	onViewDetails,
	onAccept,
	onPickUp,
	onDeliver,
}) => {
	const isOrderType = (order: Order | DriverTransaction): order is Order => {
		return "status" in order && !("storeLocation" in order);
	};

	const isTransactionType = (
		order: Order | DriverTransaction
	): order is DriverTransaction => {
		return "storeLocation" in order;
	};

	// Extract data based on order type
	const orderId = isOrderType(order) ? order.id : order.orderId;
	const status = isOrderType(order) ? order.status : order.status;

	const vendorName = isOrderType(order) ? order.vendorName : order.vendorName;

	const customerName = isOrderType(order)
		? order.customerName
		: order.customerName;

	const vendorLocation = isOrderType(order)
		? order.vendorLocation
		: order.storeLocation.address;

	const customerLocation = isOrderType(order)
		? order.customerLocation
		: order.customerLocation.address;

	const deliveryInfo = isOrderType(order)
		? order.deliveryInfo
		: order.deliveryInfo;

	const lineItems = isOrderType(order)
		? order.lineItems
		: order.orderDetails.items;

	const totalAmount = isOrderType(order)
		? order.amount.total
		: order.orderDetails.total;

	const deliveryFee = isOrderType(order)
		? order.amount.deliveryFee
		: order.earned.deliveryFee;

	const tip = isOrderType(order) ? order.amount.tip : order.earned.tip;

	const earnings = deliveryFee + tip;

	// Format address to be more readable
	const formatAddress = (address: string): string => {
		return address.length > 35 ? address.substring(0, 35) + "..." : address;
	};

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
					<div className="text-lg font-bold">{formatCurrency(totalAmount)}</div>
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
								<span className="font-medium">Items:</span> {lineItems.length}
							</p>
							{isTransactionType(order) && order.totalDuration && (
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
						onClick={() => onViewDetails(order)}
					>
						View Details
					</button>

					{type === "available" && isOrderType(order) && onAccept && (
						<button
							className="flex-1 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
							disabled={busyOrder === order.id}
							onClick={() => onAccept(order.id)}
						>
							{busyOrder === order.id ? "Accepting..." : "Accept"}
						</button>
					)}

					{type === "pickup" && isOrderType(order) && onPickUp && (
						<button
							className="flex-1 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
							disabled={busyOrder === order.id}
							onClick={() => onPickUp(order.id)}
						>
							{busyOrder === order.id ? "Processing..." : "Picked Up"}
						</button>
					)}

					{type === "delivering" && isOrderType(order) && onDeliver && (
						<button
							className="flex-1 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
							disabled={busyOrder === order.id}
							onClick={() => onDeliver(order.id)}
						>
							{busyOrder === order.id ? "Completing..." : "Delivered"}
						</button>
					)}
				</div>
			</div>
		</div>
	);
};

export default OrderCard;
