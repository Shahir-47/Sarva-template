// src/app/driver/layout.tsx
import { DriverAuthProvider } from "@/hooks/useDriverAuth";
import DriverAuthWrapper from "@/components/driver/auth/DriverAuthWrapper";

export default function DriverLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<DriverAuthProvider>
			<DriverAuthWrapper>{children}</DriverAuthWrapper>
		</DriverAuthProvider>
	);
}
