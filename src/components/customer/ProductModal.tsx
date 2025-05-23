"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { InventoryItem } from "@/firebase/inventory";
import { useBasket } from "@/components/customer/context/BasketContext";
import { useModal } from "@/components/customer/context/ModalContext";
import { Vendor } from "./VendorListingSection";
import { useRouter, usePathname } from "next/navigation";

const ProductModal: React.FC = () => {
	const { modalData, closeModal } = useModal();
	const basket = useBasket();
	const [addable, setAddable] = useState(true);
	const [quantity, setQuantity] = useState<number>(0);
	const [vendor, setVendor] = useState<Vendor | undefined>();
	const [item, setItem] = useState<InventoryItem | undefined>();
	const [showMore, setShowMore] = useState(false);
	const [isInBasket, setIsInBasket] = useState(false);

	// Use ref to track if we need to sync from basket
	const initializedRef = useRef(false);

	const router = useRouter();
	const pathname = usePathname();

	// Initial setup from modalData - runs only once when modal opens
	useEffect(() => {
		if (modalData && !initializedRef.current) {
			const { item, vendor } = modalData;

			// Check if item exists
			if (!item) {
				console.error("Error: Item is undefined in modal data");
				closeModal();
				return;
			}

			// Set current item quantity from basket
			const currentQuantity = basket.getItemCount(item);
			setQuantity(currentQuantity);
			setItem(item);
			setVendor(vendor);

			// Set addable state based on quantity and item units
			const isAddable = !item.units || currentQuantity < item.units;
			setAddable(isAddable);

			// Check if item is already in basket
			setIsInBasket(currentQuantity > 0);

			// Mark as initialized
			initializedRef.current = true;

			// Setup modal DOM visibility
			const modalBG = document.getElementById("modal-bg");
			const modal = document.getElementById("modal");

			if (modalBG) {
				modalBG.classList.add("fixed");
			}

			if (modal) {
				modal.classList.remove("hidden");
			}
		}

		// Reset initialization when modal closes
		return () => {
			if (!modalData) {
				initializedRef.current = false;
			}
		};
	}, [modalData, basket, closeModal]);

	// Update basket only when "Add to Basket" button is clicked
	const updateQuantity = (change: number) => {
		if (!item) return;

		const newQuantity = quantity + change;
		// ensure that quantity is not less than 0 and not more than item.units
		if (newQuantity < 0) return;

		// Check if we can add this quantity
		let newAddable = true;
		if (item.units && newQuantity > item.units) {
			newAddable = false;
			return;
		}

		setQuantity(newQuantity);
		setAddable(newAddable);
		setIsInBasket(basket.getItemCount(item) > 0);
	};

	// Handle the quantity change while typing
	const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;

		// Check if the value is a number or empty
		if (value === "" || !isNaN(Number(value))) {
			const numValue = value === "" ? 0 : parseInt(value, 10);
			setQuantity(numValue);

			// Update addable state based on new quantity
			if (item && item.units && numValue > item.units) {
				setAddable(false);
			} else {
				setAddable(true);
			}
		}
	};

	const handleBlur = () => {
		if (!item) return;

		// Ensure that the quantity is within bounds when the input loses focus
		if (quantity < 0) {
			setQuantity(0);
		} else if (item.units && quantity > item.units) {
			setQuantity(item.units);
		}
		setAddable(true);
	};

	const handleClose = (e: React.MouseEvent<HTMLDivElement>) => {
		if (e && (e.target as HTMLElement).id === "modal-bg") {
			closeModal();
		}
	};

	const handleShopRouting = () => {
		if (vendor?.uid) {
			const targetRoute = `/customer/order/vendor/${vendor.uid}`;
			if (pathname !== targetRoute) {
				router.push(targetRoute);
				closeModal();
			} else {
				console.log("User is already on the vendor's order page.");
			}
		}
	};

	const handleAddToBasket = () => {
		if (!item || !addable) return;

		// This is the ONLY place we update the basket
		if (quantity === 0) {
			basket.removeFromBasket(item);
			setIsInBasket(false);
		} else {
			basket.updateBasket(item, quantity);
			setIsInBasket(true);
		}

		// Close the modal after adding to basket
		closeModal();
	};

	// Don't render anything if no modal data
	if (!modalData || !item) return null;

	const buttonDisabled = !addable || quantity === 0;
	const buttonText = isInBasket ? "Update Basket" : "Add to Basket";

	return (
		<div
			id="modal-bg"
			className="inset-0 z-50 flex items-center justify-center bg-gray-200/70 bg-opacity-10"
			onClick={(e) => handleClose(e)}
		>
			<div
				id="modal"
				className="hidden relative bg-white rounded-4xl !shadow-lg p-6 w-full max-w-2xl mx-4"
				style={{ maxHeight: "90vh" }} // Set max height relative to viewport
				onClick={(e) => e.stopPropagation()}
			>
				<div
					className="overflow-y-auto"
					style={{ maxHeight: "calc(90vh - 3rem)" }}
				>
					<div className="flex flex-col items-center">
						<button
							id="close-modal"
							className="absolute cursor-pointer top-4 right-12 bg-white rounded-full p-2 !shadow-md hover:bg-gray-200 hover:cursor-pointer"
							aria-label="close modal"
							onClick={closeModal}
						>
							<Image src="/X.svg" alt="Close" width={24} height={24} />
						</button>

						<div>
							<dl>
								<div>
									<dt className="mt-0 text-sm text-gray-900 sm:mt-0 sm:col-span-2 justify-center flex items-center">
										{item.image ? (
											<Image
												src={item.image}
												alt={item.name || "Product Image"}
												width={160}
												height={160}
												className="object-cover mb-4"
											/>
										) : (
											<div className="w-40 h-40 bg-gray-200 flex items-center justify-center mb-4">
												No Image
											</div>
										)}
									</dt>
									<dd>
										<button
											className="absolute cursor-pointer bg-white rounded-full p-2 left-1 top-15 !shadow-md hover:bg-gray-200 hover:cursor-pointer"
											aria-label="flip image"
											onClick={(e) => e.stopPropagation()} // Don't close the modal
										>
											<Image
												src="/flip_image.svg"
												alt="Flip"
												width={24}
												height={24}
											/>
										</button>
									</dd>
								</div>

								<div className="bg-gray-50 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
									<dt className="mt-1 text-xl font-extrabold text-black sm:mt-0 sm:col-span-2">
										{item.name || "Not set"}
									</dt>
								</div>

								<div className="bg-white sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
									<dd className="mt-1 text-xl font-semibold text-gray-700 sm:mt-0 sm:col-span-2">
										${item.price.toFixed(2)}
									</dd>
								</div>

								<div className="border-t"></div>

								<div className="bg-gray-50 px-1 py-1 mt-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
									<dt className="text-sm font-medium text-gray-500">
										Item Description:
									</dt>
									<dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
										{item.description || "Not available"}
									</dd>
								</div>

								<div className="bg-gray-50 px-1 py-1 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
									<dt className="text-sm font-medium text-gray-500">Vendor:</dt>
									<dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
										<button
											className="relative cursor-pointer px-4 py-2 rounded-full hover:cursor-pointer bg-white text-gray-900 hover:bg-gray-200 !shadow-md"
											onClick={handleShopRouting}
										>
											{vendor?.shopName || "Unknown Vendor"}
										</button>
									</dd>
								</div>

								<div className="bg-white px-1 py-1 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
									{item.units && item.units > 0 ? (
										<>
											<dt className="text-sm font-medium text-gray-500">
												Stock:
											</dt>
											<dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
												{item.units}
											</dd>
										</>
									) : (
										<>
											<dt className="text-sm font-medium text-gray-500">
												Stock:
											</dt>
											<dd className="mt-1 text-sm text-red-500 font-bold sm:mt-0 sm:col-span-2">
												Out of Stock
											</dd>
										</>
									)}
								</div>
							</dl>
						</div>

						{item.units && item.units > 0 && (
							<div className="grid grid-cols-3 gap-3 mt-10">
								<div className="flex flex-col items-center">
									<label
										htmlFor="quantity-input"
										className="block mb-2 text-sm font-medium text-gray-900"
									>
										Choose quantity:
									</label>
									<div className="relative flex items-center max-w-[8rem]">
										<button
											type="button"
											id="decrement-button"
											className="bg-white cursor-pointer hover:bg-gray-200 rounded-l-full p-3 h-11 !shadow-xl hover:cursor-pointer"
											onClick={() => updateQuantity(-1)}
										>
											<Image
												className="text-black"
												aria-hidden="true"
												src="/remove.svg"
												alt="Decrease"
												width={24}
												height={24}
											/>
										</button>
										<input
											type="number"
											id="quantity-input"
											className="bg-white border-x-0 h-11 text-center !shadow-xl text-gray-900 text-sm focus:ring-blue-500 focus:border-blue-500 block w-full py-2.5 hover:cursor-pointer [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
											placeholder={quantity.toString()}
											value={quantity}
											onChange={handleQuantityChange}
											onBlur={handleBlur}
											max={item.units || undefined}
											required
										/>
										<button
											type="button"
											id="increment-button"
											className="bg-white cursor-pointer hover:bg-gray-200 rounded-r-full p-3 h-11 !shadow-xl hover:cursor-pointer"
											onClick={() => updateQuantity(1)}
										>
											<Image
												className="text-black"
												aria-hidden="true"
												src="/add.svg"
												alt="Increase"
												width={24}
												height={24}
											/>
										</button>
									</div>
								</div>

								<div className="flex flex-col w-full items-center mt-8">
									<span className="text-sm font-semibold text-gray-700 overflow-hidden max-w-[400px]">
										Total: {quantity} x ${item.price.toFixed(2)}
									</span>
									<span className="text-sm font-semibold text-gray-700">
										= ${(quantity * item.price).toFixed(2)}
									</span>
								</div>

								<div className="flex flex-col items-center mt-4">
									<button
										className={`relative cursor-pointer mt-4 px-4 py-2 rounded-full hover:cursor-pointer ${
											!buttonDisabled
												? "bg-blue-500 text-white hover:bg-blue-600 !shadow"
												: "bg-gray-400 text-gray-300 cursor-not-allowed"
										}`}
										onClick={handleAddToBasket}
										disabled={buttonDisabled}
									>
										{buttonText}
									</button>
								</div>
							</div>
						)}

						{/* More Details Dropdown */}
						<div className="mt-6 w-full px-4">
							<button
								className="text-sm text-blue-600 cursor-pointer hover:underline hover:cursor-pointer"
								onClick={() => setShowMore((prev) => !prev)}
							>
								{showMore ? "Hide" : "Show"} More Details
							</button>

							{showMore && (
								<div className="mt-4 space-y-1 text-sm text-gray-700 border-t pt-4 w-full">
									<div className="bg-gray-50 px-1 py-1 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
										<dt className="text-sm font-medium text-gray-500">
											Sold Units:
										</dt>
										<dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
											{item.soldUnits ?? "N/A"}
										</dd>
									</div>
									<div className="bg-gray-50 px-1 py-1 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
										<dt className="text-sm font-medium text-gray-500">
											Barcode:
										</dt>
										<dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
											{item.barcode || "N/A"}
										</dd>
									</div>
									<div className="bg-gray-50 px-1 py-1 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
										<dt className="text-sm font-medium text-gray-500">
											Created At:
										</dt>
										<dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
											{item.created_at?.toDate?.()?.toLocaleString() || "N/A"}
										</dd>
									</div>
									<div className="bg-gray-50 px-1 py-1 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
										<dt className="text-sm font-medium text-gray-500">
											Last Updated:
										</dt>
										<dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
											{item.updated_at?.toDate?.()?.toLocaleString() || "N/A"}
										</dd>
									</div>
									{item.tags && item.tags.length > 0 && (
										<div className="bg-gray-50 px-1 py-1 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
											<dt className="text-sm font-medium text-gray-500">
												Tags:
											</dt>
											<dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
												{item.tags.join(", ")}
											</dd>
										</div>
									)}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default ProductModal;
