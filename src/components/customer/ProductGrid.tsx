import React, { useState, useEffect } from "react";
import { ListingCard } from "./ListingSection";
import { InventoryItem } from "@/firebase/inventory";
import { Vendor } from "@/components/customer/VendorListingSection";
import { getUserLocation, haversineDistance } from "@/utils/productSorting";

interface ProductGridProps {
	products: InventoryItem[];
	vendors?: Vendor[];
	singleVendor?: Vendor;
	itemsPerPage?: number;
	displayType?: "popular" | "nearby" | "new" | "sale";
}

// Customer-focused sort options
type SortOption =
	| "name-az"
	| "name-za"
	| "price-low"
	| "price-high"
	| "newest"
	| "popular"
	| "proximity"
	| "relevance";

export function ProductGrid({
	products,
	vendors,
	singleVendor,
	itemsPerPage = 12,
	displayType,
}: ProductGridProps) {
	const [searchTerm, setSearchTerm] = useState("");
	const [filteredProducts, setFilteredProducts] = useState(products);
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [sortBy, setSortBy] = useState<SortOption>(
		displayType === "nearby" ? "proximity" : "relevance"
	);
	const [priceRange, setPriceRange] = useState<[number, number]>([0, 100]);
	const [showFilters, setShowFilters] = useState(false);
	const [availableTags, setAvailableTags] = useState<string[]>([]);
	const [currentPage, setCurrentPage] = useState(1);
	const [vendorDistances, setVendorDistances] = useState<
		Record<string, number>
	>({});
	const [loading, setLoading] = useState(true);
	const [nearestVendors, setNearestVendors] = useState<Vendor[]>([]);

	// Calculate pagination
	const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
	const startIndex = (currentPage - 1) * itemsPerPage;
	const endIndex = startIndex + itemsPerPage;
	const currentProducts = filteredProducts.slice(startIndex, endIndex);

	// Fetch user location and calculate vendor distances on initial load
	useEffect(() => {
		async function initializeDistances() {
			if (!vendors || vendors.length === 0) return;

			try {
				setLoading(true);
				const userCoordinates = await getUserLocation();

				// Calculate distances for each vendor
				const vendorDists: Record<string, number> = {};
				vendors.forEach((vendor) => {
					if (vendor.coordinates) {
						const distance = haversineDistance(
							userCoordinates.lat,
							userCoordinates.lon,
							vendor.coordinates.latitude,
							vendor.coordinates.longitude
						);
						vendorDists[vendor.uid] = distance;
					} else {
						vendorDists[vendor.uid] = 9999;
					}
				});

				// Sort vendors by distance
				const sortedVendors = [...vendors].sort((a, b) => {
					return (vendorDists[a.uid] || 9999) - (vendorDists[b.uid] || 9999);
				});

				setVendorDistances(vendorDists);
				setNearestVendors(sortedVendors);
				setLoading(false);
			} catch (error) {
				console.error("Error initializing distances:", error);
				setLoading(false);
			}
		}

		initializeDistances();
	}, [vendors]);

	// Extract all unique tags and determine price range from products
	useEffect(() => {
		if (products && products.length > 0) {
			// Extract unique tags
			const allTags = products.flatMap((item) => item.tags || []);
			const uniqueTags = [...new Set(allTags)];
			setAvailableTags(uniqueTags);

			// Set default price range based on min and max prices
			const prices = products.map((item) => item.price);
			const minPrice = Math.min(...prices);
			const maxPrice = Math.max(...prices);
			setPriceRange([minPrice, maxPrice]);
		}
	}, [products]);

	// Exclude vendors based on their IDs
	const excludedVendorIds = React.useMemo(
		() => ["4kKTsNNRFbeT2BBdrYmsznSPh863", "pe2rS59tleNcWdztp1dpt22HJOX2"],
		[]
	);

	// Apply filters and sorting
	useEffect(() => {
		if (!products || products.length === 0) {
			setFilteredProducts([]);
			return;
		}

		let filtered = [...products].filter(
			(item) => !excludedVendorIds.includes(item.vendorID)
		);

		// Apply search term
		if (searchTerm) {
			const term = searchTerm.toLowerCase();
			filtered = filtered.filter(
				(item) =>
					(item.name?.toLowerCase() || "").includes(term) ||
					(item.description?.toLowerCase() || "").includes(term) ||
					(item.barcode?.toLowerCase() || "").includes(term) ||
					(item.tags &&
						item.tags.some((tag) => tag.toLowerCase().includes(term)))
			);
		}

		// Apply tag filters
		if (selectedTags.length > 0) {
			filtered = filtered.filter((item) =>
				selectedTags.some((tag) => item.tags && item.tags.includes(tag))
			);
		}

		// Apply price range
		filtered = filtered.filter(
			(item) => item.price >= priceRange[0] && item.price <= priceRange[1]
		);

		// Apply sorting
		filtered.sort((a, b) => {
			switch (sortBy) {
				case "name-az":
					return (a.name || "").localeCompare(b.name || "");
				case "name-za":
					return (b.name || "").localeCompare(a.name || "");
				case "price-low":
					return a.price - b.price;
				case "price-high":
					return b.price - a.price;
				case "newest":
					// Use created_at timestamp if available
					if (a.created_at && b.created_at) {
						return b.created_at.seconds - a.created_at.seconds;
					}
					return 0;
				case "popular":
					// Sort by sold units (popularity)
					return (b.soldUnits || 0) - (a.soldUnits || 0);
				case "proximity":
					// Sort by vendor distance
					const aDistance = vendorDistances[a.vendorID] || 9999;
					const bDistance = vendorDistances[b.vendorID] || 9999;
					return aDistance - bDistance;
				case "relevance":
				default:
					// For relevance, keep the original order or implement a more complex algorithm
					return 0;
			}
		});

		setFilteredProducts(filtered);
		setCurrentPage(1); // Reset to the first page on new filter
	}, [
		products,
		searchTerm,
		selectedTags,
		sortBy,
		priceRange,
		vendorDistances,
		excludedVendorIds,
	]);

	const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setSearchTerm(e.target.value);
	};

	const toggleTag = (tag: string) => {
		if (selectedTags.includes(tag)) {
			setSelectedTags(selectedTags.filter((t) => t !== tag));
		} else {
			setSelectedTags([...selectedTags, tag]);
		}
	};

	const handlePriceRangeChange = (index: number, value: number) => {
		const newRange = [...priceRange] as [number, number];
		newRange[index] = value;
		setPriceRange(newRange);
	};

	const resetFilters = () => {
		setSearchTerm("");
		setSelectedTags([]);

		// Set sort option based on display type or default to relevance
		if (displayType === "nearby") setSortBy("proximity");
		else setSortBy("relevance");

		// Reset price range to its default based on the data
		if (products && products.length > 0) {
			const prices = products.map((item) => item.price);
			const minPrice = Math.min(...prices);
			const maxPrice = Math.max(...prices);
			setPriceRange([minPrice, maxPrice]);
		}
	};

	// Pagination handlers
	const goToPreviousPage = () => {
		setCurrentPage((prev) => Math.max(prev - 1, 1));
	};

	const goToNextPage = () => {
		setCurrentPage((prev) => Math.min(prev + 1, totalPages));
	};

	const goToPage = (pageNumber: number) => {
		setCurrentPage(Math.max(1, Math.min(pageNumber, totalPages)));
	};

	const pageNumbers = [...Array(totalPages)].map((_, index) => index + 1);

	// Get the formatted distance for a vendor (for display purposes)
	const getFormattedDistance = (vendorId: string) => {
		const distance = vendorDistances[vendorId];
		if (!distance || distance === 9999) return "";

		if (distance < 1) {
			return `${(distance * 1000).toFixed(0)} m`;
		} else {
			return `${distance.toFixed(1)} km`;
		}
	};

	// Show loading state
	if (loading && displayType === "nearby") {
		return (
			<div className="flex justify-center items-center h-40">
				<div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
			</div>
		);
	}

	return (
		<div>
			<div className="mb-4 bg-white p-4 rounded-lg shadow">
				<div className="flex flex-col md:flex-row gap-4 items-center">
					{/* Search Input */}
					<div className="relative flex-grow">
						<input
							type="text"
							placeholder="Search products..."
							className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
							value={searchTerm}
							onChange={handleSearchChange}
						/>
						<div className="absolute right-3 top-2 text-gray-500">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="h-6 w-6"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
								/>
							</svg>
						</div>
					</div>

					{/* Sort Dropdown */}
					<div className="flex-shrink-0">
						<select
							className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
							value={sortBy}
							onChange={(e) => setSortBy(e.target.value as SortOption)}
						>
							<option value="relevance">Most Relevant</option>
							<option value="popular">Most Popular</option>
							{displayType === "nearby" && (
								<option value="proximity">Nearest to Me</option>
							)}
							<option value="newest">Newest Arrivals</option>
							<option value="price-low">Price: Low to High</option>
							<option value="price-high">Price: High to Low</option>
							<option value="name-az">Name: A to Z</option>
							<option value="name-za">Name: Z to A</option>
						</select>
					</div>

					{/* Filter Toggle Button */}
					<button
						onClick={() => setShowFilters(!showFilters)}
						className="px-4 cursor-pointer py-2 bg-black hover:bg-gray-800 text-white rounded-md shadow-sm flex items-center whitespace-nowrap"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="h-5 w-5 mr-2"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
							/>
						</svg>
						{showFilters ? "Hide Filters" : "Show Filters"}
					</button>
				</div>

				{/* Expanded Filter Section */}
				{showFilters && (
					<div className="mt-4 border-t pt-4">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							{/* Tags filter */}
							<div>
								<h3 className="text-sm font-medium text-gray-700 mb-2">
									Categories
								</h3>
								<div className="flex flex-wrap gap-2">
									{availableTags.map((tag) => (
										<button
											key={tag}
											onClick={() => toggleTag(tag)}
											className={`px-3 py-1 text-sm cursor-pointer rounded-full ${
												selectedTags.includes(tag)
													? "bg-black text-white"
													: "bg-gray-100 text-gray-700 hover:bg-gray-200"
											}`}
										>
											{tag}
										</button>
									))}
								</div>
							</div>

							{/* Price Range filter */}
							<div>
								<h3 className="text-sm font-medium text-gray-700 mb-2">
									Price Range (${priceRange[0].toFixed(2)} - $
									{priceRange[1].toFixed(2)})
								</h3>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="text-xs text-gray-500">Min Price</label>
										<input
											type="number"
											min={0}
											max={priceRange[1]}
											value={priceRange[0]}
											onChange={(e) =>
												handlePriceRangeChange(0, Number(e.target.value))
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-md"
										/>
									</div>
									<div>
										<label className="text-xs text-gray-500">Max Price</label>
										<input
											type="number"
											min={priceRange[0]}
											value={priceRange[1]}
											onChange={(e) =>
												handlePriceRangeChange(1, Number(e.target.value))
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-md"
										/>
									</div>
								</div>
							</div>

							{/* Reset Filters button */}
							<div className="flex items-center justify-end space-x-4 md:col-span-2">
								<button
									onClick={resetFilters}
									className="px-4 cursor-pointer py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
								>
									Reset Filters
								</button>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* If this is the 'nearby' display type, show vendors */}
			{displayType === "nearby" && nearestVendors.length > 0 && (
				<div className="mb-6">
					<h3 className="text-lg font-semibold mb-2">Nearest Vendors</h3>
					<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
						{nearestVendors.slice(0, 5).map((vendor) => (
							<div
								key={vendor.uid}
								className="bg-white p-3 rounded-lg shadow-sm border"
							>
								<p className="font-medium truncate">{vendor.shopName}</p>
								{vendorDistances[vendor.uid] && (
									<p className="text-sm text-gray-600">
										{getFormattedDistance(vendor.uid)} away
									</p>
								)}
							</div>
						))}
					</div>
				</div>
			)}

			{/* Product Grid */}
			<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
				{currentProducts.map((item) => (
					<ListingCard
						key={item.itemID}
						item={item}
						vendor={
							vendors
								? vendors?.find((vendor) => vendor.uid === item.vendorID)
								: singleVendor
						}
					>
						<div className="max-w-[200px] overflow-hidden">
							<h3 className="text-lg font-bold text-black truncate">
								{item.name}
							</h3>
						</div>
						<p className="text-sm text-gray-600">
							{vendors?.find((vendor) => vendor.uid === item.vendorID)
								?.shopName || singleVendor?.shopName}
							{sortBy === "proximity" && vendorDistances[item.vendorID] && (
								<span className="ml-1 text-xs text-gray-500">
									({getFormattedDistance(item.vendorID)} away)
								</span>
							)}
						</p>
						<p className="text-sm font-semibold text-gray-600">
							${item.price.toFixed(2)}
						</p>
					</ListingCard>
				))}
				{filteredProducts.length === 0 && (
					<div className="col-span-full text-center py-6">
						<p className="text-gray-500">
							No products found matching your criteria.
						</p>
					</div>
				)}
			</div>

			{/* Pagination */}
			{totalPages > 1 && (
				<div className="flex justify-center mt-4 space-x-2">
					<button
						onClick={goToPreviousPage}
						disabled={currentPage === 1}
						className="px-3 py-1 cursor-pointer rounded-full border bg-white text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring focus:ring-black !shadow-lg"
					>
						Previous
					</button>
					{pageNumbers.map((pageNumber) => (
						<button
							key={pageNumber}
							onClick={() => goToPage(pageNumber)}
							className={`px-3 py-1 rounded-full border !shadow-lg ${
								currentPage === pageNumber
									? "bg-black text-white"
									: "bg-white text-gray-700 hover:bg-gray-100"
							} focus:outline-none cursor-pointer focus:ring focus:ring-black`}
						>
							{pageNumber}
						</button>
					))}
					<button
						onClick={goToNextPage}
						disabled={currentPage === totalPages}
						className="px-3 cursor-pointer py-1 rounded-full border shadow-sm bg-white text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring focus:ring-black"
					>
						Next
					</button>
				</div>
			)}
		</div>
	);
}
