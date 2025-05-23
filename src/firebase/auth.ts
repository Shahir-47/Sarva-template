// src/firebase/auth.ts
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

// Interface for user data
export interface UserData {
	profileImage: string;
	uid: string;
	email: string | null;
	displayName: string | null;
	phoneNumber: string;
	location?: string | null;
	coordinates?: GeoPoint | null;
	order_ids: string[];
	created_at: Timestamp;
	updated_at: Timestamp;
}

// Check if email already exists
export const checkEmailExists = async (email: string): Promise<boolean> => {
	try {
		const usersRef = collection(db, "users");
		const q = query(usersRef, where("email", "==", email));
		const querySnapshot = await getDocs(q);

		return !querySnapshot.empty;
	} catch (error) {
		console.error("Error checking if email exists:", error);
		throw error;
	}
};

// Check if phone number already exists
export const checkPhoneExists = async (
	phoneNumber: string
): Promise<boolean> => {
	try {
		const usersRef = collection(db, "users");
		const q = query(usersRef, where("phoneNumber", "==", phoneNumber));
		const querySnapshot = await getDocs(q);

		return !querySnapshot.empty;
	} catch (error) {
		console.error("Error checking if phone exists:", error);
		throw error;
	}
};

// Create a new user with email, password, and phone number
export const createUser = async (
	email: string,
	password: string,
	displayName: string,
	phoneNumber: string,
	locationData?: {
		address: string;
		coordinates: { lat: string; lon: string };
	}
): Promise<{ success: boolean; user?: User; error?: string }> => {
	try {
		// First check if email exists in Firestore (user DB)
		const usersRef = collection(db, "users");
		const q = query(usersRef, where("email", "==", email));
		const querySnapshot = await getDocs(q);

		let existingUserData: UserData | null = null;
		let existingDocId: string | null = null;

		// If email exists in the user database
		if (!querySnapshot.empty) {
			existingDocId = querySnapshot.docs[0].id;
			existingUserData = querySnapshot.docs[0].data() as UserData;
		} else {
			// Only check for phone number if creating a completely new user
			// If email doesn't exist in Firestore, check if phone is already in use
			const phoneExists = await checkPhoneExists(phoneNumber);
			if (phoneExists) {
				return { success: false, error: "Phone number already in use" };
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

		// Prepare location data if provided
		const geoPoint = locationData?.coordinates
			? new GeoPoint(
					parseFloat(locationData.coordinates.lat),
					parseFloat(locationData.coordinates.lon)
			  )
			: null;

		// Update or create user document in Firestore
		if (existingUserData && existingDocId) {
			// Update existing document with new auth UID and other details
			// but preserve order history and creation date
			await updateDoc(doc(db, "users", existingDocId), {
				uid: user.uid,
				displayName: user.displayName,
				phoneNumber: phoneNumber, // Update to new phone number
				// Preserve order_ids from existing data
				order_ids: existingUserData.order_ids || [],
				// Update location data if provided
				...(locationData
					? {
							location: locationData.address,
							coordinates: geoPoint,
					  }
					: {
							location: existingUserData.location || null,
					  }),
				// Preserve created_at from existing data
				created_at: existingUserData.created_at,
				updated_at: Timestamp.now(),
			});
		} else {
			// Create new user document if no existing document found
			await setDoc(doc(db, "users", user.uid), {
				uid: user.uid,
				email: user.email,
				displayName: user.displayName,
				phoneNumber: phoneNumber,
				order_ids: [],
				location: locationData?.address || null,
				coordinates: geoPoint,
				created_at: Timestamp.now(),
				updated_at: Timestamp.now(),
			});
		}

		return { success: true, user };
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
};

// Sign in with email and password
export const signInWithEmail = async (
	email: string,
	password: string
): Promise<{ success: boolean; user?: User; error?: string }> => {
	try {
		// First check if this email belongs to a user account
		const usersRef = collection(db, "users");
		const q = query(usersRef, where("email", "==", email));
		const querySnapshot = await getDocs(q);

		if (querySnapshot.empty) {
			return {
				success: false,
				error:
					"No customer account found with this email. Please use the correct sign-in page for your account type.",
			};
		}

		const userCredential = await signInWithEmailAndPassword(
			auth,
			email,
			password
		);

		return { success: true, user: userCredential.user };
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
};

// Sign out
export const signOut = async (): Promise<{
	success: boolean;
	error?: string;
}> => {
	try {
		await firebaseSignOut(auth);
		return { success: true };
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
};

// Send password reset email
export const resetPassword = async (
	email: string
): Promise<{ success: boolean; error?: string }> => {
	try {
		await sendPasswordResetEmail(auth, email);
		return { success: true };
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
};

// Send email verification
export const sendVerificationEmail = async (): Promise<{
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

// Get current user data from Firestore
export const getCurrentUserData = async (): Promise<{
	success: boolean;
	data?: UserData;
	error?: string;
}> => {
	try {
		const user = auth.currentUser;
		if (!user) {
			throw new Error("No user is currently signed in");
		}

		// First try to get the document by UID
		const userDocRef = doc(db, "users", user.uid);
		const userDoc = await getDoc(userDocRef);

		if (userDoc.exists()) {
			console.log("Found user document by UID");
			return { success: true, data: userDoc.data() as UserData };
		} else {
			// If not found by UID, try to find by email
			console.log("Document not found by UID, trying email lookup");
			const email = user.email;

			if (!email) {
				throw new Error("User has no email associated");
			}

			// Try to find user document by email
			const usersRef = collection(db, "users");
			const q = query(usersRef, where("email", "==", email));
			const querySnapshot = await getDocs(q);

			if (!querySnapshot.empty) {
				console.log("Found user document by email");
				const userData = querySnapshot.docs[0].data() as UserData;
				const docId = querySnapshot.docs[0].id;

				await updateDoc(doc(db, "users", docId), {
					uid: user.uid,
					updated_at: Timestamp.now(),
				});

				return { success: true, data: userData };
			} else {
				throw new Error("User document not found");
			}
		}
	} catch (error) {
		console.error("Error in getCurrentUserData:", error);
		return { success: false, error: (error as Error).message };
	}
};

// Update user profile
export const updateUserProfile = async (data: {
	displayName?: string;
	phoneNumber?: string;
	location?: string;
	profileImage?: string;
	coordinates?: { lat: string; lon: string };
}): Promise<{ success: boolean; error?: string }> => {
	try {
		const user = auth.currentUser;
		if (!user) {
			throw new Error("No user is currently signed in");
		}

		// Check if the new phone number is already in use by another account
		if (data.phoneNumber) {
			const phoneExists = await checkPhoneExists(data.phoneNumber);
			if (phoneExists) {
				// Get the user data to check if it's the same user
				const userDocRef = doc(db, "users", user.uid);
				const userDoc = await getDoc(userDocRef);

				if (userDoc.exists()) {
					const userData = userDoc.data() as UserData;
					if (userData.phoneNumber !== data.phoneNumber) {
						return { success: false, error: "Phone number already in use" };
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
		const userDocRef = doc(db, "users", user.uid);
		const updateData: Partial<UserData> = {
			updated_at: Timestamp.now(),
		};

		if (data.displayName) updateData.displayName = data.displayName;
		if (data.phoneNumber) updateData.phoneNumber = data.phoneNumber;
		if (data.location) updateData.location = data.location;
		if (data.profileImage !== undefined)
			updateData.profileImage = data.profileImage;
		if (geoPoint) updateData.coordinates = geoPoint;

		await updateDoc(userDocRef, updateData);

		return { success: true };
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
};

// Add order to user
export const addOrderToUser = async (
	orderId: string
): Promise<{ success: boolean; error?: string }> => {
	try {
		const user = auth.currentUser;
		if (!user) {
			throw new Error("No user is currently signed in");
		}

		const userDocRef = doc(db, "users", user.uid);

		// Get current orders to ensure no duplicates
		const userDoc = await getDoc(userDocRef);
		if (userDoc.exists()) {
			const userData = userDoc.data() as UserData;
			const orders = userData.order_ids || [];

			// Only add if not already in the array
			if (!orders.includes(orderId)) {
				await updateDoc(userDocRef, {
					order_ids: [...orders, orderId],
					updated_at: Timestamp.now(),
				});
			}
		}

		return { success: true };
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
};
