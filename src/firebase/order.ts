// src/firebase/order.ts
import {
	collection,
	addDoc,
	updateDoc,
	getDoc,
	getDocs,
	doc,
	query,
	where,
	orderBy,
	Timestamp,
} from "firebase/firestore";
import { db } from "./config";
import { addOrderToUser } from "./auth";

// Order item interface
export interface OrderItem {
	itemID: string;
	name: string;
	quantity: number;
	price: number;
}

// Order amounts interface
export interface OrderAmounts {
	subtotal: number;
	tax: number;
	serviceFee: number;
	deliveryFee: number;
	total: number;
}

// Order status enum
export enum OrderStatus {
	PENDING = "pending_payment",
	PREPARING = "preparing",
	AWAITING_DRIVER = "waiting for a driver to be assigned",
	PICKING_UP = "driver coming to pickup",
	DELIVERING = "driver delivering",
	DELIVERED = "delivered",
	CANCELLED = "cancelled",
}

// Order interface
export interface Order {
	lineItems: never[];
	vendorName: string;
	id?: string;
	customerID: string;
	vendorID: string;
	items: OrderItem[];
	status: OrderStatus;
	amount: OrderAmounts;
	created_at: Date | Timestamp;
	updated_at: Date | Timestamp;
	estimated_delivery: Date | Timestamp;
	driverID: string | null;
	customer_address: string;
	payment_method: string;
	special_instructions?: string;
	cancelled_reason: React.JSX.Element;
	cancelled_at: { seconds: number; nanoseconds: number } | null;
	payment_status: React.JSX.Element;
}

// Create a new order
export const createOrder = async (
	orderData: Order
): Promise<{ success: boolean; orderID?: string; error?: string }> => {
	try {
		// Convert JavaScript Date objects to Firestore Timestamps
		const formattedOrderData = {
			...orderData,
			created_at: Timestamp.fromDate(
				orderData.created_at instanceof Date
					? orderData.created_at
					: orderData.created_at.toDate()
			),
			updated_at: Timestamp.fromDate(
				orderData.updated_at instanceof Date
					? orderData.updated_at
					: orderData.updated_at.toDate()
			),
			estimated_delivery: Timestamp.fromDate(
				orderData.estimated_delivery instanceof Date
					? orderData.estimated_delivery
					: orderData.estimated_delivery.toDate()
			),
		};

		// Add order to Firestore
		const docRef = await addDoc(collection(db, "orders"), formattedOrderData);
		const orderID = docRef.id;

		// Update the document with its own ID
		await updateDoc(docRef, { id: orderID });

		// Add order ID to customer's orders list
		const addToUserResult = await addOrderToUser(orderID);
		if (!addToUserResult.success) {
			console.warn(
				`Added order but failed to update customer's order list: ${addToUserResult.error}`
			);
		}

		// Add order ID to vendor's orders list
		const vendorOrderResult = await addOrderToVendor(
			orderID,
			orderData.vendorID
		);
		if (!vendorOrderResult.success) {
			console.warn(
				`Added order but failed to update vendor's order list: ${vendorOrderResult.error}`
			);
		}

		return { success: true, orderID };
	} catch (error) {
		console.error("Error creating order:", error);
		return { success: false, error: (error as Error).message };
	}
};

// Add order ID to vendor's orders list
export const addOrderToVendor = async (
	orderId: string,
	vendorID: string
): Promise<{ success: boolean; error?: string }> => {
	try {
		const vendorDocRef = doc(db, "vendors", vendorID);
		const vendorDoc = await getDoc(vendorDocRef);

		if (vendorDoc.exists()) {
			const vendorData = vendorDoc.data();
			// Initialize orders array if it doesn't exist
			const orders = vendorData.orders || [];

			// Only add if not already in the array
			if (!orders.includes(orderId)) {
				await updateDoc(vendorDocRef, {
					orders: [...orders, orderId],
					updated_at: Timestamp.now(),
				});
			}
		}

		return { success: true };
	} catch (error) {
		console.error("Error adding order to vendor:", error);
		return { success: false, error: (error as Error).message };
	}
};

// Get order by ID
export const getOrderById = async (
	orderId: string
): Promise<{ success: boolean; data?: Order; error?: string }> => {
	try {
		const orderDoc = await getDoc(doc(db, "orders", orderId));

		if (orderDoc.exists()) {
			return { success: true, data: orderDoc.data() as Order };
		} else {
			return { success: false, error: "Order not found" };
		}
	} catch (error) {
		console.error("Error getting order:", error);
		return { success: false, error: (error as Error).message };
	}
};

