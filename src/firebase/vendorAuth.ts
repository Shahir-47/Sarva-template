// src/firebase/vendorAuth.ts
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

export interface BusinessHoursDay {
	isOpen: boolean;
	openTime?: string;
	closeTime?: string;
	closedReason?: string;
	allDay?: boolean;
}

// Interface for the full week of business hours
export interface BusinessHours {
	monday: BusinessHoursDay;
	tuesday: BusinessHoursDay;
	wednesday: BusinessHoursDay;
	thursday: BusinessHoursDay;
	friday: BusinessHoursDay;
	saturday: BusinessHoursDay;
	sunday: BusinessHoursDay;
}

// Interface for vendor data
export interface VendorData {
	uid: string;
	email: string | null;
	displayName: string | null;
	phoneNumber: string;
	shopName: string;
	location: string;
	coordinates?: GeoPoint | null;
	businessDescription?: string;
	businessHours?: BusinessHours;
	profileImage?: string; // Added profile image property
	inventory: string[]; // IDs of items in inventory
	stripeAccountId?: string;
	created_at: Timestamp;
	updated_at: Timestamp;
}

// Check if email already exists in vendors collection
export const checkVendorEmailExists = async (
	email: string
): Promise<boolean> => {
	try {
		const vendorsRef = collection(db, "vendors");
		const q = query(vendorsRef, where("email", "==", email));
		const querySnapshot = await getDocs(q);

		return !querySnapshot.empty;
	} catch (error) {
		console.error("Error checking if vendor email exists:", error);
		throw error;
	}
};

// Check if phone number already exists for vendors
export const checkVendorPhoneExists = async (
	phoneNumber: string
): Promise<boolean> => {
	try {
		const vendorsRef = collection(db, "vendors");
		const q = query(vendorsRef, where("phoneNumber", "==", phoneNumber));
		const querySnapshot = await getDocs(q);

		return !querySnapshot.empty;
	} catch (error) {
		console.error("Error checking if vendor phone exists:", error);
		throw error;
	}
};

