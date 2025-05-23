// src/components/driver/auth/DriverSignUp.tsx
import React, { useState, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
	createDriver,
	updateDriverProfile,
} from "../../../firebase/driverAuth";
import { useDriverAuth } from "../../../hooks/useDriverAuth";
import { uploadImage } from "@/firebase/storage";
import LoadingScreen from "@/components/shared/LoadingScreen";
import GoogleMapsAutocomplete from "@/components/shared/GoogleMapsAutocomplete";
import BackButton from "@/components/shared/BackButton";

// Password validation helper
const validatePassword = (password: string) => {
	// At least 8 characters, one uppercase, one lowercase, one number, one special character
	const hasUpperCase = /[A-Z]/.test(password);
	const hasLowerCase = /[a-z]/.test(password);
	const hasNumber = /[0-9]/.test(password);
	const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
	const isLongEnough = password.length >= 8;

	return {
		isValid:
			hasUpperCase &&
			hasLowerCase &&
			hasNumber &&
			hasSpecialChar &&
			isLongEnough,
		errors: {
			upperCase: !hasUpperCase,
			lowerCase: !hasLowerCase,
			number: !hasNumber,
			specialChar: !hasSpecialChar,
			length: !isLongEnough,
		},
	};
};

// Phone number validation
const validatePhone = (phone: string) => {
	const phoneRegex = /^(\+?\d[\s\-.\(\)]*){7,15}$/;
	return phoneRegex.test(phone);
};

// Email validation
const validateEmail = (email: string) => {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
};

