// src/app/vendor/layout.tsx
import { VendorAuthProvider } from "@/hooks/useVendorAuth";
import VendorAuthWrapper from "@/components/vendor/auth/VendorAuthWrapper";

export default function VendorLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<VendorAuthProvider>
			<VendorAuthWrapper>{children}</VendorAuthWrapper>
		</VendorAuthProvider>
	);
}
