"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import BusinessHoursDisplay from "@/components/customer/BusinessHoursDisplay";

export interface BusinessHoursDay {
	isOpen: boolean;
	openTime?: string;
	closeTime?: string;
	closedReason?: string;
	allDay?: boolean;
}

// Interface for the full week of business hours
export interface BusinessHours {
	monday: BusinessHoursDay;
	tuesday: BusinessHoursDay;
	wednesday: BusinessHoursDay;
	thursday: BusinessHoursDay;
	friday: BusinessHoursDay;
	saturday: BusinessHoursDay;
	sunday: BusinessHoursDay;
}

export interface Vendor {
	coordinates: { latitude: number; longitude: number };
	stripeAccountId: string;
	email: string;
	businessHours?: BusinessHours;
	businessDescription: string;
	created_at: string; // Assuming string representation of timestamp
	displayName: string;
	inventory: unknown[]; // Replace 'any[]' with 'unknown[]' until the structure is defined
	location: string;
	phoneNumber: string;
	shopName: string;
	uid: string;
	profileImage: string;
	updated_at: string; // Assuming string representation of timestamp
}

interface VendorListings {
	vendors: Vendor[];
}

export default function VendorGrid({ vendors }: VendorListings) {
	return (
		<div className="w-full max-w-screen mx-auto p-4">
			<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
				{vendors.map((vendor) => (
					<VendorCard key={vendor.uid} vendor={vendor}>
						<div className="max-w-full overflow-hidden">
							<h3 className="text-xl font-bold text-black truncate">
								{vendor.shopName}
							</h3>
						</div>
						<p className="text-sm text-gray-500 italic">
							{vendor.businessDescription}
						</p>
						<p className="text-xs text-gray-400 mt-1">
							Location: {vendor.location}
						</p>
						<p className="text-xs text-gray-400 mt-1">
							Phone: {vendor.phoneNumber}
						</p>
						{vendor.businessHours && (
							<div className="mt-2">
								<BusinessHoursDisplay
									hours={vendor.businessHours}
									compact={true}
									className="text-sm text-gray-600"
								/>
							</div>
						)}
					</VendorCard>
				))}
			</div>
		</div>
	);
}

interface VendorCardProps {
	vendor: Vendor;
	children: React.ReactNode;
}

export function VendorCard({ vendor, children }: VendorCardProps) {
	const router = useRouter();
	const [isClickable, setIsClickable] = useState(false);

	useEffect(() => {
		if (vendor?.uid) {
			setIsClickable(true);
		} else {
			setIsClickable(false);
		}
	}, [vendor?.uid]);

	const handleCardClick = () => {
		if (isClickable && vendor?.uid) {
			router.push(`order/vendor/${vendor.uid}`);
		}
	};

	return (
		<div
			className="rounded-lg overflow-hidden !shadow-md bg-white hover:bg-gray-200 p-4 cursor-pointer hover:shadow-lg transition-shadow duration-200 border-2 border-gray-200"
			onClick={handleCardClick} // Add the onClick handler
		>
			<div className="flex flex-col items-center mb-2">
				{vendor?.profileImage ? (
					<div className="relative w-24 h-24 rounded-full overflow-hidden mb-2">
						<Image
							src={vendor.profileImage}
							alt={`${vendor?.shopName || "Vendor"} logo`}
							layout="fill"
							objectFit="cover"
						/>
					</div>
				) : (
					<div className="w-24 h-24 rounded-full bg-gray-300 flex items-center justify-center mb-2">
						<span className="text-gray-500 text-xl font-semibold">
							{vendor?.shopName?.charAt(0).toUpperCase() || "V"}
						</span>
					</div>
				)}
				{children}
			</div>
		</div>
	);
}
