// File: app/api/distance-matrix/route.ts
import { NextRequest, NextResponse } from "next/server";

// Response type
type ResponseData = {
	success: boolean;
	distance?: number;
	duration?: number;
	distanceInKm?: number;
	error?: string;
};

// This handler supports both GET and POST methods
export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;

	// Get parameters from query string
	const originLat = searchParams.get("originLat");
	const originLon = searchParams.get("originLon");
	const destLat = searchParams.get("destLat");
	const destLon = searchParams.get("destLon");

	// Validate parameters
	if (!originLat || !originLon || !destLat || !destLon) {
		return NextResponse.json(
			{
				success: false,
				error:
					"Missing coordinates. Please provide originLat, originLon, destLat, destLon",
			},
			{ status: 400 }
		);
	}

	try {
		// Parse coordinates
		const origin = {
			lat: parseFloat(originLat),
			lon: parseFloat(originLon),
		};

		const destination = {
			lat: parseFloat(destLat),
			lon: parseFloat(destLon),
		};

		return await handleDistanceCalculation(origin, destination);
	} catch (error) {
		console.error("Error in GET handler:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Failed to process request",
			},
			{ status: 500 }
		);
	}
}

export async function POST(request: NextRequest) {
	try {
		// Parse request body
		const body = await request.json();
		const { origin, destination } = body;

		// Validate data
		if (
			!origin?.lat ||
			!origin?.lon ||
			!destination?.lat ||
			!destination?.lon
		) {
			return NextResponse.json(
				{
					success: false,
					error:
						"Invalid coordinates. Please provide valid origin and destination objects with lat and lon properties.",
				},
				{ status: 400 }
			);
		}

		return await handleDistanceCalculation(origin, destination);
	} catch (error) {
		console.error("Error in POST handler:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Failed to process request",
			},
			{ status: 500 }
		);
	}
}

// Shared handler for both GET and POST
async function handleDistanceCalculation(
	origin: { lat: number; lon: number },
	destination: { lat: number; lon: number }
): Promise<NextResponse<ResponseData>> {
	try {
		// Get API key from environment variables
		const apiKey = process.env.GOOGLE_MAPS_API_KEY;

		if (!apiKey) {
			console.error("Google Maps API key is missing");
			return NextResponse.json(
				{
					success: false,
					error: "Server configuration error. API key is missing.",
				},
				{ status: 500 }
			);
		}

		// Format coordinates for Google Maps API
		const originString = `${origin.lat},${origin.lon}`;
		const destString = `${destination.lat},${destination.lon}`;

		// Build the Google Maps Distance Matrix API URL
		const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originString}&destinations=${destString}&mode=driving&units=metric&key=${apiKey}`;

		// Call Google Maps Distance Matrix API
		const response = await fetch(url, {
			method: "GET",
			headers: {
				Accept: "application/json",
			},
		});

		// Handle API errors
		if (!response.ok) {
			const errorBody = await response.text();
			console.error(`Google Maps API error (${response.status}):`, errorBody);

			if (response.status === 401 || response.status === 403) {
				return NextResponse.json(
					{
						success: false,
						error: "API authentication error. Please check your configuration.",
					},
					{ status: 500 }
				);
			} else if (response.status === 429) {
				return NextResponse.json(
					{
						success: false,
						error:
							"Rate limit exceeded for location services. Please try again later.",
					},
					{ status: 429 }
				);
			} else {
				return NextResponse.json(
					{
						success: false,
						error: `Location service error: ${response.status}`,
					},
					{ status: 500 }
				);
			}
		}

		// Parse response
		const data = await response.json();

		// Check if we have valid data
		if (
			data.status === "OK" &&
			data.rows &&
			data.rows.length > 0 &&
			data.rows[0].elements &&
			data.rows[0].elements.length > 0
		) {
			const element = data.rows[0].elements[0];

			if (element.status === "OK") {
				// Extract distance and duration from the response
				const distance = element.distance.value; // in meters
				const duration = element.duration.value; // in seconds

				return NextResponse.json(
					{
						success: true,
						distance,
						duration,
						distanceInKm: distance / 1000,
					},
					{ status: 200 }
				);
			} else {
				console.error("Google Maps API element status error:", element.status);
				return NextResponse.json(
					{
						success: false,
						error: `Failed to calculate distance: ${element.status}`,
					},
					{ status: 400 }
				);
			}
		} else {
			console.error("Invalid response from Google Maps API:", data);
			return NextResponse.json(
				{
					success: false,
					error: `Failed to calculate distance. Status: ${
						data.status || "UNKNOWN"
					}`,
				},
				{ status: 500 }
			);
		}
	} catch (error) {
		console.error("Error calculating distance:", error);
		return NextResponse.json(
			{
				success: false,
				error: "An unexpected error occurred while calculating distance.",
			},
			{ status: 500 }
		);
	}
}
