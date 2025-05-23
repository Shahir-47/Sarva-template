// src/services/deliveryService.ts
import { GeoPoint } from "firebase/firestore";
import {
	calculateRoadDistance,
	geoPointToCoordinates,
	calculateDeliveryFee,
	calculateEstimatedDeliveryTime,
} from "./distanceService";
import {
	formatTimeFromMinutes,
	kilometersToMiles,
} from "@/utils/formatHelpers";

// Define tip options
export interface TipOption {
	id: string;
	label: string;
	value: number | null; // null for custom tip
	type: "percentage" | "fixed" | "none" | "custom";
}

// Standard tip options
export const DEFAULT_TIP_OPTIONS: TipOption[] = [
	{ id: "none", label: "No Tip", value: 0, type: "none" },
	{ id: "tip_10", label: "10%", value: 0.1, type: "percentage" },
	{ id: "tip_15", label: "15%", value: 0.15, type: "percentage" },
	{ id: "tip_20", label: "20%", value: 0.2, type: "percentage" },
	{ id: "tip_25", label: "25%", value: 0.25, type: "percentage" },
	{ id: "custom", label: "Custom", value: null, type: "custom" },
];

// Calculate tip amount based on selected option and subtotal
export const calculateTipAmount = (
	tipOption: TipOption,
	subtotal: number,
	customTipAmount?: number
): number => {
	if (tipOption.type === "none") {
		return 0;
	}

	if (tipOption.type === "custom" && customTipAmount !== undefined) {
		return customTipAmount;
	}

	if (tipOption.type === "percentage" && tipOption.value !== null) {
		return +(subtotal * tipOption.value).toFixed(2);
	}

	if (tipOption.type === "fixed" && tipOption.value !== null) {
		return tipOption.value;
	}

	return 0;
};

// Enhanced delivery info that includes distance-based calculations and tips
export interface DeliveryInfo {
	deliveryFee: number;
	estimatedTime: number;
	distance: number;
	distanceInKm: number;
	distanceInMiles: number;
	timeFormatted: string;
	tipAmount: number;
	success: boolean;
}

/**
 * Get enhanced delivery information that includes distance-based calculations and tips
 * Now using the secure Next.js API endpoint for API calls
 */
export const getEnhancedDeliveryInfo = async (
	customerCoordinates: GeoPoint,
	vendorCoordinates: GeoPoint,
	tipOption: TipOption = DEFAULT_TIP_OPTIONS[0], // Default to 'No Tip'
	customTipAmount: number = 0,
	subtotal: number = 0,
	baseDeliveryFee: number = 5,
	preparationTime: number = 15
): Promise<DeliveryInfo> => {
	try {
		// Convert GeoPoints to Coordinates
		const customerCoords = geoPointToCoordinates(customerCoordinates);
		const vendorCoords = geoPointToCoordinates(vendorCoordinates);

		console.log("Calculating distance between:", {
			customer: customerCoords,
			vendor: vendorCoords,
		});

		// Get road distance and duration using our secure API
		const routeInfo = await calculateRoadDistance(customerCoords, vendorCoords);

		if (!routeInfo.success) {
			console.warn("Failed to calculate route, using fallback");
			throw new Error("Failed to calculate route");
		}

		// Calculate delivery fee based on actual distance
		const deliveryFee = calculateDeliveryFee(
			routeInfo.distance,
			baseDeliveryFee
		);

		// Calculate estimated delivery time
		const estimatedTime = calculateEstimatedDeliveryTime(
			routeInfo.duration,
			preparationTime
		);

		// Calculate tip amount
		const tipAmount = calculateTipAmount(tipOption, subtotal, customTipAmount);
		const distanceInKm = routeInfo.distance / 1000;
		const distanceInMiles = kilometersToMiles(distanceInKm);
		const timeFormatted = formatTimeFromMinutes(estimatedTime);

		const deliveryInfo = {
			deliveryFee,
			estimatedTime,
			distance: routeInfo.distance,
			distanceInKm,
			distanceInMiles,
			timeFormatted,
			tipAmount,
			success: true,
		};

		return deliveryInfo;
	} catch (error) {
		console.error("Error getting enhanced delivery info:", error);

		// Calculate default tip amount even when distance calculation fails
		const tipAmount = calculateTipAmount(tipOption, subtotal, customTipAmount);

		// Fall back to straight-line calculation
		try {
			console.log("Attempting fallback to straight-line calculation");
			const fallbackInfo = getFallbackDeliveryInfo(
				customerCoordinates,
				vendorCoordinates,
				tipOption,
				customTipAmount,
				subtotal,
				baseDeliveryFee,
				preparationTime
			);
			return fallbackInfo;
		} catch (fallbackError) {
			console.error("Even fallback calculation failed:", fallbackError);

			// Last resort default values
			return {
				deliveryFee: baseDeliveryFee,
				estimatedTime: preparationTime + 30, // Default fallback
				distance: 0,
				distanceInKm: 0,
				distanceInMiles: 0,
				timeFormatted: formatTimeFromMinutes(preparationTime + 30),
				tipAmount,
				success: false,
			};
		}
	}
};

