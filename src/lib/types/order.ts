// src/lib/types/order.ts
export enum OrderStatus {
	PENDING = "pending_payment",
	PREPARING = "preparing",
	AWAITING_DRIVER = "waiting for a driver to be assigned",
	PICKING_UP = "driver coming to pickup",
	DELIVERING = "driver delivering",
	DELIVERED = "delivered",
	CANCELLED = "cancelled",
}
