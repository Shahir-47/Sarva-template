// src/services/distanceService.ts
import { GeoPoint } from "firebase/firestore";

// Define types
interface Coordinates {
	lat: number | string;
	lon: number | string;
}

interface RouteInfo {
	distance: number; // in meters
	duration: number; // in seconds
	success: boolean;
}

/**
 * Calculate the road distance and duration between two coordinates
 * using our Next.js App Router API endpoint
 */
export const calculateRoadDistance = async (
	origin: Coordinates,
	destination: Coordinates
): Promise<RouteInfo> => {
	try {
		// Ensure coordinates are numbers
		const originCoords = {
			lat: typeof origin.lat === "string" ? parseFloat(origin.lat) : origin.lat,
			lon: typeof origin.lon === "string" ? parseFloat(origin.lon) : origin.lon,
		};

		const destCoords = {
			lat:
				typeof destination.lat === "string"
					? parseFloat(destination.lat)
					: destination.lat,
			lon:
				typeof destination.lon === "string"
					? parseFloat(destination.lon)
					: destination.lon,
		};

		// Use URL with query parameters
		const queryParams = new URLSearchParams({
			originLat: originCoords.lat.toString(),
			originLon: originCoords.lon.toString(),
			destLat: destCoords.lat.toString(),
			destLon: destCoords.lon.toString(),
		});

		// Make a call to our Next.js API endpoint
		const response = await fetch(
			`/api/distance-matrix?${queryParams.toString()}`
		);

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			console.error(
				"Distance matrix API error:",
				response.status,
				errorData.error
			);
			throw new Error(
				`Distance calculation error: ${errorData.error || response.status}`
			);
		}

		const data = await response.json();

		if (data.success) {
			return {
				distance: data.distance, // in meters
				duration: data.duration, // in seconds
				success: true,
			};
		} else {
			console.error("Invalid response from distance matrix API:", data);
			throw new Error("Failed to calculate distance");
		}
	} catch (error) {
		console.error("Error calculating road distance:", error);
		return {
			distance: 0,
			duration: 0,
			success: false,
		};
	}
};

/**
 * Helper function to convert Firebase GeoPoint to Coordinates
 */
export const geoPointToCoordinates = (geoPoint: GeoPoint): Coordinates => {
	return {
		lat: geoPoint.latitude,
		lon: geoPoint.longitude,
	};
};

/**
 * Calculate delivery fee based on distance, following industry-standard structure
 * This follows a similar pattern to how major food delivery services calculate fees
 */
export const calculateDeliveryFee = (
	distanceInMeters: number,
	baseDeliveryFee: number = 5,
	minDeliveryFee: number = 5
): number => {
	// If no distance data available, return base fee
	if (!distanceInMeters || distanceInMeters <= 0) {
		return baseDeliveryFee;
	}

	// Convert meters to miles for calculation
	const distanceInMiles = (distanceInMeters / 1000) * 0.621371;

	// Calculate fee using tiered approach similar to DoorDash's model
	// Base fee covers first 3 miles
	let calculatedFee = baseDeliveryFee;

	// For distances beyond 3 miles, add per-mile charge
	if (distanceInMiles > 3) {
		// $1.25 per mile for miles 3-8
		const tier1Miles = Math.min(distanceInMiles - 3, 5);
		calculatedFee += tier1Miles * 1.25;

		// $1.00 per mile for miles 8-15
		if (distanceInMiles > 8) {
			const tier2Miles = Math.min(distanceInMiles - 8, 7);
			calculatedFee += tier2Miles * 1.0;

			// $0.75 per mile beyond 15 miles
			if (distanceInMiles > 15) {
				const tier3Miles = distanceInMiles - 15;
				calculatedFee += tier3Miles * 0.75;
			}
		}
	}

	// Round to nearest $0.25 for cleaner pricing
	calculatedFee = Math.ceil(calculatedFee * 4) / 4;

	// Ensure fee is at least the minimum
	return Math.max(calculatedFee, minDeliveryFee);
};

/**
 * Calculate estimated delivery time
 */
export const calculateEstimatedDeliveryTime = (
	durationInSeconds: number,
	preparationTime: number = 15, // Default food prep time in minutes
	additionalBuffer: number = 10 // Additional buffer time in minutes
): number => {
	// Convert seconds to minutes
	const drivingTimeInMinutes = Math.ceil(durationInSeconds / 60);

	// Total estimated delivery time in minutes
	return preparationTime + drivingTimeInMinutes + additionalBuffer;
};

/**
 * Mainfunction to get complete delivery information
 */
export const getDeliveryInfo = async (
	customerCoordinates: Coordinates,
	vendorCoordinates: Coordinates,
	baseDeliveryFee: number = 5,
	preparationTime: number = 15
): Promise<{
	deliveryFee: number;
	estimatedTime: number;
	distance: number;
	distanceInKm: number;
	success: boolean;
}> => {
	try {
		// Get road distance and duration
		const routeInfo = await calculateRoadDistance(
			customerCoordinates,
			vendorCoordinates
		);

		if (!routeInfo.success) {
			throw new Error("Failed to calculate route");
		}

		// Calculate delivery fee
		const deliveryFee = calculateDeliveryFee(
			routeInfo.distance,
			baseDeliveryFee
		);

		// Calculate estimated delivery time
		const estimatedTime = calculateEstimatedDeliveryTime(
			routeInfo.duration,
			preparationTime
		);

		return {
			deliveryFee,
			estimatedTime,
			distance: routeInfo.distance,
			distanceInKm: routeInfo.distance / 1000,
			success: true,
		};
	} catch (error) {
		console.error("Error getting delivery info:", error);
		return {
			deliveryFee: baseDeliveryFee,
			estimatedTime: preparationTime + 30, // Default fallback
			distance: 0,
			distanceInKm: 0,
			success: false,
		};
	}
};
