// src/app/api/address-autocomplete/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const query = searchParams.get("query");
	const countryCode = searchParams.get("countryCode") || "us";

	if (!query) {
		return NextResponse.json(
			{ success: false, error: "Missing query parameter" },
			{ status: 400 }
		);
	}

	try {
		// Get API key from environment variables (server-side only)
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

		// Set up the Google Places Autocomplete API request
		const placesResponse = await fetch(
			`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
				query
			)}&types=address&components=country:${countryCode}&key=${apiKey}`
		);

		if (!placesResponse.ok) {
			throw new Error(`Google Maps API error: ${placesResponse.status}`);
		}

		const placesData = await placesResponse.json();

		if (placesData.status !== "OK" && placesData.status !== "ZERO_RESULTS") {
			throw new Error(`Google Maps API returned status: ${placesData.status}`);
		}

		// If no predictions found, return empty array
		if (
			placesData.status === "ZERO_RESULTS" ||
			!placesData.predictions ||
			placesData.predictions.length === 0
		) {
			return NextResponse.json({ success: true, suggestions: [] });
		}

		// Process a limited number of results (max 5) to match the original API
		const limitedPredictions = placesData.predictions.slice(0, 5);

		// For each prediction, get more details including coordinates using Place Details API
		const detailedSuggestions = await Promise.all(
			limitedPredictions.map(
				async (prediction: {
					place_id: string;
					description: string;
					structured_formatting?: {
						main_text?: string;
						secondary_text?: string;
					};
				}) => {
					try {
						// Get place details to retrieve coordinates and address components
						const detailsResponse = await fetch(
							`https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=geometry,address_component,formatted_address&key=${apiKey}`
						);

						if (!detailsResponse.ok) {
							throw new Error(
								`Google Maps Details API error: ${detailsResponse.status}`
							);
						}

						const detailsData = await detailsResponse.json();

						if (detailsData.status !== "OK") {
							console.warn(
								`Google Maps Details API returned status: ${detailsData.status} for place_id: ${prediction.place_id}`
							);
							// Return partial data even if details fetch fails
							return {
								place_id: prediction.place_id,
								display_name: prediction.description,
								display_place:
									prediction.structured_formatting?.main_text || "",
								display_address:
									prediction.structured_formatting?.secondary_text || "",
								address: {
									name: prediction.structured_formatting?.main_text || "",
									country: countryCode.toUpperCase(),
									country_code: countryCode,
								},
								lat: "",
								lon: "",
							};
						}

						// Extract address components
						const addressComponents: Record<string, string> = {};

						if (detailsData.result && detailsData.result.address_components) {
							detailsData.result.address_components.forEach(
								(component: {
									long_name: string;
									short_name: string;
									types: string[];
								}) => {
									const types = component.types;

									if (types.includes("street_number")) {
										addressComponents.house_number = component.long_name;
									} else if (types.includes("route")) {
										addressComponents.road = component.long_name;
									} else if (types.includes("locality")) {
										addressComponents.city = component.long_name;
									} else if (types.includes("administrative_area_level_1")) {
										addressComponents.state = component.long_name;
									} else if (types.includes("postal_code")) {
										addressComponents.postcode = component.long_name;
									} else if (types.includes("country")) {
										addressComponents.country = component.long_name;
										addressComponents.country_code =
											component.short_name.toLowerCase();
									} else if (
										types.includes("neighborhood") ||
										types.includes("sublocality")
									) {
										addressComponents.neighbourhood = component.long_name;
									}
								}
							);
						}

						// Get coordinates
						const location = detailsData.result?.geometry?.location;
						const lat = location ? location.lat.toString() : "";
						const lon = location ? location.lng.toString() : "";

						// Format result to match format expected by frontend
						return {
							place_id: prediction.place_id,
							display_name:
								detailsData.result?.formatted_address || prediction.description,
							display_place: prediction.structured_formatting?.main_text || "",
							display_address:
								prediction.structured_formatting?.secondary_text || "",
							address: {
								name: prediction.structured_formatting?.main_text || "",
								...addressComponents,
							},
							lat,
							lon,
							// Include bounding box if needed by frontend
							boundingbox: location
								? [
										(location.lat - 0.01).toString(),
										(location.lat + 0.01).toString(),
										(location.lng - 0.01).toString(),
										(location.lng + 0.01).toString(),
								  ]
								: undefined,
						};
					} catch (error) {
						console.error("Error fetching place details:", error);
						// Return partial data even if details fetch fails
						return {
							place_id: prediction.place_id,
							display_name: prediction.description,
							display_place: prediction.structured_formatting?.main_text || "",
							display_address:
								prediction.structured_formatting?.secondary_text || "",
							address: {
								name: prediction.structured_formatting?.main_text || "",
								country: countryCode.toUpperCase(),
								country_code: countryCode,
							},
							lat: "",
							lon: "",
						};
					}
				}
			)
		);

		return NextResponse.json({
			success: true,
			suggestions: detailedSuggestions,
		});
	} catch (error) {
		console.error("Error fetching address suggestions:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to fetch address suggestions" },
			{ status: 500 }
		);
	}
}
