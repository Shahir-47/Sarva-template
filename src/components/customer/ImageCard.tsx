import React from "react";
import Image from "next/image";

interface ImageCardProps {
	imgSrc: string;
	imgLink?: string;
	children?: React.ReactNode;
}

export default function ImageCard({
	children,
	imgSrc,
	...props
}: ImageCardProps) {
	return (
		<div
			{...props}
			className="max-w-sm rounded-lg overflow-hidden shadow-2xl group"
		>
			<Image
				src={imgSrc}
				alt="Image description"
				className="transition-transform duration-200 group-hover:scale-110 will-change-transform"
				layout="responsive"
				width={500}
				height={300}
			/>
			<div className="px-6 py-4 bg-sand hover:bg-grey flex flex-col h-full">
				<div>{children}</div>
			</div>
		</div>
	);
}
