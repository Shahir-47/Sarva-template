"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter, useParams } from "next/navigation";
import { useVendorAuth } from "@/hooks/useVendorAuth";
import VendorNavBar from "@/components/vendor/VendorNavBar";
import { VendorData } from "@/firebase/vendorAuth";
import { getCurrentVendorData } from "@/firebase/vendorAuth";
import {
	getInventoryItem,
	updateInventoryItem,
	InventoryItem,
} from "@/firebase/inventory";
import { uploadImage, deleteImage } from "@/firebase/storage";
import LoadingScreen from "@/components/shared/LoadingScreen";
import Footer from "@/components/shared/Footer";

export default function EditInventoryItemPage() {
	const params = useParams();
	const itemId = params.id as string;

	const [vendorData, setVendorData] = useState<VendorData | null>(null);
	const [item, setItem] = useState<InventoryItem | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [successMessage, setSuccessMessage] = useState("");

	// Form state
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [price, setPrice] = useState("");
	const [cost, setCost] = useState("");
	const [units, setUnits] = useState("");
	const [imageUrl, setImageUrl] = useState("");
	const [imageFile, setImageFile] = useState<File | null>(null);
	const [imagePreview, setImagePreview] = useState<string | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [originalImage, setOriginalImage] = useState<string | null>(null);
	const [imageShouldBeRemoved, setImageShouldBeRemoved] = useState(false);
	const [barcode, setBarcode] = useState("");
	const [tags, setTags] = useState<string[]>([]);
	const [tagInput, setTagInput] = useState("");

	const { user, initializing } = useVendorAuth();
	const router = useRouter();

	useEffect(() => {
		const fetchData = async () => {
			if (initializing) return;

			setIsLoading(true);

			// If no user or email not verified, redirect
			if (!user) {
				router.push("/unauthorized");
				return;
			}

			// Get vendor data
			try {
				const vendorResult = await getCurrentVendorData();
				if (vendorResult.success && vendorResult.data) {
					setVendorData(vendorResult.data);

					// Get item data
					const itemResult = await getInventoryItem(itemId);
					if (itemResult.success && itemResult.data) {
						const itemData = itemResult.data;

						// Verify that this item belongs to this vendor
						if (itemData.vendorID !== vendorResult.data.uid) {
							setError("You don't have permission to edit this item");
							setTimeout(() => {
								router.push("/vendor/inventory");
							}, 2000);
							return;
						}

						// Set item data and form fields
						setItem(itemData);
						setName(itemData.name || "");
						setDescription(itemData.description || "");
						setPrice(itemData.price?.toString() || "");
						setCost(itemData.cost?.toString() || "");
						setUnits(itemData.units?.toString() || "");
						setImageUrl(itemData.image || "");
						setOriginalImage(itemData.image || null);
						setBarcode(itemData.barcode || "");
						setTags(itemData.tags || []);
					} else {
						setError("Item not found");
						setTimeout(() => {
							router.push("/vendor/inventory");
						}, 2000);
					}
				} else if (vendorResult.error) {
					setError(vendorResult.error);
				}
			} catch (err) {
				console.error("Error loading data:", err);
				setError("Failed to load data");
			}

			setIsLoading(false);
		};

		fetchData();
	}, [user, router, initializing, itemId]);

	const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
			setImageUrl(""); // Clear the URL input when a file is selected
			setImageShouldBeRemoved(false); // Reset the removal flag when new image is selected

			// Create a preview URL
			const reader = new FileReader();
			reader.onloadend = () => {
				setImagePreview(reader.result as string);
			};
			reader.readAsDataURL(file);
		}
	};

	const removeImage = () => {
		setImageFile(null);
		setImagePreview(null);
		setImageUrl("");
		setImageShouldBeRemoved(true);
	};

	const addTag = () => {
		if (tagInput.trim() !== "" && !tags.includes(tagInput.trim())) {
			setTags([...tags, tagInput.trim()]);
			setTagInput("");
		}
	};

	const removeTag = (tagToRemove: string) => {
		setTags(tags.filter((tag) => tag !== tagToRemove));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);
		setError("");
		setSuccessMessage("");

		if (!name || !description || !price || !cost || !units) {
			setError("Please fill in all required fields");
			setIsSubmitting(false);
			return;
		}

		try {
			// Validate price and units as numbers
			const priceValue = parseFloat(price);
			const costValue = parseFloat(cost);
			const unitsValue = parseInt(units);

			if (isNaN(priceValue) || priceValue <= 0) {
				setError("Please enter a valid price");
				setIsSubmitting(false);
				return;
			}

			if (isNaN(costValue) || costValue < 0) {
				setError("Please enter a valid cost");
				setIsSubmitting(false);
				return;
			}

			if (costValue > priceValue) {
				setError("Cost should not exceed selling price");
				setIsSubmitting(false);
				return;
			}

			if (isNaN(unitsValue) || unitsValue < 0) {
				setError("Please enter a valid number of units");
				setIsSubmitting(false);
				return;
			}

			if (!vendorData || !item) {
				setError("Item data not available");
				setIsSubmitting(false);
				return;
			}

			// Image URL to be set
			let finalImageUrl = "/placeholder-image.png";

			// If image should be removed (user explicitly clicked the remove button)
			if (imageShouldBeRemoved) {
				// If there's an original image from Firebase Storage, delete it
				if (
					originalImage &&
					originalImage.includes("firebasestorage.googleapis.com")
				) {
					await deleteImage(originalImage);
				}
				// Use placeholder image
				finalImageUrl = "/placeholder-image.png";
			}
			// If a file is selected for upload
			else if (imageFile) {
				setIsUploading(true);

				// Create a path for the image: vendors/[vendorId]/items/[timestamp]-[filename]
				const timestamp = Date.now();
				const path = `vendors/${vendorData.uid}/items/${timestamp}-${imageFile.name}`;

				const uploadResult = await uploadImage(imageFile, path);

				if (uploadResult.success && uploadResult.url) {
					finalImageUrl = uploadResult.url;

					// If there's an original image from Firebase Storage, delete it
					if (
						originalImage &&
						originalImage.includes("firebasestorage.googleapis.com")
					) {
						await deleteImage(originalImage);
					}
				} else {
					setError(`Failed to upload image: ${uploadResult.error}`);
					setIsSubmitting(false);
					setIsUploading(false);
					return;
				}
				setIsUploading(false);
			}
			// If URL is provided
			else if (imageUrl) {
				finalImageUrl = imageUrl;

				// If we're changing from an original Firebase image to a new URL, delete the old one
				if (
					originalImage &&
					originalImage !== imageUrl &&
					originalImage.includes("firebasestorage.googleapis.com")
				) {
					await deleteImage(originalImage);
				}
			}
			// Keep original image if nothing changed
			else if (originalImage && !imageShouldBeRemoved) {
				finalImageUrl = originalImage;
			}

			// Create updated item object
			const updatedItem = {
				name,
				description,
				price: priceValue,
				cost: costValue,
				units: unitsValue,
				image: finalImageUrl,
				tags: tags.length > 0 ? tags : ["other"],
				barcode: barcode || null,
			};

			// Update item in inventory
			const result = await updateInventoryItem(itemId, updatedItem);

			if (result.success) {
				setSuccessMessage("Item updated successfully!");

				// Redirect after a short delay
				setTimeout(() => {
					router.push("/vendor/inventory");
				}, 2000);
			} else {
				setError(result.error || "Failed to update item");
			}
		} catch (error) {
			setError((error as Error).message || "An unexpected error occurred");
			console.error("Error updating item:", error);
		}

		setIsSubmitting(false);
	};

	// Determine what image to show in the preview
	const getImageToDisplay = () => {
		if (imageShouldBeRemoved) {
			return null;
		} else if (imagePreview) {
			return imagePreview;
		} else if (imageUrl) {
			return imageUrl;
		} else if (originalImage && !imageShouldBeRemoved) {
			return originalImage;
		}
		return null;
	};

	const currentImage = getImageToDisplay();

	if (isLoading) {
		return <LoadingScreen message="Loading..." />;
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<header>
				<VendorNavBar vendorData={vendorData} />
			</header>

			<main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
				<div className="bg-white shadow-md rounded-lg overflow-hidden">
					<div className="px-6 py-4 bg-puce text-white">
						<h1 className="text-xl font-bold">Edit Inventory Item</h1>
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
							<div className="mb-4">
								<label
									htmlFor="name"
									className="block text-gray-700 font-medium mb-2"
								>
									Item Name*
								</label>
								<input
									type="text"
									id="name"
									className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-puce focus:border-transparent"
									value={name}
									onChange={(e) => setName(e.target.value)}
									required
								/>
							</div>

							<div className="mb-4">
								<label
									htmlFor="description"
									className="block text-gray-700 font-medium mb-2"
								>
									Description*
								</label>
								<textarea
									id="description"
									className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-puce focus:border-transparent"
									rows={4}
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									required
								/>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
								<div>
									<label
										htmlFor="units"
										className="block text-gray-700 font-medium mb-2"
									>
										Units in Stock*
									</label>
									<input
										type="number"
										id="units"
										min="0"
										className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-puce focus:border-transparent"
										value={units}
										onChange={(e) => setUnits(e.target.value)}
										required
									/>
								</div>

								<div>
									<label
										htmlFor="barcode"
										className="block text-gray-700 font-medium mb-2"
									>
										Barcode (Optional)
									</label>
									<input
										type="text"
										id="barcode"
										className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-puce focus:border-transparent"
										value={barcode}
										onChange={(e) => setBarcode(e.target.value)}
									/>
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
								<div>
									<label
										className="block text-gray-700 mb-2 font-medium"
										htmlFor="price"
									>
										Selling Price ($)*
									</label>
									<input
										type="number"
										id="price"
										step="0.01"
										min="0"
										className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-puce focus:border-transparent"
										value={price}
										onChange={(e) => setPrice(e.target.value)}
										required
									/>
									<p className="mt-1 text-xs text-gray-500">
										Price customers will pay
									</p>
								</div>

								<div>
									<label
										className="block text-gray-700 mb-2 font-medium"
										htmlFor="cost"
									>
										Cost Price ($)*
									</label>
									<input
										type="number"
										id="cost"
										step="0.01"
										min="0"
										className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-puce focus:border-transparent"
										value={cost}
										onChange={(e) => setCost(e.target.value)}
										required
									/>
									<p className="mt-1 text-xs text-gray-500">
										Your purchase/acquisition cost
									</p>
								</div>
							</div>

							{/* Display calculated profit margin as user types */}
							{price &&
								cost &&
								parseFloat(price) > 0 &&
								parseFloat(cost) >= 0 && (
									<div className="mb-4 p-3 bg-gray-50 rounded-lg">
										<div className="flex justify-between">
											<div>
												<span className="text-sm font-medium text-gray-500">
													Profit per unit:
												</span>
												<span className="ml-2 font-bold text-gray-800">
													${(parseFloat(price) - parseFloat(cost)).toFixed(2)}
												</span>
											</div>
											<div>
												<span className="text-sm font-medium text-gray-500">
													Profit margin:
												</span>
												<span className="ml-2 font-bold text-green-600">
													{parseFloat(price) > 0
														? (
																((parseFloat(price) - parseFloat(cost)) /
																	parseFloat(price)) *
																100
														  ).toFixed(1)
														: 0}
													%
												</span>
											</div>
										</div>
									</div>
								)}

							<div className="mb-4">
								<label className="block text-gray-700 font-medium mb-2">
									Item Image
								</label>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
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
														Click to upload a new image
													</p>
													<p className="text-xs text-gray-400">
														JPG, PNG, GIF up to 5MB
													</p>
												</div>
											</label>
										</div>
										<div className="mt-4">
											<label
												htmlFor="imageUrl"
												className="block text-gray-700 font-medium mb-2"
											>
												Or enter an image URL
											</label>
											<input
												type="text"
												id="imageUrl"
												className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-puce focus:border-transparent"
												value={imageUrl}
												onChange={(e) => {
													setImageUrl(e.target.value);
													setImageFile(null);
													setImagePreview(null);
													setImageShouldBeRemoved(false);
												}}
												placeholder="https://example.com/image.jpg"
												disabled={!!imageFile}
											/>
										</div>
									</div>
									<div>
										<p className="text-sm text-gray-500 mb-2">Preview:</p>
										<div className="h-48 w-full border rounded-md flex items-center justify-center overflow-hidden bg-gray-100 relative">
											{currentImage ? (
												<>
													<Image
														src={currentImage}
														alt="Preview"
														className="max-h-full max-w-full object-contain"
														width={500}
														height={500}
														onError={(e) => {
															(e.target as HTMLImageElement).src =
																"/placeholder-image.png";
														}}
													/>
													<button
														type="button"
														onClick={removeImage}
														className="absolute top-2 cursor-pointer right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md hover:bg-red-600"
														title="Remove image"
													>
														×
													</button>
												</>
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
															d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
														/>
													</svg>
													<p className="mt-2 text-sm text-gray-400">
														No image selected
													</p>
												</div>
											)}
										</div>
										{imageShouldBeRemoved && (
											<div className="mt-2 text-xs text-red-500">
												Image will be removed when you update the item
											</div>
										)}
									</div>
								</div>
							</div>

							<div className="mb-6">
								<label className="block text-gray-700 font-medium mb-2">
									Tags
								</label>
								<div className="flex">
									<input
										type="text"
										className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-puce focus:border-transparent"
										value={tagInput}
										onChange={(e) => setTagInput(e.target.value)}
										onKeyPress={(e) => {
											if (e.key === "Enter") {
												e.preventDefault();
												addTag();
											}
										}}
										placeholder="Add a tag and press Enter"
									/>
									<button
										type="button"
										onClick={addTag}
										className="bg-puce cursor-pointer hover:bg-rose text-white py-2 px-4 rounded-r-md"
									>
										Add
									</button>
								</div>

								<div className="mt-2 flex flex-wrap gap-2">
									{tags.map((tag) => (
										<span
											key={tag}
											className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-sm flex items-center"
										>
											{tag}
											<button
												type="button"
												onClick={() => removeTag(tag)}
												className="ml-1 text-gray-500 hover:text-red-500 cursor-pointer"
											>
												&times;
											</button>
										</span>
									))}
								</div>
							</div>

							<div className="flex justify-end space-x-4">
								<button
									type="button"
									onClick={() => router.push("/vendor/inventory")}
									className="cursor-pointer px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
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
										? "Updating..."
										: "Update Item"}
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
