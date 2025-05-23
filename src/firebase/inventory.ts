// src/firebase/inventory.ts
import {
	doc,
	collection,
	addDoc,
	updateDoc,
	deleteDoc,
	getDoc,
	getDocs,
	query,
	where,
	Timestamp,
} from "firebase/firestore";
import { db } from "./config";
import {
	addItemToVendorInventory,
	removeItemFromVendorInventory,
} from "./vendorAuth";

// Interface for inventory item
export interface InventoryItem {
	itemID?: string;
	name: string;
	description: string;
	price: number;
	cost: number;
	units: number;
	vendorID: string;
	image: string;
	tags: string[];
	soldUnits?: number;
	barcode?: string | null;
	created_at?: Timestamp;
	updated_at?: Timestamp;
}

// Add a new item to the inventory
export const addItemToInventory = async (
	itemData: InventoryItem
): Promise<{ success: boolean; itemID?: string; error?: string }> => {
	try {
		// Add timestamp fields
		const itemWithTimestamps = {
			...itemData,
			soldUnits: itemData.soldUnits || 0,
			created_at: Timestamp.now(),
			updated_at: Timestamp.now(),
		};

		// Add to inventory collection
		const docRef = await addDoc(
			collection(db, "inventory"),
			itemWithTimestamps
		);

		// Get the generated document ID
		const itemID = docRef.id;

		// Update the document with its own ID
		await updateDoc(docRef, { itemID });

		// Add the item ID to the vendor's inventory list
		const addToVendorResult = await addItemToVendorInventory(itemID);

		if (!addToVendorResult.success) {
			return {
				success: false,
				error: `Item created but failed to add to vendor inventory: ${addToVendorResult.error}`,
			};
		}

		return { success: true, itemID };
	} catch (error) {
		console.error("Error adding item to inventory:", error);
		return { success: false, error: (error as Error).message };
	}
};

// Get an item by ID
export const getInventoryItem = async (
	itemID: string
): Promise<{ success: boolean; data?: InventoryItem; error?: string }> => {
	try {
		const itemRef = doc(db, "inventory", itemID);
		const itemDoc = await getDoc(itemRef);

		if (itemDoc.exists()) {
			return { success: true, data: itemDoc.data() as InventoryItem };
		} else {
			return { success: false, error: "Item not found" };
		}
	} catch (error) {
		console.error("Error getting inventory item:", error);
		return { success: false, error: (error as Error).message };
	}
};

// Get all items for a vendor
export const getVendorInventoryItems = async (
	vendorID: string
): Promise<{ success: boolean; data?: InventoryItem[]; error?: string }> => {
	try {
		const inventoryRef = collection(db, "inventory");
		const q = query(inventoryRef, where("vendorID", "==", vendorID));
		const querySnapshot = await getDocs(q);

		const items: InventoryItem[] = [];
		querySnapshot.forEach((doc) => {
			items.push(doc.data() as InventoryItem);
		});

		return { success: true, data: items };
	} catch (error) {
		console.error("Error getting vendor inventory items:", error);
		return { success: false, error: (error as Error).message };
	}
};

// Get all items
// This will need to have some sort of location filter in the future
export const getInventoryItems = async (): Promise<{
	success: boolean;
	data?: InventoryItem[];
	error?: string;
}> => {
	try {
		const inventoryRef = collection(db, "inventory");
		const q = query(inventoryRef);
		const querySnapshot = await getDocs(q);

		const items: InventoryItem[] = [];
		querySnapshot.forEach((doc) => {
			items.push(doc.data() as InventoryItem);
		});

		return { success: true, data: items };
	} catch (error) {
		console.error("Error getting all inventory items:", error);
		return { success: false, error: (error as Error).message };
	}
};

// Update an inventory item
export const updateInventoryItem = async (
	itemID: string,
	updates: Partial<InventoryItem>
): Promise<{ success: boolean; error?: string }> => {
	try {
		// Add updated timestamp
		const updatesWithTimestamp = {
			...updates,
			updated_at: Timestamp.now(),
		};

		const itemRef = doc(db, "inventory", itemID);
		await updateDoc(itemRef, updatesWithTimestamp);

		return { success: true };
	} catch (error) {
		console.error("Error updating inventory item:", error);
		return { success: false, error: (error as Error).message };
	}
};

// Delete an inventory item
export const deleteInventoryItem = async (
	itemID: string,
	vendorID: string
): Promise<{ success: boolean; error?: string }> => {
	try {
		// First, verify that the item belongs to this vendor
		const itemRef = doc(db, "inventory", itemID);
		const itemDoc = await getDoc(itemRef);

		if (!itemDoc.exists()) {
			return { success: false, error: "Item not found" };
		}

		const itemData = itemDoc.data() as InventoryItem;
		if (itemData.vendorID !== vendorID) {
			return {
				success: false,
				error: "You don't have permission to delete this item",
			};
		}

		// Remove from inventory collection
		await deleteDoc(itemRef);

		// Remove the item ID from the vendor's inventory list
		await removeItemFromVendorInventory(itemID);

		return { success: true };
	} catch (error) {
		console.error("Error deleting inventory item:", error);
		return { success: false, error: (error as Error).message };
	}
};
