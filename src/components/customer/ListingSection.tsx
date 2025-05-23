import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { InventoryItem } from "@/firebase/inventory";
import Image from "next/image";
import { useModal } from "@/components/customer/context/ModalContext";
import ProductModal from "@/components/customer/ProductModal";
import { useBasket } from "@/components/customer/context/BasketContext";
import { Vendor } from "./VendorListingSection";
import { useAuth } from "@/hooks/useAuth";
import {
	sortByPopularity,
	sortByNewest,
	filterOnSale,
	getStoredUserCoordinates, // Import the new function
	getVendorsByDistance,
	getItemsByProximity,
} from "@/utils/productSorting";

interface Listings {
	items: InventoryItem[];
	vendors: Vendor[];
	displayTags?: string[];
	displayType?: "popular" | "nearby" | "new" | "sale";
}

export default function Carousel({
	items,
	vendors,
	displayTags,
	displayType,
}: Listings) {
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const [displayItems, setDisplayItems] = useState<InventoryItem[]>([]);
	const [loading, setLoading] = useState(true);
	const { user } = useAuth(); // Get the current authenticated user

	// Exclude vendors based on their IDs
	const excludedVendorIds = React.useMemo(
		() => ["4kKTsNNRFbeT2BBdrYmsznSPh863", "pe2rS59tleNcWdztp1dpt22HJOX2"],
		[]
	);

	// Process items based on displayType
	useEffect(() => {
		const processItems = async () => {
			setLoading(true);
			let processedItems: InventoryItem[] = [...items].filter(
				(item) => !excludedVendorIds.includes(item.vendorID)
			);

			// Filter by tags if provided
			if (displayTags && displayTags.length > 0) {
				processedItems = processedItems.filter(
					(item) =>
						item.tags && item.tags.some((tag) => displayTags.includes(tag))
				);
			}

			// Apply sorting/filtering based on display type if provided
			if (displayType) {
				switch (displayType) {
					case "popular":
						processedItems = sortByPopularity(processedItems);
						break;

					case "nearby":
						try {
							// Get stored coordinates rather than using browser geolocation
							const userCoordinates = await getStoredUserCoordinates(
								user?.uid || ""
							);
							const { distances } = getVendorsByDistance(
								vendors,
								userCoordinates
							);
							processedItems = getItemsByProximity(processedItems, distances);
						} catch (error) {
							console.error("Error sorting by distance:", error);
							// Fallback to popularity if distance sorting fails
							processedItems = sortByPopularity(processedItems);
						}
						break;

					case "new":
						processedItems = sortByNewest(processedItems);
						break;

					case "sale":
						processedItems = filterOnSale(processedItems);
						break;
				}
			}

			// Take only the first 15 items for the carousel
			setDisplayItems(processedItems.slice(0, 15));
			setLoading(false);
		};

		processItems();
	}, [items, vendors, displayTags, displayType, user, excludedVendorIds]);

	const scroll = (direction: "left" | "right") => {
		if (!scrollRef.current) return;
		const scrollAmount = window.innerWidth * 0.5;
		const scrollContainer = scrollRef.current;

		if ("scrollBy" in scrollContainer) {
			scrollContainer.scrollBy({
				left: direction === "left" ? -scrollAmount : scrollAmount,
				behavior: "smooth",
			});
		} else {
			(scrollContainer as HTMLDivElement).scrollLeft +=
				direction === "left" ? -scrollAmount : scrollAmount;
		}
	};

	if (loading) {
		return (
			<div className="flex justify-center items-center h-40">
				<div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
			</div>
		);
	}

	// If no items after processing, show a message
	if (displayItems.length === 0) {
		return (
			<div className="flex justify-center items-center h-40 bg-gray-50 rounded-lg">
				<p className="text-gray-500">No items available in this category.</p>
			</div>
		);
	}

	return (
		<div className="relative w-full max-w-screen mx-auto flex flex-col justify-center">
			<button
				onClick={() => scroll("left")}
				className="absolute cursor-pointer left-3 top-1/2 -translate-y-1/2 z-10 bg-white/70 hover:bg-gray-200 p-2 rounded-full !shadow-md hover:cursor-pointer"
				aria-label="Scroll Left"
			>
				<ChevronLeft className="text-black" />
			</button>

			<div
				ref={scrollRef}
				className="flex space-x-5 overflow-x-hidden mb-5 p-4 bg-gray-50 rounded-lg !shadow-md scrollbar-hide"
			>
				{displayItems.map((item) => (
					<ListingCard
						key={item.itemID}
						item={item}
						vendor={vendors.find((vendor) => vendor.uid === item.vendorID)}
					>
						<div className="max-w-[200px] overflow-hidden">
							<h3 className="text-lg font-bold text-black truncate">
								{item.name}
							</h3>
						</div>
						<p className="text-sm text-gray-600">
							{vendors.find((vendor) => vendor.uid === item.vendorID)
								?.shopName || `Vendor ID: ${item.vendorID}`}
						</p>
						<p className="text-sm font-semibold text-gray-600">
							${item.price.toFixed(2)}
						</p>
					</ListingCard>
				))}
			</div>

			<button
				onClick={() => scroll("right")}
				className="absolute cursor-pointer right-3 top-1/2 -translate-y-1/2 z-5 bg-white/70 hover:bg-gray-200 p-2 rounded-full !shadow-md hover:cursor-pointer"
				aria-label="Scroll Right"
			>
				<ChevronRight className="text-black" />
			</button>

			<div>
				<ProductModal />
			</div>
		</div>
	);
}

