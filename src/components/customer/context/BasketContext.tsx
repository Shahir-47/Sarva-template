import React, { createContext, useContext, useEffect, useState } from "react";
import { InventoryItem } from "@/firebase/inventory";

export interface BasketItem {
	item: InventoryItem;
	quantity: number;
}

interface BasketContextType {
	basket: BasketItem[];
	baskets: Record<string, BasketItem[]>;
	activePaymentVendorId: string | null; // Added to track which vendor's payment form is active
	setActivePaymentVendorId: (vendorId: string | null) => void; // Method to set active payment vendor
	getTotalCount: () => number;
	getVendorItemCount: (vendorID: string) => number;
	getItemCount: (item: InventoryItem) => number;
	getVendorPrice: (vendorID: string) => number;
	getTotalPrice: () => number;
	getVendorCount: () => number;
	updateBasket: (
		item: InventoryItem,
		quantity: number,
		vendor?: { id: string; name: string }
	) => void;
	removeFromBasket: (item: InventoryItem) => void;
	clearFromBasket: (item: InventoryItem) => void;
	clearVendorBasket: (vendorID: string) => void;
	clearAllBaskets: () => void;
	fetchBaskets: () => Record<string, BasketItem[]>;
}

const BasketContext = createContext<BasketContextType | undefined>(undefined);

