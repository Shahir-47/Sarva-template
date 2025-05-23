// src/hooks/useVendorAuth.tsx
"use client";

import {
	useState,
	useEffect,
	useContext,
	createContext,
	ReactNode,
	useCallback,
} from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
	doc,
	getDoc,
	query,
	collection,
	where,
	getDocs,
	Timestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase/config";
import { VendorData } from "../firebase/vendorAuth";

// Interface for vendor auth context
interface VendorAuthContextInterface {
	user: User | null;
	vendorData: VendorData | null;
	loading: boolean;
	initializing: boolean;
	error: string | null;
	clearError: () => void;
	refreshVendorData: () => Promise<void>; // New function to refresh vendor data
}

// Default context value
const defaultVendorAuthContext: VendorAuthContextInterface = {
	user: null,
	vendorData: null,
	loading: true,
	initializing: true,
	error: null,
	clearError: () => {},
	refreshVendorData: async () => {}, // Default empty implementation
};

// Create vendor auth context
const VendorAuthContext = createContext<VendorAuthContextInterface>(
	defaultVendorAuthContext
);

// Provider component props
interface VendorAuthProviderProps {
	children: ReactNode;
}

// Provider component that wraps app and makes auth object available to any child component
export function VendorAuthProvider({ children }: VendorAuthProviderProps) {
	const [user, setUser] = useState<User | null>(null);
	const [vendorData, setVendorData] = useState<VendorData | null>(null);
	const [loading, setLoading] = useState(true);
	const [initializing, setInitializing] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Modified function for useVendorAuth.tsx
	const getVendorData = async (authUser: User) => {
		try {
			// First, try to get the document by UID with retries
			const vendorDocRef = doc(db, "vendors", authUser.uid);

			// Try up to 3 times with delays between attempts
			for (let attempt = 0; attempt < 3; attempt++) {
				const vendorDoc = await getDoc(vendorDocRef);

				if (vendorDoc.exists()) {
					console.log(`Found vendor document by UID on attempt ${attempt + 1}`);
					return vendorDoc.data() as VendorData;
				}

				if (attempt < 2) {
					console.log(
						`Vendor document not found, retry attempt ${attempt + 1}/3`
					);
					// Wait before next attempt (exponential backoff)
					await new Promise((resolve) =>
						setTimeout(resolve, 1000 * (attempt + 1))
					);
				}
			}

			// If still not found, try email lookup
			console.log(
				"Document not found by UID after retries, trying email lookup"
			);
			if (authUser.email) {
				const vendorsRef = collection(db, "vendors");
				const q = query(vendorsRef, where("email", "==", authUser.email));
				const querySnapshot = await getDocs(q);

				if (!querySnapshot.empty) {
					console.log("Found vendor document by email");
					return querySnapshot.docs[0].data() as VendorData;
				}
			}

			// Check if this is likely a new account (created in last 2 minutes)
			const creationTime = new Date(authUser.metadata.creationTime || "");
			const now = new Date();
			const minutesSinceCreation =
				(now.getTime() - creationTime.getTime()) / (1000 * 60);

			if (minutesSinceCreation < 2) {
				console.log("Detected newly created account, creating temporary data");
				// Return a minimal temporary profile for new signups
				return {
					uid: authUser.uid,
					email: authUser.email,
					displayName: authUser.displayName,
					phoneNumber: "",
					shopName: authUser.displayName
						? `${authUser.displayName}'s Shop`
						: "New Shop",
					location: "",
					inventory: [],
					created_at: Timestamp.now(),
					updated_at: Timestamp.now(),
				} as VendorData;
			}

			console.log("No vendor document found by UID or email");
			return null;
		} catch (error) {
			console.error("Error getting vendor data:", error);
			setError((error as Error).message);
			return null;
		}
	};

	// Function to refresh vendor data - exposed in context
	const refreshVendorData = useCallback(async () => {
		if (!auth.currentUser) return;

		setLoading(true);
		try {
			const freshData = await getVendorData(auth.currentUser);
			if (freshData) {
				setVendorData(freshData);
			}
		} catch (error) {
			console.error("Error refreshing vendor data:", error);
			setError((error as Error).message);
		} finally {
			setLoading(false);
		}
	}, []);

	// Clear error state
	const clearError = () => setError(null);

	// Subscribe to auth state changes
	useEffect(() => {
		let dataTimeoutId: NodeJS.Timeout;

		const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
			setLoading(true);

			if (authUser) {
				// User is signed in
				console.log("Auth state changed: User signed in", authUser.uid);
				setUser(authUser);

				dataTimeoutId = setTimeout(() => {
					console.log("Data retrieval timeout reached");
					setLoading(false);
					setInitializing(false);
				}, 8000); // 8 second timeout for data retrieval

				try {
					const data = await getVendorData(authUser);
					if (data) {
						setVendorData(data);
					}
				} catch (err) {
					console.error("Error getting vendor data:", err);
					setError((err as Error).message);
				} finally {
					clearTimeout(dataTimeoutId);
				}
			} else {
				// User is signed out
				console.log("Auth state changed: User signed out");
				setUser(null);
				setVendorData(null);
			}

			setInitializing(false);
			setLoading(false);
		});

		return () => {
			unsubscribe();
			if (dataTimeoutId) clearTimeout(dataTimeoutId);
		};
	}, []);

	// Context value
	const value = {
		user,
		vendorData,
		loading,
		initializing,
		error,
		clearError,
		refreshVendorData,
	};

	return (
		<VendorAuthContext.Provider value={value}>
			{children}
		</VendorAuthContext.Provider>
	);
}

// Hook for components to get the auth object and re-render when it changes
export const useVendorAuth = () => {
	return useContext(VendorAuthContext);
};