const DriverSignUp: React.FC = () => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [phoneNumber, setPhoneNumber] = useState("");
	const [alternatePhoneNumber, setAlternatePhoneNumber] = useState("");
	const [location, setLocation] = useState("");
	const [address, setAddress] = useState("");
	const [coordinates, setCoordinates] = useState<{
		lat: string;
		lon: string;
	} | null>(null);
	const [errorMessage, setErrorMessage] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [authChecked, setAuthChecked] = useState(false);
	const [addressSelected, setAddressSelected] = useState(false);
	const [imageFile, setImageFile] = useState<File | null>(null);
	const [imagePreview, setImagePreview] = useState<string | null>(null);
	const [formTouched, setFormTouched] = useState({
		email: false,
		displayName: false,
		phoneNumber: false,
		alternatePhoneNumber: false,
		location: false,
		address: false,
		password: false,
		confirmPassword: false,
		profileImage: false,
	});
	const [passwordValidation, setPasswordValidation] = useState({
		isValid: false,
		errors: {
			upperCase: true,
			lowerCase: true,
			number: true,
			specialChar: true,
			length: true,
		},
	});

	const router = useRouter();
	const { user, error, clearError, initializing } = useDriverAuth();

	// Redirect if driver is already signed in
	useEffect(() => {
		if (!initializing) {
			setAuthChecked(true);
			if (user) {
				// If email verified, go to driver dashboard
				router.replace("/driver/dashboard");
			}
		}
	}, [user, router, initializing]);

	// Show error from auth context if any
	useEffect(() => {
		if (error) {
			setErrorMessage(error);
		}
	}, [error]);

	// Update password validation in real-time
	useEffect(() => {
		if (password) {
			setPasswordValidation(validatePassword(password));
		}
	}, [password]);

	// Show loading screen while checking auth or redirecting
	if (!authChecked || (user && authChecked)) {
		return <LoadingScreen message="Checking authentication status..." />;
	}

	// Handle location selection
	const handleLocationSelect = (locationData: {
		address?: {
			name?: string;
			house_number?: string;
			road?: string;
			neighbourhood?: string;
			suburb?: string;
			city?: string;
			state?: string;
			postcode?: string;
			country?: string;
		};
		display_name: string;
		lat: string;
		lon: string;
	}) => {
		// Extract city/service area from the address components
		const addressComponents = locationData.address || {};
		const serviceArea =
			addressComponents.city ||
			addressComponents.state ||
			addressComponents.country ||
			"";

		// Update the location (service area) field
		if (serviceArea) {
			setLocation(serviceArea);
		}

		// Set full address
		setAddress(locationData.display_name);

		// Create a safe copy of coordinates to avoid enumeration issues in React
		const safeCoordinates = {
			lat: String(locationData.lat),
			lon: String(locationData.lon),
		};

		// Store coordinates
		setCoordinates(safeCoordinates);

		setAddressSelected(true);
		setFormTouched({ ...formTouched, address: true });
	};

	// Handle image file selection
	const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (files && files.length > 0) {
			const file = files[0];

			// Validate file type
			if (!file.type.startsWith("image/")) {
				setErrorMessage("Please select an image file");
				return;
			}

			// Validate file size (5MB max)
			if (file.size > 5 * 1024 * 1024) {
				setErrorMessage("Image size must be less than 5MB");
				return;
			}

			setImageFile(file);
			setFormTouched({ ...formTouched, profileImage: true });

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

	const handleInputChange = (
		field: keyof typeof formTouched,
		value: string
	) => {
		switch (field) {
			case "email":
				setEmail(value);
				break;
			case "displayName":
				setDisplayName(value);
				break;
			case "phoneNumber":
				setPhoneNumber(value);
				break;
			case "alternatePhoneNumber":
				setAlternatePhoneNumber(value);
				break;
			case "location":
				setLocation(value);
				break;
			case "password":
				setPassword(value);
				break;
			case "confirmPassword":
				setConfirmPassword(value);
				break;
			default:
				break;
		}

		setFormTouched({ ...formTouched, [field]: true });
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setErrorMessage("");
		clearError();

		// Mark all form fields as touched for validation display
		setFormTouched({
			email: true,
			displayName: true,
			phoneNumber: true,
			alternatePhoneNumber: true,
			location: true,
			address: true,
			password: true,
			confirmPassword: true,
			profileImage: true,
		});

		// Validate all fields
		if (
			!email ||
			!password ||
			!confirmPassword ||
			!displayName ||
			!phoneNumber ||
			!location ||
			!address
		) {
			setErrorMessage(
				"All required fields including profile image must be filled"
			);
			return;
		}

		// Validate email format
		if (!validateEmail(email)) {
			setErrorMessage("Please enter a valid email address");
			return;
		}

		// Validate phone format
		if (!validatePhone(phoneNumber)) {
			setErrorMessage("Please enter a valid phone number");
			return;
		}

		// Validate alternate phone format if provided
		if (alternatePhoneNumber && !validatePhone(alternatePhoneNumber)) {
			setErrorMessage("Please enter a valid alternate phone number");
			return;
		}

		// Check password validation
		if (!passwordValidation.isValid) {
			setErrorMessage("Password does not meet the requirements");
			return;
		}

		// Check if passwords match
		if (password !== confirmPassword) {
			setErrorMessage("Passwords do not match");
			return;
		}

		// Verify that address has been selected from autocomplete
		if (!addressSelected || !coordinates) {
			setErrorMessage("Please select a valid address from the suggestions");
			return;
		}

		setIsLoading(true);

		try {
			// Upload profile image first
			let profileImageUrl = "";

			if (imageFile) {
				setIsUploading(true);

				// Create a path for the image: drivers/[timestamp]-[filename]
				const timestamp = Date.now();
				const path = `drivers/signup/${timestamp}-${imageFile.name}`;

				const uploadResult = await uploadImage(imageFile, path);

				if (uploadResult.success && uploadResult.url) {
					profileImageUrl = uploadResult.url;
				} else {
					throw new Error(`Failed to upload image: ${uploadResult.error}`);
				}

				setIsUploading(false);
			}

			// Create safe copy of coordinates to avoid enumeration issues
			const safeCoordinates = coordinates
				? {
						lat: String(coordinates.lat),
						lon: String(coordinates.lon),
				  }
				: undefined;

			// Create driver with all required information
			const result = await createDriver(
				email,
				password,
				displayName,
				phoneNumber,
				location,
				address,
				alternatePhoneNumber,
				safeCoordinates
			);

			// If driver creation was successful, update the profile with the image URL
			if (result.success && result.user && profileImageUrl) {
				await updateDriverProfile({
					profileImage: profileImageUrl,
				});
			}

			// Show success message
			setErrorMessage(
				"Account created successfully! Redirecting to dashboard..."
			);

			// IMPORTANT: Add a delay and use window.location for full page reload
			setTimeout(() => {
				window.location.href = "/driver/dashboard";
			}, 3000);

			return;
		} catch (error) {
			setErrorMessage((error as Error).message);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="bg-white p-6 rounded-lg shadow-md">
			<BackButton href="/" label="Back to Home" className="mb-2" />
			{errorMessage && (
				<div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4 shadow-sm">
					<div className="flex items-center justify-between">
						<div className="flex items-center">
							<svg
								className="w-5 h-5 mr-2"
								fill="currentColor"
								viewBox="0 0 20 20"
							>
								<path
									fillRule="evenodd"
									d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
									clipRule="evenodd"
								/>
							</svg>
							<span>{errorMessage}</span>
						</div>
						<button
							className="text-xl font-medium cursor-pointer"
							onClick={() => {
								setErrorMessage("");
								clearError();
							}}
						>
							&times;
						</button>
					</div>
				</div>
			)}

			<form onSubmit={handleSubmit}>
				{/* Profile Image */}
				<div className="mb-6">
					<label className="block text-gray-700 font-medium mb-2">
						Profile Image
					</label>
					<div className="flex flex-col items-center gap-4">
						<div className="w-32 h-32 bg-gray-100 rounded-full overflow-hidden flex items-center justify-center border-4 border-white shadow-lg">
							{imagePreview ? (
								<Image
									src={imagePreview}
									alt="Profile Preview"
									width={128}
									height={128}
									className="w-full h-full object-cover"
								/>
							) : (
								<div className="text-center p-4">
									<svg
										className="w-16 h-16 text-gray-300 mx-auto"
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
											Click to upload an image (optional)
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
										Remove
									</button>
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Personal Information */}
				<div className="mb-4">
					<h3 className="text-md font-semibold text-gray-700 mb-3 pb-1 border-b">
						Personal Information
					</h3>

					<div className="mb-4">
						<label
							className="block text-gray-700 mb-2 font-medium"
							htmlFor="email"
						>
							Email*
						</label>
						<input
							id="email"
							type="email"
							className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-sarva focus:border-transparent ${
								formTouched.email && !validateEmail(email) && email
									? "border-red-500"
									: formTouched.email && validateEmail(email)
									? "border-green-500"
									: "border-gray-300"
							}`}
							value={email}
							onChange={(e) => handleInputChange("email", e.target.value)}
							onBlur={() => setFormTouched({ ...formTouched, email: true })}
							required
						/>
						{formTouched.email && !validateEmail(email) && email && (
							<p className="mt-1 text-sm text-red-500">
								Please enter a valid email address
							</p>
						)}
					</div>

					<div className="mb-4">
						<label
							className="block text-gray-700 mb-2 font-medium"
							htmlFor="displayName"
						>
							Full Name*
						</label>
						<input
							id="displayName"
							type="text"
							className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-sarva focus:border-transparent ${
								formTouched.displayName && !displayName
									? "border-red-500"
									: formTouched.displayName && displayName
									? "border-green-500"
									: "border-gray-300"
							}`}
							value={displayName}
							onChange={(e) => handleInputChange("displayName", e.target.value)}
							onBlur={() =>
								setFormTouched({ ...formTouched, displayName: true })
							}
							required
						/>
						{formTouched.displayName && !displayName && (
							<p className="mt-1 text-sm text-red-500">Full name is required</p>
						)}
					</div>

					<div className="mb-4">
						<label
							className="block text-gray-700 mb-2 font-medium"
							htmlFor="phone"
						>
							Phone Number*
						</label>
						<input
							id="phone"
							type="tel"
							className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-sarva focus:border-transparent ${
								formTouched.phoneNumber &&
								!validatePhone(phoneNumber) &&
								phoneNumber
									? "border-red-500"
									: formTouched.phoneNumber && validatePhone(phoneNumber)
									? "border-green-500"
									: "border-gray-300"
							}`}
							value={phoneNumber}
							onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
							onBlur={() =>
								setFormTouched({ ...formTouched, phoneNumber: true })
							}
							placeholder="+1 (123) 456-7890"
							required
						/>
						{formTouched.phoneNumber &&
							!validatePhone(phoneNumber) &&
							phoneNumber && (
								<p className="mt-1 text-sm text-red-500">
									Please enter a valid phone number
								</p>
							)}
						<p className="mt-1 text-sm text-gray-500">
							Format example: +1 (123) 456-7890 or 1234567890
						</p>
					</div>

					<div className="mb-4">
						<label
							className="block text-gray-700 mb-2 font-medium"
							htmlFor="alternatePhone"
						>
							Alternate Phone Number
						</label>
						<input
							id="alternatePhone"
							type="tel"
							className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-sarva focus:border-transparent ${
								formTouched.alternatePhoneNumber &&
								alternatePhoneNumber &&
								!validatePhone(alternatePhoneNumber)
									? "border-red-500"
									: formTouched.alternatePhoneNumber &&
									  alternatePhoneNumber &&
									  validatePhone(alternatePhoneNumber)
									? "border-green-500"
									: "border-gray-300"
							}`}
							value={alternatePhoneNumber}
							onChange={(e) =>
								handleInputChange("alternatePhoneNumber", e.target.value)
							}
							onBlur={() =>
								setFormTouched({ ...formTouched, alternatePhoneNumber: true })
							}
							placeholder="+1 (123) 456-7890"
						/>
						{formTouched.alternatePhoneNumber &&
							alternatePhoneNumber &&
							!validatePhone(alternatePhoneNumber) && (
								<p className="mt-1 text-sm text-red-500">
									Please enter a valid phone number
								</p>
							)}
						<p className="mt-1 text-sm text-gray-500">
							For account security and recovery purposes
						</p>
					</div>
				</div>

				{/* Location Information */}
				<div className="mb-4">
					<h3 className="text-md font-semibold text-gray-700 mb-3 pb-1 border-b">
						Location Information
					</h3>

					<div className="mb-4">
						<label className="block text-gray-700 mb-2 font-medium">
							Address*
						</label>
						<GoogleMapsAutocomplete
							value={address}
							onChange={setAddress}
							onSelect={handleLocationSelect}
							placeholder="Enter your delivery address"
							label=""
							required={true}
							countryCode="us"
						/>
						{formTouched.address && !addressSelected && !coordinates ? (
							<p className="mt-1 text-sm text-red-500">
								Please select a valid address from the suggestions list
							</p>
						) : addressSelected && coordinates ? (
							<p className="mt-1 text-sm text-green-500">
								Valid address selected
							</p>
						) : null}
					</div>

					{addressSelected && coordinates && (
						<div className="mb-4">
							<label
								className="block text-gray-700 mb-2 font-medium"
								htmlFor="location"
							>
								City/Service Area*
							</label>
							<input
								id="location"
								type="text"
								className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-sarva focus:border-transparent ${
									formTouched.location && !location
										? "border-red-500"
										: formTouched.location && location
										? "border-green-500"
										: "border-gray-300"
								}`}
								value={location}
								onChange={(e) => handleInputChange("location", e.target.value)}
								onBlur={() =>
									setFormTouched({ ...formTouched, location: true })
								}
								required
							/>
							{formTouched.location && !location && (
								<p className="mt-1 text-sm text-red-500">
									Service area is required
								</p>
							)}
							<p className="mt-1 text-xs text-gray-500">
								Service area auto-detected from your address. You can edit if
								needed.
							</p>
						</div>
					)}
				</div>

				{/* Password Section */}
				<div className="mb-4">
					<h3 className="text-md font-semibold text-gray-700 mb-3 pb-1 border-b">
						Security
					</h3>

					<div className="mb-4">
						<label
							className="block text-gray-700 mb-2 font-medium"
							htmlFor="password"
						>
							Password*
						</label>
						<input
							id="password"
							type="password"
							className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-sarva focus:border-transparent ${
								formTouched.password && !passwordValidation.isValid && password
									? "border-red-500"
									: formTouched.password && passwordValidation.isValid
									? "border-green-500"
									: "border-gray-300"
							}`}
							value={password}
							onChange={(e) => handleInputChange("password", e.target.value)}
							onBlur={() => setFormTouched({ ...formTouched, password: true })}
							required
						/>

						{/* Password requirements */}
						<div className="mt-2 text-sm">
							<p className="font-semibold mb-1">Password must contain:</p>
							<ul className="pl-5 list-disc">
								<li
									className={
										passwordValidation.errors.length
											? "text-red-500"
											: "text-green-500"
									}
								>
									At least 8 characters
								</li>
								<li
									className={
										passwordValidation.errors.upperCase
											? "text-red-500"
											: "text-green-500"
									}
								>
									At least one uppercase letter (A-Z)
								</li>
								<li
									className={
										passwordValidation.errors.lowerCase
											? "text-red-500"
											: "text-green-500"
									}
								>
									At least one lowercase letter (a-z)
								</li>
								<li
									className={
										passwordValidation.errors.number
											? "text-red-500"
											: "text-green-500"
									}
								>
									At least one number (0-9)
								</li>
								<li
									className={
										passwordValidation.errors.specialChar
											? "text-red-500"
											: "text-green-500"
									}
								>
									At least one special character (e.g., !@#$%^&*)
								</li>
							</ul>
						</div>
					</div>

					<div className="mb-6">
						<label
							className="block text-gray-700 mb-2 font-medium"
							htmlFor="confirmPassword"
						>
							Confirm Password*
						</label>
						<input
							id="confirmPassword"
							type="password"
							className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-sarva focus:border-transparent ${
								formTouched.confirmPassword && password !== confirmPassword
									? "border-red-500"
									: formTouched.confirmPassword &&
									  password === confirmPassword &&
									  password
									? "border-green-500"
									: "border-gray-300"
							}`}
							value={confirmPassword}
							onChange={(e) =>
								handleInputChange("confirmPassword", e.target.value)
							}
							onBlur={() =>
								setFormTouched({ ...formTouched, confirmPassword: true })
							}
							required
						/>
						{formTouched.confirmPassword &&
							password &&
							confirmPassword &&
							password !== confirmPassword && (
								<p className="mt-1 text-sm text-red-500">
									Passwords do not match
								</p>
							)}
					</div>
				</div>

				<div className="mb-6">
					<p className="text-sm text-gray-500 mb-2">
						By signing up, you agree to complete your profile with vehicle,
						driver&apos;s license, and payment information after verification.
					</p>
				</div>

				<button
					type="submit"
					className="w-full bg-sarva cursor-pointer hover:bg-rose text-white py-3 px-4 rounded-md text-lg font-medium shadow-md transition-colors duration-200"
					disabled={
						isLoading ||
						isUploading ||
						!passwordValidation.isValid ||
						!addressSelected ||
						!coordinates
					}
				>
					{isUploading
						? "Uploading Image..."
						: isLoading
						? "Creating Account..."
						: "Sign Up as Driver"}
				</button>

				<div className="mt-6 text-center">
					Already have a driver account?{" "}
					<a
						href="/driver/auth/signin"
						className="text-sarva hover:text-rose font-medium"
					>
						Sign In
					</a>
				</div>
			</form>
		</div>
	);
};

export default DriverSignUp;
