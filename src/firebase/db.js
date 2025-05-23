// src/firebase/db.js
import {
	doc,
	getDoc,
	updateDoc,
	arrayUnion,
	Timestamp,
} from "firebase/firestore";
import { db } from "./config";

// Get user data
export const getUserData = async (userId) => {
	try {
		const userRef = doc(db, "users", userId);
		const userDoc = await getDoc(userRef);

		if (userDoc.exists()) {
			return { success: true, data: userDoc.data() };
		} else {
			return { success: false, error: "User not found" };
		}
	} catch (error) {
		return { success: false, error: error.message };
	}
};

// Update user location
export const updateUserLocation = async (userId, location) => {
	try {
		const userRef = doc(db, "users", userId);
		await updateDoc(userRef, {
			location,
			updated_at: Timestamp.now(),
		});

		return { success: true };
	} catch (error) {
		return { success: false, error: error.message };
	}
};

// Add order to user's order list
export const addOrderToUser = async (userId, orderId) => {
	try {
		const userRef = doc(db, "users", userId);
		await updateDoc(userRef, {
			order_ids: arrayUnion(orderId),
			updated_at: Timestamp.now(),
		});

		return { success: true };
	} catch (error) {
		return { success: false, error: error.message };
	}
};
