// src/app/customer/layout.tsx
import { AuthProvider } from "@/hooks/useAuth";
import CustomerAuthWrapper from "@/components/customer/auth/CustomerAuthWrapper";

export default function CustomerLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<AuthProvider>
			<CustomerAuthWrapper>{children}</CustomerAuthWrapper>
		</AuthProvider>
	);
}