// Get all orders for a customer
export const getCustomerOrders = async (
	customerId: string
): Promise<{ success: boolean; data?: Order[]; error?: string }> => {
	try {
		const q = query(
			collection(db, "orders"),
			where("customerID", "==", customerId),
			orderBy("created_at", "desc")
		);

		const querySnapshot = await getDocs(q);
		const orders: Order[] = [];

		querySnapshot.forEach((doc) => {
			orders.push({ id: doc.id, ...doc.data() } as Order);
		});

		return { success: true, data: orders };
	} catch (error) {
		console.error("Error getting customer orders:", error);
		return { success: false, error: (error as Error).message };
	}
};

// Get all orders for a vendor
export const getVendorOrders = async (
	vendorID: string
): Promise<{ success: boolean; data?: Order[]; error?: string }> => {
	try {
		const q = query(
			collection(db, "orders"),
			where("vendorID", "==", vendorID),
			orderBy("created_at", "desc")
		);

		const querySnapshot = await getDocs(q);
		const orders: Order[] = [];

		querySnapshot.forEach((doc) => {
			orders.push({ id: doc.id, ...doc.data() } as Order);
		});

		return { success: true, data: orders };
	} catch (error) {
		console.error("Error getting vendor orders:", error);
		return { success: false, error: (error as Error).message };
	}
};

// Get all orders for a driver
export const getDriverOrders = async (
	driverId: string
): Promise<{ success: boolean; data?: Order[]; error?: string }> => {
	try {
		const q = query(
			collection(db, "orders"),
			where("driverID", "==", driverId),
			orderBy("created_at", "desc")
		);

		const querySnapshot = await getDocs(q);
		const orders: Order[] = [];

		querySnapshot.forEach((doc) => {
			orders.push({ id: doc.id, ...doc.data() } as Order);
		});

		return { success: true, data: orders };
	} catch (error) {
		console.error("Error getting driver orders:", error);
		return { success: false, error: (error as Error).message };
	}
};

// Update order status
export const updateOrderStatus = async (
	orderId: string,
	status: OrderStatus
): Promise<{ success: boolean; error?: string }> => {
	try {
		const orderRef = doc(db, "orders", orderId);
		await updateDoc(orderRef, {
			status,
			updated_at: Timestamp.now(),
		});

		return { success: true };
	} catch (error) {
		console.error("Error updating order status:", error);
		return { success: false, error: (error as Error).message };
	}
};

// Assign driver to order
export const assignDriverToOrder = async (
	orderId: string,
	driverId: string
): Promise<{ success: boolean; error?: string }> => {
	try {
		const orderRef = doc(db, "orders", orderId);
		await updateDoc(orderRef, {
			driverID: driverId,
			status: OrderStatus.PICKING_UP,
			updated_at: Timestamp.now(),
		});

		// Add order ID to driver's deliveries list
		const driverRef = doc(db, "drivers", driverId);
		const driverDoc = await getDoc(driverRef);

		if (driverDoc.exists()) {
			const driverData = driverDoc.data();
			const deliveries = driverData.deliveryIds || [];

			if (!deliveries.includes(orderId)) {
				await updateDoc(driverRef, {
					deliveryIds: [...deliveries, orderId],
					updated_at: Timestamp.now(),
				});
			}
		}

		return { success: true };
	} catch (error) {
		console.error("Error assigning driver to order:", error);
		return { success: false, error: (error as Error).message };
	}
};

// Get orders with a specific status (for system-wide queries)
export const getOrdersByStatus = async (
	status: OrderStatus
): Promise<{ success: boolean; data?: Order[]; error?: string }> => {
	try {
		const q = query(
			collection(db, "orders"),
			where("status", "==", status),
			orderBy("created_at", "desc")
		);

		const querySnapshot = await getDocs(q);
		const orders: Order[] = [];

		querySnapshot.forEach((doc) => {
			orders.push({ id: doc.id, ...doc.data() } as Order);
		});

		return { success: true, data: orders };
	} catch (error) {
		console.error("Error getting orders by status:", error);
		return { success: false, error: (error as Error).message };
	}
};