interface ListingCardProps {
	item: InventoryItem;
	vendor?: Vendor;
	children: React.ReactNode;
}

export function ListingCard({ item, vendor, children }: ListingCardProps) {
	const { openModal } = useModal();
	const basket = useBasket();
	const itemCount = basket.getItemCount(item);
	const [isInputFocused, setIsInputFocused] = React.useState(false);

	function updateBasketQuantity(change: number, e: React.MouseEvent) {
		e.stopPropagation(); // Prevent card click

		const currentCount = basket.getItemCount(item);
		const newCount = Math.max(0, currentCount + change);

		if (newCount === 0) {
			basket.removeFromBasket(item);
		} else if (item.units && newCount <= item.units) {
			basket.updateBasket(item, newCount);
		}
	}

	function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
		e.stopPropagation(); // Prevent card click

		const value = e.target.value;
		const newCount = parseInt(value, 10);

		if (isNaN(newCount)) return;

		if (newCount === 0) {
			basket.removeFromBasket(item);
		} else if (item.units && newCount <= item.units) {
			basket.updateBasket(item, newCount);
		} else if (item.units) {
			basket.updateBasket(item, item.units);
		}
	}

	function handleInputFocus(e: React.FocusEvent) {
		e.stopPropagation(); // Prevent card click
		setIsInputFocused(true);
	}

	function handleInputBlur(e: React.FocusEvent) {
		e.stopPropagation(); // Prevent card click
		setIsInputFocused(false);
	}

	function handleCardClick(e: React.MouseEvent) {
		// Get the event target and check if it's the basket controls area
		const target = e.target as HTMLElement;

		// Check if it's part of the basket controls
		if (
			target.tagName === "INPUT" ||
			target.tagName === "BUTTON" ||
			target.closest("button") ||
			isInputFocused ||
			target.closest(".basket-controls")
		) {
			return; // Don't open modal if clicking on basket controls
		}

		// Open the modal with current data
		openModal({
			item,
			vendor,
			amount: itemCount,
		});
	}

	// Determine if item is on sale
	const isOnSale =
		item.tags &&
		item.tags.some((tag) =>
			["sale", "discount", "promo", "deal", "special", "offer"].some(
				(keyword) => tag.toLowerCase().includes(keyword)
			)
		);

	return (
		<div
			className="min-w-[200px] max-h-[250] max-w-sm rounded-lg overflow-hidden !shadow-lg group hover:cursor-pointer relative"
			onClick={handleCardClick}
		>
			<div className="w-full h-40 overflow-hidden relative">
				<Image
					src={item.image}
					alt={item.name || "Product Image"}
					width={400}
					height={160}
					className="transition-transform group-hover:scale-110 duration-200"
				/>

				{/* Display "Out of Stock" if no units available */}
				{item.units <= 0 && (
					<div className="absolute inset-0 bg-black/50 flex items-center justify-center">
						<span className="text-white font-bold px-2 py-1 bg-red-500 rounded">
							Out of Stock
						</span>
					</div>
				)}
			</div>

			<div className="px-4 pb-2 pt-2 bg-white hover:bg-gray-100 flex flex-col border-2 border-gray-200 rounded-b-lg">
				{children}
			</div>

			{/* Basket control buttons */}
			{item.units > 0 && (
				<div
					className="absolute bottom-3 right-3 flex items-center basket-controls"
					onClick={(e) => e.stopPropagation()}
				>
					{itemCount > 0 ? (
						<div className="flex items-center bg-white rounded-full !shadow-md overflow-hidden">
							<button
								className="p-1 cursor-pointer hover:bg-red-100 transition-colors"
								onClick={(e) => updateBasketQuantity(-1, e)}
								aria-label="Decrease quantity"
							>
								<Image
									src="/remove.svg"
									alt="Remove one"
									width={22}
									height={22}
								/>
							</button>

							<input
								type="number"
								min="0"
								max={item.units}
								value={itemCount}
								onChange={handleInputChange}
								onFocus={handleInputFocus}
								onBlur={handleInputBlur}
								className="w-12 text-center font-semibold text-gray-800 border-none focus:ring-1 focus:ring-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
								onClick={(e) => e.stopPropagation()}
							/>

							<button
								className="p-1 cursor-pointer hover:bg-green-100 transition-colors"
								onClick={(e) => updateBasketQuantity(1, e)}
								aria-label="Increase quantity"
								disabled={!!item.units && itemCount >= item.units}
							>
								<Image
									src="/add.svg"
									alt="Add one"
									width={22}
									height={22}
									className={`${
										item.units && itemCount >= item.units ? "opacity-50" : ""
									}`}
								/>
							</button>
						</div>
					) : (
						<button
							className="bg-white cursor-pointer rounded-full p-2 !shadow-md hover:bg-blue-100 transition-colors"
							onClick={(e) => updateBasketQuantity(1, e)}
							aria-label="Add to basket"
						>
							<Image
								src="/add.svg"
								alt="Add to basket"
								width={24}
								height={24}
							/>
						</button>
					)}
				</div>
			)}

			{/* Sale tag if applicable */}
			{isOnSale && (
				<div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
					SALE
				</div>
			)}
		</div>
	);
}
