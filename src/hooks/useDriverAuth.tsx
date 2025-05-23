// src/hooks/useDriverAuth.tsx with refreshDriverData function added
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
import { DriverData } from "../firebase/driverAuth";

// Interface for driver auth context
interface DriverAuthContextInterface {
	user: User | null;
	driverData: DriverData | null;
	loading: boolean;
	initializing: boolean;
	error: string | null;
	clearError: () => void;
	refreshDriverData: () => Promise<void>;
}

// Default context value
const defaultDriverAuthContext: DriverAuthContextInterface = {
	user: null,
	driverData: null,
	loading: true,
	initializing: true,
	error: null,
	clearError: () => {},
	refreshDriverData: async () => {},
};

// Create driver auth context
const DriverAuthContext = createContext<DriverAuthContextInterface>(
	defaultDriverAuthContext
);

// Provider component props
interface DriverAuthProviderProps {
	children: ReactNode;
}

// Provider component that wraps app and makes auth object available to any child component
export function DriverAuthProvider({ children }: DriverAuthProviderProps) {
	const [user, setUser] = useState<User | null>(null);
	const [driverData, setDriverData] = useState<DriverData | null>(null);
	const [loading, setLoading] = useState(true);
	const [initializing, setInitializing] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Function to get driver data from Firestore
	// Function to get driver data from Firestore with retry logic
	const getDriverData = async (authUser: User) => {
		try {
			// Try multiple times with increasing delays (for newly created accounts)
			for (let attempt = 0; attempt < 3; attempt++) {
				// First, try to get the document by UID
				const driverDocRef = doc(db, "drivers", authUser.uid);
				const driverDoc = await getDoc(driverDocRef);

				if (driverDoc.exists()) {
					console.log(`Found driver document by UID on attempt ${attempt + 1}`);
					return driverDoc.data() as DriverData;
				}

				if (attempt < 2) {
					console.log(`Retry attempt ${attempt + 1}/3 for driver data`);
					// Wait before next attempt (increasing delay)
					await new Promise((resolve) =>
						setTimeout(resolve, 1000 * (attempt + 1))
					);
				}
			}

			// If document still not found after retries, try email lookup
			console.log(
				"Document not found by UID after retries, trying email lookup"
			);
			if (authUser.email) {
				const driversRef = collection(db, "drivers");
				const q = query(driversRef, where("email", "==", authUser.email));
				const querySnapshot = await getDocs(q);

				if (!querySnapshot.empty) {
					console.log("Found driver document by email");
					return querySnapshot.docs[0].data() as DriverData;
				}
			}

			// Check if this is likely a new account (created in last few minutes)
			const creationTime = new Date(authUser.metadata.creationTime || "");
			const now = new Date();
			const minutesSinceCreation =
				(now.getTime() - creationTime.getTime()) / (1000 * 60);

			if (minutesSinceCreation < 2) {
				console.log(
					"Detected newly created driver account, creating temporary data"
				);
				// Return temporary profile for new signups
				return {
					uid: authUser.uid,
					email: authUser.email,
					displayName: authUser.displayName,
					phoneNumber: "",
					location: "",
					address: "",
					profileImage: "",
					deliveryIds: [],
					created_at: Timestamp.now(),
					updated_at: Timestamp.now(),
					stats: {
						totalDeliveries: 0,
						totalEarnings: 0,
						totalMilesDriven: 0,
						averageRating: 0,
						totalDistance: 0,
						totalItems: 0,
					},
				} as DriverData;
			}

			console.log("No driver document found by UID or email");
			return null;
		} catch (error) {
			console.error("Error getting driver data:", error);
			setError((error as Error).message);
			return null;
		}
	};

	// Function to refresh driver data - exposed in context
	const refreshDriverData = useCallback(async () => {
		if (!auth.currentUser) return;

		setLoading(true);
		try {
			const freshData = await getDriverData(auth.currentUser);
			if (freshData) {
				setDriverData(freshData);
			}
		} catch (error) {
			console.error("Error refreshing driver data:", error);
			setError((error as Error).message);
		} finally {
			setLoading(false);
		}
	}, []);

	// Clear error state
	const clearError = () => setError(null);

	// Subscribe to auth state changes
	useEffect(() => {
		let timeoutId: NodeJS.Timeout;
		const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
			setLoading(true);

			if (authUser) {
				setUser(authUser);

				// Set a timeout for data retrieval
				const timeoutPromise = new Promise<null>((_, reject) => {
					timeoutId = setTimeout(() => {
						reject(new Error("Timeout: Failed to retrieve driver data"));
					}, 5000); // 5 second timeout
				});

				try {
					// Race between data retrieval and timeout
					const data = await Promise.race([
						getDriverData(authUser),
						timeoutPromise,
					]);

					if (data) {
						setDriverData(data);
					} else {
						// No driver data found - this user doesn't have driver permission
						setError("You don't have permission to access driver features");
					}
				} catch (error) {
					console.error("Error or timeout:", error);
					setError((error as Error).message);
				} finally {
					clearTimeout(timeoutId);
				}
			} else {
				// User is signed out
				console.log("Auth state changed: User signed out");
				setUser(null);
				setDriverData(null);
			}

			setInitializing(false);
			setLoading(false);
		});

		// Cleanup subscription and timeout on unmount
		return () => {
			unsubscribe();
			if (timeoutId) clearTimeout(timeoutId);
		};
	}, []);

	// Context value
	const value = {
		user,
		driverData,
		loading,
		initializing,
		error,
		clearError,
		refreshDriverData,
	};

	return (
		<DriverAuthContext.Provider value={value}>
			{children}
		</DriverAuthContext.Provider>
	);
}

// Hook for components to get the auth object and re-render when it changes
export const useDriverAuth = () => {
	return useContext(DriverAuthContext);
};
