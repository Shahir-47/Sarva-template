// src/firebase/driverAuth.ts
import {
	createUserWithEmailAndPassword,
	signInWithEmailAndPassword,
	signOut as firebaseSignOut,
	sendPasswordResetEmail,
	updateProfile,
	User,
} from "firebase/auth";

import {
	doc,
	setDoc,
	getDoc,
	updateDoc,
	Timestamp,
	query,
	collection,
	where,
	getDocs,
	GeoPoint,
} from "firebase/firestore";

import { auth, db } from "./config";

// Interface for driver data
export interface DriverData {
	profileImage: string;
	uid: string;
	email: string | null;
	displayName: string | null;
	phoneNumber: string;
	alternatePhoneNumber?: string;
	location: string;
	address: string;
	coordinates?: GeoPoint | null;
	// Vehicle details
	vehicleInfo?: {
		make?: string;
		model?: string;
		year?: number;
		color?: string;
		licensePlate?: string;
		vin?: string;
	};
	// Driving license details
	driverLicense?: {
		number?: string;
		state?: string;
		expiryDate?: string;
		imageUrl?: string;
	};
	// Work authorization details
	workAuthorization?: {
		ssn?: string;
		documentType?: string; // W-2, 1099, etc.
		documentUrl?: string;
	};
	// Payment details
	stripeAccountId?: string; // Stripe account ID for payments
	stripeCapabilities?: {
		card_payments: boolean;
		transfers: boolean;
	};
	stripeOnboardingComplete?: boolean;
	// Statistics
	stats?: {
		totalDeliveries: number;
		totalEarnings: number;
		totalMilesDriven: number;
		averageRating: number;
		totalDistance: number;
		totalItems: number;
	};
	deliveryIds: string[]; // IDs of deliveries completed or attempted
	created_at: Timestamp;
	updated_at: Timestamp;
}

// Check if email already exists in drivers collection
export const checkDriverEmailExists = async (
	email: string
): Promise<boolean> => {
	try {
		const driversRef = collection(db, "drivers");
		const q = query(driversRef, where("email", "==", email));
		const querySnapshot = await getDocs(q);

		return !querySnapshot.empty;
	} catch (error) {
		console.error("Error checking if driver email exists:", error);
		throw error;
	}
};

// Check if phone number already exists for drivers
export const checkDriverPhoneExists = async (
	phoneNumber: string
): Promise<boolean> => {
	try {
		const driversRef = collection(db, "drivers");
		const q = query(driversRef, where("phoneNumber", "==", phoneNumber));
		const querySnapshot = await getDocs(q);

		return !querySnapshot.empty;
	} catch (error) {
		console.error("Error checking if driver phone exists:", error);
		throw error;
	}
};

