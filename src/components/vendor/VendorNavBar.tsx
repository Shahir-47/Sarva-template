// src/components/vendor/VendorNavBar.tsx
import React from "react";
import { signOut } from "@/firebase/vendorAuth";
import { useRouter, usePathname } from "next/navigation";
import { VendorData } from "@/firebase/vendorAuth";
import Link from "next/link";
import Image from "next/image";

// Default links for the vendor navbar
const defaultLinks: Array<{ name: string; href: string }> = [
	{ name: "Dashboard", href: "/vendor/dashboard" },
	{ name: "Inventory", href: "/vendor/inventory" },
	{ name: "Orders", href: "/vendor/orders" },
	{ name: "Profile", href: "/vendor/profile" },
];

interface VendorNavBarProps {
	vendorData?: VendorData | null;
	links?: Array<{ name: string; href: string }>;
}

const VendorNavBar: React.FC<VendorNavBarProps> = ({ vendorData, links }) => {
	const router = useRouter();
	const pathname = usePathname();
	const totalLinks: Array<{ name: string; href: string }> = links
		? defaultLinks.concat(links)
		: defaultLinks;

	const handleSignOut = async () => {
		try {
			// First, clear any local data that might cause issues
			localStorage.removeItem("customerBaskets"); // Clear basket data

			// Perform sign out
			await signOut();

			// Use window.location for a full page reload to the home page
			// This ensures clean unmounting of all components
			window.location.href = "/";
		} catch (error) {
			console.error("Error during sign out:", error);
			// Fallback to router push if there's an error
			router.push("/");
		}
	};

	return (
		<div className="bg-white !shadow-md">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-between items-center">
				<div className="flex items-center">
					<div className="flex items-center mr-3">
						<Link
							href="/vendor/dashboard"
							className="inline-block transform transition duration-200 ease-in-out hover:scale-105 hover:-translate-y-1"
						>
							<Image
								src="/logo-black.png"
								alt="Logo"
								width={200}
								height={100}
							/>
						</Link>
						<h1 className="ml-1 text-2xl font-bold text-puce">Vendor Portal</h1>
					</div>
					<nav className="ml-6">
						<ul className="flex space-x-4">
							{totalLinks?.map((link) => {
								const isActive = pathname?.startsWith(link.href);
								return (
									<li key={link.href}>
										<Link href={link.href}>
											<div
												className={
													`px-3 py-2 font-medium transition-colors duration-150 ` +
													(isActive
														? "text-puce border-b-2 border-puce"
														: "text-gray-600 hover:text-gray-800")
												}
											>
												{link.name}
											</div>
										</Link>
									</li>
								);
							})}
						</ul>
					</nav>
				</div>
				<div className="flex items-center">
					<div className="flex items-center mr-4">
						{vendorData?.profileImage ? (
							<Link href="/vendor/profile" className="mr-3">
								<div className="w-8 h-8 rounded-full overflow-hidden border-2 border-puce">
									<Image
										src={vendorData.profileImage}
										alt="Profile"
										width={32}
										height={32}
										className="w-full h-full object-cover"
									/>
								</div>
							</Link>
						) : (
							<Link href="/vendor/profile" className="mr-3">
								<div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 border-2 border-puce">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										className="h-5 w-5"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
										/>
									</svg>
								</div>
							</Link>
						)}
						<span className="text-gray-600">
							{vendorData?.shopName ||
								vendorData?.displayName ||
								vendorData?.email}
						</span>
					</div>
					<button
						onClick={handleSignOut}
						className="bg-red-500 cursor-pointer hover:bg-red-600 text-white py-2 px-4 rounded-full !shadow"
					>
						Sign Out
					</button>
				</div>
			</div>
		</div>
	);
};

export default VendorNavBar;
