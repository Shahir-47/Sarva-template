// src/app/vendor/auth/signup/page.tsx
"use client";

import VendorSignUp from "@/components/vendor/auth/VendorSignUp";
import Footer from "@/components/shared/Footer";
import Image from "next/image";

export default function VendorSignUpPage() {
	return (
		<div>
			<div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
				<div className="sm:mx-auto sm:w-full sm:max-w-md">
					<Image
						src="/logo-black.png"
						alt="Logo"
						width={200}
						height={100}
						className="mx-auto"
					/>
					<h2 className="mt-2 text-center text-xl text-gray-600">
						Create a Vendor Account
					</h2>
				</div>

				<div className="mt-8 sm:mx-auto sm:w-full sm:max-w-[800px]">
					<VendorSignUp />
				</div>
			</div>
			<Footer />
		</div>
	);
}
