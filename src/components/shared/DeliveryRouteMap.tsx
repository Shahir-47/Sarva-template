// src/components/shared/DeliveryRouteMap.tsx
import React, { useEffect, useState } from "react";
import { GeoPoint } from "firebase/firestore";

interface DeliveryRouteMapProps {
	// Source location (vendor/store)
	sourceAddress?: string;
	sourceCoordinates?: GeoPoint | { latitude: number; longitude: number };

	// Destination location (customer)
	destinationCoordinates?: GeoPoint | { latitude: number; longitude: number };
	destinationAddress?: string;

	height?: string;
	className?: string;
}

// Helper function to extract lat/lng from GeoPoint or coordinate object
const extractCoordinates = (
	coordinates?: GeoPoint | { latitude: number; longitude: number }
): { lat: number; lng: number } | null => {
	if (!coordinates) return null;

	// Check if it's a GeoPoint (Firebase)
	if ("latitude" in coordinates && "longitude" in coordinates) {
		return {
			lat: coordinates.latitude,
			lng: coordinates.longitude,
		};
	}

	return null;
};

interface RouteData {
	polyline: string;
	bounds: {
		northeast: { lat: number; lng: number };
		southwest: { lat: number; lng: number };
	};
	distance: { text: string; value: number };
	duration: { text: string; value: number };
	staticMapUrl: string; // Static map URL generated on the server
}

const DeliveryRouteMap: React.FC<DeliveryRouteMapProps> = ({
	sourceAddress,
	sourceCoordinates,
	destinationAddress,
	destinationCoordinates,
	height = "360px",
	className = "",
}) => {
	const [mapUrl, setMapUrl] = useState<string>("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState<boolean>(true);
	const [routeInfo, setRouteInfo] = useState<{
		distance: string;
		duration: string;
	} | null>(null);

	useEffect(() => {
		const fetchRouteAndCreateMap = async () => {
			setLoading(true);
			setError(null);

			try {
				// Extract coordinates
				const sourceCoords = extractCoordinates(sourceCoordinates);
				const destCoords = extractCoordinates(destinationCoordinates);

				// If we don't have coordinates, we can't generate a map
				if (!sourceCoords || !destCoords) {
					if (!sourceAddress || !destinationAddress) {
						throw new Error(
							"Insufficient location data to generate a route map"
						);
					}

					setError("Could not display map: coordinates unavailable");
					setMapUrl(""); // Ensure mapUrl is empty to avoid rendering issues
					setLoading(false);
					return;
				}

				// Format coordinates for API requests
				const origin = `${sourceCoords.lat},${sourceCoords.lng}`;
				const destination = `${destCoords.lat},${destCoords.lng}`;

				// Get the numerical height (remove 'px' if present)
				const numericHeight = parseInt(height.replace("px", ""), 10) || 150;
				// Calculate width based on a 2:1 aspect ratio
				const width = Math.round(numericHeight * 2);

				// Calculate scale factor for higher resolution (2x)
				const scale = 2; // Retina/high-res display support

				// Call our server API endpoint to fetch the route data and map URL
				// All Google Maps API calls happen on the server
				const response = await fetch(
					`/api/directions?origin=${encodeURIComponent(
						origin
					)}&destination=${encodeURIComponent(
						destination
					)}&width=${width}&height=${numericHeight}&scale=${scale}`
				);

				if (!response.ok) {
					const errorData = await response.json();
					throw new Error(errorData.error || "Failed to fetch route data");
				}

				const routeData: RouteData = await response.json();

				// Validate the returned map URL to avoid rendering issues
				if (!routeData.staticMapUrl) {
					throw new Error("Invalid route data: missing map URL");
				}

				// Store route info for display
				if (routeData.distance && routeData.duration) {
					setRouteInfo({
						distance: routeData.distance.text,
						duration: routeData.duration.text,
					});
				}

				// Use the map URL generated on the server
				setMapUrl(routeData.staticMapUrl);
				setLoading(false);
			} catch (err) {
				console.error("Error generating route map:", err);

				// Fallback to a simple map without route
				try {
					const sourceCoords = extractCoordinates(sourceCoordinates);
					const destCoords = extractCoordinates(destinationCoordinates);

					if (!sourceCoords || !destCoords) {
						throw new Error("Missing coordinates");
					}

					const origin = `${sourceCoords.lat},${sourceCoords.lng}`;
					const destination = `${destCoords.lat},${destCoords.lng}`;

					// Get the numerical height
					const numericHeight = parseInt(height.replace("px", ""), 10) || 150;
					// Calculate width based on a 2:1 aspect ratio
					const width = Math.round(numericHeight * 2);

					// Higher resolution for sharper images
					const scale = 2;

					// Call our fallback map API endpoint
					// All Google Maps API calls happen on the server
					const fallbackResponse = await fetch(
						`/api/map-fallback?origin=${encodeURIComponent(
							origin
						)}&destination=${encodeURIComponent(
							destination
						)}&width=${width}&height=${numericHeight}&scale=${scale}`
					);

					if (!fallbackResponse.ok) {
						throw new Error("Failed to get fallback map");
					}

					const fallbackData = await fallbackResponse.json();
					setMapUrl(fallbackData.staticMapUrl);
					setError(
						"Showing locations only (no route): " + (err as Error).message
					);
					setLoading(false);
				} catch (fallbackErr) {
					setError("Could not display map: " + (fallbackErr as Error).message);
					setLoading(false);
				}
			}
		};

		fetchRouteAndCreateMap();
	}, [
		sourceAddress,
		sourceCoordinates,
		destinationAddress,
		destinationCoordinates,
		height,
	]);

	// Show loading state
	if (loading) {
		return (
			<div
				className={`bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center ${className}`}
				style={{ height }}
			>
				<div className="flex flex-col items-center text-gray-500">
					<div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
					<p>Loading map...</p>
				</div>
			</div>
		);
	}

	// Show error state
	if (error && mapUrl === "") {
		return (
			<div
				className={`bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center ${className}`}
				style={{ height }}
			>
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
					<p className="text-gray-500">{error || "Route map unavailable"}</p>
					<p className="text-sm text-gray-500 mt-1">
						{sourceAddress ? sourceAddress.substring(0, 30) : "Unknown source"}{" "}
						→
						{destinationAddress
							? destinationAddress.substring(0, 30)
							: "Unknown destination"}
					</p>
				</div>
			</div>
		);
	}

	// Show the map
	return (
		<div
			className={`rounded-lg overflow-hidden relative ${className}`}
			style={{ height }}
		>
			{mapUrl && (
				<img
					src={mapUrl}
					alt="Delivery route map"
					className="w-full h-full object-cover"
				/>
			)}
			{error && (
				<div className="absolute top-0 left-0 right-0 bg-yellow-500 bg-opacity-80 p-1 text-xs text-white">
					{error}
				</div>
			)}
			<div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2 text-white text-xs">
				<div className="flex justify-between items-center">
					<p className="text-xs opacity-90">
						{sourceAddress && destinationAddress
							? `${sourceAddress.substring(
									0,
									40
							  )}...→ ${destinationAddress.substring(0, 40)}...`
							: "Delivery Route"}
					</p>
					{routeInfo && (
						<div className="text-xs font-semibold">
							{routeInfo.distance} · {routeInfo.duration}
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default DeliveryRouteMap;
