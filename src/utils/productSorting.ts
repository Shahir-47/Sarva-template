// src/utils/productSorting.ts
import { InventoryItem } from "@/firebase/inventory";
import { Vendor } from "@/components/customer/VendorListingSection";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@/firebase/config";

// Sort by sold units (popularity)
export const sortByPopularity = (items: InventoryItem[]): InventoryItem[] => {
	return [...items].sort((a, b) => {
		// Use the soldUnits field to determine popularity
		const aSold = a.soldUnits || 0;
		const bSold = b.soldUnits || 0;
		return bSold - aSold;
	});
};

// Calculate distance between two points using Haversine formula
export const haversineDistance = (
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number
): number => {
	const R = 6371; // Radius of the earth in km
	const dLat = deg2rad(lat2 - lat1);
	const dLon = deg2rad(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(deg2rad(lat1)) *
			Math.cos(deg2rad(lat2)) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	const distance = R * c; // Distance in km
	return distance;
};

const deg2rad = (deg: number): number => {
	return deg * (Math.PI / 180);
};

// Get stored user coordinates from Firestore
export const getStoredUserCoordinates = async (
	userID: string
): Promise<{ lat: number; lon: number }> => {
	try {
		const userDoc = await getDoc(doc(db, "users", userID));

		if (userDoc.exists() && userDoc.data().coordinates) {
			const coordinates = userDoc.data().coordinates;
			return {
				lat: coordinates.latitude,
				lon: coordinates.longitude,
			};
		} else {
			// Default to Carlisle coordinates if no user coordinates found
			return { lat: 40.20281155, lon: -77.19957404 };
		}
	} catch (error) {
		console.error("Error fetching stored user coordinates:", error);
		// Default to Carlisle coordinates on error
		return { lat: 40.20281155, lon: -77.19957404 };
	}
};

// Calculate distances to all vendors and return sorted vendors
export const getVendorsByDistance = (
	vendors: Vendor[],
	userCoordinates: { lat: number; lon: number }
): { vendors: Vendor[]; distances: Record<string, number> } => {
	// Create a map of vendor IDs to distances
	const vendorDistances: Record<string, number> = {};

	// Calculate distances for each vendor
	vendors.forEach((vendor) => {
		if (vendor.coordinates) {
			const distance = haversineDistance(
				userCoordinates.lat,
				userCoordinates.lon,
				parseFloat(vendor.coordinates.latitude.toString()),
				parseFloat(vendor.coordinates.longitude.toString())
			);
			vendorDistances[vendor.uid] = distance;
		} else {
			// If vendor has no coordinates, assign a very large distance
			vendorDistances[vendor.uid] = 9999;
		}
	});

	// Sort vendors by distance
	const sortedVendors = [...vendors].sort((a, b) => {
		return (vendorDistances[a.uid] || 9999) - (vendorDistances[b.uid] || 9999);
	});

	return { vendors: sortedVendors, distances: vendorDistances };
};

// Filter items by vendor and sort by distance
export const getItemsByProximity = (
	items: InventoryItem[],
	vendorDistances: Record<string, number>
): InventoryItem[] => {
	return [...items].sort((a, b) => {
		const aDistance = vendorDistances[a.vendorID] || 9999;
		const bDistance = vendorDistances[b.vendorID] || 9999;
		return aDistance - bDistance;
	});
};

// Sort by creation date (newest first)
export const sortByNewest = (items: InventoryItem[]): InventoryItem[] => {
	return [...items].sort((a, b) => {
		if (!a.created_at && !b.created_at) return 0;
		if (!a.created_at) return 1;
		if (!b.created_at) return -1;

		// Sort by timestamp, newest first
		return b.created_at.seconds - a.created_at.seconds;
	});
};

// Filter for items on sale
export const filterOnSale = (items: InventoryItem[]): InventoryItem[] => {
	return items.filter((item) => {
		// Check if any tag includes sale-related keywords
		const saleKeywords = [
			"sale",
			"discount",
			"promo",
			"deal",
			"offer",
			"special",
		];

		return (
			item.tags &&
			item.tags.some((tag) =>
				saleKeywords.some((keyword) => tag.toLowerCase().includes(keyword))
			)
		);
	});
};

// Deprecated: Keep this for backward compatibility but don't use in new code
export const getUserLocation = (): Promise<{ lat: number; lon: number }> => {
	console.warn(
		"getUserLocation is deprecated. Use getStoredUserCoordinates instead."
	);
	// Return the default coordinates for Carlisle, PA
	return Promise.resolve({ lat: 40.20281155, lon: -77.19957404 });
};
