import React, { useState, useEffect } from "react";
import { BusinessHours, BusinessHoursDay } from "@/firebase/vendorAuth";

interface BusinessHoursFormProps {
	value: BusinessHours | undefined;
	onChange: (hours: BusinessHours) => void;
}

const DEFAULT_HOURS: BusinessHours = {
	monday: {
		isOpen: true,
		openTime: "9:00 AM",
		closeTime: "5:00 PM",
		allDay: false,
	},
	tuesday: {
		isOpen: true,
		openTime: "9:00 AM",
		closeTime: "5:00 PM",
		allDay: false,
	},
	wednesday: {
		isOpen: true,
		openTime: "9:00 AM",
		closeTime: "5:00 PM",
		allDay: false,
	},
	thursday: {
		isOpen: true,
		openTime: "9:00 AM",
		closeTime: "5:00 PM",
		allDay: false,
	},
	friday: {
		isOpen: true,
		openTime: "9:00 AM",
		closeTime: "5:00 PM",
		allDay: false,
	},
	saturday: { isOpen: false, allDay: false },
	sunday: { isOpen: false, allDay: false },
};

const BusinessHoursForm: React.FC<BusinessHoursFormProps> = ({
	value,
	onChange,
}) => {
	// Initialize with default hours if none provided
	const [hours, setHours] = useState<BusinessHours>(value || DEFAULT_HOURS);

	// Update hours if value prop changes
	useEffect(() => {
		if (value) {
			setHours(value);
		}
	}, [value]);

	const updateDay = (
		day: keyof BusinessHours,
		updates: Partial<BusinessHoursDay>
	) => {
		const updatedHours = {
			...hours,
			[day]: {
				...hours[day],
				...updates,
			},
		};
		setHours(updatedHours);
		onChange(updatedHours);
	};

	const renderDayRow = (day: keyof BusinessHours, label: string) => {
		const dayData = hours[day];

		return (
			<div className="grid grid-cols-12 gap-2 mb-3 items-center">
				<div className="col-span-2">
					<label className="text-gray-700 font-medium">{label}</label>
				</div>
				<div className="col-span-2">
					<select
						className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-puce"
						value={dayData.isOpen ? "open" : "closed"}
						onChange={(e) =>
							updateDay(day, { isOpen: e.target.value === "open" })
						}
					>
						<option value="open">Open</option>
						<option value="closed">Closed</option>
					</select>
				</div>

				{dayData.isOpen ? (
					<>
						{dayData.allDay ? (
							<div className="col-span-7 flex items-center">
								<span className="text-gray-700">Open 24 hours</span>
							</div>
						) : (
							<>
								<div className="col-span-3">
									<input
										type="text"
										placeholder="9:00 AM"
										className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-puce"
										value={dayData.openTime || ""}
										onChange={(e) =>
											updateDay(day, { openTime: e.target.value })
										}
									/>
								</div>
								<div className="col-span-1 text-center">to</div>
								<div className="col-span-3">
									<input
										type="text"
										placeholder="5:00 PM"
										className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-puce"
										value={dayData.closeTime || ""}
										onChange={(e) =>
											updateDay(day, { closeTime: e.target.value })
										}
									/>
								</div>
							</>
						)}
						<div className="col-span-1 flex items-center ml-2">
							<input
								type="checkbox"
								id={`allDay-${day}`}
								checked={dayData.allDay || false}
								onChange={(e) => updateDay(day, { allDay: e.target.checked })}
								className="h-4 w-4 text-puce focus:ring-puce border-gray-300 rounded"
							/>
							<label
								htmlFor={`allDay-${day}`}
								className="ml-1 text-xs text-gray-700"
							>
								All day
							</label>
						</div>
					</>
				) : (
					<div className="col-span-7">
						<input
							type="text"
							placeholder="Reason for closure (optional)"
							className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-puce"
							value={dayData.closedReason || ""}
							onChange={(e) => updateDay(day, { closedReason: e.target.value })}
						/>
					</div>
				)}
			</div>
		);
	};

	return (
		<div className="bg-white p-4 rounded-md border border-gray-200">
			<h3 className="text-lg font-medium mb-4">Business Hours</h3>

			<div className="mb-2 text-sm text-gray-500">
				For each day, select if you&apos;re open or closed. If open, specify
				your hours using AM/PM format or check &quot;All day&quot; for 24-hour
				operation.
			</div>

			{renderDayRow("monday", "Monday")}
			{renderDayRow("tuesday", "Tuesday")}
			{renderDayRow("wednesday", "Wednesday")}
			{renderDayRow("thursday", "Thursday")}
			{renderDayRow("friday", "Friday")}
			{renderDayRow("saturday", "Saturday")}
			{renderDayRow("sunday", "Sunday")}
		</div>
	);
};

export default BusinessHoursForm;
