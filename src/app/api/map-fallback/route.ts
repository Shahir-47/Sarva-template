// src/app/api/map-fallback/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	try {
		// Get query parameters
		const searchParams = request.nextUrl.searchParams;
		const origin = searchParams.get("origin");
		const destination = searchParams.get("destination");

		// Get dimensions
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

		// Get Google Maps API key from environment (NOT exposed to client)
		const apiKey = process.env.GOOGLE_MAPS_API_KEY;

		if (!apiKey) {
			return NextResponse.json(
				{ error: "Google Maps API key is not configured" },
				{ status: 500 }
			);
		}

		// Generate static map URL with the API key on the server
		// Using the 'visible' parameter to ensure both markers are in view
		const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=${width}x${height}&scale=${scale}&maptype=roadmap&markers=color:blue%7Clabel:A%7C${origin}&markers=color:red%7Clabel:B%7C${destination}&visible=${origin}|${destination}&key=${apiKey}`;

		return NextResponse.json({
			staticMapUrl,
		});
	} catch (error) {
		console.error("Error generating fallback map:", error);
		return NextResponse.json(
			{ error: "Failed to generate fallback map" },
			{ status: 500 }
		);
	}
}