export const BasketProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const [baskets, setBaskets] = useState<Record<string, BasketItem[]>>({});
	const [activePaymentVendorId, setActivePaymentVendorId] = useState<
		string | null
	>(null);

	useEffect(() => {
		const loadBaskets = async () => {
			const fetchedBaskets = await fetchBasketsAsync();
			setBaskets(fetchedBaskets);
		};

		loadBaskets();
	}, []);

	useEffect(() => {
		const handleStorage = (e: StorageEvent) => {
			if (e.key === "customerBaskets") {
				const updated = localStorage.getItem("customerBaskets");
				setBaskets(updated ? JSON.parse(updated) : {});
			}
		};
		window.addEventListener("storage", handleStorage);
		return () => window.removeEventListener("storage", handleStorage);
	}, []);

	const fetchBaskets = () => {
		const stored = localStorage.getItem("customerBaskets");
		const parsed = stored ? JSON.parse(stored) : {};
		setBaskets(parsed);
		return parsed;
	};

	const fetchBasketsAsync = async (): Promise<Record<string, BasketItem[]>> => {
		const stored = localStorage.getItem("customerBaskets");
		const parsed = stored ? JSON.parse(stored) : {};
		return parsed;
	};

	const updateBasket = (item: InventoryItem, quantity: number) => {
		if (!item) {
			console.error("Error: Item is undefined");
			return;
		}

		setBaskets((prevBaskets) => {
			const vendorId = item.vendorID;
			if (!vendorId) {
				console.error("Error: Item has no vendorID");
				return prevBaskets;
			}

			const existingBasket = prevBaskets[vendorId] || [];
			const itemIndex = existingBasket.findIndex(
				(b) => b.item.itemID === item.itemID
			);
			let updatedBasket = [...existingBasket];

			if (itemIndex !== -1) {
				// Item exists in basket
				if (quantity === 0) {
					// Remove item if quantity is 0
					updatedBasket = updatedBasket.filter(
						(b) => b.item.itemID !== item.itemID
					);
				} else if (quantity > 0 && (!item.units || quantity <= item.units)) {
					// Update quantity if within bounds
					updatedBasket[itemIndex] = {
						...updatedBasket[itemIndex],
						quantity: quantity,
					};
				} else {
					console.error("Error: Invalid quantity for existing item.");
					return prevBaskets;
				}
			} else {
				// New item to basket
				if (quantity > 0 && (!item.units || quantity <= item.units)) {
					updatedBasket = [...existingBasket, { item, quantity }];
				} else {
					console.error("Error: Invalid quantity for new item.");
					return prevBaskets;
				}
			}

			// If basket is empty after update, remove entire vendor entry
			const updatedBaskets = { ...prevBaskets };
			if (updatedBasket.length === 0) {
				delete updatedBaskets[vendorId];
			} else {
				updatedBaskets[vendorId] = updatedBasket;
			}

			localStorage.setItem("customerBaskets", JSON.stringify(updatedBaskets));
			return updatedBaskets;
		});
	};

	const clearFromBasket = (item: InventoryItem) => {
		if (!item || !item.vendorID) return;

		setBaskets((prevBaskets) => {
			const vendorId = item.vendorID;
			const existingBasket = prevBaskets[vendorId];

			if (!existingBasket) return prevBaskets;

			const updatedBasket = existingBasket.filter(
				(b) => b.item.itemID !== item.itemID
			);

			const updatedBaskets = { ...prevBaskets };
			if (updatedBasket.length === 0) {
				delete updatedBaskets[vendorId];
			} else {
				updatedBaskets[vendorId] = updatedBasket;
			}

			localStorage.setItem("customerBaskets", JSON.stringify(updatedBaskets));
			return updatedBaskets;
		});
	};

	const removeFromBasket = (item: InventoryItem) => {
		if (!item || !item.vendorID) return;

		setBaskets((prevBaskets) => {
			const vendorId = item.vendorID;
			const existingBasket = prevBaskets[vendorId];

			if (!existingBasket) return prevBaskets;

			const itemIndex = existingBasket.findIndex(
				(b) => b.item.itemID === item.itemID
			);
			if (itemIndex === -1) return prevBaskets;

			const updatedBasket = [...existingBasket];
			if (updatedBasket[itemIndex].quantity > 1) {
				updatedBasket[itemIndex].quantity -= 1;
			} else {
				updatedBasket.splice(itemIndex, 1);
			}

			const updatedBaskets = { ...prevBaskets };
			if (updatedBasket.length === 0) {
				delete updatedBaskets[vendorId];
			} else {
				updatedBaskets[vendorId] = updatedBasket;
			}

			localStorage.setItem("customerBaskets", JSON.stringify(updatedBaskets));
			return updatedBaskets;
		});
	};

	const clearVendorBasket = (vendorID: string) => {
		// If we're clearing this vendor's basket, also clear active payment if it's for this vendor
		if (activePaymentVendorId === vendorID) {
			setActivePaymentVendorId(null);
		}

		setBaskets((prevBaskets) => {
			const updatedBaskets = { ...prevBaskets };
			delete updatedBaskets[vendorID];
			localStorage.setItem("customerBaskets", JSON.stringify(updatedBaskets));
			return updatedBaskets;
		});
	};

	const clearAllBaskets = () => {
		setActivePaymentVendorId(null);
		setBaskets({});
		localStorage.setItem("customerBaskets", JSON.stringify({}));
	};

	const getItemCount = (item: InventoryItem): number => {
		if (!item || !item.vendorID) return 0;

		const vendorId = item.vendorID;
		const vendorBasket = baskets[vendorId];

		if (!vendorBasket) return 0;

		const foundItem = vendorBasket.find(
			(basketItem) => basketItem.item.itemID === item.itemID
		);

		return foundItem ? foundItem.quantity : 0;
	};

	const getTotalCount = () => {
		let totalItemCount = 0;
		for (const vendorId in baskets) {
			const vendorBasket = baskets[vendorId];
			totalItemCount += vendorBasket.reduce(
				(sum, item) => sum + item.quantity,
				0
			);
		}
		return totalItemCount;
	};

	const getTotalPrice = () => {
		let totalPrice = 0;
		for (const vendorId in baskets) {
			const vendorBasket = baskets[vendorId];
			totalPrice += vendorBasket.reduce(
				(sum, item) => sum + item.quantity * item.item.price,
				0
			);
		}
		return totalPrice;
	};

	const getVendorItemCount = (vendorID: string): number => {
		const vendorBasket = baskets[vendorID];
		if (!vendorBasket) return 0;

		return vendorBasket.reduce((sum, item) => sum + item.quantity, 0);
	};

	const getVendorPrice = (vendorID: string): number => {
		const vendorBasket = baskets[vendorID];
		if (!vendorBasket) return 0;

		return vendorBasket.reduce(
			(sum, item) => sum + item.item.price * item.quantity,
			0
		);
	};

	const getVendorCount = (): number => {
		return Object.keys(baskets).length;
	};

	return (
		<BasketContext.Provider
			value={{
				basket: Object.values(baskets).flat(),
				baskets,
				activePaymentVendorId,
				setActivePaymentVendorId,
				getTotalCount,
				getItemCount,
				getVendorCount,
				getVendorItemCount,
				getVendorPrice,
				getTotalPrice,
				updateBasket,
				removeFromBasket,
				clearFromBasket,
				clearVendorBasket,
				clearAllBaskets,
				fetchBaskets,
			}}
		>
			{children}
		</BasketContext.Provider>
	);
};

export const useBasket = (): BasketContextType => {
	const context = useContext(BasketContext);
	if (!context) {
		throw new Error("useBasket must be used within a BasketProvider");
	}
	return context;
};
