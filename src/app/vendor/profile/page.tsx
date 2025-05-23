// src/app/vendor/profile/page.tsx
"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useVendorAuth } from "@/hooks/useVendorAuth";
import { updateVendorProfile } from "@/firebase/vendorAuth";
import VendorNavBar from "@/components/vendor/VendorNavBar";
import { uploadImage } from "@/firebase/storage";
import GoogleMapsAutocomplete from "@/components/shared/GoogleMapsAutocomplete";
import BusinessHoursForm from "@/components/vendor/BusinessHoursForm";
import { BusinessHours } from "@/firebase/vendorAuth";
import StripeDisconnect from "@/components/shared/StripeDisconnect";
import Footer from "@/components/shared/Footer";

export default function VendorProfilePage() {
	const [formData, setFormData] = useState({
		displayName: "",
		phoneNumber: "",
		shopName: "",
		location: "",
		businessDescription: "",
	});

	const [coordinates, setCoordinates] = useState<{
		lat: string;
		lon: string;
	} | null>(null);
	const [addressSelected, setAddressSelected] = useState(false);
	const [profileImage, setProfileImage] = useState<string | null>(null);
	const [imageFile, setImageFile] = useState<File | null>(null);
	const [imagePreview, setImagePreview] = useState<string | null>(null);
	const [businessHours, setBusinessHours] = useState<BusinessHours | undefined>(
		undefined
	);

	const [isLoading, setIsLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [error, setError] = useState("");
	const [successMessage, setSuccessMessage] = useState("");

	const { user, vendorData, initializing, refreshVendorData } = useVendorAuth();
	const router = useRouter();

	// Load vendor data when component mounts
	useEffect(() => {
		if (initializing) return;

		if (!user) {
			router.push("/vendor/auth/signin");
			return;
		}

		if (!vendorData) {
			setIsLoading(false);
			return;
		}

		// Populate form with existing data
		setFormData({
			displayName: vendorData.displayName || "",
			phoneNumber: vendorData.phoneNumber || "",
			shopName: vendorData.shopName || "",
			location: vendorData.location || "",
			businessDescription: vendorData.businessDescription || "",
		});

		// Set business hours if they exist
		if (vendorData.businessHours) {
			setBusinessHours(vendorData.businessHours);
		}

		// Set coordinates if they exist
		if (vendorData.coordinates) {
			const lat = vendorData.coordinates.latitude?.toString() || "";
			const lon = vendorData.coordinates.longitude?.toString() || "";
			if (lat && lon) {
				setCoordinates({ lat, lon });
				setAddressSelected(true);
			}
		}

		// Set profile image if it exists in vendor data
		if (vendorData.profileImage) {
			setProfileImage(vendorData.profileImage);
		}

		setIsLoading(false);
	}, [user, vendorData, initializing, router]);

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

	// Handle location selection
	const handleLocationSelect = (locationData: {
		display_name: string;
		lat: string;
		lon: string;
	}) => {
		setFormData((prev) => ({
			...prev,
			location: locationData.display_name,
		}));

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
				event.data?.data?.entityType === "vendors"
			) {
				// Refresh vendor data to show updated Stripe status
				await refreshVendorData();

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
	}, [refreshVendorData]);

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
					entityType: "vendors",
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
					event.data?.data?.entityType === "vendors"
				) {
					// Remove this event listener to avoid duplicates
					window.removeEventListener("message", handleMessage);

					// Refresh vendor data to show updated Stripe status
					await refreshVendorData();

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

		// Validate that an address has been selected if the location field was changed
		if (formData.location !== vendorData?.location && !addressSelected) {
			setError("Please select a valid address from the suggestions");
			setIsSubmitting(false);
			return;
		}

		try {
			if (!vendorData) {
				throw new Error("Vendor data not available");
			}

			// Upload image if selected
			let profileImageUrl = profileImage;

			if (imageFile) {
				setIsUploading(true);

				// Create a path for the image: vendors/[vendorId]/profile/[timestamp]-[filename]
				const timestamp = Date.now();
				const path = `vendors/${vendorData.uid}/profile/${timestamp}-${imageFile.name}`;

				const uploadResult = await uploadImage(imageFile, path);

				if (uploadResult.success && uploadResult.url) {
					profileImageUrl = uploadResult.url;
				} else {
					throw new Error(`Failed to upload image: ${uploadResult.error}`);
				}

				setIsUploading(false);
			}

			// Update vendor profile including the profile image URL if available
			const updateData = {
				...formData,
				...(profileImageUrl ? { profileImage: profileImageUrl } : {}),
				...(coordinates ? { coordinates } : {}),
				...(businessHours ? { businessHours } : {}),
			};

			const result = await updateVendorProfile(updateData);

			if (result.success) {
				setSuccessMessage("Profile updated successfully!");

				// Update the profile image state
				if (profileImageUrl) {
					setProfileImage(profileImageUrl);
				}

				// Refresh vendor data in the auth context to update the navbar
				await refreshVendorData();
			} else {
				throw new Error(result.error || "Failed to update profile");
			}
		} catch (error) {
			setError((error as Error).message);
		} finally {
			setIsSubmitting(false);
		}
	};

	if (isLoading) {
		return (
			<div className="min-h-screen bg-gray-50 flex justify-center items-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-puce mx-auto"></div>
					<p className="mt-4 text-gray-600">Loading profile...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<header>
				<VendorNavBar vendorData={vendorData} />
			</header>

			<main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
				<div className="bg-white shadow-md rounded-lg overflow-hidden">
					<div className="px-6 py-4 bg-puce text-white">
						<h1 className="text-xl font-bold">Edit Your Profile</h1>
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

						<form onSubmit={handleSubmit}>
							{/* Profile Image Section */}
							<div className="mb-6">
								<label className="block text-gray-700 font-medium mb-2">
									Profile Image
								</label>
								<div className="flex flex-col md:flex-row gap-6">
									<div className="w-40 h-40 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
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
												<p className="mt-2 text-sm text-gray-400">No image</p>
											</div>
										)}
									</div>

									<div className="flex-1">
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
														className="w-12 h-12 text-gray-400"
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
											<div className="mt-2 text-right">
												<button
													type="button"
													onClick={removeSelectedImage}
													className="text-red-500 cursor-pointer hover:text-red-700 text-sm"
												>
													Remove selected image
												</button>
											</div>
										)}
									</div>
								</div>
							</div>
							{/* Business Information Section */}
							<div className="mb-6">
								<h2 className="text-lg font-medium text-gray-800 mb-4 pb-2 border-b">
									Business Information
								</h2>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
									<div>
										<label
											className="block text-gray-700 font-medium mb-2"
											htmlFor="shopName"
										>
											Shop/Restaurant Name*
										</label>
										<input
											type="text"
											id="shopName"
											name="shopName"
											className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-puce focus:border-transparent"
											value={formData.shopName}
											onChange={handleChange}
											required
										/>
									</div>

									<div>
										<label
											className="block text-gray-700 font-medium mb-2"
											htmlFor="location"
										>
											Business Address*
										</label>
										<GoogleMapsAutocomplete
											value={formData.location}
											onChange={(value: string) =>
												setFormData((prev) => ({ ...prev, location: value }))
											}
											onSelect={handleLocationSelect}
											placeholder="Enter your business address"
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
								</div>

								<div className="mb-4">
									<label
										className="block text-gray-700 font-medium mb-2"
										htmlFor="businessDescription"
									>
										Business Description
									</label>
									<textarea
										id="businessDescription"
										name="businessDescription"
										rows={4}
										className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-puce focus:border-transparent"
										value={formData.businessDescription}
										onChange={handleChange}
									/>
								</div>

								<div className="mb-6">
									<h2 className="text-lg font-medium text-gray-800 mb-4 pb-2 border-b">
										Business Hours
									</h2>
									<BusinessHoursForm
										value={businessHours}
										onChange={setBusinessHours}
									/>
									<p className="mt-2 text-xs text-gray-500">
										Set your business hours for each day of the week. If
										you&apos;re closed on a particular day, select
										&quot;Closed&quot; and you can add a reason which will be
										shown to customers.
									</p>
								</div>
							</div>
							{/* Contact Information Section */}
							<div className="mb-6">
								<h2 className="text-lg font-medium text-gray-800 mb-4 pb-2 border-b">
									Contact Information
								</h2>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<label
											className="block text-gray-700 font-medium mb-2"
											htmlFor="displayName"
										>
											Contact Person Name*
										</label>
										<input
											type="text"
											id="displayName"
											name="displayName"
											className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-puce focus:border-transparent"
											value={formData.displayName}
											onChange={handleChange}
											required
										/>
									</div>

									<div>
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
											className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-puce focus:border-transparent"
											value={formData.phoneNumber}
											onChange={handleChange}
											required
										/>
									</div>
								</div>
							</div>
							{/* Stripe Account Section */}
							{/* Stripe Account Section */}
							<div className="p-6 bg-white rounded shadow mb-6">
								<h2 className="text-lg font-medium text-gray-800 mb-4 pb-2 border-b">
									Stripe Account
								</h2>
								{vendorData?.stripeAccountId ? (
									<div>
										<p className="text-green-700">
											✅ Connected Stripe account: {vendorData.stripeAccountId}
										</p>
										<div className="mt-2">
											<StripeDisconnect
												entityId={vendorData.uid}
												entityType="vendors"
												onSuccess={refreshVendorData}
												onError={setError}
											/>
										</div>
									</div>
								) : (
									<div>
										<p className="text-gray-700 mb-2">
											To receive payments, please connect your Stripe account.
										</p>
										<button
											type="button"
											onClick={handleConnect}
											className="px-4 py-2 bg-puce cursor-pointer hover:bg-rose text-white rounded-md shadow-sm"
										>
											Connect Stripe Account
										</button>
									</div>
								)}
							</div>
							<div className="flex justify-end space-x-4">
								<button
									type="button"
									onClick={() => router.push("/vendor/dashboard")}
									className="px-4 py-2 cursor-pointer border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
								>
									Cancel
								</button>
								<button
									type="submit"
									className="px-4 py-2 cursor-pointer bg-puce hover:bg-rose text-white rounded-md shadow-sm"
									disabled={isSubmitting || isUploading}
								>
									{isUploading
										? "Uploading Image..."
										: isSubmitting
										? "Saving..."
										: "Save Changes"}
								</button>
							</div>
						</form>
					</div>
				</div>
			</main>
			<Footer />
		</div>
	);
}
