// src/app/api/directions/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	try {
		// Get query parameters
		const searchParams = request.nextUrl.searchParams;
		const origin = searchParams.get("origin");
		const destination = searchParams.get("destination");

		// Get map dimensions from query params
		const width = parseInt(searchParams.get("width") || "300", 10);
		const height = parseInt(searchParams.get("height") || "150", 10);
		const scale = parseInt(searchParams.get("scale") || "2", 10);

		// Validate inputs
		if (!origin || !destination) {
			return NextResponse.json(
				{ error: "Origin and destination parameters are required" },
				{ status: 400 }
			);
		}

		// Get Google Maps API key from environment
		const apiKey = process.env.GOOGLE_MAPS_API_KEY;

		if (!apiKey) {
			return NextResponse.json(
				{ error: "Google Maps API key is not configured" },
				{ status: 500 }
			);
		}

		// Call Google Directions API
		const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
			origin
		)}&destination=${encodeURIComponent(
			destination
		)}&mode=driving&key=${apiKey}`;

		const response = await fetch(directionsUrl);
		const data = await response.json();

		// Check for valid response
		if (!data.routes || data.routes.length === 0) {
			return NextResponse.json(
				{ error: "No route found", details: data.status },
				{ status: 404 }
			);
		}

		// Extract the route data
		const route = data.routes[0];
		const polyline = route.overview_polyline.points;

		// Generate static map URL on the server with the API key
		const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=${width}x${height}&scale=${scale}&maptype=roadmap&markers=color:blue%7Clabel:A%7C${origin}&markers=color:red%7Clabel:B%7C${destination}&path=enc:${polyline}&visible=${origin}|${destination}&key=${apiKey}`;

		// Return the route data and map URL
		return NextResponse.json({
			polyline,
			bounds: route.bounds,
			distance: route.legs[0].distance,
			duration: route.legs[0].duration,
			startAddress: route.legs[0].start_address,
			endAddress: route.legs[0].end_address,
			staticMapUrl, // Include the secure map URL
		});
	} catch (error) {
		console.error("Error fetching directions:", error);
		return NextResponse.json(
			{ error: "Failed to fetch directions" },
			{ status: 500 }
		);
	}
}
