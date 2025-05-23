"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import {
	getCurrentUserData,
	updateUserProfile,
	UserData,
} from "@/firebase/auth";
import { GeoPoint } from "firebase/firestore";
import { uploadImage } from "@/firebase/storage";
import NavBar from "@/components/customer/navBar";
import LoadingScreen from "@/components/shared/LoadingScreen";
import GoogleMapsAutocomplete from "@/components/shared/GoogleMapsAutocomplete";
import Footer from "@/components/shared/Footer";

export default function ProfilePage() {
	const [userData, setUserData] = useState<UserData | null>(null);
	const [formData, setFormData] = useState({
		displayName: "",
		phoneNumber: "",
		location: "",
	});

	const [coordinates, setCoordinates] = useState<{
		lat: string;
		lon: string;
	} | null>(null);
	const [addressSelected, setAddressSelected] = useState(false);
	const [profileImage, setProfileImage] = useState<string | null>(null);
	const [imageFile, setImageFile] = useState<File | null>(null);
	const [imagePreview, setImagePreview] = useState<string | null>(null);

	const [isLoading, setIsLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [error, setError] = useState("");
	const [successMessage, setSuccessMessage] = useState("");
	const [editMode, setEditMode] = useState(false);

	const { user } = useAuth();
	const router = useRouter();

	// Format phone number for display
	const formatPhoneNumber = (phoneNumber: string) => {
		if (!phoneNumber) return "";

		// Strip non-numeric characters
		const cleaned = phoneNumber.replace(/\D/g, "");

		// Format as (XXX) XXX-XXXX for US numbers
		if (cleaned.length === 10) {
			return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(
				6
			)}`;
		} else if (cleaned.length === 11 && cleaned.startsWith("1")) {
			// Format for numbers with country code 1
			return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(
				4,
				7
			)}-${cleaned.slice(7)}`;
		}

		return phoneNumber;
	};

	// Load user data when component mounts
	useEffect(() => {
		const fetchUserData = async () => {
			setIsLoading(true);

			// If no user or email not verified, redirect
			if (!user) {
				router.push("/unauthorized");
				return;
			}

			// Get user data
			try {
				const result = await getCurrentUserData();
				if (result.success && result.data) {
					setUserData(result.data);

					// Populate form with existing data
					setFormData({
						displayName: result.data.displayName || "",
						phoneNumber: result.data.phoneNumber || "",
						location: result.data.location || "",
					});

					// Set coordinates if they exist
					if (result.data.coordinates) {
						const lat = result.data.coordinates.latitude?.toString() || "";
						const lon = result.data.coordinates.longitude?.toString() || "";
						if (lat && lon) {
							setCoordinates({ lat, lon });
							setAddressSelected(true);
						}
					}

					// Set profile image if it exists
					if (result.data.profileImage) {
						setProfileImage(result.data.profileImage);
					}
				} else if (result.error) {
					setError(result.error);
				}
			} catch (err) {
				console.error("Failed to load user data:", err);
				setError("Failed to load user data. Please refresh the page.");
			}

			setIsLoading(false);
		};

		fetchUserData();
	}, [user, router]);

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
		if (formData.location !== userData?.location && !addressSelected) {
			setError("Please select a valid address from the suggestions");
			setIsSubmitting(false);
			return;
		}

		try {
			if (!user) {
				throw new Error("User data not available");
			}

			// Upload image if selected
			let profileImageUrl = profileImage;

			if (imageFile) {
				setIsUploading(true);

				// Create a path for the image: users/[userId]/profile/[timestamp]-[filename]
				const timestamp = Date.now();
				const path = `users/${user.uid}/profile/${timestamp}-${imageFile.name}`;

				const uploadResult = await uploadImage(imageFile, path);

				if (uploadResult.success && uploadResult.url) {
					profileImageUrl = uploadResult.url;
				} else {
					throw new Error(`Failed to upload image: ${uploadResult.error}`);
				}

				setIsUploading(false);
			}

			// Update user profile including the profile image URL if available
			const updateData = {
				...formData,
				...(profileImageUrl ? { profileImage: profileImageUrl } : {}),
				...(coordinates ? { coordinates } : {}),
			};

			const result = await updateUserProfile(updateData);

			if (result.success) {
				setSuccessMessage("Profile updated successfully!");

				// Update the profile image state
				if (profileImageUrl) {
					setProfileImage(profileImageUrl);
				}

				// Update userData with new values
				setUserData((prev) => {
					if (!prev) return null;
					return {
						...prev,
						...updateData,
						coordinates: coordinates
							? new GeoPoint(
									parseFloat(coordinates.lat),
									parseFloat(coordinates.lon)
							  )
							: prev.coordinates,
					};
				});

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
		return <LoadingScreen message="Loading your profile..." />;
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<header>
				<NavBar />
			</header>

			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
				{error && (
					<div className="bg-red-100 border border-red-200 text-red-700 p-4 rounded-lg mb-6 flex items-center">
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
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/>
						</svg>
						{error}
					</div>
				)}

				{successMessage && (
					<div className="bg-green-100 border border-green-200 text-green-700 p-4 rounded-lg mb-6 flex items-center">
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
								d="M5 13l4 4L19 7"
							/>
						</svg>
						{successMessage}
					</div>
				)}

				<div className="bg-white shadow-md rounded-lg overflow-hidden">
					<div className="border-b border-gray-200 bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4">
						<div className="flex justify-between items-center">
							<h1 className="text-xl font-bold text-white">
								{editMode ? "Edit Your Profile" : "Your Profile"}
							</h1>
							{!editMode && (
								<button
									type="button"
									onClick={() => setEditMode(true)}
									className="cursor-pointer px-4 py-2 bg-white text-blue-600 rounded-md shadow-sm hover:bg-blue-50 transition-colors"
								>
									Edit Profile
								</button>
							)}
						</div>
					</div>

					<div className="p-6">
						{/* View Mode */}
						{!editMode ? (
							<div className="flex flex-col md:flex-row gap-8">
								{/* Profile Image */}
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
										{userData?.displayName}
									</h2>
									<a
										className="text-gray-500 hover:underline"
										href={`mailto:${userData?.email}`}
									>
										{userData?.email}
									</a>
								</div>

								{/* Profile Details */}
								<div className="md:w-2/3">
									<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
										{/* Contact Information */}
										<div className="space-y-4">
											<h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
												Contact Information
											</h3>

											<div>
												<p className="text-sm text-gray-500">Phone Number</p>
												<a
													className="text-base text-gray-900 hover:underline"
													href={`tel:${userData?.phoneNumber}`}
												>
													{formatPhoneNumber(userData?.phoneNumber || "")}
												</a>
											</div>

											<div>
												<p className="text-sm text-gray-500">
													Delivery Address
												</p>
												<a
													className="text-base text-gray-900 hover:underline"
													href={`https://www.google.com/maps/search/?api=1&query=${coordinates?.lat},${coordinates?.lon}`}
													target="_blank"
													rel="noopener noreferrer"
												>
													{userData?.location}
												</a>
											</div>

											<div>
												<p className="text-sm text-gray-500">Member Since</p>
												<p className="text-base text-gray-900">
													{formatDate(userData?.created_at ?? null)}
												</p>
											</div>
										</div>
									</div>

									{/* Recent Activity */}
									{userData?.order_ids && userData.order_ids.length > 0 && (
										<div className="mt-8">
											<h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">
												Recent Orders
											</h3>
											<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
												{userData.order_ids.slice(0, 4).map((orderId) => (
													<div
														key={orderId}
														className="border rounded-lg p-4 hover:bg-gray-50 hover:shadow-sm transition-all"
													>
														<div className="flex justify-between items-center">
															<p className="font-medium">
																Order #{orderId.slice(-6)}
															</p>
															<button
																onClick={() =>
																	router.push(
																		`/customer/my-orders?order=${orderId}`
																	)
																}
																className="text-blue-600 cursor-pointer hover:text-blue-800 text-sm"
															>
																View Details
															</button>
														</div>
													</div>
												))}
											</div>

											{userData.order_ids.length > 4 && (
												<div className="mt-3 text-right">
													<button
														onClick={() => router.push("/customer/my-orders")}
														className="text-blue-600 hover:text-blue-800 cursor-pointer text-sm font-medium"
													>
														View All Orders →
													</button>
												</div>
											)}
										</div>
									)}
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
												<div className="w-48 h-48 bg-gray-100 rounded-full overflow-hidden flex items-center justify-center border-4 border-white shadow-lg">
													{imagePreview ? (
														<Image
															src={imagePreview}
															alt="Profile Preview"
															width={192}
															height={192}
															className="w-full h-full object-cover"
														/>
													) : profileImage ? (
														<Image
															src={profileImage}
															alt="Current Profile"
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
													className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
													value={formData.displayName}
													onChange={handleChange}
													required
												/>
											</div>

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
													className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
													value={formData.phoneNumber}
													onChange={handleChange}
													required
												/>
											</div>

											<div className="mb-4">
												<label className="block text-gray-700 font-medium mb-2">
													Delivery Address*
												</label>
												<GoogleMapsAutocomplete
													value={formData.location}
													onChange={(value: string) =>
														setFormData((prev) => ({
															...prev,
															location: value,
														}))
													}
													onSelect={handleLocationSelect}
													placeholder="Enter your delivery address"
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

										<div className="flex justify-end space-x-4">
											<button
												type="button"
												onClick={() => setEditMode(false)}
												className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
											>
												Cancel
											</button>
											<button
												type="submit"
												className="px-4 py-2 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm"
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
		</div>
	);
}
