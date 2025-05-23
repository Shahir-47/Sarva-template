// src/components/driver/auth/DriverAuthWrapper.tsx
"use client";

import { useDriverAuth } from "@/hooks/useDriverAuth";
import LoadingScreen from "@/components/shared/LoadingScreen";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useVendorAuth } from "@/hooks/useVendorAuth";

export default function DriverAuthWrapper({
	children,
}: {
	children: React.ReactNode;
}) {
	const { user, driverData, loading, initializing } = useDriverAuth();
	const { user: customer } = useAuth();
	const { user: vendor } = useVendorAuth();
	const pathname = usePathname();
	const [shouldRender, setShouldRender] = useState(false);

	// These paths bypass the auth wrapper checks
	const authPaths = [
		"/driver/auth/signin",
		"/driver/auth/signup",
		"/driver/auth/reset-password",
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
			if (!user && !customer && !vendor) {
				// User is not logged in - redirect
				window.location.href = "/";
			} else if (customer || vendor) {
				// User is logged in as driver or vendor - redirect
				window.location.href = "/unauthorized";
			} else if (user && driverData) {
				// User has proper permissions - show content
				setShouldRender(true);
			} else if (user && !driverData) {
				// User doesn't have permissions - redirect
				window.location.href = "/unauthorized";
			}
		}
	}, [
		user,
		driverData,
		loading,
		initializing,
		isAuthPath,
		pathname,
		customer,
		vendor,
	]);

	// For auth paths, render immediately
	if (isAuthPath) {
		return <>{children}</>;
	}

	// For protected paths, show loading or content
	if (!shouldRender) {
		if (initializing || loading) {
			return <LoadingScreen message="Loading..." />;
		}
		return null; // Return nothing while redirecting
	}

	return <>{children}</>;
}
