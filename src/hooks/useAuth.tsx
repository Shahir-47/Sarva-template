"use client";

// src/hooks/useAuth.tsx
import {
	useState,
	useEffect,
	useContext,
	createContext,
	ReactNode,
} from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "../firebase/config";
import { UserData } from "../firebase/auth";

// Interface for auth context
interface AuthContextInterface {
	user: User | null;
	userData: UserData | null;
	loading: boolean;
	initializing: boolean;
	error: string | null;
	clearError: () => void;
}

// Default context value
const defaultAuthContext: AuthContextInterface = {
	user: null,
	userData: null,
	loading: true,
	initializing: true,
	error: null,
	clearError: () => {},
};

// Create auth context
const AuthContext = createContext<AuthContextInterface>(defaultAuthContext);

// Provider component props
interface AuthProviderProps {
	children: ReactNode;
}

// Provider component that wraps your app and makes auth object available to any child component
export function AuthProvider({ children }: AuthProviderProps) {
	const [user, setUser] = useState<User | null>(null);
	const [userData, setUserData] = useState<UserData | null>(null);
	const [loading, setLoading] = useState(true);
	const [initializing, setInitializing] = useState(true); // Add initializing state
	const [error, setError] = useState<string | null>(null);

	// Function to get user data from Firestore
	// Updated getUserData function for useAuth.tsx
	const getUserData = async (uid: string) => {
		try {
			// Try multiple times with increasing delays (for newly created accounts)
			for (let attempt = 0; attempt < 3; attempt++) {
				const userDocRef = doc(db, "users", uid);
				const userDoc = await getDoc(userDocRef);

				if (userDoc.exists()) {
					console.log(`Found user document by UID on attempt ${attempt + 1}`);
					return userDoc.data() as UserData;
				}

				if (attempt < 2) {
					console.log(`Retry attempt ${attempt + 1}/3 for user data`);
					// Wait before next attempt (increasing delay)
					await new Promise((resolve) =>
						setTimeout(resolve, 1000 * (attempt + 1))
					);
				}
			}

			// Check for newly created account
			const authUser = auth.currentUser;
			if (authUser) {
				const creationTime = new Date(authUser.metadata.creationTime || "");
				const now = new Date();
				const minutesSinceCreation =
					(now.getTime() - creationTime.getTime()) / (1000 * 60);

				if (minutesSinceCreation < 2) {
					console.log(
						"Detected newly created customer account, creating temporary data"
					);
					// Return a minimal valid data structure for new customers
					return {
						uid: authUser.uid,
						email: authUser.email,
						displayName: authUser.displayName,
						phoneNumber: "",
						profileImage: "",
						order_ids: [],
						created_at: Timestamp.now(),
						updated_at: Timestamp.now(),
					} as UserData;
				}
			}

			console.log("No user document found by UID after retries");
			return null;
		} catch (error) {
			console.error("Error getting user data:", error);
			setError((error as Error).message);
			return null;
		}
	};

	// Clear error state
	const clearError = () => setError(null);

	// Subscribe to auth state changes
	useEffect(() => {
		let dataTimeoutId: NodeJS.Timeout;

		const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
			setLoading(true);

			if (authUser) {
				// User is signed in
				setUser(authUser);

				dataTimeoutId = setTimeout(() => {
					console.log("Data retrieval timeout reached");
					setLoading(false);
					setInitializing(false);
				}, 8000); // 8 second timeout for data retrieval

				try {
					const data = await getUserData(authUser.uid);
					if (data) {
						setUserData(data);
					}
				} catch (err) {
					console.error("Error getting user data:", err);
					setError((err as Error).message);
				} finally {
					clearTimeout(dataTimeoutId);
				}
			} else {
				// User is signed out
				console.log("Auth state changed: User signed out");
				setUser(null);
				setUserData(null);
			}

			setInitializing(false); // First-time auth check complete
			setLoading(false);
		});

		// Cleanup subscription on unmount
		return () => {
			unsubscribe();
			if (dataTimeoutId) clearTimeout(dataTimeoutId);
		};
	}, []);

	// Context value
	const value = {
		user,
		userData,
		loading,
		initializing,
		error,
		clearError,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook for components to get the auth object and re-render when it changes
export const useAuth = () => {
	return useContext(AuthContext);
};