// Create a new driver with email, password, and required details
// Update the createDriver function to handle location coordinates
export const createDriver = async (
	email: string,
	password: string,
	displayName: string,
	phoneNumber: string,
	location: string,
	address: string,
	alternatePhoneNumber: string = "",
	coordinates?: { lat: string; lon: string }
): Promise<{ success: boolean; user?: User; error?: string }> => {
	try {
		// First check if email exists in Firestore (driver DB)
		const driversRef = collection(db, "drivers");
		const q = query(driversRef, where("email", "==", email));
		const querySnapshot = await getDocs(q);

		let existingDriverData: DriverData | null = null;
		let existingDocId: string | null = null;

		// If email exists in the driver database
		if (!querySnapshot.empty) {
			existingDocId = querySnapshot.docs[0].id;
			existingDriverData = querySnapshot.docs[0].data() as DriverData;
		} else {
			// Only check for phone number if creating a completely new driver
			const phoneExists = await checkDriverPhoneExists(phoneNumber);
			if (phoneExists) {
				return {
					success: false,
					error: "Phone number already in use by another driver",
				};
			}
		}

		// Create user with email and password in Authentication
		const userCredential = await createUserWithEmailAndPassword(
			auth,
			email,
			password
		);
		const user = userCredential.user;

		// Update profile with display name
		await updateProfile(user, { displayName });

		// Prepare location GeoPoint if coordinates are provided
		const geoPoint = coordinates
			? new GeoPoint(parseFloat(coordinates.lat), parseFloat(coordinates.lon))
			: null;

		// Update or create driver document in Firestore
		if (existingDriverData && existingDocId) {
			// Update existing document with new auth UID and other details
			await updateDoc(doc(db, "drivers", existingDocId), {
				uid: user.uid,
				displayName: user.displayName,
				phoneNumber: phoneNumber,
				alternatePhoneNumber: alternatePhoneNumber,
				location: location,
				address: address,
				coordinates: geoPoint,
				deliveryIds: existingDriverData.deliveryIds || [],
				updated_at: Timestamp.now(),
			});
		} else {
			// Create new driver document
			await setDoc(doc(db, "drivers", user.uid), {
				uid: user.uid,
				email: user.email,
				displayName: user.displayName,
				phoneNumber: phoneNumber,
				alternatePhoneNumber: alternatePhoneNumber,
				location: location,
				address: address,
				coordinates: geoPoint,
				vehicleInfo: {},
				driverLicense: {},
				workAuthorization: {},
				paymentInfo: {},
				stats: {
					totalDeliveries: 0,
					totalEarnings: 0,
					totalMilesDriven: 0,
					averageRating: 0,
				},
				deliveryIds: [],
				created_at: Timestamp.now(),
				updated_at: Timestamp.now(),
			});
		}

		return { success: true, user };
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
};

// Sign in driver with email and password
export const signInDriverWithEmail = async (
	email: string,
	password: string
): Promise<{ success: boolean; user?: User; error?: string }> => {
	try {
		// First check if this email belongs to a user account
		const usersRef = collection(db, "drivers");
		const q = query(usersRef, where("email", "==", email));
		const querySnapshot = await getDocs(q);

		if (querySnapshot.empty) {
			return {
				success: false,
				error:
					"No driver account found with this email. Please use the correct sign-in page for your account type.",
			};
		}

		const userCredential = await signInWithEmailAndPassword(
			auth,
			email,
			password
		);

		// Check if user exists in drivers collection to confirm they're a driver
		const driverDocRef = doc(db, "drivers", userCredential.user.uid);
		const driverDoc = await getDoc(driverDocRef);

		if (!driverDoc.exists()) {
			// User exists in Auth but not as a driver
			await firebaseSignOut(auth);
			return {
				success: false,
				error:
					"Account exists but not as a driver. Please sign in through the appropriate portal.",
			};
		}

		return { success: true, user: userCredential.user };
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
};

// Get current driver data from Firestore
export const getCurrentDriverData = async (): Promise<{
	success: boolean;
	data?: DriverData;
	error?: string;
}> => {
	try {
		const user = auth.currentUser;
		if (!user) {
			throw new Error("No user is currently signed in");
		}

		// First try to get the document by UID
		const driverDocRef = doc(db, "drivers", user.uid);
		const driverDoc = await getDoc(driverDocRef);

		if (driverDoc.exists()) {
			console.log("Found driver document by UID");
			return { success: true, data: driverDoc.data() as DriverData };
		} else {
			// If not found by UID, try to find by email
			console.log("Document not found by UID, trying email lookup");
			const email = user.email;

			if (!email) {
				throw new Error("User has no email associated");
			}

			// Try to find driver document by email
			const driversRef = collection(db, "drivers");
			const q = query(driversRef, where("email", "==", email));
			const querySnapshot = await getDocs(q);

			if (!querySnapshot.empty) {
				console.log("Found driver document by email");
				const driverData = querySnapshot.docs[0].data() as DriverData;
				const docId = querySnapshot.docs[0].id;

				await updateDoc(doc(db, "drivers", docId), {
					uid: user.uid,
					updated_at: Timestamp.now(),
				});

				return { success: true, data: driverData };
			} else {
				throw new Error("Driver document not found");
			}
		}
	} catch (error) {
		console.error("Error in getCurrentDriverData:", error);
		return { success: false, error: (error as Error).message };
	}
};

// Send verification email for driver
export const sendDriverVerificationEmail = async (): Promise<{
	success: boolean;
	error?: string;
}> => {
	try {
		const user = auth.currentUser;
		if (!user) {
			throw new Error("No user is currently signed in");
		}

		return { success: true };
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
};

// Send password reset email for driver
export const resetDriverPassword = async (
	email: string
): Promise<{ success: boolean; error?: string }> => {
	try {
		// First check if email exists in drivers collection
		const driversRef = collection(db, "drivers");
		const q = query(driversRef, where("email", "==", email));
		const querySnapshot = await getDocs(q);

		if (querySnapshot.empty) {
			return {
				success: false,
				error: "No driver account found with this email",
			};
		}

		// Send password reset email
		await sendPasswordResetEmail(auth, email);
		return { success: true };
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
};

// Update driver profile
export const updateDriverProfile = async (data: {
	profileImage?: string;
	displayName?: string;
	phoneNumber?: string;
	alternatePhoneNumber?: string;
	location?: string;
	address?: string;
	coordinates?: { lat: string; lon: string };
	vehicleInfo?: {
		make?: string;
		model?: string;
		year?: number;
		color?: string;
		licensePlate?: string;
		vin?: string;
	};
	driverLicense?: {
		number?: string;
		state?: string;
		expiryDate?: string;
		imageUrl?: string;
	};
	workAuthorization?: {
		ssn?: string;
		documentType?: string;
		documentUrl?: string;
	};
	paymentInfo?: {
		accountType?: string;
		accountDetails?: string;
	};
}): Promise<{ success: boolean; error?: string }> => {
	try {
		const user = auth.currentUser;
		if (!user) {
			throw new Error("No user is currently signed in");
		}

		// Check if the new phone number is already in use by another account
		if (data.phoneNumber) {
			const phoneExists = await checkDriverPhoneExists(data.phoneNumber);
			if (phoneExists) {
				// Get the driver data to check if it's the same driver
				const driverDocRef = doc(db, "drivers", user.uid);
				const driverDoc = await getDoc(driverDocRef);

				if (driverDoc.exists()) {
					const driverData = driverDoc.data() as DriverData;
					if (driverData.phoneNumber !== data.phoneNumber) {
						return {
							success: false,
							error: "Phone number already in use by another driver",
						};
					}
				}
			}
		}

		// Update displayName in Firebase Auth if provided
		if (data.displayName) {
			await updateProfile(user, { displayName: data.displayName });
		}

		// Convert coordinates to GeoPoint if provided
		let geoPoint = null;
		if (data.coordinates && data.coordinates.lat && data.coordinates.lon) {
			geoPoint = new GeoPoint(
				parseFloat(data.coordinates.lat),
				parseFloat(data.coordinates.lon)
			);
		}

		// Update document in Firestore
		const driverDocRef = doc(db, "drivers", user.uid);
		const updateData: Partial<DriverData> = {
			updated_at: Timestamp.now(),
		};

		// Add fields to update data if they exist
		if (data.displayName) updateData.displayName = data.displayName;
		if (data.phoneNumber) updateData.phoneNumber = data.phoneNumber;
		if (data.alternatePhoneNumber)
			updateData.alternatePhoneNumber = data.alternatePhoneNumber;
		if (data.location) updateData.location = data.location;
		if (data.address) updateData.address = data.address;
		if (geoPoint) updateData.coordinates = geoPoint;
		if (data.profileImage) updateData.profileImage = data.profileImage;

		// Handle nested objects
		if (data.vehicleInfo) {
			const driverDoc = await getDoc(driverDocRef);
			const existingData = driverDoc.exists()
				? (driverDoc.data() as DriverData)
				: { vehicleInfo: {} };
			updateData.vehicleInfo = {
				...existingData.vehicleInfo,
				...data.vehicleInfo,
			};
		}

		if (data.driverLicense) {
			const driverDoc = await getDoc(driverDocRef);
			const existingData = driverDoc.exists()
				? (driverDoc.data() as DriverData)
				: { driverLicense: {} };
			updateData.driverLicense = {
				...existingData.driverLicense,
				...data.driverLicense,
			};
		}

		if (data.workAuthorization) {
			const driverDoc = await getDoc(driverDocRef);
			const existingData = driverDoc.exists()
				? (driverDoc.data() as DriverData)
				: { workAuthorization: {} };
			updateData.workAuthorization = {
				...existingData.workAuthorization,
				...data.workAuthorization,
			};
		}

		await updateDoc(driverDocRef, updateData);

		return { success: true };
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
};

// Add delivery to driver's delivery list
export const addDeliveryToDriver = async (
	deliveryId: string
): Promise<{ success: boolean; error?: string }> => {
	try {
		const user = auth.currentUser;
		if (!user) {
			throw new Error("No user is currently signed in");
		}

		const driverDocRef = doc(db, "drivers", user.uid);

		// Get current deliveries to ensure no duplicates
		const driverDoc = await getDoc(driverDocRef);
		if (driverDoc.exists()) {
			const driverData = driverDoc.data() as DriverData;
			const deliveries = driverData.deliveryIds || [];

			// Only add if not already in the array
			if (!deliveries.includes(deliveryId)) {
				await updateDoc(driverDocRef, {
					deliveryIds: [...deliveries, deliveryId],
					updated_at: Timestamp.now(),
				});
			}
		}

		return { success: true };
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
};

// Update driver statistics
export const updateDriverStats = async (stats: {
	totalDeliveries?: number;
	totalEarnings?: number;
	totalMilesDriven?: number;
	averageRating?: number;
}): Promise<{ success: boolean; error?: string }> => {
	try {
		const user = auth.currentUser;
		if (!user) {
			throw new Error("No user is currently signed in");
		}

		const driverDocRef = doc(db, "drivers", user.uid);
		const driverDoc = await getDoc(driverDocRef);

		if (driverDoc.exists()) {
			const driverData = driverDoc.data() as DriverData;
			const currentStats = driverData.stats || {
				totalDeliveries: 0,
				totalEarnings: 0,
				totalMilesDriven: 0,
				averageRating: 0,
			};

			const updatedStats = {
				...currentStats,
				...stats,
			};

			await updateDoc(driverDocRef, {
				stats: updatedStats,
				updated_at: Timestamp.now(),
			});

			return { success: true };
		} else {
			return { success: false, error: "Driver document not found" };
		}
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
};

// Sign out driver
export const signOut = async (): Promise<void> => {
	try {
		await firebaseSignOut(auth);
	} catch (error) {
		console.error("Error signing out:", error);
	}
};
