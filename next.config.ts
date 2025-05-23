import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	eslint: {
		ignoreDuringBuilds: true,
	},

	images: {
		domains: [
			"firebasestorage.googleapis.com",
			"placehold.co",
			"images.unsplash.com",
		],
	},
};

export default nextConfig;
