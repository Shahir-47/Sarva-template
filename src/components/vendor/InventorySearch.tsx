// src/components/vendor/InventorySearch.tsx
import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { InventoryItem } from "@/firebase/inventory";

interface InventorySearchProps {
	items: InventoryItem[];
	onFilteredItemsChange: (filteredItems: InventoryItem[]) => void;
	onSearchTermChange?: (term: string) => void;
}

// Enhanced sort options with profit-related sorting
type SortOption =
	| "name"
	| "price-low"
	| "price-high"
	| "cost-low"
	| "cost-high"
	| "margin-low"
	| "margin-high"
	| "profit-low"
	| "profit-high"
	| "stock-low"
	| "stock-high"
	| "sales-low"
	| "sales-high"
	| "revenue-low"
	| "revenue-high"
	| "newest"
	| "oldest";

const InventorySearch: React.FC<InventorySearchProps> = ({
	items,
	onFilteredItemsChange,
	onSearchTermChange,
}) => {
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [sortBy, setSortBy] = useState<SortOption>("name");
	const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
	const [costRange, setCostRange] = useState<[number, number]>([0, 1000]);
	const [marginRange, setMarginRange] = useState<[number, number]>([0, 100]);
	const [stockRange, setStockRange] = useState<[number, number]>([0, 100]);
	const [showFilters, setShowFilters] = useState(false);
	const [availableTags, setAvailableTags] = useState<string[]>([]);
	const searchParams = useSearchParams();

	// Extract all unique tags and determine ranges from items
	useEffect(() => {
		if (items && items.length > 0) {
			// Extract unique tags
			const allTags = items.flatMap((item) => item.tags || []);
			const uniqueTags = [...new Set(allTags)];
			setAvailableTags(uniqueTags);

			// Set default price range based on min and max prices
			const prices = items.map((item) => item.price);
			const minPrice = Math.min(...prices);
			const maxPrice = Math.max(...prices);
			setPriceRange([minPrice, maxPrice]);

			// Set default cost range based on min and max costs
			const costs = items.map((item) => item.cost || 0);
			const minCost = Math.min(...costs);
			const maxCost = Math.max(...costs);
			setCostRange([minCost, maxCost]);

			// Set default margin range based on min and max margins
			const margins = items.map((item) => {
				const margin =
					item.price > 0
						? ((item.price - (item.cost || 0)) / item.price) * 100
						: 0;
				return margin;
			});
			const minMargin = Math.floor(Math.min(...margins));
			const maxMargin = Math.ceil(Math.max(...margins));
			setMarginRange([minMargin, maxMargin]);

			// Set default stock range based on min and max stock
			const stocks = items.map((item) => item.units || 0);
			const minStock = Math.min(...stocks);
			const maxStock = Math.max(...stocks);
			setStockRange([minStock, maxStock]);
		}
	}, [items]);

	// Apply filters and sorting
	useEffect(() => {
		if (!items || items.length === 0) {
			onFilteredItemsChange([]);
			return;
		}

		let filteredItems = [...items];

		// Apply search term
		if (searchTerm) {
			const term = searchTerm.toLowerCase();
			filteredItems = filteredItems.filter(
				(item) =>
					item.name.toLowerCase().includes(term) ||
					item.description.toLowerCase().includes(term) ||
					(item.barcode && item.barcode.toLowerCase().includes(term))
			);
		}

		// Apply tag filters
		if (selectedTags.length > 0) {
			filteredItems = filteredItems.filter((item) =>
				selectedTags.some((tag) => item.tags && item.tags.includes(tag))
			);
		}

		// Apply price range
		filteredItems = filteredItems.filter(
			(item) => item.price >= priceRange[0] && item.price <= priceRange[1]
		);

		// Apply cost range
		filteredItems = filteredItems.filter(
			(item) =>
				(item.cost || 0) >= costRange[0] && (item.cost || 0) <= costRange[1]
		);

		// Apply margin range
		filteredItems = filteredItems.filter((item) => {
			const margin =
				item.price > 0
					? ((item.price - (item.cost || 0)) / item.price) * 100
					: 0;
			return margin >= marginRange[0] && margin <= marginRange[1];
		});

		// Apply stock range
		filteredItems = filteredItems.filter(
			(item) =>
				(item.units || 0) >= stockRange[0] && (item.units || 0) <= stockRange[1]
		);

		// Apply sorting
		filteredItems.sort((a, b) => {
			switch (sortBy) {
				case "name":
					return a.name.localeCompare(b.name);
				case "price-low":
					return a.price - b.price;
				case "price-high":
					return b.price - a.price;
				case "cost-low":
					return (a.cost || 0) - (b.cost || 0);
				case "cost-high":
					return (b.cost || 0) - (a.cost || 0);
				case "margin-low": {
					const marginA =
						a.price > 0 ? ((a.price - (a.cost || 0)) / a.price) * 100 : 0;
					const marginB =
						b.price > 0 ? ((b.price - (b.cost || 0)) / b.price) * 100 : 0;
					return marginA - marginB;
				}
				case "margin-high": {
					const marginA =
						a.price > 0 ? ((a.price - (a.cost || 0)) / a.price) * 100 : 0;
					const marginB =
						b.price > 0 ? ((b.price - (b.cost || 0)) / b.price) * 100 : 0;
					return marginB - marginA;
				}
				case "profit-low":
					return a.price - (a.cost || 0) - (b.price - (b.cost || 0));
				case "profit-high":
					return b.price - (b.cost || 0) - (a.price - (a.cost || 0));
				case "stock-low":
					return (a.units || 0) - (b.units || 0);
				case "stock-high":
					return (b.units || 0) - (a.units || 0);
				case "sales-low":
					return (a.soldUnits || 0) - (b.soldUnits || 0);
				case "sales-high":
					return (b.soldUnits || 0) - (a.soldUnits || 0);
				case "revenue-low":
					return (a.soldUnits || 0) * a.price - (b.soldUnits || 0) * b.price;
				case "revenue-high":
					return (b.soldUnits || 0) * b.price - (a.soldUnits || 0) * a.price;
				case "newest":
					// Use created_at timestamp if available
					if (a.created_at && b.created_at) {
						return b.created_at.seconds - a.created_at.seconds;
					}
					return 0;
				case "oldest":
					// Use created_at timestamp if available
					if (a.created_at && b.created_at) {
						return a.created_at.seconds - b.created_at.seconds;
					}
					return 0;
				default:
					return 0;
			}
		});

		onFilteredItemsChange(filteredItems);
	}, [
		items,
		searchTerm,
		selectedTags,
		sortBy,
		priceRange,
		costRange,
		marginRange,
		stockRange,
		onFilteredItemsChange,
	]);

	// Initialize based on URL parameters
	useEffect(() => {
		const filter = searchParams.get("filter");
		const sort = searchParams.get("sort");
		const order = searchParams.get("order");

		// Apply stock filters from URL
		if (filter === "lowStock") {
			setStockRange([1, 9]); // Set stock range for low stock items
			setSortBy("stock-low");
		} else if (filter === "outOfStock") {
			setStockRange([0, 0]); // Set stock range for out of stock items
		}

		// Apply sorting from URL
		if (sort === "value" && order === "desc") {
			setSortBy("price-high");
		}
	}, [searchParams]);

	const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const term = e.target.value;
		setSearchTerm(term);
		onSearchTermChange?.(term);
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

	const handleCostRangeChange = (index: number, value: number) => {
		const newRange = [...costRange] as [number, number];
		newRange[index] = value;
		setCostRange(newRange);
	};

	const handleMarginRangeChange = (index: number, value: number) => {
		const newRange = [...marginRange] as [number, number];
		newRange[index] = value;
		setMarginRange(newRange);
	};

	const handleStockRangeChange = (index: number, value: number) => {
		const newRange = [...stockRange] as [number, number];
		newRange[index] = value;
		setStockRange(newRange);
	};

	const resetFilters = () => {
		setSearchTerm("");
		setSelectedTags([]);
		setSortBy("name");

		// Reset all ranges to their defaults based on the data
		if (items && items.length > 0) {
			// Reset price range
			const prices = items.map((item) => item.price);
			const minPrice = Math.min(...prices);
			const maxPrice = Math.max(...prices);
			setPriceRange([minPrice, maxPrice]);

			// Reset cost range
			const costs = items.map((item) => item.cost || 0);
			const minCost = Math.min(...costs);
			const maxCost = Math.max(...costs);
			setCostRange([minCost, maxCost]);

			// Reset margin range
			const margins = items.map((item) => {
				const margin =
					item.price > 0
						? ((item.price - (item.cost || 0)) / item.price) * 100
						: 0;
				return margin;
			});
			const minMargin = Math.floor(Math.min(...margins));
			const maxMargin = Math.ceil(Math.max(...margins));
			setMarginRange([minMargin, maxMargin]);

			// Reset stock range
			const stocks = items.map((item) => item.units || 0);
			const minStock = Math.min(...stocks);
			const maxStock = Math.max(...stocks);
			setStockRange([minStock, maxStock]);
		}
	};

	return (
		<div className="mb-6 bg-white p-4 rounded-lg shadow">
			<div className="flex flex-col md:flex-row gap-4 items-center">
				<div className="relative flex-grow">
					<input
						type="text"
						placeholder="Search by name, description or barcode..."
						className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-puce focus:border-transparent"
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

				<div className="flex-shrink-0">
					<select
						className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-puce focus:border-transparent"
						value={sortBy}
						onChange={(e) => setSortBy(e.target.value as SortOption)}
					>
						<optgroup label="General">
							<option value="name">Sort by Name (A-Z)</option>
							<option value="newest">Newest First</option>
							<option value="oldest">Oldest First</option>
						</optgroup>
						<optgroup label="Price & Cost">
							<option value="price-low">Price (Low to High)</option>
							<option value="price-high">Price (High to Low)</option>
							<option value="cost-low">Cost (Low to High)</option>
							<option value="cost-high">Cost (High to Low)</option>
						</optgroup>
						<optgroup label="Profit & Margin">
							<option value="margin-low">Profit Margin % (Low to High)</option>
							<option value="margin-high">Profit Margin % (High to Low)</option>
							<option value="profit-low">Profit per Unit (Low to High)</option>
							<option value="profit-high">Profit per Unit (High to Low)</option>
						</optgroup>
						<optgroup label="Inventory & Sales">
							<option value="stock-low">Stock (Low to High)</option>
							<option value="stock-high">Stock (High to Low)</option>
							<option value="sales-low">Units Sold (Low to High)</option>
							<option value="sales-high">Units Sold (High to Low)</option>
							<option value="revenue-low">Total Revenue (Low to High)</option>
							<option value="revenue-high">Total Revenue (High to Low)</option>
						</optgroup>
					</select>
				</div>

				<button
					onClick={() => setShowFilters(!showFilters)}
					className="px-4 cursor-pointer py-2 bg-puce hover:bg-rose text-white rounded-md shadow-sm flex items-center whitespace-nowrap"
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

			{showFilters && (
				<div className="mt-4 border-t pt-4">
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{/* Tags filter */}
						<div>
							<h3 className="text-sm font-medium text-gray-700 mb-2">Tags</h3>
							<div className="flex flex-wrap gap-2">
								{availableTags.map((tag) => (
									<button
										key={tag}
										onClick={() => toggleTag(tag)}
										className={`px-3 cursor-pointer py-1 text-sm rounded-full ${
											selectedTags.includes(tag)
												? "bg-puce text-white"
												: "bg-gray-100 text-gray-700 hover:bg-gray-200"
										}`}
									>
										{tag}
									</button>
								))}
							</div>
						</div>

						<div className="ml-2 lg:col-span-2">
							{/* Price Range filter */}
							<div className="mb-4">
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

							{/* Cost Range filter */}
							<div className="mb-4">
								<h3 className="text-sm font-medium text-gray-700 mb-2">
									Cost Range (${costRange[0].toFixed(2)} - $
									{costRange[1].toFixed(2)})
								</h3>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="text-xs text-gray-500">Min Cost</label>
										<input
											type="number"
											min={0}
											max={costRange[1]}
											value={costRange[0]}
											onChange={(e) =>
												handleCostRangeChange(0, Number(e.target.value))
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-md"
										/>
									</div>
									<div>
										<label className="text-xs text-gray-500">Max Cost</label>
										<input
											type="number"
											min={costRange[0]}
											value={costRange[1]}
											onChange={(e) =>
												handleCostRangeChange(1, Number(e.target.value))
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-md"
										/>
									</div>
								</div>
							</div>

							{/* Profit Margin Range filter */}
							<div className="mb-4">
								<h3 className="text-sm font-medium text-gray-700 mb-2">
									Profit Margin Range ({marginRange[0].toFixed(0)}% -{" "}
									{marginRange[1].toFixed(0)}%)
								</h3>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="text-xs text-gray-500">
											Min Margin %
										</label>
										<input
											type="number"
											min={0}
											max={100}
											value={marginRange[0]}
											onChange={(e) =>
												handleMarginRangeChange(0, Number(e.target.value))
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-md"
										/>
									</div>
									<div>
										<label className="text-xs text-gray-500">
											Max Margin %
										</label>
										<input
											type="number"
											min={marginRange[0]}
											max={100}
											value={marginRange[1]}
											onChange={(e) =>
												handleMarginRangeChange(1, Number(e.target.value))
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-md"
										/>
									</div>
								</div>
							</div>

							{/* Stock Range filter */}
							<div className="mb-4">
								<h3 className="text-sm font-medium text-gray-700 mb-2">
									Stock Range ({stockRange[0]} - {stockRange[1]} units)
								</h3>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="text-xs text-gray-500">Min Stock</label>
										<input
											type="number"
											min={0}
											max={stockRange[1]}
											value={stockRange[0]}
											onChange={(e) =>
												handleStockRangeChange(0, Number(e.target.value))
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-md"
										/>
									</div>
									<div>
										<label className="text-xs text-gray-500">Max Stock</label>
										<input
											type="number"
											min={stockRange[0]}
											value={stockRange[1]}
											onChange={(e) =>
												handleStockRangeChange(1, Number(e.target.value))
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-md"
										/>
									</div>
								</div>
							</div>
						</div>

						{/* Reset Filters button */}
						<div className="flex items-center justify-end space-x-4 lg:col-span-3">
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
	);
};

export default InventorySearch;
