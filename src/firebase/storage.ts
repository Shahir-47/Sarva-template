// src/firebase/storage.ts
import {
	ref,
	uploadBytes,
	getDownloadURL,
	deleteObject,
} from "firebase/storage";
import { storage } from "./config";

// Upload an image to Firebase Storage
export const uploadImage = async (
	file: File,
	path: string
): Promise<{ success: boolean; url?: string; error?: string }> => {
	try {
		// Create a reference to the file in Firebase Storage
		const storageRef = ref(storage, path);

		// Upload the file
		const snapshot = await uploadBytes(storageRef, file);

		// Get the download URL
		const downloadURL = await getDownloadURL(snapshot.ref);

		return { success: true, url: downloadURL };
	} catch (error) {
		console.error("Error uploading image:", error);
		return { success: false, error: (error as Error).message };
	}
};

// Delete an image from Firebase Storage
export const deleteImage = async (
	url: string
): Promise<{ success: boolean; error?: string }> => {
	try {
		// Extract the path from the URL
		// Firebase Storage URLs have a format like:
		// https://firebasestorage.googleapis.com/v0/b/[bucket]/o/[path]?token=...
		const path = decodeURIComponent(url.split("/o/")[1].split("?")[0]);

		// Create a reference to the file
		const storageRef = ref(storage, path);

		// Delete the file
		await deleteObject(storageRef);

		return { success: true };
	} catch (error) {
		console.error("Error deleting image:", error);
		return { success: false, error: (error as Error).message };
	}
};
