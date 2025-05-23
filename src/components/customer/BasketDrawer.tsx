import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useBasket } from "@/components/customer/context/BasketContext";
import CartCardListings from "./cartCard";
import { Vendor } from "@/components/customer/VendorListingSection";

interface BasketDrawerProps {
	vendorList: Vendor[];
}

const BasketDrawer: React.FC<BasketDrawerProps> = ({ vendorList }) => {
	const [open, setOpen] = useState(false);
	const baskets = useBasket();
	const [vendorMap, setVendorMap] = useState<Record<string, Vendor>>({});

	useEffect(() => {
		// Create a map of vendor IDs to vendor objects for efficient lookup
		if (vendorList && vendorList.length > 0) {
			const map: Record<string, Vendor> = {};
			vendorList.forEach((vendor) => {
				if (vendor && vendor.uid) {
					map[vendor.uid] = vendor;
				}
			});
			setVendorMap(map);
		}
	}, [vendorList]);

	const openBasket = () => {
		setOpen(true);

		const basketDrawer = document.getElementById("basketDrawer");
		const drawerBG = document.getElementById("drawer-bg");

		if (drawerBG && basketDrawer) {
			drawerBG.classList.add("fixed");
			basketDrawer.classList.remove("hidden");
			basketDrawer.classList.add("fixed");
		}
	};

	const closeBasket = () => {
		setOpen(false);

		const basketDrawer = document.getElementById("basketDrawer");
		const drawerBG = document.getElementById("drawer-bg");

		if (drawerBG && basketDrawer) {
			drawerBG.classList.remove("fixed");
			basketDrawer.classList.remove("fixed");
			basketDrawer.classList.add("hidden");
		}
	};

	function closeDrawerBackgroundClick(e: React.MouseEvent<HTMLDivElement>) {
		if ((e.target as HTMLElement).id === "drawer-bg") {
			closeBasket();
		}
	}

	const handlePlaceOrder = () => {
		closeBasket();
	};

	const basketItemCount = baskets.getTotalCount();

	return (
		<div>
			<button
				className="fixed cursor-pointer z-60 bottom-10 right-10 w-17 h-17 bg-white rounded-full p-2 !shadow-md hover:bg-gray-200 group flex items-center justify-center hover:cursor-pointer"
				type="button"
				onClick={() => (open ? closeBasket() : openBasket())}
			>
				<div className="relative">
					<Image
						src="/shopping_basket.svg"
						alt="open basket"
						width={24}
						height={24}
						className="w-10 h-10"
					/>
					{basketItemCount > 0 && (
						<div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
							{basketItemCount}
						</div>
					)}
				</div>
			</button>

			<div
				id="drawer-bg"
				className="inset-0 z-50 flex items-center justify-center bg-gray-200/70 bg-opacity-10"
				onClick={closeDrawerBackgroundClick}
			>
				<div
					id="basketDrawer"
					className="hidden left-0 top-0 z-60 h-screen p-4 overflow-y-auto transition-transform duration-300 transform bg-white shadow-lg w-80 sm:w-120 md:w-[35rem] lg:w-[40rem]"
					tabIndex={-1}
					aria-labelledby="drawer-label"
				>
					<div className="relative grid gap-4 z-11">
						<div className="absolute text-black bg-white rounded-4xl !shadow-lg p-6 col-span-10">
							<h1 className="font-bold text-3xl">Your Basket</h1>
							<p className="text-sm text-gray-500">
								Each vendor&apos;s items are grouped separately because
								deliveries are made by individual shops.
							</p>
						</div>
						<button
							className="cursor-pointer absolute bg-white rounded-full p-2 !shadow-md hover:bg-gray-200 col-span-2 justify-self-end hover:cursor-pointer"
							aria-label="close modal"
							onClick={closeBasket}
						>
							<Image src="/X.svg" alt="close" width={50} height={50} />
						</button>
					</div>

					<div className="text-sm mb-4 text-gray-500 dark:text-gray-400 absolute z-10 left-10 right-10">
						<div className="pointer-events-none absolute top-0 left-0 right-0 h-60 bg-gradient-to-b from-white to-transparent z-10" />
						<div className="overflow-y-auto max-h-[calc(100vh-3rem)] scrollbar-hide">
							<div className="h-30" />
							{Object.keys(baskets.baskets).length > 0 ? (
								Object.keys(baskets.baskets).map((vendorId) => (
									<CartCardListings
										key={vendorId}
										shopName={vendorMap[vendorId]?.shopName || "Unknown Shop"}
										basket={baskets.baskets[vendorId]}
										vendorId={vendorId}
										vendor={vendorMap[vendorId]}
										onPlaceOrder={() => handlePlaceOrder()}
									/>
								))
							) : (
								<div className="mt-32 text-center">
									<p className="text-lg font-medium text-gray-700">
										Your basket is empty
									</p>
									<p className="text-sm text-gray-500 mt-2 mb-4">
										Browse products and add items to your basket
									</p>
								</div>
							)}

							{Object.keys(baskets.baskets).length > 0 && (
								<div className="mt-8 bg-white rounded-xl p-4 !shadow-md">
									<div className="flex justify-between items-center">
										<span className="font-bold text-xl text-gray-800">
											Subtotal all vendors:
										</span>
										<span className="font-bold text-xl text-gray-800">
											${baskets.getTotalPrice().toFixed(2)}
										</span>
									</div>
									<p className="text-sm text-gray-500 mt-2">
										Note: Each vendor will fulfill their portion of your order
										separately.
									</p>
								</div>
							)}
						</div>
						<div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white to-transparent" />
					</div>
				</div>
			</div>
		</div>
	);
};
export default BasketDrawer;
