// src/components/vendor/auth/VendorAuthWrapper.tsx
"use client";

import { useVendorAuth } from "@/hooks/useVendorAuth";
import LoadingScreen from "@/components/shared/LoadingScreen";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useDriverAuth } from "@/hooks/useDriverAuth";

export default function VendorAuthWrapper({
	children,
}: {
	children: React.ReactNode;
}) {
	const { user, vendorData, loading, initializing } = useVendorAuth();
	const { user: driver } = useDriverAuth();
	const { user: customer } = useAuth();
	const pathname = usePathname();
	const [shouldRender, setShouldRender] = useState(false);

	// These paths bypass the auth wrapper checks
	const authPaths = [
		"/vendor/auth/signin",
		"/vendor/auth/signup",
		"/vendor/auth/reset-password",
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
			if (!user && !driver && !customer) {
				// User is not logged in - redirect
				window.location.href = "/";
			} else if (driver || customer) {
				// User is logged in as driver or customer - redirect
				window.location.href = "/unauthorized";
			} else if (user && vendorData) {
				// User has proper permissions - show content
				setShouldRender(true);
			} else if (user && !vendorData) {
				// User doesn't have permissions - redirect
				window.location.href = "/unauthorized";
			}
		}
	}, [
		user,
		vendorData,
		loading,
		initializing,
		isAuthPath,
		pathname,
		driver,
		customer,
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
