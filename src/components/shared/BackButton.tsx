// src/components/shared/BackButton.tsx
import React from "react";
import Link from "next/link";

interface BackButtonProps {
	href: string;
	label?: string;
	className?: string;
}

const BackButton: React.FC<BackButtonProps> = ({
	href,
	label = "Back",
	className = "",
}) => {
	return (
		<Link
			href={href}
			className={`flex items-center text-gray-600 hover:text-gray-900 transition-colors ${className}`}
		>
			<svg
				className="w-4 h-4 mr-1"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					d="M10 19l-7-7m0 0l7-7m-7 7h18"
				/>
			</svg>
			{label}
		</Link>
	);
};

export default BackButton;