// Create a new vendor with email, password, and required details
// Update the createVendor function to handle location coordinates
export const createVendor = async (
	email: string,
	password: string,
	displayName: string,
	phoneNumber: string,
	shopName: string,
	location: string,
	businessDescription: string = "",
	businessHours?: BusinessHours,
	coordinates?: { lat: string; lon: string }
): Promise<{ success: boolean; user?: User; error?: string }> => {
	try {
		// First check if email exists in Firestore (vendor DB)
		const vendorsRef = collection(db, "vendors");
		const q = query(vendorsRef, where("email", "==", email));
		const querySnapshot = await getDocs(q);

		let existingVendorData: VendorData | null = null;
		let existingDocId: string | null = null;

		// If email exists in the vendor database
		if (!querySnapshot.empty) {
			existingDocId = querySnapshot.docs[0].id;
			existingVendorData = querySnapshot.docs[0].data() as VendorData;
		} else {
			// Only check for phone number if creating a completely new vendor
			const phoneExists = await checkVendorPhoneExists(phoneNumber);
			if (phoneExists) {
				return {
					success: false,
					error: "Phone number already in use by another vendor",
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
		let geoPoint = null;
		if (
			coordinates &&
			typeof coordinates.lat === "string" &&
			typeof coordinates.lon === "string"
		) {
			try {
				const lat = parseFloat(coordinates.lat);
				const lon = parseFloat(coordinates.lon);
				if (!isNaN(lat) && !isNaN(lon)) {
					geoPoint = new GeoPoint(lat, lon);
				}
			} catch (e) {
				console.error("Error parsing coordinates:", e);
				// Continue without coordinates rather than failing
			}
		}

		// Update or create vendor document in Firestore
		if (existingVendorData && existingDocId) {
			// Update existing document with new auth UID and other details
			await updateDoc(doc(db, "vendors", existingDocId), {
				uid: user.uid,
				displayName: user.displayName,
				phoneNumber: phoneNumber,
				shopName: shopName,
				location: location,
				coordinates: geoPoint,
				businessDescription: businessDescription,
				businessHours: businessHours,
				inventory: existingVendorData.inventory || [],
				updated_at: Timestamp.now(),
			});
		} else {
			// Create new vendor document
			await setDoc(doc(db, "vendors", user.uid), {
				uid: user.uid,
				email: user.email,
				displayName: user.displayName,
				phoneNumber: phoneNumber,
				shopName: shopName,
				location: location,
				coordinates: geoPoint,
				businessDescription: businessDescription,
				businessHours: businessHours,
				profileImage: "", // Initialize empty profile image
				inventory: [],
				created_at: Timestamp.now(),
				updated_at: Timestamp.now(),
			});
		}

		return { success: true, user };
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
};

// Sign in vendor with email and password
export const signInVendorWithEmail = async (
	email: string,
	password: string
): Promise<{ success: boolean; user?: User; error?: string }> => {
	// First check if this email belongs to a user account
	const usersRef = collection(db, "vendors");
	const q = query(usersRef, where("email", "==", email));
	const querySnapshot = await getDocs(q);

	if (querySnapshot.empty) {
		return {
			success: false,
			error:
				"No vendors account found with this email. Please use the correct sign-in page for your account type.",
		};
	}

	try {
		const userCredential = await signInWithEmailAndPassword(
			auth,
			email,
			password
		);

		// Check if user exists in vendors collection to confirm they're a vendor
		const vendorDocRef = doc(db, "vendors", userCredential.user.uid);
		const vendorDoc = await getDoc(vendorDocRef);

		if (!vendorDoc.exists()) {
			// User exists in Auth but not as a vendor
			await firebaseSignOut(auth);
			return {
				success: false,
				error:
					"Account exists but not as a vendor. Please sign in through the appropriate portal.",
			};
		}

		return { success: true, user: userCredential.user };
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
};

// Get current vendor data from Firestore
export const getCurrentVendorData = async (): Promise<{
	success: boolean;
	data?: VendorData;
	error?: string;
}> => {
	try {
		const user = auth.currentUser;
		if (!user) {
			throw new Error("No user is currently signed in");
		}

		// First try to get the document by UID
		const vendorDocRef = doc(db, "vendors", user.uid);
		const vendorDoc = await getDoc(vendorDocRef);

		if (vendorDoc.exists()) {
			console.log("Found vendor document by UID");
			return { success: true, data: vendorDoc.data() as VendorData };
		} else {
			// If not found by UID, try to find by email
			console.log("Document not found by UID, trying email lookup");
			const email = user.email;

			if (!email) {
				throw new Error("User has no email associated");
			}

			// Try to find vendor document by email
			const vendorsRef = collection(db, "vendors");
			const q = query(vendorsRef, where("email", "==", email));
			const querySnapshot = await getDocs(q);

			if (!querySnapshot.empty) {
				console.log("Found vendor document by email");
				const vendorData = querySnapshot.docs[0].data() as VendorData;
				const docId = querySnapshot.docs[0].id;

				await updateDoc(doc(db, "vendors", docId), {
					uid: user.uid,
					updated_at: Timestamp.now(),
				});

				return { success: true, data: vendorData };
			} else {
				throw new Error("Vendor document not found");
			}
		}
	} catch (error) {
		console.error("Error in getCurrentVendorData:", error);
		return { success: false, error: (error as Error).message };
	}
};

// Send verification email for vendor
export const sendVendorVerificationEmail = async (): Promise<{
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

// Send password reset email for vendor
export const resetVendorPassword = async (
	email: string
): Promise<{ success: boolean; error?: string }> => {
	try {
		// First check if email exists in vendors collection
		const vendorsRef = collection(db, "vendors");
		const q = query(vendorsRef, where("email", "==", email));
		const querySnapshot = await getDocs(q);

		if (querySnapshot.empty) {
			return {
				success: false,
				error: "No vendor account found with this email",
			};
		}

		// Send password reset email
		await sendPasswordResetEmail(auth, email);
		return { success: true };
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
};

// Update vendor profile
// Update vendor profile
export const updateVendorProfile = async (data: {
	displayName?: string;
	phoneNumber?: string;
	shopName?: string;
	location?: string;
	businessDescription?: string;
	profileImage?: string;
	businessHours?: BusinessHours;
	coordinates?: { lat: string; lon: string };
}): Promise<{ success: boolean; error?: string }> => {
	try {
		const user = auth.currentUser;
		if (!user) {
			throw new Error("No user is currently signed in");
		}

		// Check if the new phone number is already in use by another account
		if (data.phoneNumber) {
			const phoneExists = await checkVendorPhoneExists(data.phoneNumber);
			if (phoneExists) {
				// Get the vendor data to check if it's the same vendor
				const vendorDocRef = doc(db, "vendors", user.uid);
				const vendorDoc = await getDoc(vendorDocRef);

				if (vendorDoc.exists()) {
					const vendorData = vendorDoc.data() as VendorData;
					if (vendorData.phoneNumber !== data.phoneNumber) {
						return {
							success: false,
							error: "Phone number already in use by another vendor",
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
		const vendorDocRef = doc(db, "vendors", user.uid);
		const updateData: Partial<VendorData> = {
			updated_at: Timestamp.now(),
		};

		if (data.displayName) updateData.displayName = data.displayName;
		if (data.phoneNumber) updateData.phoneNumber = data.phoneNumber;
		if (data.shopName) updateData.shopName = data.shopName;
		if (data.location) updateData.location = data.location;
		if (data.businessDescription)
			updateData.businessDescription = data.businessDescription;
		if (data.profileImage !== undefined)
			updateData.profileImage = data.profileImage;
		if (geoPoint) updateData.coordinates = geoPoint;
		if (data.businessHours) updateData.businessHours = data.businessHours;

		await updateDoc(vendorDocRef, updateData);

		return { success: true };
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
};

// Add item to vendor's inventory
export const addItemToVendorInventory = async (
	itemId: string
): Promise<{ success: boolean; error?: string }> => {
	try {
		const user = auth.currentUser;
		if (!user) {
			throw new Error("No user is currently signed in");
		}

		const vendorDocRef = doc(db, "vendors", user.uid);

		// Get current inventory to ensure no duplicates
		const vendorDoc = await getDoc(vendorDocRef);
		if (vendorDoc.exists()) {
			const vendorData = vendorDoc.data() as VendorData;
			const inventory = vendorData.inventory || [];

			// Only add if not already in the array
			if (!inventory.includes(itemId)) {
				await updateDoc(vendorDocRef, {
					inventory: [...inventory, itemId],
					updated_at: Timestamp.now(),
				});
			}
		}

		return { success: true };
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
};

// Remove item from vendor's inventory
export const removeItemFromVendorInventory = async (
	itemId: string
): Promise<{ success: boolean; error?: string }> => {
	try {
		const user = auth.currentUser;
		if (!user) {
			throw new Error("No user is currently signed in");
		}

		const vendorDocRef = doc(db, "vendors", user.uid);

		// Get current inventory
		const vendorDoc = await getDoc(vendorDocRef);
		if (vendorDoc.exists()) {
			const vendorData = vendorDoc.data() as VendorData;
			const inventory = vendorData.inventory || [];

			// Filter out the item
			const updatedInventory = inventory.filter((id) => id !== itemId);

			await updateDoc(vendorDocRef, {
				inventory: updatedInventory,
				updated_at: Timestamp.now(),
			});
		}

		return { success: true };
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
};

// Sign out vendor
export const signOut = async (): Promise<void> => {
	try {
		await firebaseSignOut(auth);
	} catch (error) {
		console.error("Error signing out:", error);
	}
};
