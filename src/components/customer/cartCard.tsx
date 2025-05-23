import React, { useState, useEffect } from "react";
import { BasketItem, useBasket } from "./context/BasketContext";
import Image from "next/image";
import { InventoryItem } from "@/firebase/inventory";
import { useModal } from "@/components/customer/context/ModalContext";
import { Vendor } from "@/components/customer/VendorListingSection";
import { useRouter } from "next/navigation";
import { useStripe, useElements, CardElement } from "@stripe/react-stripe-js";
import {
	doc,
	addDoc,
	updateDoc,
	collection,
	arrayUnion,
	Timestamp,
	getDoc,
	GeoPoint,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/hooks/useAuth";
import { addOrderToUser } from "@/firebase/auth";
import LoadingScreen from "../shared/LoadingScreen";
import {
	getEnhancedDeliveryInfo,
	getFallbackDeliveryInfo,
	DEFAULT_TIP_OPTIONS,
	TipOption,
	DeliveryInfo,
	calculateTipAmount,
} from "@/services/deliveryService";

interface CartCardProps {
	vendorId: string;
	shopName: string;
	basket: BasketItem[];
	vendor: Vendor | null;
	onPlaceOrder?: () => void;
}

interface UserProfile {
	uid: string;
	displayName: string;
	email: string;
	phoneNumber?: string;
	location?: string;
	coordinates?: GeoPoint;
}

const CARD_ELEMENT_OPTIONS = {
	style: {
		base: {
			color: "#32325d",
			fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
			fontSmoothing: "antialiased",
			fontSize: "16px",
			"::placeholder": {
				color: "#aab7c4",
			},
		},
		invalid: {
			color: "#fa755a",
			iconColor: "#fa755a",
		},
	},
};

const CartCardListings: React.FC<CartCardProps> = ({
	vendorId,
	onPlaceOrder,
}) => {
	const [isOpen, setIsOpen] = useState(true);
	const [processing, setProcessing] = useState(false);
	const [paymentError, setPaymentError] = useState("");
	const [paymentSuccess, setPaymentSuccess] = useState(false);
	const [vendor, setVendor] = useState<Vendor | null>(null);
	const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
	const [shopName, setShopName] = useState("");

	// Split delivery info into two parts: base delivery info (distance-based) and tip
	const [baseDeliveryInfo, setBaseDeliveryInfo] = useState<DeliveryInfo | null>(
		null
	);
	const [isLoadingDeliveryInfo, setIsLoadingDeliveryInfo] = useState(false);
	const [selectedTipOption, setSelectedTipOption] = useState<TipOption>(
		DEFAULT_TIP_OPTIONS[0]
	);
	const [customTipAmount, setCustomTipAmount] = useState<number>(0);
	const [customTipPercent, setCustomTipPercent] = useState<number>(0);

	const { openModal } = useModal();
	const {
		basket,
		removeFromBasket,
		updateBasket,
		clearVendorBasket,
		clearFromBasket,
		activePaymentVendorId,
		setActivePaymentVendorId,
	} = useBasket();
	const router = useRouter();
	const { user: authUser } = useAuth();
	const stripe = useStripe();
	const elements = useElements();

	// Filter basket items for this vendor
	const vendorBasket = basket.filter(
		(item: BasketItem) => item.item.vendorID === vendorId
	);

	// Calculate subtotal separately
	const subtotal = vendorBasket.reduce(
		(total: number, item: BasketItem) =>
			total + item.quantity * item.item.price,
		0
	);

	// Calculate tip amount based on current subtotal and tip options
	const tipAmount = calculateTipAmount(
		selectedTipOption,
		subtotal,
		selectedTipOption.type === "custom" ? customTipAmount : undefined
	);

	// Calculate financial details
	const calculateTotals = () => {
		// Use distance-based delivery fee if available, otherwise use base fee
		const deliveryFee = baseDeliveryInfo
			? baseDeliveryInfo.deliveryFee
			: subtotal > 0
			? 5
			: 0;
		const tax = +(subtotal * 0.07).toFixed(2);
		const serviceFee = +(subtotal * 0.05).toFixed(2);

		const total = +(
			subtotal +
			deliveryFee +
			tax +
			serviceFee +
			tipAmount
		).toFixed(2);

		return { subtotal, deliveryFee, tax, serviceFee, tip: tipAmount, total };
	};

	const { deliveryFee, tax, serviceFee, tip, total } = calculateTotals();

	// Fetch vendor data when component mounts
	useEffect(() => {
		const fetchVendorData = async () => {
			try {
				// Fetch vendor details
				const vendorSnap = await getDoc(doc(db, "vendors", vendorId));
				if (vendorSnap.exists()) {
					const vendorData = vendorSnap.data() as Vendor;
					setVendor(vendorData);
					setShopName(vendorData.shopName);
				}
			} catch (error) {
				console.error("Error fetching vendor data:", error);
			}
		};

		fetchVendorData();
	}, [vendorId]);

	// Fetch user profile if authenticated
	useEffect(() => {
		const fetchUserProfile = async () => {
			if (!authUser?.uid) return;

			try {
				const userSnap = await getDoc(doc(db, "users", authUser.uid));
				if (userSnap.exists()) {
					const userData = userSnap.data();
					setUserProfile({
						uid: authUser.uid,
						displayName: userData.displayName || authUser.displayName || "",
						email: userData.email || authUser.email || "",
						phoneNumber: userData.phoneNumber || authUser.phoneNumber || "",
						location: userData.location || "",
						coordinates: userData.coordinates || null,
					});
				} else {
					// If user doesn't exist in db yet, use auth info as fallback
					setUserProfile({
						uid: authUser.uid,
						displayName: authUser.displayName || "",
						email: authUser.email || "",
						phoneNumber: authUser.phoneNumber || "",
						location: "",
						coordinates: undefined,
					});
				}
			} catch (error) {
				console.error("Error fetching user profile:", error);
			}
		};

		fetchUserProfile();
	}, [
		authUser?.uid,
		authUser?.displayName,
		authUser?.email,
		authUser?.phoneNumber,
	]);

	// Calculate ONLY distance-based delivery info when vendor or user profile changes
	// This effect no longer depends on subtotal or tip options
	useEffect(() => {
		const calculateDistanceBasedDeliveryInfo = async () => {
			// Only calculate if vendor and user have valid coordinates
			if (
				!vendor ||
				!userProfile ||
				!vendor.coordinates ||
				!userProfile.coordinates
			) {
				return;
			}

			// Only if the basket has items (we still need at least one item)
			if (vendorBasket.length === 0) {
				return;
			}

			setIsLoadingDeliveryInfo(true);

			try {
				console.log("Calculating delivery distance...");
				// Use a default tip option (no tip) for the distance calculation
				// This separates the distance/fee calculation from the tip calculation
				const distanceInfo = await getEnhancedDeliveryInfo(
					userProfile.coordinates,
					new GeoPoint(
						vendor.coordinates.latitude,
						vendor.coordinates.longitude
					),
					DEFAULT_TIP_OPTIONS[0], // Using "No Tip" option for distance calculation
					0, // No custom tip
					0 // Don't pass subtotal for distance calculation
				);

				if (distanceInfo.success) {
					// Store only the distance and fee info, not the tip
					setBaseDeliveryInfo({
						...distanceInfo,
						tipAmount: 0, // We'll calculate tip separately
					});
				} else {
					// Fallback to straight-line calculation
					const fallbackInfo = getFallbackDeliveryInfo(
						userProfile.coordinates,
						new GeoPoint(
							vendor.coordinates.latitude,
							vendor.coordinates.longitude
						),
						DEFAULT_TIP_OPTIONS[0],
						0,
						0
					);
					setBaseDeliveryInfo({
						...fallbackInfo,
						tipAmount: 0,
					});
				}
			} catch (error) {
				console.error("Error calculating delivery distance:", error);
				// Set default delivery info on error
				setBaseDeliveryInfo({
					deliveryFee: 5,
					estimatedTime: 45,
					distance: 0,
					distanceInKm: 0,
					distanceInMiles: 0,
					timeFormatted: "45 mins",
					tipAmount: 0,
					success: false,
				});
			} finally {
				setIsLoadingDeliveryInfo(false);
			}
		};

		calculateDistanceBasedDeliveryInfo();
	}, [vendor, userProfile, vendorId, vendorBasket.length]); // Only depends on location data and whether basket has items

	// Update custom tip amount when percentage changes
	useEffect(() => {
		if (selectedTipOption.type === "custom" && subtotal > 0) {
			// Calculate custom tip amount based on percentage
			const newTipAmount = +(subtotal * (customTipPercent / 100)).toFixed(2);
			setCustomTipAmount(newTipAmount);
		}
	}, [customTipPercent, subtotal, selectedTipOption]);

	// Check if this vendor's payment form is active
	const showPayment = activePaymentVendorId === vendorId;

	const toggleOpen = () => {
		setIsOpen(!isOpen);
	};

	const handleRemoveItem = (e: React.MouseEvent, item: InventoryItem) => {
		e.stopPropagation();
		clearFromBasket(item);
	};

	const handleUpdateQuantity = (item: InventoryItem, change: number) => {
		const currentQty =
			vendorBasket.find((i: BasketItem) => i.item.itemID === item.itemID)
				?.quantity || 0;
		const newQty = Math.max(0, currentQty + change);

		if (newQty === 0) {
			removeFromBasket(item);
		} else {
			updateBasket(item, newQty);
		}
	};

	const handleClearVendorBasket = () => {
		if (window.confirm(`Remove all items from ${shopName}?`)) {
			clearVendorBasket(vendorId);
			setPaymentSuccess(false);
		}
	};

	const handleCheckout = () => {
		if (!authUser) {
			alert("Please sign in to continue with checkout");
			router.push("/customer/auth/signin");
			return;
		}

		// If any other vendor has the payment form open, close it
		setActivePaymentVendorId(vendorId);
	};

	// Handle tip option selection
	const handleTipOptionChange = (option: TipOption) => {
		setSelectedTipOption(option);

		// Reset custom tip fields when a non-custom option is selected
		if (option.type !== "custom") {
			setCustomTipAmount(0);
			setCustomTipPercent(0);
		}
	};

	// Handle custom tip percentage change
	const handleCustomTipPercentChange = (
		e: React.ChangeEvent<HTMLInputElement>
	) => {
		const percent = parseFloat(e.target.value);
		if (!isNaN(percent)) {
			setCustomTipPercent(percent);
		}
	};

	// Handle custom tip amount change directly
	const handleCustomTipAmountChange = (
		e: React.ChangeEvent<HTMLInputElement>
	) => {
		const amount = parseFloat(e.target.value);
		if (!isNaN(amount)) {
			setCustomTipAmount(amount);

			// Update percentage for reference
			if (subtotal > 0) {
				const percent = +((amount / subtotal) * 100).toFixed(2);
				setCustomTipPercent(percent);
			}
		}
	};

	const handlePlaceOrder = async () => {
		if (
			!authUser ||
			!stripe ||
			!elements ||
			!vendorBasket.length ||
			!vendor ||
			!userProfile
		) {
			setPaymentError("Missing required information. Please try again.");
			return;
		}

		const cardElement = elements.getElement(CardElement);
		if (!cardElement) {
			setPaymentError("Card information is required");
			return;
		}

		setProcessing(true);
		setPaymentError("");

		try {
			// Create line items for detailed order tracking
			const lineItems = vendorBasket.map((basketItem: BasketItem) => ({
				itemID: basketItem.item.itemID,
				name: basketItem.item.name,
				price: basketItem.item.price,
				quantity: basketItem.quantity,
				barcode: basketItem.item.barcode || "",
			}));

			// Create order with normalized data structure
			const orderData = {
				// Customer info
				customerID: userProfile.uid,
				customerName: userProfile.displayName,
				customerEmail: userProfile.email,
				customerPhone: userProfile.phoneNumber || "",
				customerLocation: userProfile.location || "",
				customerCoordinates: userProfile.coordinates || null,

				// Vendor info
				vendorID: vendorId,
				vendorName: shopName,
				vendorLocation: vendor.location || "",
				vendorCoordinates: vendor.coordinates || null,
				vendorEmail: vendor.email || "",
				vendorPhone: vendor.phoneNumber || "",

				// Order details
				lineItems: lineItems,
				paymentIntentId: "",
				status: "pending_payment",

				// Enhanced delivery info
				deliveryInfo: {
					distance: baseDeliveryInfo?.distance || 0,
					distanceInKm: baseDeliveryInfo?.distanceInKm || 0,
					distanceInMiles: baseDeliveryInfo?.distanceInMiles || 0,
					estimatedTime: baseDeliveryInfo?.estimatedTime || 45,
				},

				// Financial details
				amount: {
					subtotal,
					deliveryFee: baseDeliveryInfo?.deliveryFee || deliveryFee,
					tax,
					serviceFee,
					tip,
					total: +(
						subtotal +
						(baseDeliveryInfo?.deliveryFee || deliveryFee) +
						tax +
						serviceFee +
						tip
					).toFixed(2),
				},

				// Timestamps
				created_at: Timestamp.now(),
			};

			const orderRef = await addDoc(collection(db, "orders"), orderData);
			const orderId = orderRef.id;

			// Create payment intent
			const piRes = await fetch("/api/create-payment-intent", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					amount: Math.round(total * 100),
					currency: "usd",
					orderId,
					vendorStripeAccountId: vendor.stripeAccountId,
					serviceFeeAmount: Math.round(serviceFee * 100),
					deliveryFeeAmount: Math.round(
						(baseDeliveryInfo?.deliveryFee || deliveryFee) * 100
					),
					tipAmount: Math.round(tip * 100),
					taxAmount: Math.round(tax * 100),
					customerEmail: userProfile.email,
				}),
			});

			const { clientSecret, paymentIntentId } = await piRes.json();

			// Process payment
			const { error } = await stripe.confirmCardPayment(clientSecret, {
				payment_method: {
					card: cardElement,
					billing_details: {
						name: userProfile.displayName,
						email: userProfile.email,
						phone: userProfile.phoneNumber || "",
					},
				},
			});

			if (error) throw error;

			// Update order status after successful payment
			await updateDoc(doc(db, "orders", orderId), {
				paymentIntentId,
				status: "preparing",
				updated_at: Timestamp.now(),
			});

			// Update user and vendor records
			await addOrderToUser(orderId);
			await updateDoc(doc(db, "vendors", vendorId), {
				order_ids: arrayUnion(orderId),
				updated_at: Timestamp.now(),
			});

			// Show success message, clear basket for this vendor
			setPaymentSuccess(true);
			clearVendorBasket(vendorId);
			setActivePaymentVendorId(null); // Close payment form

			// Execute callback if provided
			if (onPlaceOrder) {
				onPlaceOrder();
			}
		} catch (err: unknown) {
			if (err instanceof Error) {
				console.error("Payment error:", err);
				setPaymentError(err.message || "Payment failed. Please try again.");
			} else {
				console.error("Unexpected error:", err);
				setPaymentError("An unexpected error occurred. Please try again.");
			}
		} finally {
			setProcessing(false);
		}
	};

	if (!vendor) {
		return <LoadingScreen message="Loading..." />;
	}

	if (!vendorBasket || vendorBasket.length === 0) return null;

	return (
		<div className="mt-10 mb-10 min-h-[120px] rounded-3xl !shadow-lg overflow-hidden bg-blue-100">
			<div className="flex items-center justify-between p-4">
				<h1 className="font-semibold text-black text-2xl">{shopName}</h1>
				<div className="flex items-center">
					{vendorBasket.length > 0 && (
						<button
							className="bg-red-500 cursor-pointer text-white rounded-full p-2 mr-2 hover:bg-red-600 flex items-center hover:cursor-pointer"
							aria-label="clear basket"
							onClick={handleClearVendorBasket}
						>
							<span className="text-white text-xs px-2">Clear</span>
						</button>
					)}
					<button
						className="bg-white cursor-pointer rounded-full p-2 shadow-md hover:bg-gray-200 flex items-center hover:cursor-pointer"
						aria-label={isOpen ? "close cart" : "open cart"}
						onClick={toggleOpen}
					>
						<Image
							width={20}
							height={20}
							src={isOpen ? "/expand_less.svg" : "/expand_more.svg"}
							className="ml-2"
							alt={isOpen ? "Close Cart" : "Open Cart"}
						/>
						<span className="text-black ml-2 mr-5">
							{isOpen ? "Hide" : "Show"}
						</span>
					</button>
				</div>
			</div>

			{isOpen && (
				<div className="p-4">
					{paymentSuccess && (
						<div className="mb-4 p-3 bg-green-100 border border-green-300 rounded-lg text-green-700">
							Order successfully placed! Your payment has been processed and
							your order is being prepared.
						</div>
					)}

					{vendorBasket.length > 0 ? (
						<div>
							<ul className="mt-1 divide-y divide-gray-200">
								{vendorBasket.map((basketItem: BasketItem) => (
									<li key={basketItem.item.itemID} className="py-2">
										{basketItem && basketItem.item ? (
											<div
												className="flex justify-between items-center py-2 border-t border-gray-300 hover:bg-gray-200 rounded-lg px-2"
												onClick={() =>
													openModal({
														item: basketItem.item,
														vendor: vendor,
														amount: basketItem.quantity,
													})
												}
											>
												<div className="flex items-center space-x-2">
													<button
														className="bg-white cursor-pointer rounded-full p-1 !shadow-md hover:bg-red-100"
														aria-label="decrease quantity"
														onClick={(e) => {
															e.stopPropagation();
															handleUpdateQuantity(basketItem.item, -1);
														}}
													>
														<Image
															src="/remove.svg"
															alt="Remove"
															width={20}
															height={20}
														/>
													</button>
													<span className="w-6 text-center font-medium">
														{basketItem.quantity}
													</span>
													<button
														className="bg-white cursor-pointer rounded-full p-1 !shadow-md hover:bg-green-100"
														aria-label="increase quantity"
														onClick={(e) => {
															e.stopPropagation();
															handleUpdateQuantity(basketItem.item, 1);
														}}
													>
														<Image
															src="/add.svg"
															alt="Add"
															width={20}
															height={20}
														/>
													</button>
												</div>

												<div className="flex items-center flex-1 mx-2">
													<div className="w-16 h-16 rounded-md overflow-hidden relative flex-shrink-0">
														<Image
															src={basketItem.item.image || "/placeholder.png"}
															alt={basketItem.item.name}
															className="object-cover"
															fill
															sizes="4rem"
														/>
													</div>
													<span className="ml-3 text-lg font-medium text-gray-700 truncate max-w-[150px]">
														{basketItem.item.name}
													</span>
												</div>

												<div className="flex flex-col items-end">
													<span className="text-lg font-semibold text-gray-700">
														$
														{(
															basketItem.quantity * basketItem.item.price
														).toFixed(2)}
													</span>
													<span className="text-xs text-gray-500">
														${basketItem.item.price.toFixed(2)} each
													</span>
												</div>

												<button
													className="ml-2 cursor-pointer bg-white rounded-full p-1 !shadow-md hover:bg-red-100 flex-shrink-0"
													aria-label="remove from basket"
													onClick={(e) => handleRemoveItem(e, basketItem.item)}
												>
													<Image
														src="/trash.svg"
														alt="Remove from basket"
														width={20}
														height={20}
													/>
												</button>
											</div>
										) : null}
									</li>
								))}
							</ul>

							<div className="mt-4 p-4 bg-white rounded-lg !shadow-sm">
								<div className="flex justify-between items-center">
									<span className="font-medium text-gray-500">
										Items:{" "}
										{vendorBasket.reduce(
											(total: number, item: BasketItem) =>
												total + item.quantity,
											0
										)}
									</span>
									<span className="font-medium text-gray-500">
										Subtotal: ${subtotal.toFixed(2)}
									</span>
								</div>

								{/* Delivery info with miles instead of km */}
								<div className="flex justify-between items-center mt-2">
									<span className="font-medium text-gray-500">
										Delivery Fee:
									</span>
									<div className="flex items-center">
										{isLoadingDeliveryInfo ? (
											<span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded mr-2">
												calculating...
											</span>
										) : (
											baseDeliveryInfo?.distance !== undefined &&
											baseDeliveryInfo.distance > 0 && (
												<span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded mr-2">
													{baseDeliveryInfo.distanceInMiles.toFixed(1)} miles
												</span>
											)
										)}
										<span className="font-medium text-gray-500">
											${deliveryFee.toFixed(2)}
										</span>
									</div>
								</div>

								{/* Estimated delivery time using pre-formatted time string */}
								{baseDeliveryInfo && baseDeliveryInfo.estimatedTime > 0 && (
									<div className="flex justify-between items-center mt-2">
										<span className="font-medium text-gray-500">
											Estimated Delivery Time:
										</span>
										<span className="font-medium text-gray-500">
											{baseDeliveryInfo.timeFormatted}
										</span>
									</div>
								)}

								<div className="flex justify-between items-center mt-2">
									<span className="font-medium text-gray-500">Tax (7%):</span>
									<span className="font-medium text-gray-500">
										${tax.toFixed(2)}
									</span>
								</div>

								<div className="flex justify-between items-center mt-2">
									<span className="font-medium text-gray-500">
										Service Fee (5%):
									</span>
									<span className="font-medium text-gray-500">
										${serviceFee.toFixed(2)}
									</span>
								</div>

								{/* Tip selection area */}
								{showPayment && (
									<div className="mt-4 mb-2 border-t pt-3">
										<p className="font-medium text-gray-700 mb-2">
											Driver Tip:
										</p>
										<div className="grid grid-cols-3 gap-2 mb-3">
											{DEFAULT_TIP_OPTIONS.map((option) => (
												<button
													key={option.id}
													onClick={() => handleTipOptionChange(option)}
													className={`py-2 px-3 rounded-lg border ${
														selectedTipOption.id === option.id
															? "bg-blue-500 text-white border-blue-500"
															: "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
													}`}
												>
													{option.label}
												</button>
											))}
										</div>

										{/* Custom tip input for dollar amount */}
										{selectedTipOption.type === "custom" && (
											<div className="flex flex-col mb-3">
												<div className="flex items-center mb-2">
													<div className="relative flex-1 mr-2">
														<span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
															$
														</span>
														<input
															type="number"
															min="0"
															step="0.50"
															value={customTipAmount || ""}
															onChange={handleCustomTipAmountChange}
															className="w-full pl-7 pr-3 py-2 border rounded-lg"
															placeholder="Enter amount"
														/>
													</div>
													<div className="relative flex-1">
														<span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
															%
														</span>
														<input
															type="number"
															min="0"
															max="100"
															value={customTipPercent || ""}
															onChange={handleCustomTipPercentChange}
															className="w-full pl-3 pr-7 py-2 border rounded-lg"
															placeholder="Enter %"
														/>
													</div>
												</div>
												<p className="text-xs text-gray-500">
													{customTipAmount > 0
														? `Tip: ${customTipAmount.toFixed(
																2
														  )} (${customTipPercent.toFixed(1)}%)`
														: "Enter a tip amount or percentage"}
												</p>
											</div>
										)}
									</div>
								)}

								<div className="flex justify-between items-center mt-2 pt-2 border-t">
									<span className="font-bold text-gray-700">Order Total:</span>
									<span className="font-bold text-gray-700">
										${total.toFixed(2)}
									</span>
								</div>

								{showPayment ? (
									<div className="mt-4">
										<div className="mb-4">
											<label className="block text-gray-700 font-medium mb-2">
												Card Information
											</label>
											<div className="p-3 border rounded-md bg-white">
												<CardElement options={CARD_ELEMENT_OPTIONS} />
											</div>
											{paymentError && (
												<p className="text-red-500 text-sm mt-2">
													{paymentError}
												</p>
											)}
										</div>

										{userProfile && (
											<div className="mb-4 p-3 bg-gray-50 rounded border">
												<h3 className="font-medium mb-2">
													Delivery Information
												</h3>
												<p>
													<span className="text-gray-600">Name:</span>{" "}
													{userProfile.displayName}
												</p>
												<p>
													<span className="text-gray-600">Email:</span>{" "}
													{userProfile.email}
												</p>
												<p>
													<span className="text-gray-600">Phone:</span>{" "}
													{userProfile.phoneNumber || "Not provided"}
												</p>
												<p>
													<span className="text-gray-600">Address:</span>{" "}
													{userProfile.location || "Not provided"}
												</p>
												{(!userProfile.phoneNumber ||
													!userProfile.location) && (
													<p className="text-amber-600 text-sm mt-2">
														Some delivery information is missing. Please update
														your profile.
													</p>
												)}
											</div>
										)}

										<div className="flex space-x-2">
											<button
												onClick={() => setActivePaymentVendorId(null)}
												className="flex-1 cursor-pointer py-2 rounded-full border border-gray-300 hover:bg-gray-100 transition-colors"
												disabled={processing}
											>
												Cancel
											</button>
											<button
												onClick={handlePlaceOrder}
												className="flex-1 cursor-pointer bg-blue-500 text-white py-2 rounded-full hover:bg-blue-600 !shadow transition-colors disabled:opacity-50"
												disabled={processing || !stripe || !elements}
											>
												{processing ? "Processing..." : "Place Order"}
											</button>
										</div>
									</div>
								) : (
									<button
										onClick={handleCheckout}
										className="w-full cursor-pointer mt-4 bg-blue-500 text-white py-2 rounded-full hover:bg-blue-600 !shadow transition-colors"
									>
										Checkout from {shopName}
									</button>
								)}
							</div>
						</div>
					) : (
						<p className="text-gray-500 text-center py-4">
							This vendor&apos;s cart is empty.
						</p>
					)}
				</div>
			)}
		</div>
	);
};

export default CartCardListings;
