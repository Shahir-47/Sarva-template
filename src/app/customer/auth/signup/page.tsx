// src/app/auth/signup/page.tsx
"use client";

import SignUp from "@/components/customer/auth/SignUp";
import Image from "next/image";
import Footer from "@/components/shared/Footer";

export default function SignUpPage() {
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
					<p className="text-center text-2xl font-bold text-gray-800 mt-3">
						Customer Sign Up
					</p>
					<h2 className="mt-2 text-center text-xl text-gray-600">
						Create a new account
					</h2>
				</div>

				<div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
					<SignUp />
				</div>
			</div>
			<Footer />
		</div>
	);
}
