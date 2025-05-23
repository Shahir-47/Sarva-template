// src/app/info/privacy/page.tsx
"use client";

import { useRouter } from "next/navigation";
import Footer from "@/components/shared/Footer";
import Image from "next/image";
import Link from "next/link";

export default function PrivacyPage() {
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
			<section className="py-16 bg-white">
				<div className="max-w-3xl mx-auto px-6 sm:px-8 lg:px-10">
					<h1 className="text-4xl font-extrabold text-center text-gray-900 tracking-tight sm:text-5xl lg:text-6xl mb-10">
						Privacy Policy
					</h1>

					<div className="space-y-8 text-lg text-gray-700">
						<h2>
							<strong>1. Introduction</strong>
						</h2>
						<p>
							This Privacy Policy governs the manner in which The Marketplace
							collects, uses, maintains, and discloses personal information from
							users (&quot;Users,&quot; &quot;you&quot;) of our online platform
							that facilitates transactions between customers, vendors, and
							drivers (the &quot;Services&quot;). This policy applies to the
							Marketplace website, mobile applications, and all other
							interactions Users may have with us.
						</p>

						<h2>
							<strong>2. Information We Collect</strong>
						</h2>
						<p>We may collect the following types of information from Users:</p>
						<ul className="list-disc list-inside space-y-2">
							<li>
								<strong>Personal Identification Information:</strong> This may
								include names, email addresses, postal addresses, phone numbers,
								dates of birth, and other similar information provided by
								Customers, Vendors, and Drivers during registration or in the
								course of using the Services.
							</li>
							<li>
								<strong>Transaction Information:</strong> Details of
								transactions conducted through the Marketplace, including order
								information, payment details (processed by third-party payment
								processors), delivery information, and purchase history.
							</li>
							<li>
								<strong>Technical Information:</strong> Information about
								Users&apos; devices, browsing actions, and patterns, including
								IP addresses, browser type, operating system, referring URLs,
								pages viewed, and access times. This information may be
								collected through cookies, web beacons, and other tracking
								technologies.
							</li>
							<li>
								<strong>Location Information:</strong> With User consent
								(provided on sign up), we may collect precise or approximate
								location data to facilitate delivery services and location-based
								features.
							</li>
							<li>
								<strong>Communications:</strong> Records of communications
								between Users and the Marketplace, as well as between Customers,
								Vendors, and Drivers facilitated through the platform.
							</li>
							<li>
								<strong>Vendor Information:</strong> For Vendors, this may
								include business names, tax identification numbers, bank account
								details (for payouts), product listings, pricing, and inventory
								information.
							</li>
							<li>
								<strong>Driver Information:</strong> For Drivers, this may
								include vehicle information, driving licenses, insurance
								details, and background check information (collected by
								third-party service providers).
							</li>
						</ul>

						<h2>
							<strong>3. How We Use Collected Information</strong>
						</h2>
						<p>
							We may use the collected information for various purposes,
							including:
						</p>
						<ul className="list-disc list-inside space-y-2">
							<li>
								To provide and maintain the Services, including facilitating
								transactions between Customers, Vendors, and Drivers.
							</li>
							<li>To process payments and manage financial transactions.</li>
							<li>
								To communicate with Users, including providing customer support,
								sending service announcements, and responding to inquiries.
							</li>
							<li>
								To personalize User experience and deliver relevant content and
								offers.
							</li>
							<li>
								To monitor and analyze usage trends and improve the
								functionality and performance of the Marketplace.
							</li>
							<li>
								To detect, prevent, and address fraud, security breaches, and
								other illegal activities.
							</li>
							<li>
								To comply with applicable laws, regulations, and legal
								processes.
							</li>
							<li>
								For marketing and promotional purposes, with User consent where
								required by law.
							</li>
							<li>To facilitate delivery services and track order progress.</li>
							<li>
								To verify the identity and eligibility of Vendors and Drivers.
							</li>
						</ul>

						<h2>
							<strong>4. Sharing of Personal Information</strong>
						</h2>
						<p>
							We may share personal information with third parties in the
							following circumstances:
						</p>
						<ul className="list-disc list-inside space-y-2">
							<li>
								<strong>With Vendors:</strong> We share Customer order
								information and relevant details with Vendors to fulfill orders.
							</li>
							<li>
								<strong>With Drivers:</strong> We share Customer delivery
								addresses and contact information with Drivers to facilitate
								deliveries. We may also share Driver information with Customers
								for tracking purposes.
							</li>
							<li>
								<strong>Third-Party Service Providers:</strong> We may engage
								third-party service providers to assist with payment processing,
								data analysis, email delivery, hosting services, and other
								functions necessary to operate the Marketplace. These providers
								are contractually obligated to protect User information.
							</li>
							<li>
								<strong>Legal Compliance:</strong> We may disclose personal
								information if required to do so by law or in response to valid
								legal process, such as a court order or subpoena.
							</li>
							<li>
								<strong>Business Transfers:</strong> In the event of a merger,
								acquisition, or sale of all or a portion of our assets, User
								information may be transferred to the acquiring entity.
							</li>
							<li>
								<strong>With User Consent:</strong> We may share information
								with third parties with your explicit consent.
							</li>
							<li>
								<strong>Aggregated and Anonymized Data:</strong> We may share
								aggregated and anonymized data that does not personally identify
								Users with third parties for various purposes, including
								analytics and marketing.
							</li>
						</ul>

						<h2>
							<strong>5. Data Retention</strong>
						</h2>
						<p>
							We will retain User personal information for as long as necessary
							to fulfill the purposes outlined in this Privacy Policy, unless a
							longer retention period is required or permitted by law.
						</p>

						<h2>
							<strong>6. Security of Your Information</strong>
						</h2>
						<p>
							We implement reasonable security measures designed to protect your
							personal information from unauthorized access, use, disclosure,
							alteration, or destruction. However, no method of transmission
							over the internet or electronic storage is completely secure, and
							we cannot guarantee absolute security.
						</p>

						<h2>
							<strong>7. Your Rights</strong>
						</h2>
						<p>
							Users may have certain rights regarding their personal
							information, depending on their jurisdiction. These rights may
							include the right to access, correct, update, or delete their
							personal information. Users may also have the right to object to
							or restrict certain processing of their personal information, as
							well as the right to data portability. To exercise these rights,
							please contact us using the contact information provided below.
						</p>

						<h2>
							<strong>8. Third-Party Websites and Services</strong>
						</h2>
						<p>
							The Marketplace may contain links to third-party websites or
							services that are not owned or controlled by us. This Privacy
							Policy does not apply to those third-party websites or services.
							We encourage Users to review the privacy policies of those third
							parties before providing any personal information.
						</p>

						<h2>
							<strong>9. Children&apos;s Privacy</strong>
						</h2>
						<p>
							The Marketplace is not intended for children under the age of 16.
							We do not knowingly collect personal information from children. If
							we become aware that we have collected personal information from a
							child without parental consent, we will take steps to delete such
							information.
						</p>

						<h2>
							<strong>10. Changes to This Privacy Policy</strong>
						</h2>
						<p>
							We reserve the right to modify or update this Privacy Policy at
							any time. We will notify Users of any material changes by posting
							the updated policy on the Marketplace or through other appropriate
							communication channels. Your continued use of the Marketplace
							after the effective date of any changes constitutes your
							acceptance of the revised Privacy Policy.
						</p>

						<h2>
							<strong>11. Contact Us</strong>
						</h2>
						<p>
							If you have any questions or concerns about this Privacy Policy or
							our data practices, please contact us at: 
							<a
								href="mailto:support@example.com"
								className="text-blue-600 hover:text-puce transition-colors"
							>
								 customercontact@sarvabazaar.com
							</a>
						</p>

						<div
							id="disclaimer"
							className="mt-12 pt-6 border-t border-gray-200"
						>
							<h3 className="text-xl font-semibold text-gray-800 mb-4">
								Disclaimer Regarding Developer Responsibility
							</h3>
							<p className="text-gray-700">
								The development and provision of the Sarva platform are services
								provided by an independent developer. Sarva, its owners,
								operators, and affiliates are solely responsible for the
								collection, use, maintenance, and disclosure of personal
								information as described in this Privacy Policy. The developer
								shall not be held liable or responsible for any aspect of data
								privacy, security, or compliance related to the operation of the
								Marketplace or the handling of User data. By using the
								Marketplace, Users acknowledge and agree that any concerns or
								issues related to privacy should be directed to Sarva using the
								contact information provided above, and not to the developer.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* Footer section */}
			<Footer />
		</div>
	);
}
