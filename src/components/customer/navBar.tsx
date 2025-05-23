import React from "react";
import { signOut } from "@/firebase/auth";
import { useRouter, usePathname } from "next/navigation";
import { getCurrentUserData } from "@/firebase/auth";
import type { UserData } from "@/firebase/auth";
import Link from "next/link";
import Image from "next/image";

const defaultLinks = [
	{ name: "Dashboard", href: "/customer/dashboard" },
	{ name: "Order", href: "/customer/order" },
	{ name: "My Orders", href: "/customer/my-orders" },
	{ name: "Profile", href: "/customer/profile" },
];

const NavBar: React.FC = () => {
	const pathname = usePathname();
	const router = useRouter();
	const totalLinks = defaultLinks;
	const [userData, setUserData] = React.useState<UserData | null>(null);

	React.useEffect(() => {
		const fetchUserData = async () => {
			const result = await getCurrentUserData();
			if (result.success && result.data) {
				setUserData(result.data);
			}
		};
		fetchUserData();
	}, []);

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
		<div className="bg-sarva !shadow-md">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-between items-center">
				<div className="flex items-center">
					<Link
						href="/customer/dashboard"
						className="inline-block transform transition duration-200 ease-in-out hover:scale-105 hover:-translate-y-1"
					>
						<Image src="/logo.png" alt="Logo" width={200} height={100} />
					</Link>
					<nav className="ml-8">
						<ul className="flex space-x-4">
							{totalLinks.map(({ name, href }) => {
								const isActive = pathname?.startsWith(href);
								return (
									<li key={href}>
										<Link
											href={href}
											className={
												`px-3 py-2 font-medium transition-colors duration-150 ` +
												(isActive
													? "text-white border-b-2 border-white"
													: "text-gray-900 hover:text-white")
											}
										>
											{name}
										</Link>
									</li>
								);
							})}
						</ul>
					</nav>
				</div>
				<div className="flex items-center">
					<div className="flex items-center mr-4">
						{userData?.profileImage ? (
							<Link href="/customer/profile" className="mr-3">
								<div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white">
									<Image
										src={userData.profileImage}
										alt="Profile"
										width={32}
										height={32}
										className="w-full h-full object-cover"
									/>
								</div>
							</Link>
						) : (
							<Link href="/customer/profile" className="mr-3">
								<div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-gray-500 border-2 border-white">
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
						<span className="text-gray-900">
							{userData?.displayName || userData?.email}
						</span>
					</div>
					<button
						onClick={handleSignOut}
						className="bg-red-500 cursor-pointer hover:bg-red-600 text-white py-2 px-4 rounded-full shadow"
					>
						Sign Out
					</button>
				</div>
			</div>
		</div>
	);
};

export default NavBar;
