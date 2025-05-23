// src/components/shared/GoogleMapsAutocomplete.tsx
import React, { useState, useEffect, useRef } from "react";

interface LocationResult {
	place_id: string;
	lat: string;
	lon: string;
	display_name: string;
	display_place?: string;
	display_address?: string;
	address?: {
		name?: string;
		house_number?: string;
		road?: string;
		neighbourhood?: string;
		suburb?: string;
		city?: string;
		state?: string;
		postcode?: string;
		country?: string;
		country_code?: string;
	};
	boundingbox?: string[];
}

interface GoogleMapsAutocompleteProps {
	value: string;
	onChange: (value: string) => void;
	onSelect: (location: LocationResult) => void;
	placeholder?: string;
	className?: string;
	id?: string;
	required?: boolean;
	disabled?: boolean;
	label?: string;
	countryCode?: string;
}

const GoogleMapsAutocomplete: React.FC<GoogleMapsAutocompleteProps> = ({
	value,
	onChange,
	onSelect,
	placeholder = "Enter an address",
	className = "",
	id = "location-autocomplete",
	required = false,
	disabled = false,
	label = "Address",
	countryCode = "us", // Default to US addresses
}) => {
	const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
	const [isValid, setIsValid] = useState<boolean>(false);
	const [isDirty, setIsDirty] = useState<boolean>(false);
	const [selectedItem, setSelectedItem] = useState<LocationResult | null>(null);
	const [inputTouched, setInputTouched] = useState<boolean>(false);
	const [originalSelectedValue, setOriginalSelectedValue] =
		useState<string>("");
	const autocompleteRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// Fetch suggestions from Google Maps API via our backend
	const fetchSuggestions = React.useCallback(
		async (query: string) => {
			if (!query || query.length < 3) return;

			setIsLoading(true);
			try {
				// Using the same API endpoint, but now it connects to Google Maps
				const response = await fetch(
					`/api/address-autocomplete?query=${encodeURIComponent(
						query
					)}&countryCode=${countryCode}`
				);

				if (!response.ok) {
					throw new Error(`Google Maps API error: ${response.status}`);
				}

				const data = await response.json();

				if (data.success && Array.isArray(data.suggestions)) {
					setSuggestions(data.suggestions);
				} else {
					setSuggestions([]);
				}
			} catch (error) {
				console.error("Error fetching address suggestions:", error);
				setSuggestions([]);
			} finally {
				setIsLoading(false);
			}
		},
		[countryCode]
	);

	// Debounce function to limit API calls
	useEffect(() => {
		if (value === originalSelectedValue) {
			return; // Skip if the value is from a selection
		}

		// If user modifies the text after selecting, mark as invalid
		if (selectedItem && value !== originalSelectedValue) {
			setIsValid(false);
			setSelectedItem(null);
		}

		const timer = setTimeout(() => {
			if (value) {
				fetchSuggestions(value);
			} else {
				setSuggestions([]);
			}
		}, 300); // Debounce for 300ms

		return () => clearTimeout(timer);
	}, [value, originalSelectedValue, fetchSuggestions, selectedItem]);

	// Handle click outside to close suggestions
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				autocompleteRef.current &&
				!autocompleteRef.current.contains(event.target as Node)
			) {
				setShowSuggestions(false);

				// If input was touched but no valid selection was made, show validation state
				if (inputTouched && !isValid && value) {
					setIsDirty(true);
				}
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [inputTouched, isValid, value]);

	// Handle suggestion selection
	const handleSuggestionClick = (suggestion: LocationResult) => {
		setSelectedItem(suggestion);
		setOriginalSelectedValue(suggestion.display_name);
		onChange(suggestion.display_name);

		// Pass the selected location data
		onSelect({
			...suggestion,
			// Ensure required fields exist
			place_id: suggestion.place_id,
			display_name: suggestion.display_name,
			lat: suggestion.lat || "",
			lon: suggestion.lon || "",
		});

		setShowSuggestions(false);
		setIsValid(true);
		setIsDirty(false);
	};

	// Input field classes based on validation state
	const getInputClasses = () => {
		let classes = `w-full px-3 py-2 border rounded-md focus:outline-none ${className}`;

		if (isDirty && !isValid && inputTouched) {
			// Invalid state
			classes +=
				" border-red-500 focus:ring-2 focus:ring-red-300 focus:border-transparent";
		} else if (isValid) {
			// Valid state
			classes +=
				" border-green-500 focus:ring-2 focus:ring-green-300 focus:border-transparent";
		} else {
			// Default state
			classes +=
				" border-gray-300 focus:ring-2 focus:ring-puce focus:border-transparent";
		}

		return classes;
	};

	// Format display address for suggestions
	const formatDisplayAddress = (suggestion: LocationResult) => {
		if (suggestion.display_address) return suggestion.display_address;

		const addressParts = suggestion.display_name.split(",");
		return addressParts.length > 1
			? addressParts.slice(1).join(",").trim()
			: "";
	};

	return (
		<div className="w-full" ref={autocompleteRef}>
			{label && (
				<label className="block text-gray-700 mb-2 font-medium" htmlFor={id}>
					{label}
					{required && "*"}
				</label>
			)}
			<div className="relative">
				<input
					ref={inputRef}
					id={id}
					type="text"
					className={getInputClasses()}
					value={value}
					onChange={(e) => {
						onChange(e.target.value);
						setInputTouched(true);
						setShowSuggestions(true);
						if (e.target.value !== originalSelectedValue) {
							setIsValid(false);
						}
					}}
					onFocus={() => {
						setShowSuggestions(true);
						setInputTouched(true);
					}}
					onBlur={() => {
						// Don't hide suggestions immediately to allow for clicks
						setTimeout(() => {
							if (inputTouched && !isValid && value) {
								setIsDirty(true);
							}
						}, 200);
					}}
					placeholder={placeholder}
					required={required}
					disabled={disabled}
					autoComplete="off"
				/>

				{isLoading && (
					<div className="absolute right-3 top-3">
						<svg
							className="animate-spin h-5 w-5 text-gray-500"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								className="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								strokeWidth="4"
							></circle>
							<path
								className="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
					</div>
				)}

				{!isLoading && isValid && (
					<div className="absolute right-3 top-3">
						<svg
							className="h-5 w-5 text-green-500"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M5 13l4 4L19 7"
							/>
						</svg>
					</div>
				)}

				{showSuggestions && suggestions.length > 0 && (
					<ul className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base overflow-auto focus:outline-none sm:text-sm">
						{suggestions.map((suggestion) => (
							<li
								key={suggestion.place_id}
								className="cursor-pointer px-4 py-2 hover:bg-gray-100 transition-colors"
								onClick={() => handleSuggestionClick(suggestion)}
							>
								<div className="font-medium">
									{suggestion.display_place ||
										suggestion.address?.name ||
										suggestion.display_name.split(",")[0].trim()}
								</div>
								<div className="text-sm text-gray-500 truncate">
									{formatDisplayAddress(suggestion)}
								</div>
							</li>
						))}
					</ul>
				)}

				{isDirty && !isValid && inputTouched && value && (
					<div className="mt-1 text-sm text-red-500">
						Please select a valid address from the suggestions
					</div>
				)}

				{value && !isLoading && suggestions.length === 0 && showSuggestions && (
					<div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md py-2 px-3 text-sm text-gray-500">
						No addresses found. Please try a different search.
					</div>
				)}
			</div>
			<p className="text-xs text-gray-400 mt-1">
				{countryCode === "us"
					? "Only US addresses are supported"
					: `Only ${countryCode.toUpperCase()} addresses are supported`}
			</p>
		</div>
	);
};

export default GoogleMapsAutocomplete;
