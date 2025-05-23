"use client";

import Highlighter from "react-highlight-words";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useVendorAuth } from "@/hooks/useVendorAuth";
import { getCurrentVendorData } from "@/firebase/vendorAuth";
import { VendorData } from "@/firebase/vendorAuth";
import {
	getVendorInventoryItems,
	getInventoryItem,
	InventoryItem,
	deleteInventoryItem,
} from "@/firebase/inventory";
import { deleteImage } from "@/firebase/storage";
import VendorNavBar from "@/components/vendor/VendorNavBar";
import InventorySearch from "@/components/vendor/InventorySearch";
import DeleteConfirmationModal from "@/components/vendor/DeleteConfirmationModal";
import Link from "next/link";
import Image from "next/image";
import Footer from "@/components/shared/Footer";

export default function VendorInventoryPage() {
	// State variables
	const [vendorData, setVendorData] = useState<VendorData | null>(null);
	const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
	const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [deleteModalOpen, setDeleteModalOpen] = useState(false);
	const [itemToDelete, setItemToDelete] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const [error, setError] = useState("");
	const [searchTerm, setSearchTerm] = useState<string>("");

	const { user, initializing } = useVendorAuth();
	const router = useRouter();

	// Fetch vendor data and inventory items
	useEffect(() => {
		const fetchData = async () => {
			if (initializing) return;

			setIsLoading(true);

			// If no user or email not verified, redirect
			if (!user) {
				console.log("No user found, redirecting to vendor signin");
				router.push("/unauthorized");
				return;
			}

			// Get vendor data
			try {
				const result = await getCurrentVendorData();

				if (result.success && result.data) {
					setVendorData(result.data);

					// Fetch inventory items for this vendor
					const inventoryResult = await getVendorInventoryItems(
						result.data.uid
					);
					if (inventoryResult.success && inventoryResult.data) {
						const items = inventoryResult.data.map((item) => ({
							...item,
							itemID: item.itemID || "",
							barcode: item.barcode || "",
						}));

						setInventoryItems(items);
						setFilteredItems(items);
					}
				} else if (result.error) {
					setError(result.error);
				}
			} catch (err) {
				setError("Failed to load vendor data");
				console.error(err);
			}

			setIsLoading(false);
		};

		fetchData();
	}, [user, router, initializing]);

	// Handle deleting an inventory item
	const handleDeleteItem = async () => {
		if (!itemToDelete || !vendorData) return;

		setIsDeleting(true);

		try {
			// Get the item to check if it has an image to delete
			const itemResult = await getInventoryItem(itemToDelete.id);

			if (itemResult.success && itemResult.data) {
				const item = itemResult.data;

				// If the item has an image from Firebase Storage, delete it
				if (
					item.image &&
					item.image.includes("firebasestorage.googleapis.com")
				) {
					await deleteImage(item.image);
				}
			}

			// Delete the item from Firestore
			const result = await deleteInventoryItem(itemToDelete.id, vendorData.uid);

			if (result.success) {
				// Remove item from local state
				const updatedItems = inventoryItems.filter(
					(item) => item.itemID !== itemToDelete.id
				);
				setInventoryItems(updatedItems);
				setFilteredItems(updatedItems);
				setDeleteModalOpen(false);
				setItemToDelete(null);
			} else {
				setError(result.error || "Failed to delete item");
			}
		} catch (error) {
			setError((error as Error).message || "An unexpected error occurred");
		}

		setIsDeleting(false);
	};

	// Callback to update filtered items from search component
	const handleFilteredItemsChange = useCallback((items: InventoryItem[]) => {
		setFilteredItems(items);
	}, []);

	// Calculate inventory statistics
	const calculateInventoryStats = () => {
		if (filteredItems.length === 0) return null;

		const avgMargin =
			filteredItems.reduce((sum, item) => {
				const margin =
					item.price > 0
						? ((item.price - (item.cost || 0)) / item.price) * 100
						: 0;
				return sum + margin;
			}, 0) / filteredItems.length;

		const totalRevenue = filteredItems.reduce(
			(sum, item) => sum + (item.soldUnits || 0) * item.price,
			0
		);

		const totalProfit = filteredItems.reduce(
			(sum, item) =>
				sum + (item.soldUnits || 0) * (item.price - (item.cost || 0)),
			0
		);

		const lowMarginItems = filteredItems.filter((item) => {
			const margin =
				item.price > 0
					? ((item.price - (item.cost || 0)) / item.price) * 100
					: 0;
			return margin < 20;
		}).length;

		return { avgMargin, totalRevenue, totalProfit, lowMarginItems };
	};

	// Helper function to render inventory statistics
	const renderInventoryStats = () => {
		const stats = calculateInventoryStats();
		if (!stats) return null;

		return (
			<div className="mb-6 bg-white p-4 rounded-lg shadow">
				<div className="flex flex-wrap gap-4 justify-between">
					<div>
						<span className="text-sm text-gray-500">Showing:</span>
						<span className="ml-2 font-semibold">
							{filteredItems.length} of {inventoryItems.length} items
						</span>
					</div>

					<div className="flex flex-wrap gap-4">
						<div>
							<span className="text-sm text-gray-500">Avg. Margin:</span>
							<span className="ml-2 font-semibold text-green-600">
								{stats.avgMargin.toFixed(1)}%
							</span>
						</div>

						<div>
							<span className="text-sm text-gray-500">Total Revenue:</span>
							<span className="ml-2 font-semibold">
								${stats.totalRevenue.toFixed(2)}
							</span>
						</div>

						<div>
							<span className="text-sm text-gray-500">Total Profit:</span>
							<span className="ml-2 font-semibold text-green-600">
								${stats.totalProfit.toFixed(2)}
							</span>
						</div>

						<div>
							<span className="text-sm text-gray-500">Low Margin Items:</span>
							<span className="ml-2 font-semibold text-yellow-600">
								{stats.lowMarginItems}
							</span>
						</div>
					</div>
				</div>
			</div>
		);
	};

	// Helper function to render an inventory item card
	const renderItemCard = (item: InventoryItem) => {
		// Calculate profit metrics
		const profitPerUnit = item.price - (item.cost || 0);
		const marginPercent =
			item.price > 0 ? (profitPerUnit / item.price) * 100 : 0;
		const totalProfit = (item.soldUnits || 0) * profitPerUnit;

		// Determine margin color class based on percentage
		let marginColorClass = "text-green-600";
		if (marginPercent < 15) marginColorClass = "text-red-600";
		else if (marginPercent < 25) marginColorClass = "text-yellow-600";
		else if (marginPercent > 50) marginColorClass = "text-emerald-600";

		return (
			<div
				key={item.itemID}
				className="bg-white rounded-lg shadow overflow-hidden hover:shadow-md transition-shadow duration-200"
			>
				<div className="h-48 w-full relative">
					<Image
						src={item.image || "/placeholder-image.png"}
						alt={item.name}
						className="w-full h-full object-cover"
						width={500}
						height={500}
						onError={(e) => {
							(e.target as HTMLImageElement).src = "/placeholder-image.png";
						}}
					/>

					{/* Profit margin indicator */}
					<div className="absolute bottom-2 right-2">
						<div
							className={`${marginColorClass} bg-white text-xs font-bold px-2 py-1 rounded-full shadow`}
						>
							{marginPercent.toFixed(0)}% margin
						</div>
					</div>
				</div>

				<div className="p-4">
					<div className="flex justify-between items-start">
						<h2 className="text-xl font-semibold text-gray-800 line-clamp-1">
							<Highlighter
								highlightClassName="bg-yellow-200"
								searchWords={[searchTerm]}
								autoEscape
								textToHighlight={item.name}
							/>
						</h2>
						<div className="flex flex-col items-end">
							<p className="text-lg font-bold text-puce">
								${item.price.toFixed(2)}
							</p>
							<p className="text-xs text-gray-600">
								Cost: ${(item.cost || 0).toFixed(2)}
							</p>
						</div>
					</div>

					{/* Profit and margin visualization */}
					<div className="mt-2 bg-gray-50 p-2 rounded-lg">
						<div className="grid grid-cols-2 gap-2 text-xs">
							<div>
								<p className="text-gray-500">Profit/unit</p>
								<p className="font-bold text-sm">${profitPerUnit.toFixed(2)}</p>
							</div>
							<div>
								<p className="text-gray-500">Margin</p>
								<p className={`font-bold text-sm ${marginColorClass}`}>
									{marginPercent.toFixed(1)}%
								</p>
							</div>
							<div>
								<p className="text-gray-500">Units sold</p>
								<p className="font-bold text-sm">{item.soldUnits || 0}</p>
							</div>
							<div>
								<p className="text-gray-500">Total profit</p>
								<p className="font-bold text-sm">${totalProfit.toFixed(2)}</p>
							</div>
						</div>
					</div>

					<p className="text-gray-600 text-sm mt-2 line-clamp-2">
						<Highlighter
							highlightClassName="bg-yellow-200"
							searchWords={[searchTerm]}
							autoEscape
							textToHighlight={item.description}
						/>
					</p>

					<div className="mt-3 flex justify-between items-center">
						<p className="text-sm text-gray-500">In stock: {item.units}</p>
					</div>

					<div className="mt-2 flex flex-wrap gap-1">
						{item.tags &&
							item.tags.map((tag) => (
								<span
									key={tag}
									className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded"
								>
									{tag}
								</span>
							))}
					</div>

					{item.barcode && (
						<p className="mt-2 text-xs text-gray-500">
							<Highlighter
								highlightClassName="bg-yellow-200"
								searchWords={[searchTerm]}
								autoEscape
								textToHighlight={item.barcode}
							/>
						</p>
					)}

					<div className="mt-4 flex space-x-2">
						<Link
							href={`/vendor/inventory/view/${item.itemID}`}
							className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-1 px-3 rounded text-sm flex-1 text-center"
						>
							View
						</Link>
						<button
							onClick={() =>
								router.push(`/vendor/inventory/edit/${item.itemID}`)
							}
							className="bg-gray-100 cursor-pointer hover:bg-gray-200 text-gray-700 py-1 px-3 rounded text-sm flex-1"
						>
							Edit
						</button>
						<button
							className="bg-red-100 cursor-pointer hover:bg-red-200 text-red-700 py-1 px-3 rounded text-sm"
							onClick={() => {
								setItemToDelete({ id: item.itemID!, name: item.name });
								setDeleteModalOpen(true);
							}}
						>
							Delete
						</button>
					</div>
				</div>
			</div>
		);
	};

	// Loading state
	if (isLoading) {
		return (
			<div className="min-h-screen bg-gray-50 flex justify-center items-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-puce mx-auto"></div>
					<p className="mt-4 text-gray-600">Loading inventory...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<header>
				<VendorNavBar vendorData={vendorData} />
			</header>

			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
				{/* Error message */}
				{error && (
					<div className="bg-red-100 text-red-700 p-4 rounded mb-6">
						{error}
					</div>
				)}

				{/* Page header */}
				<div className="flex justify-between items-center mb-6">
					<h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
					<Link
						href="/vendor/inventory/add"
						className="bg-puce hover:bg-rose text-white py-2 px-4 rounded-lg shadow-md flex items-center"
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
								d="M12 6v6m0 0v6m0-6h6m-6 0H6"
							/>
						</svg>
						Add New Item
					</Link>
				</div>

				{/* Search component */}
				{inventoryItems.length > 0 && (
					<InventorySearch
						items={inventoryItems}
						onFilteredItemsChange={handleFilteredItemsChange}
						onSearchTermChange={setSearchTerm}
					/>
				)}

				{/* Inventory statistics */}
				{filteredItems.length > 0 && renderInventoryStats()}

				{/* Empty inventory state */}
				{inventoryItems.length === 0 ? (
					<div className="bg-white shadow rounded-lg p-6 text-center">
						<p className="text-gray-500 mb-4">
							Your inventory is empty. Start adding items to your store!
						</p>
						<Link
							href="/vendor/inventory/add"
							className="bg-puce hover:bg-rose text-white py-2 px-4 rounded-full shadow-md inline-block"
						>
							Add Your First Item
						</Link>
					</div>
				) : filteredItems.length === 0 ? (
					<div className="bg-white shadow rounded-lg p-6 text-center">
						<p className="text-gray-500 mb-4">
							No items match your search criteria. Try adjusting your filters.
						</p>
						<button
							onClick={() => setFilteredItems(inventoryItems)}
							className="bg-gray-200 hover:bg-gray-300 cursor-pointer text-gray-700 py-2 px-4 rounded-full shadow-md inline-block"
						>
							Show All Items
						</button>
					</div>
				) : (
					/* Item grid */
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{filteredItems.map(renderItemCard)}
					</div>
				)}
			</main>

			<Footer />

			{/* Delete confirmation modal */}
			<DeleteConfirmationModal
				isOpen={deleteModalOpen}
				itemName={itemToDelete?.name || ""}
				onCancel={() => {
					setDeleteModalOpen(false);
					setItemToDelete(null);
				}}
				onConfirm={handleDeleteItem}
				isDeleting={isDeleting}
			/>
		</div>
	);
}
