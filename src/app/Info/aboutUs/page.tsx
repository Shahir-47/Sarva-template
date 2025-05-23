// src/app/info/aboutUs/page.tsx
"use client";

import { useRouter } from "next/navigation";
import Footer from "@/components/shared/Footer";
import Image from "next/image";
import Link from "next/link";

export default function AboutUsPage() {
	const router = useRouter();

	return (
		<div className="min-h-screen bg-gray-50">
			<div className="flex justify-center items-center pt-20">
				{" "}
				{/* Added for centering */}
				<Link
					href="/"
					className="inline-block transform transition duration-200 ease-in-out hover:scale-105 hover:-translate-y-1"
				>
					<Image
						src="/logo-black.png"
						alt="Logo"
						width={300} // Increased size
						height={150} // Increased size, maintain aspect ratio
					/>
				</Link>
			</div>
			<button
				id="close-modal"
				className="cursor-pointer absolute top-15 left-12 bg-white rounded-full p-2 pr-4 !shadow-md hover:bg-gray-200 hover:cursor-pointer flex items-center  border-2 border-gray-300"
				aria-label="Back to Home"
				onClick={() => router.push("/")}
			>
				<Image
					src={"/arrow_back.svg"}
					className="ml-2"
					alt="Back Arrow"
					width={50}
					height={50}
				/>
				back
			</button>

			{/* Hero section with enhanced design */}
			<section className="bg-white py-16">
				<div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-10">
					<h1 className="text-4xl font-extrabold text-center text-gray-900 tracking-tight sm:text-5xl lg:text-6xl mb-10">
						Our Story
					</h1>
					<div className="space-y-6 text-lg text-gray-700">
						<p>
							It began with a craving, not just for food, but for belonging.
						</p>
						<p>
							During the pandemic, what started as a simple wish to get paan
							delivered unraveled into something bigger. As we spoke to family,
							friends, and local vendors, a deeper pattern emerged: Why, in a
							world of on-demand everything, are our cultural groceries still so
							hard to access, so invisibly served? Why do the vendors who’ve fed
							our families for decades still manage inventory by memory, not
							tech? Why are we, one of the largest immigrant communities in the
							U.S., still navigating aisles of neglect in the digital economy?
						</p>
						<p className="font-semibold">
							These aren’t just logistical gaps. They’re identity gaps. And
							SARVA is our answer.
						</p>
						<p>
							SARVA is a South Asian grocery delivery platform built to bridge
							culture, convenience, and community. We&apos;re not just
							delivering products, we&apos;re preserving home. We’re empowering
							small, often-overlooked South Asian vendors with modern tools to
							thrive. We’re creating a system where heritage and technology
							don’t compete; they collaborate.
						</p>
						<p>
							We’ve spent countless hours, between college classes, jobs, and
							leadership roles, building SARVA from the ground up. And this past
							week, our vision was recognized:
						</p>
						<p className="font-semibold">
							We were named Finalists at the 2025 Starting Dock: Shippensburg’s
							Entrepreneurial Launchpad.
						</p>
						<p>
							From messy sketches to investor pitches, and now to our MVP launch
							just around the corner, this moment is more than a milestone. It’s
							a message.
						</p>
						<h3 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">
							Meet the team behind SARVA:
						</h3>
						<div className="space-y-4">
							<div>
								<h4 className="text-xl font-semibold text-puce">
									Dipseka Timsina — CEO & Co-founder
								</h4>
								<p>
									With a strong foundation in environmental science and
									research, Dipseka leads SARVA with precision and purpose. Her
									experiences across research labs, nonprofit strategy, and
									community engagement help her design solutions that are not
									only functional but rooted in equity. She ensures SARVA’s
									mission always stays grounded in the people it serves.
								</p>
							</div>
							<div>
								<h4 className="text-xl font-semibold text-puce">
									Nishtha Sharma — Chief Data Officer & Co-founder
								</h4>
								<p>
									Smart, precise, and deeply intuitive, Nishtha turns data into
									purpose. From vendor performance analytics to consumer
									behavior insights, her work makes sure every move SARVA makes
									is informed and ethical, ensuring we don’t just grow fast, we
									grow right.
								</p>
							</div>
							<div>
								<h4 className="text-xl font-semibold text-puce">
									Farhan Azim Aurronoy — CFO & Co-founder
								</h4>
								<p>
									Farhan is our architect of stability. With expertise in
									finance, fintech, and smart modeling, he brings critical
									thinking, financial structure, and future-focused logic to the
									team. From pricing frameworks to long-term projections, his
									ability to see through complexity ensures SARVA isn’t just
									built, it’s built to last.
								</p>
							</div>
						</div>
						<p className="font-semibold">
							This is more than a business. It’s a movement, rooted in identity,
							powered by technology, and carried forward by a team that believes
							our communities deserve more.
						</p>
						<p className="font-bold text-xl text-puce">MVP coming soon.</p>
						<p className="italic text-gray-600">The story is just beginning.</p>
					</div>
				</div>
				{/* Website Created By Section */}
				<div className="mt-16 text-center text-lg font-bold text-gray-900">
					<h2 className="inline-block mr-4">Website Created By:</h2>
					<ul className="list-none inline-block">
						<li className="inline-block mr-4">
							<a
								href="https://www.linkedin.com/in/shahir47/"
								className="text-puce underline underline-offset-4 hover:text-sarva transition-all duration-300 text-lg font-semibold cursor-pointer"
								target="_blank"
								rel="noopener noreferrer"
							>
								Shahir Ahmed
							</a>
						</li>
						<li className="inline-block">
							<a
								href="https://www.linkedin.com/in/rolandlocke/"
								className="text-puce underline underline-offset-4 hover:text-sarva transition-all duration-300 text-lg font-semibold cursor-pointer"
								target="_blank"
								rel="noopener noreferrer"
							>
								Roland Locke
							</a>
						</li>
					</ul>
				</div>
			</section>

			{/* Footer section */}
			<Footer />
		</div>
	);
}
