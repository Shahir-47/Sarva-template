// src/utils/formatHelpers.ts

/**
 * Format minutes into a human-readable time string (e.g., "1 hr 25 min")
 */
export const formatTimeFromMinutes = (minutes: number): string => {
	if (!minutes || minutes <= 0) return "0 min";

	const hours = Math.floor(minutes / 60);
	const remainingMinutes = Math.round(minutes % 60);

	if (hours === 0) {
		return `${remainingMinutes} min`;
	} else if (remainingMinutes === 0) {
		return hours === 1 ? `1 hr` : `${hours} hrs`;
	} else {
		return `${hours} hr${hours > 1 ? "s" : ""} ${remainingMinutes} min`;
	}
};

/**
 * Convert kilometers to miles and format with one decimal place
 */
export const kilometersToMiles = (kilometers: number): number => {
	return kilometers * 0.621371;
};

/**
 * Format distance in miles with proper rounding and unit
 */
export const formatDistanceInMiles = (kilometers: number): string => {
	if (!kilometers || kilometers <= 0) return "0 miles";

	const miles = kilometersToMiles(kilometers);

	// For very short distances
	if (miles < 0.1) {
		return "< 0.1 miles";
	}

	// For distances less than 10 miles, show one decimal place
	if (miles < 10) {
		return `${miles.toFixed(1)} miles`;
	}

	// For longer distances, round to whole number
	return `${Math.round(miles)} miles`;
};
