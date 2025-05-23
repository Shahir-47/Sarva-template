// src/components/shared/LoadingScreen.tsx
import React from "react";

interface LoadingScreenProps {
	message?: string;
	color?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({
	message = "Loading...",
}) => {
	return (
		<div className="min-h-screen bg-white flex justify-center items-center">
			<div className="text-center">
				<div
					className={`animate-spin rounded-full h-12 w-12 border-b-2 border-sarva mx-auto`}
				></div>
				<p className="mt-4 text-2xl text-gray-900">{message}</p>
			</div>
		</div>
	);
};

export default LoadingScreen;
