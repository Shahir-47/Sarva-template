// src/components/shared/Footer.tsx
import Link from "next/link";
import Image from "next/image";

type FooterProps = {
	className?: string;
};

const Footer: React.FC<FooterProps> = ({ className = "" }) => {
	return (
		<footer className={`bg-sand py-10 ${className}`}>
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex flex-col md:flex-row justify-between items-center">
					<div className="mb-6 md:mb-0">
						<Image
							src="/logo-black.png"
							alt="Sarva Logo"
							width={150}
							height={70}
							className="object-contain"
						/>
						<p className="text-gray-600 mt-2">
							Connecting you to local flavors
						</p>
					</div>
					<div className="flex space-x-8">
						<Link
							href="/Info/aboutUs"
							className="text-gray-600 hover:text-puce transition-colors duration-200"
						>
							About Us
						</Link>
						<Link
							href="/Info/contactUs"
							className="text-gray-600 hover:text-puce transition-colors duration-200"
						>
							Contact
						</Link>
						<Link
							href="/Info/privacy"
							className="text-gray-600 hover:text-puce transition-colors duration-200"
						>
							Privacy Policy
						</Link>
						<Link
							href="/Info/termsOfService"
							className="text-gray-600 hover:text-puce transition-colors duration-200"
						>
							Terms of Service
						</Link>	
					</div>
				</div>
				
				<div className="mt-8 pt-8 border-t border-gray-200 text-center text-gray-500">
					<p>© {new Date().getFullYear()} Sarva. All rights reserved.</p>
				</div>
			</div>
		</footer>
	);
};

export default Footer;
