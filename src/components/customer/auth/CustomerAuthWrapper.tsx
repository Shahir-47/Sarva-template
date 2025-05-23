// src/components/customer/auth/CustomerAuthWrapper.tsx
"use client";

import { useAuth } from "@/hooks/useAuth";
import LoadingScreen from "@/components/shared/LoadingScreen";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useDriverAuth } from "@/hooks/useDriverAuth";
import { useVendorAuth } from "@/hooks/useVendorAuth";

export default function CustomerAuthWrapper({
	children,
}: {
	children: React.ReactNode;
}) {
	const { user, userData, loading, initializing } = useAuth();
	const { user: driver } = useDriverAuth();
	const { user: vendor } = useVendorAuth();

	const pathname = usePathname();
	const [shouldRender, setShouldRender] = useState(false);

	// These paths bypass the auth wrapper checks
	const authPaths = [
		"/customer/auth/signin",
		"/customer/auth/signup",
		"/customer/auth/reset-password",
	];

	const isAuthPath = authPaths.includes(pathname);

	useEffect(() => {
		// Skip all checks for auth paths - they handle their own auth
		if (isAuthPath) {
			setShouldRender(true);
			return;
		}

		// For protected routes
		if (!initializing && !loading) {
			if (!user && !driver && !vendor) {
				// User is not logged in - redirect
				window.location.href = "/";
				return;
			} else if (driver || vendor) {
				// User is logged in as driver or vendor - redirect
				window.location.href = "/unauthorized";
			} else if (user && userData) {
				// User has proper permissions - show content
				setShouldRender(true);
			} else if (user && !userData) {
				// User doesn't have permissions - redirect
				window.location.href = "/unauthorized";
			}
		}
	}, [
		user,
		userData,
		loading,
		initializing,
		isAuthPath,
		pathname,
		driver,
		vendor,
	]);

	// For auth paths, render immediately
	if (isAuthPath) {
		return <>{children}</>;
	}

	// For protected paths, show loading or content
	if (!shouldRender) {
		if (initializing || loading) {
			return <LoadingScreen />;
		}
		return null; // Return nothing while redirecting
	}

	return <>{children}</>;
}
