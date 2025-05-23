// src/app/driver/auth/signin/page.tsx
"use client";

import DriverSignIn from "@/components/driver/auth/DriverSignIn";
import Footer from "@/components/shared/Footer";
import Image from "next/image";

export default function DriverSignInPage() {
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
						Driver Sign In
					</h2>
				</div>

				<div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
					<DriverSignIn />
				</div>
			</div>
			<Footer />
		</div>
	);
}
