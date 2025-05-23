import React from "react";
import { BusinessHours } from "@/firebase/vendorAuth";

interface BusinessHoursDisplayProps {
	hours: BusinessHours;
	className?: string;
	compact?: boolean;
}

const BusinessHoursDisplay: React.FC<BusinessHoursDisplayProps> = ({
	hours,
	className = "",
	compact = false,
}) => {
	const daysOfWeek = [
		{ key: "monday" as keyof BusinessHours, label: "Monday" },
		{ key: "tuesday" as keyof BusinessHours, label: "Tuesday" },
		{ key: "wednesday" as keyof BusinessHours, label: "Wednesday" },
		{ key: "thursday" as keyof BusinessHours, label: "Thursday" },
		{ key: "friday" as keyof BusinessHours, label: "Friday" },
		{ key: "saturday" as keyof BusinessHours, label: "Saturday" },
		{ key: "sunday" as keyof BusinessHours, label: "Sunday" },
	];

	const today = new Date().getDay();
	// Convert from JS day index (0=Sunday) to our day keys (0=Monday)
	const todayIndex = today === 0 ? 6 : today - 1;

	// For compact mode, only show today's hours
	if (compact) {
		const dayInfo = daysOfWeek[todayIndex];
		const dayData = hours[dayInfo.key];

		if (!dayData) return null;

		return (
			<div className={`business-hours-compact ${className}`}>
				<p className="font-medium">{dayInfo.label} (Today):</p>
				{dayData.isOpen ? (
					<p>
						{dayData.allDay
							? "Open 24 hours"
							: `${dayData.openTime || "9:00 AM"} - ${
									dayData.closeTime || "5:00 PM"
							  }`}
					</p>
				) : (
					<p className="text-gray-600">
						Closed {dayData.closedReason ? `(${dayData.closedReason})` : ""}
					</p>
				)}
			</div>
		);
	}

	return (
		<div className={`business-hours ${className}`}>
			<div className="grid gap-1">
				{daysOfWeek.map((day, index) => {
					const dayData = hours[day.key];
					if (!dayData) return null; // Skip if day data is missing

					const isToday = index === todayIndex;

					return (
						<div
							key={day.key}
							className={`text-sm grid grid-cols-12 ${
								isToday ? "font-semibold" : ""
							}`}
						>
							<div className="col-span-3 mr-4">
								{day.label}
								{isToday && " (Today)"}
							</div>
							<div className="col-span-9">
								{dayData.isOpen ? (
									<span>
										{dayData.allDay
											? "Open 24 hours"
											: `${dayData.openTime || "9:00 AM"} - ${
													dayData.closeTime || "5:00 PM"
											  }`}
									</span>
								) : (
									<span className="text-gray-600">
										Closed{" "}
										{dayData.closedReason ? `(${dayData.closedReason})` : ""}
									</span>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
};

export default BusinessHoursDisplay;
