// src/app/driver/profile/page.tsx
"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useDriverAuth } from "@/hooks/useDriverAuth";
import { updateDriverProfile } from "@/firebase/driverAuth";
import DriverNavBar from "@/components/driver/DriverNavBar";
import { uploadImage } from "@/firebase/storage";
import GoogleMapsAutocomplete from "@/components/shared/GoogleMapsAutocomplete";
import DeliveryDetailsModal from "@/components/driver/DeliveryDetailsModal";
import {
	collection,
	query,
	where,
	getDocs,
	Timestamp,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import StripeDisconnect from "@/components/shared/StripeDisconnect";
import Footer from "@/components/shared/Footer";

export default function DriverProfilePage() {
	const [formData, setFormData] = useState({
		displayName: "",
		phoneNumber: "",
		alternatePhoneNumber: "",
		location: "", // City/Service area
		address: "", // Full address
		// Vehicle info fields
		vehicleMake: "",
		vehicleModel: "",
		vehicleYear: "",
		vehicleColor: "",
		vehicleLicensePlate: "",
	});

	const [coordinates, setCoordinates] = useState<{
		lat: string;
		lon: string;
	} | null>(null);
	const [addressSelected, setAddressSelected] = useState(false);
	const [profileImage, setProfileImage] = useState<string | null>(null);
	const [imageFile, setImageFile] = useState<File | null>(null);
	const [imagePreview, setImagePreview] = useState<string | null>(null);

	const [editMode, setEditMode] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [error, setError] = useState("");
	const [successMessage, setSuccessMessage] = useState("");
	const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
	const [selectedDeliveryId, setSelectedDeliveryId] = useState<string>("");
	const [recentDeliveriesWithDetails, setRecentDeliveriesWithDetails] =
		useState<
			Array<{
				id: string;
				timestamp: Timestamp;
				vendorName: string;
			}>
		>([]);
	const [loadingRecentDeliveries, setLoadingRecentDeliveries] = useState(false);

	const { user, driverData, initializing, refreshDriverData } = useDriverAuth();
	const router = useRouter();

	// Load driver data when component mounts
	useEffect(() => {
		if (initializing) return;

		if (!user) {
			router.push("/driver/auth/signin");
			return;
		}

		if (!driverData) {
			setIsLoading(false);
			return;
		}

		// Populate form with existing data
		setFormData({
			displayName: driverData.displayName || "",
			phoneNumber: driverData.phoneNumber || "",
			alternatePhoneNumber: driverData.alternatePhoneNumber || "",
			location: driverData.location || "",
			address: driverData.address || "",
			vehicleMake: driverData.vehicleInfo?.make || "",
			vehicleModel: driverData.vehicleInfo?.model || "",
			vehicleYear: driverData.vehicleInfo?.year?.toString() || "",
			vehicleColor: driverData.vehicleInfo?.color || "",
			vehicleLicensePlate: driverData.vehicleInfo?.licensePlate || "",
		});

		// Set coordinates if they exist
		if (driverData.coordinates) {
			const lat = driverData.coordinates.latitude?.toString() || "";
			const lon = driverData.coordinates.longitude?.toString() || "";
			if (lat && lon) {
				setCoordinates({ lat, lon });
				setAddressSelected(true);
			}
		}

		// Set profile image if it exists
		if (driverData.profileImage) {
			setProfileImage(driverData.profileImage);
		}

		setIsLoading(false);
	}, [user, driverData, initializing, router]);

	useEffect(() => {
		const fetchRecentDeliveries = async () => {
			if (
				!user ||
				!driverData?.deliveryIds ||
				driverData.deliveryIds.length === 0
			)
				return;

			setLoadingRecentDeliveries(true);

			try {
				// Get the most recent 10 delivery IDs (we'll filter down to 4 after getting timestamps)
				const recentIds = driverData.deliveryIds.slice(-10); // Get the last 10 (most recent) IDs

				// Create a batch of promises to fetch details for each delivery
				const fetchPromises = recentIds.map(async (deliveryId) => {
					// First try to find it in the orders collection
					const ordersQuery = query(
						collection(db, "orders"),
						where("__name__", "==", deliveryId)
					);

					const ordersSnapshot = await getDocs(ordersQuery);

					if (!ordersSnapshot.empty) {
						const orderData = ordersSnapshot.docs[0].data();
						return {
							id: deliveryId,
							timestamp: orderData.delivered_at || orderData.created_at,
							vendorName: orderData.vendorName || "Unknown Vendor",
						};
					}

					// If not found in orders, try driverTransactions
					const transactionsQuery = query(
						collection(db, "driverTransactions"),
						where("orderId", "==", deliveryId)
					);

					const transactionsSnapshot = await getDocs(transactionsQuery);

					if (!transactionsSnapshot.empty) {
						const transactionData = transactionsSnapshot.docs[0].data();
						return {
							id: deliveryId,
							timestamp:
								transactionData.deliverTimestamp ||
								transactionData.completionTimestamp ||
								transactionData.acceptTimestamp,
							vendorName: transactionData.vendorName || "Unknown Vendor",
						};
					}

					// If we couldn't find details, return basic info
					return {
						id: deliveryId,
						timestamp: null,
						vendorName: "Unknown Vendor",
					};
				});

				// Wait for all fetch operations to complete
				const deliveriesWithDetails = await Promise.all(fetchPromises);

				// Sort by timestamp (newest first)
				const sortedDeliveries = deliveriesWithDetails
					.filter((delivery) => delivery.timestamp) // Only include deliveries with timestamps
					.sort((a, b) => {
						if (a.timestamp && b.timestamp) {
							return b.timestamp.seconds - a.timestamp.seconds;
						}
						return 0;
					})
					.slice(0, 4); // Get the 4 most recent deliveries

				setRecentDeliveriesWithDetails(sortedDeliveries);
			} catch (error) {
				console.error("Error fetching recent deliveries:", error);
			} finally {
				setLoadingRecentDeliveries(false);
			}
		};

		fetchRecentDeliveries();
	}, [user, driverData?.deliveryIds]);

	// Handle form input changes
	const handleChange = (
		e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
	) => {
		const { name, value } = e.target;
		setFormData((prevData) => ({
			...prevData,
			[name]: value,
		}));
	};

	const handleViewDelivery = (deliveryId: string) => {
		setSelectedDeliveryId(deliveryId);
		setIsModalOpen(true);
	};

	// Handle location selection
	// Define the LocationResult type if not already defined
	type LocationResult = {
		display_name: string;
		address?: {
			city?: string;
			town?: string;
			state?: string;
			county?: string;
		};
		lat: string;
		lon: string;
	};

	const handleLocationSelect = (locationData: LocationResult) => {
		// Set full address
		setFormData((prev) => ({
			...prev,
			address: locationData.display_name,
		}));

		// Extract and set city/service area from the address components
		const addressComponents = locationData.address || {};
		const serviceArea =
			addressComponents.city ||
			addressComponents.town ||
			addressComponents.state ||
			addressComponents.county ||
			"";

		if (serviceArea) {
			setFormData((prev) => ({
				...prev,
				location: serviceArea,
			}));
		}

		// Store coordinates
		setCoordinates({
			lat: locationData.lat,
			lon: locationData.lon,
		});

		setAddressSelected(true);
	};

	useEffect(() => {
		// Set up a message listener for Stripe onboarding completion
		const handleMessage = async (event: MessageEvent) => {
			// Verify origin for security
			if (event.origin !== window.location.origin) return;

			// Check for our specific message type
			if (
				event.data?.type === "STRIPE_ONBOARDING_COMPLETE" &&
				event.data?.data?.entityType === "drivers"
			) {
				// Refresh driver data to show updated Stripe status
				await refreshDriverData();

				// Show success message
				setSuccessMessage(
					"Your Stripe account has been connected successfully!"
				);
			}
		};

		// Add the message event listener
		window.addEventListener("message", handleMessage);

		// Clean up the event listener on component unmount
		return () => {
			window.removeEventListener("message", handleMessage);
		};
	}, [refreshDriverData]);

	const handleConnect = async () => {
		if (!user) return;
		setError("");
		setIsSubmitting(true);

		try {
			const res = await fetch("/api/onboard-express-account", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					entityId: user.uid,
					entityType: "drivers",
					email: user.email,
				}),
			});

			const text = await res.text();

			if (!res.ok) {
				let msg = text;
				try {
					msg = JSON.parse(text).error || JSON.parse(text).message;
				} catch {}
				throw new Error(msg || `Stripe replied ${res.status}`);
			}

			const { url } = JSON.parse(text);

			// Set up a message listener before opening the popup
			const handleMessage = async (event: MessageEvent) => {
				// Verify origin for security
				if (event.origin !== window.location.origin) return;

				// Check for our specific message type
				if (
					event.data?.type === "STRIPE_ONBOARDING_COMPLETE" &&
					event.data?.data?.entityType === "drivers"
				) {
					// Remove this event listener to avoid duplicates
					window.removeEventListener("message", handleMessage);

					// Refresh driver data to show updated Stripe status
					await refreshDriverData();

					// Show success message
					setSuccessMessage(
						"Your Stripe account has been connected successfully!"
					);
				}
			};

			// Add the message event listener
			window.addEventListener("message", handleMessage);

			// open the Stripe-hosted flow in a popup
			const popup = window.open(
				url,
				"stripeOnboarding",
				"width=600,height=800"
			);

			// If popup was blocked, show a message
			if (!popup) {
				throw new Error("Please enable popups to connect your Stripe account");
			}
		} catch (e) {
			console.error(e);
			if (e instanceof Error) {
				setError(e.message || "Unexpected error starting onboarding");
			} else {
				setError("Unexpected error starting onboarding");
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	// Handle image file selection
	const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (files && files.length > 0) {
			const file = files[0];

			// Validate file type
			if (!file.type.startsWith("image/")) {
				setError("Please select an image file");
				return;
			}

			// Validate file size (5MB max)
			if (file.size > 5 * 1024 * 1024) {
				setError("Image size must be less than 5MB");
				return;
			}

			setImageFile(file);

			// Create a preview URL
			const reader = new FileReader();
			reader.onloadend = () => {
				setImagePreview(reader.result as string);
			};
			reader.readAsDataURL(file);
		}
	};

	// Remove selected image
	const removeSelectedImage = () => {
		setImageFile(null);
		setImagePreview(null);
	};

	// Handle form submission
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setSuccessMessage("");
		setIsSubmitting(true);

		// Validate that an address has been selected if the address field was changed
		if (formData.address !== driverData?.address && !addressSelected) {
			setError("Please select a valid address from the suggestions");
			setIsSubmitting(false);
			return;
		}

		try {
			if (!driverData) {
				throw new Error("Driver data not available");
			}

			// Upload image if selected
			let profileImageUrl = profileImage;

			if (imageFile) {
				setIsUploading(true);

				// Create a path for the image: drivers/[driverId]/profile/[timestamp]-[filename]
				const timestamp = Date.now();
				const path = `drivers/${driverData.uid}/profile/${timestamp}-${imageFile.name}`;

				const uploadResult = await uploadImage(imageFile, path);

				if (uploadResult.success && uploadResult.url) {
					profileImageUrl = uploadResult.url;
				} else {
					throw new Error(`Failed to upload image: ${uploadResult.error}`);
				}

				setIsUploading(false);
			}

			// Prepare vehicle info
			const vehicleInfo = {
				make: formData.vehicleMake,
				model: formData.vehicleModel,
				year: formData.vehicleYear ? parseInt(formData.vehicleYear) : undefined,
				color: formData.vehicleColor,
				licensePlate: formData.vehicleLicensePlate,
			};

			// Update driver profile including the profile image URL if available
			const updateData = {
				displayName: formData.displayName,
				phoneNumber: formData.phoneNumber,
				alternatePhoneNumber: formData.alternatePhoneNumber,
				location: formData.location,
				address: formData.address,
				vehicleInfo,
				...(coordinates ? { coordinates } : {}),
			};

			const result = await updateDriverProfile(updateData);

			if (result.success) {
				setSuccessMessage("Profile updated successfully!");

				// Update the profile image state
				if (profileImageUrl) {
					setProfileImage(profileImageUrl);
					await updateDriverProfile({
						profileImage: profileImageUrl,
					});
				}

				// Refresh driver data in the auth context to update the navbar
				await refreshDriverData();

				// Exit edit mode
				setEditMode(false);
			} else {
				throw new Error(result.error || "Failed to update profile");
			}
		} catch (error) {
			setError((error as Error).message);
		} finally {
			setIsSubmitting(false);
		}
	};

	// Format date for display
	const formatDate = (timestamp: { seconds: number } | null) => {
		if (!timestamp) return "N/A";
		try {
			const date = new Date(timestamp.seconds * 1000);
			return date.toLocaleString("en-US", {
				month: "long",
				day: "numeric",
				year: "numeric",
				hour: "numeric",
				minute: "2-digit",
				hour12: true,
			});
		} catch (error) {
			console.error("Error formatting date:", error);
			return "Invalid Date";
		}
	};

	if (isLoading) {
		return (
			<div className="min-h-screen bg-gray-50 flex justify-center items-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sarva mx-auto"></div>
					<p className="mt-4 text-gray-600">Loading profile...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<header>{driverData && <DriverNavBar />}</header>

			<main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
				<div className="bg-white shadow-md rounded-lg overflow-hidden">
					<div className="px-6 py-4 bg-sarva text-white">
						<div className="flex justify-between items-center">
							<h1 className="text-xl font-bold">
								{editMode ? "Edit Your Profile" : "Your Driver Profile"}
							</h1>
							{!editMode && (
								<button
									type="button"
									onClick={() => setEditMode(true)}
									className="px-4 py-2 bg-white text-sarva rounded-md shadow-sm hover:bg-gray-100 transition-colors cursor-pointer"
								>
									Edit Profile
								</button>
							)}
						</div>
					</div>

					<div className="p-6">
						{error && (
							<div className="bg-red-100 text-red-700 p-4 rounded mb-6">
								{error}
							</div>
						)}

						{successMessage && (
							<div className="bg-green-100 text-green-700 p-4 rounded mb-6">
								{successMessage}
							</div>
						)}

						{/* View Mode */}
						{!editMode ? (
							<div className="flex flex-col md:flex-row gap-8">
								{/* Profile Image and Basic Info */}
								<div className="md:w-1/3 flex flex-col items-center">
									<div className="w-48 h-48 bg-gray-100 rounded-full overflow-hidden flex items-center justify-center border-4 border-white shadow-lg">
										{profileImage ? (
											<Image
												src={profileImage}
												alt="Profile"
												width={192}
												height={192}
												className="w-full h-full object-cover"
											/>
										) : (
											<div className="text-center p-4">
												<svg
													className="w-24 h-24 text-gray-300 mx-auto"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
													xmlns="http://www.w3.org/2000/svg"
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={2}
														d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
													/>
												</svg>
											</div>
										)}
									</div>
									<h2 className="text-2xl font-bold text-gray-900 mt-4">
										{driverData?.displayName}
									</h2>
									<a
										className="text-gray-500 hover:underline"
										href={`mailto:${driverData?.email}`}
									>
										{driverData?.email}
									</a>

									{/* Driver Statistics */}
									{driverData?.stats && (
										<div className="mt-6 w-full">
											<div className="grid grid-cols-2 gap-4 text-center">
												<div className="bg-gray-50 p-3 rounded-lg">
													<p className="text-2xl font-bold text-sarva">
														{driverData.stats.totalDeliveries || 0}
													</p>
													<p className="text-sm text-gray-500">Deliveries</p>
												</div>
												<div className="bg-gray-50 p-3 rounded-lg">
													<p className="text-2xl font-bold text-sarva">
														$
														{driverData.stats.totalEarnings?.toFixed(2) ||
															"0.00"}
													</p>
													<p className="text-sm text-gray-500">Earnings</p>
												</div>
												<div className="bg-gray-50 p-3 rounded-lg">
													<p className="text-2xl font-bold text-sarva">
														{driverData.stats.totalMilesDriven || 0}
													</p>
													<p className="text-sm text-gray-500">Miles</p>
												</div>
												<div className="bg-gray-50 p-3 rounded-lg">
													<p className="text-2xl font-bold text-sarva">
														{driverData.stats.averageRating?.toFixed(1) ||
															"N/A"}
													</p>
													<p className="text-sm text-gray-500">Rating</p>
												</div>
											</div>
										</div>
									)}
								</div>

								{/* Profile Details */}
								<div className="md:w-2/3">
									<div className="space-y-6">
										{/* Contact Information */}
										<div>
											<h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
												Contact Information
											</h3>
											<div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
												<div>
													<p className="text-sm text-gray-500">Phone Number</p>
													<a
														className="text-base text-gray-900 hover:underline cursor-pointer"
														href={`tel:${driverData?.phoneNumber}`}
													>
														{driverData?.phoneNumber}
													</a>
												</div>
												{driverData?.alternatePhoneNumber && (
													<div>
														<p className="text-sm text-gray-500">
															Alternative Phone
														</p>
														<a
															className="text-base text-gray-900 hover:underline cursor-pointer"
															href={`tel:${driverData?.alternatePhoneNumber}`}
														>
															{driverData?.alternatePhoneNumber}
														</a>
													</div>
												)}
												<div>
													<p className="text-sm text-gray-500">Address</p>
													<a
														className="text-base text-gray-900 hover:underline cursor-pointer"
														href={`https://www.google.com/maps/search/?api=1&query=${coordinates?.lat},${coordinates?.lon}`}
													>
														{driverData?.address}
													</a>
												</div>
												<div>
													<p className="text-sm text-gray-500">Service Area</p>
													<p className="text-base text-gray-900">
														{driverData?.location}
													</p>
												</div>
												<div>
													<p className="text-sm text-gray-500">Member Since</p>
													<p className="text-base text-gray-900">
														{formatDate(driverData?.created_at ?? null)}
													</p>
												</div>
											</div>
										</div>

										{/* Vehicle Information */}
										{driverData?.vehicleInfo && (
											<div>
												<h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
													Vehicle Information
												</h3>
												<div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
													{driverData.vehicleInfo.make && (
														<div>
															<p className="text-sm text-gray-500">Make</p>
															<p className="text-base text-gray-900">
																{driverData.vehicleInfo.make}
															</p>
														</div>
													)}
													{driverData.vehicleInfo.model && (
														<div>
															<p className="text-sm text-gray-500">Model</p>
															<p className="text-base text-gray-900">
																{driverData.vehicleInfo.model}
															</p>
														</div>
													)}
													{driverData.vehicleInfo.year && (
														<div>
															<p className="text-sm text-gray-500">Year</p>
															<p className="text-base text-gray-900">
																{driverData.vehicleInfo.year}
															</p>
														</div>
													)}
													{driverData.vehicleInfo.color && (
														<div>
															<p className="text-sm text-gray-500">Color</p>
															<p className="text-base text-gray-900">
																{driverData.vehicleInfo.color}
															</p>
														</div>
													)}
													{driverData.vehicleInfo.licensePlate && (
														<div>
															<p className="text-sm text-gray-500">
																License Plate
															</p>
															<p className="text-base text-gray-900">
																{driverData.vehicleInfo.licensePlate}
															</p>
														</div>
													)}
												</div>
											</div>
										)}

										{/* Payment Information */}
										{/* Payment Information */}
										<div>
											<h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
												Payment Information
											</h3>
											<div className="mt-3">
												{driverData?.stripeAccountId ? (
													<div>
														<p className="text-green-700 flex items-center">
															<svg
																xmlns="http://www.w3.org/2000/svg"
																className="h-5 w-5 mr-2"
																viewBox="0 0 20 20"
																fill="currentColor"
															>
																<path
																	fillRule="evenodd"
																	d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
																	clipRule="evenodd"
																/>
															</svg>
															Connected Stripe account:{" "}
															{driverData.stripeAccountId}
														</p>
														<div className="mt-2">
															<StripeDisconnect
																entityId={driverData.uid}
																entityType="drivers"
																onSuccess={refreshDriverData}
																onError={setError}
															/>
														</div>
													</div>
												) : (
													<div>
														<p className="text-gray-700 mb-2">
															To receive payments, please connect your Stripe
															account.
														</p>
														<button
															onClick={handleConnect}
															className="px-4 py-2 bg-sarva hover:bg-rose text-white rounded-md shadow-sm cursor-pointer"
														>
															Connect Stripe Account
														</button>
													</div>
												)}
											</div>
										</div>

										{/* Recent Deliveries */}
										{/* Recent Deliveries */}
										{driverData?.deliveryIds &&
											driverData.deliveryIds.length > 0 && (
												<div>
													<h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-3">
														Recent Deliveries
													</h3>

													{loadingRecentDeliveries ? (
														<div className="flex justify-center py-4">
															<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sarva"></div>
														</div>
													) : recentDeliveriesWithDetails.length > 0 ? (
														<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
															{recentDeliveriesWithDetails.map((delivery) => (
																<div
																	key={delivery.id}
																	className="border rounded-lg p-4 hover:bg-gray-50 hover:shadow-sm transition-all"
																>
																	<div className="flex justify-between items-center">
																		<div>
																			<p className="font-medium">
																				Delivery #{delivery.id.slice(-6)}
																			</p>
																			<p className="text-xs text-gray-500">
																				{delivery.vendorName} •{" "}
																				{delivery.timestamp
																					? formatDate(delivery.timestamp)
																					: "Date unknown"}
																			</p>
																		</div>
																		<button
																			onClick={() =>
																				handleViewDelivery(delivery.id)
																			}
																			className="text-sarva hover:text-rose cursor-pointer text-sm"
																		>
																			View Details
																		</button>
																	</div>
																</div>
															))}
														</div>
													) : (
														<div className="text-center py-4 text-gray-500">
															<p>No recent delivery details available</p>
														</div>
													)}

													{driverData.deliveryIds.length > 4 && (
														<div className="mt-3 text-right">
															<button
																onClick={() => router.push("/driver/orders")}
																className="text-sarva hover:text-rose cursor-pointer text-sm font-medium"
															>
																View All Deliveries →
															</button>
														</div>
													)}
												</div>
											)}
									</div>
								</div>
							</div>
						) : (
							// Edit Mode
							<form onSubmit={handleSubmit}>
								<div className="flex flex-col md:flex-row gap-8">
									{/* Profile Image Section */}
									<div className="md:w-1/3">
										<div className="mb-6">
											<label className="block text-gray-700 font-medium mb-2">
												Profile Image
											</label>
											<div className="flex flex-col items-center gap-4">
												<div className="w-40 h-40 bg-gray-100 rounded-full overflow-hidden flex items-center justify-center border-4 border-white shadow-lg">
													{imagePreview ? (
														<Image
															src={imagePreview}
															alt="Profile Preview"
															width={160}
															height={160}
															className="w-full h-full object-cover"
														/>
													) : profileImage ? (
														<Image
															src={profileImage}
															alt="Current Profile"
															width={160}
															height={160}
															className="w-full h-full object-cover"
														/>
													) : (
														<div className="text-center p-4">
															<svg
																className="w-12 h-12 text-gray-300 mx-auto"
																fill="none"
																stroke="currentColor"
																viewBox="0 0 24 24"
																xmlns="http://www.w3.org/2000/svg"
															>
																<path
																	strokeLinecap="round"
																	strokeLinejoin="round"
																	strokeWidth={2}
																	d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
																/>
															</svg>
															<p className="mt-2 text-sm text-gray-400">
																No image
															</p>
														</div>
													)}
												</div>

												<div className="w-full">
													<div className="border-2 border-dashed border-gray-300 rounded-md p-4 flex flex-col items-center justify-center">
														<input
															type="file"
															id="image"
															accept="image/*"
															className="hidden"
															onChange={handleImageChange}
														/>
														<label htmlFor="image" className="cursor-pointer">
															<div className="flex flex-col items-center justify-center">
																<svg
																	className="w-10 h-10 text-gray-400"
																	fill="none"
																	stroke="currentColor"
																	viewBox="0 0 24 24"
																	xmlns="http://www.w3.org/2000/svg"
																>
																	<path
																		strokeLinecap="round"
																		strokeLinejoin="round"
																		strokeWidth={2}
																		d="M12 6v6m0 0v6m0-6h6m-6 0H6"
																	/>
																</svg>
																<p className="mt-2 text-sm text-gray-500">
																	Click to upload an image
																</p>
																<p className="text-xs text-gray-400">
																	JPG, PNG, GIF up to 5MB
																</p>
															</div>
														</label>
													</div>

													{imagePreview && (
														<div className="mt-2 text-center">
															<button
																type="button"
																onClick={removeSelectedImage}
																className="text-red-500 hover:text-red-700 cursor-pointer text-sm"
															>
																Remove selected image
															</button>
														</div>
													)}
												</div>
											</div>
										</div>
									</div>

									{/* Form Fields */}
									<div className="md:w-2/3">
										{/* Personal Information */}
										<div className="mb-6">
											<h2 className="text-lg font-medium text-gray-800 mb-4 pb-2 border-b">
												Personal Information
											</h2>

											<div className="mb-4">
												<label
													className="block text-gray-700 font-medium mb-2"
													htmlFor="displayName"
												>
													Full Name*
												</label>
												<input
													type="text"
													id="displayName"
													name="displayName"
													className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sarva focus:border-transparent"
													value={formData.displayName}
													onChange={handleChange}
													required
												/>
											</div>

											<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
												<div className="mb-4">
													<label
														className="block text-gray-700 font-medium mb-2"
														htmlFor="phoneNumber"
													>
														Phone Number*
													</label>
													<input
														type="tel"
														id="phoneNumber"
														name="phoneNumber"
														className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sarva focus:border-transparent"
														value={formData.phoneNumber}
														onChange={handleChange}
														required
													/>
												</div>

												<div className="mb-4">
													<label
														className="block text-gray-700 font-medium mb-2"
														htmlFor="alternatePhoneNumber"
													>
														Alternate Phone Number
													</label>
													<input
														type="tel"
														id="alternatePhoneNumber"
														name="alternatePhoneNumber"
														className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sarva focus:border-transparent"
														value={formData.alternatePhoneNumber}
														onChange={handleChange}
													/>
												</div>
											</div>
										</div>

										{/* Location Information */}
										<div className="mb-6">
											<h2 className="text-lg font-medium text-gray-800 mb-4 pb-2 border-b">
												Location Information
											</h2>

											<div className="mb-4">
												<label className="block text-gray-700 font-medium mb-2">
													Address*
												</label>
												<GoogleMapsAutocomplete
													value={formData.address}
													onChange={(value) =>
														setFormData((prev) => ({ ...prev, address: value }))
													}
													onSelect={handleLocationSelect}
													placeholder="Enter your address"
													label=""
													required={true}
													countryCode="us"
												/>
												{addressSelected && coordinates && (
													<p className="mt-1 text-sm text-green-500">
														Valid address selected
													</p>
												)}
											</div>

											<div className="mb-4">
												<label
													className="block text-gray-700 font-medium mb-2"
													htmlFor="location"
												>
													City/Service Area*
												</label>
												<input
													type="text"
													id="location"
													name="location"
													className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sarva focus:border-transparent"
													value={formData.location}
													onChange={handleChange}
													required
												/>
												<p className="text-xs text-gray-500 mt-1">
													This is your primary service area. It&#39;s
													auto-detected from your address but can be edited if
													needed.
												</p>
											</div>
										</div>

										{/* Vehicle Information */}
										<div className="mb-6">
											<h2 className="text-lg font-medium text-gray-800 mb-4 pb-2 border-b">
												Vehicle Information
											</h2>

											<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
												<div className="mb-4">
													<label
														className="block text-gray-700 font-medium mb-2"
														htmlFor="vehicleMake"
													>
														Vehicle Make
													</label>
													<input
														type="text"
														id="vehicleMake"
														name="vehicleMake"
														className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sarva focus:border-transparent"
														value={formData.vehicleMake}
														onChange={handleChange}
														placeholder="e.g., Toyota, Honda"
													/>
												</div>

												<div className="mb-4">
													<label
														className="block text-gray-700 font-medium mb-2"
														htmlFor="vehicleModel"
													>
														Vehicle Model
													</label>
													<input
														type="text"
														id="vehicleModel"
														name="vehicleModel"
														className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sarva focus:border-transparent"
														value={formData.vehicleModel}
														onChange={handleChange}
														placeholder="e.g., Camry, Civic"
													/>
												</div>

												<div className="mb-4">
													<label
														className="block text-gray-700 font-medium mb-2"
														htmlFor="vehicleYear"
													>
														Vehicle Year
													</label>
													<input
														type="text"
														id="vehicleYear"
														name="vehicleYear"
														className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sarva focus:border-transparent"
														value={formData.vehicleYear}
														onChange={handleChange}
														placeholder="e.g., 2022"
													/>
												</div>

												<div className="mb-4">
													<label
														className="block text-gray-700 font-medium mb-2"
														htmlFor="vehicleColor"
													>
														Vehicle Color
													</label>
													<input
														type="text"
														id="vehicleColor"
														name="vehicleColor"
														className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sarva focus:border-transparent"
														value={formData.vehicleColor}
														onChange={handleChange}
														placeholder="e.g., Black, Silver"
													/>
												</div>

												<div className="mb-4">
													<label
														className="block text-gray-700 font-medium mb-2"
														htmlFor="vehicleLicensePlate"
													>
														License Plate
													</label>
													<input
														type="text"
														id="vehicleLicensePlate"
														name="vehicleLicensePlate"
														className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sarva focus:border-transparent"
														value={formData.vehicleLicensePlate}
														onChange={handleChange}
														placeholder="e.g., ABC1234"
													/>
												</div>
											</div>
										</div>

										{/* Stripe Account Section */}
										<div className="p-4 bg-gray-50 rounded shadow mb-6">
											<h2 className="text-lg font-medium text-gray-800 mb-4">
												Stripe Account
											</h2>
											{driverData?.stripeAccountId ? (
												<p className="text-green-700 flex items-center">
													<svg
														xmlns="http://www.w3.org/2000/svg"
														className="h-5 w-5 mr-2"
														viewBox="0 0 20 20"
														fill="currentColor"
													>
														<path
															fillRule="evenodd"
															d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
															clipRule="evenodd"
														/>
													</svg>
													Connected Stripe account: {driverData.stripeAccountId}
												</p>
											) : (
												<div>
													<p className="text-gray-700 mb-2">
														To receive payments, please connect your Stripe
														account.
													</p>
													<button
														type="button"
														onClick={handleConnect}
														className="px-4 py-2 bg-sarva hover:bg-rose text-white rounded-md shadow-sm cursor-pointer"
													>
														Connect Stripe Account
													</button>
												</div>
											)}
										</div>

										<div className="flex justify-end space-x-4">
											<button
												type="button"
												onClick={() => setEditMode(false)}
												className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 cursor-pointer"
											>
												Cancel
											</button>
											<button
												type="submit"
												className="px-4 py-2 bg-sarva hover:bg-rose text-white rounded-md shadow-sm cursor-pointer"
												disabled={isSubmitting || isUploading}
											>
												{isUploading
													? "Uploading Image..."
													: isSubmitting
													? "Saving..."
													: "Save Changes"}
											</button>
										</div>
									</div>
								</div>
							</form>
						)}
					</div>
				</div>
			</main>

			<Footer />

			<DeliveryDetailsModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				deliveryId={selectedDeliveryId}
			/>
		</div>
	);
}