// Calculate straight-line distance between two points (fallback when API fails)
export const calculateStraightLineDistance = (
	point1: GeoPoint,
	point2: GeoPoint
): number => {
	const R = 6371e3; // Earth's radius in meters
	const φ1 = (point1.latitude * Math.PI) / 180;
	const φ2 = (point2.latitude * Math.PI) / 180;
	const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
	const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

	const a =
		Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
		Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	const distance = R * c; // Distance in meters

	return distance;
};

// Get fallback delivery information using straight-line calculation
export const getFallbackDeliveryInfo = (
	customerCoordinates: GeoPoint,
	vendorCoordinates: GeoPoint,
	tipOption: TipOption = DEFAULT_TIP_OPTIONS[0],
	customTipAmount: number = 0,
	subtotal: number = 0,
	baseDeliveryFee: number = 5,
	preparationTime: number = 15
): DeliveryInfo => {
	try {
		console.log("Using fallback straight-line distance calculation");

		// Calculate straight-line distance (as fallback)
		const straightLineDistance = calculateStraightLineDistance(
			customerCoordinates,
			vendorCoordinates
		);

		console.log("Straight-line distance:", straightLineDistance, "meters");

		// Calculate delivery fee based on straight-line distance
		const deliveryFee = calculateDeliveryFee(
			straightLineDistance,
			baseDeliveryFee
		);

		// Estimate driving time based on straight-line distance
		// Assuming average speed of 30 km/h in urban areas
		const estimatedDrivingTime = (straightLineDistance / 1000 / 30) * 60 * 60; // seconds

		// Calculate estimated delivery time
		const estimatedTime = calculateEstimatedDeliveryTime(
			estimatedDrivingTime,
			preparationTime
		);

		// Calculate tip amount
		const tipAmount = calculateTipAmount(tipOption, subtotal, customTipAmount);
		const distanceInKm = straightLineDistance / 1000;
		const distanceInMiles = kilometersToMiles(distanceInKm);
		const timeFormatted = formatTimeFromMinutes(estimatedTime);

		const fallbackInfo = {
			deliveryFee,
			estimatedTime,
			distance: straightLineDistance,
			distanceInKm,
			distanceInMiles,
			timeFormatted,
			tipAmount,
			success: true,
		};

		return fallbackInfo;
	} catch (error) {
		console.error("Error getting fallback delivery info:", error);

		// Calculate tip amount even when distance calculation fails
		const tipAmount = calculateTipAmount(tipOption, subtotal, customTipAmount);

		return {
			deliveryFee: baseDeliveryFee,
			estimatedTime: preparationTime + 30, // Default fallback
			distance: 0,
			distanceInKm: 0,
			distanceInMiles: 0,
			timeFormatted: formatTimeFromMinutes(preparationTime + 30),
			tipAmount,
			success: false,
		};
	}
};
