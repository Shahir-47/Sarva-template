// src/app/info/privacy/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/firebase/config";
import { doc, getDoc } from "firebase/firestore";
import LoadingScreen from "@/components/shared/LoadingScreen";
import Footer from "@/components/shared/Footer";
import PublicHeader from "@/components/shared/publicPageHeader";
import NavBar from "@/components/customer/navBar";
import VendorNavBar from "@/components/vendor/VendorNavBar";
import DriverNavBar from "@/components/driver/DriverNavBar";
import Image from "next/image";
import Link from "next/link";

export default function TermsOfServicePage() {
    const [curHeader, setcurHeader] = useState<React.ComponentType | null>(null); // Use a more specific type
	const router = useRouter();

	useEffect(() => {
		// Use Firebase's onAuthStateChanged to properly detect auth state
		const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
			if (currentUser) {
				// User is authenticated, determine user type
				try {
					// First check if user is a customer
					const customerDoc = await getDoc(doc(db, "users", currentUser.uid));
					if (customerDoc.exists()) {
                        setcurHeader(() => NavBar);
						return;
					}

					// Check if user is a vendor
					const vendorDoc = await getDoc(doc(db, "vendors", currentUser.uid));
					if (vendorDoc.exists()) {
						setcurHeader(() => VendorNavBar);
						return;
					}

					// Check if user is a driver
					const driverDoc = await getDoc(doc(db, "drivers", currentUser.uid));
					if (driverDoc.exists()) {
						setcurHeader(() => DriverNavBar);
						return;
					}

                } catch (error) {
                    console.error("Error checking user type:", error);
                    setcurHeader(() => PublicHeader);
                }
            }
        });

        // Set a backup timeout in case auth takes too long
        const timeoutId = setTimeout(() => {
            console.log("Auth check timed out, showing home page anyway");
        }, 3000); // 3 second timeout

        // Clean up the subscription and timeout
        return () => {
            unsubscribe();
            clearTimeout(timeoutId);
        };
    }, [router]);

    // Render the header dynamically
    const HeaderComponent = curHeader || PublicHeader;

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="flex justify-center items-center pt-20"> {/* Added for centering */}
                <Link
                href="/"
                className="inline-block transform transition duration-200 ease-in-out hover:scale-105 hover:-translate-y-1"
                >
                <Image
                    src="/logo-black.png"
                    alt="Logo"
                    width={300}  // Increased size
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
                    Terms of Service
                    </h1>

                    <div className="space-y-8 text-lg text-gray-700">
                        <h2>1. Acceptance of Terms</h2>
                        <p>
                            By accessing and using Sarva ("the Marketplace," "we," "us," or "our")
                            and its services (the "Services"), you ("User," "you") agree to be bound
                            by these Terms of Service ("Terms"). These Terms apply to all Users,
                            including customers, vendors, and drivers. If you do not agree to these
                            Terms, you may not access or use the Services.
                        </p>

                        <h2>2. Description of Services</h2>
                        <p>
                            Sarva is an online platform that facilitates transactions between
                            customers who wish to purchase goods or services, vendors who offer goods
                            or services for sale, and drivers who provide delivery services. We
                            provide a platform for these interactions but are not directly involved
                            in the transactions between customers and vendors or the delivery services
                            provided by drivers.
                        </p>

                        <h2>3. User Accounts</h2>
                        <p>
                            To access certain features of the Services, Users may be required to
                            register for an account. You agree to provide accurate, current, and
                            complete information during the registration process and to update such
                            information to keep it accurate, current, and complete. You are
                            responsible for safeguarding your account credentials and for all
                            activities that occur under your account. You agree to notify us
                            immediately of any unauthorized use of your account.
                        </p>

                        <h2>4. User Conduct</h2>
                        <p>You agree to use the Services in a lawful and respectful manner. You will
                            not:</p>
                        <ul className="list-disc list-inside space-y-2">
                            <li>Violate any applicable laws, regulations, or third-party rights.</li>
                            <li>
                            Post or transmit any content that is unlawful, harmful, threatening,
                            abusive, harassing, defamatory, vulgar, obscene, libelous, invasive of
                            another's privacy, hateful, or racially, ethnically, or otherwise
                            objectionable.
                            </li>
                            <li>
                            Impersonate any person or entity or falsely state or otherwise
                            misrepresent your affiliation with a person or entity.
                            </li>
                            <li>
                            Interfere with or disrupt the integrity or performance of the Services
                            or the servers and networks connected to the Services.
                            </li>
                            <li>
                            Attempt to gain unauthorized access to any portion or feature of the
                            Services, or any other systems or networks connected to the Services.
                            </li>
                            <li>
                            Engage in any fraudulent or deceptive activities.
                            </li>
                            <li>
                            Use any robot, spider, scraper, or other automated means to access the
                            Services for any purpose without our express written permission.
                            </li>
                        </ul>

                        <h2>5. Transactions and Payments</h2>
                        <h3>5.1 Customers</h3>
                        <p>
                            Customers may purchase goods or services offered by Vendors through Sarva.
                            Payment processing is facilitated by third-party payment processors. You
                            agree to abide by the terms and conditions of such payment processors.
                            Sarva is not responsible for any issues arising from payment processing.
                        </p>
                        <h3>5.2 Vendors</h3>
                        <p>
                            Vendors are responsible for accurately listing their goods or services,
                            setting prices, and fulfilling orders. Sarva may charge vendors fees for
                            using the platform, as outlined in a separate agreement. Vendors are
                            responsible for all applicable taxes related to their sales.
                        </p>
                        <h3>5.3 Drivers</h3>
                        <p>
                            Drivers are responsible for providing delivery services in a safe and
                            timely manner. Drivers may be subject to background checks and must comply
                            with all applicable traffic laws and regulations. Sarva's role is limited
                            to connecting drivers with delivery requests.
                        </p>

                        <h2>6. Intellectual Property</h2>
                        <p>
                            Sarva and its original content, features, and functionality (including but
                            not limited to text, graphics, logos, images, and software) are owned by
                            Sarva and are protected by copyright, trademark, and
                            other intellectual property laws. You may not reproduce, modify,
                            distribute, display, or create derivative works of any portion of the
                            Services without our express written permission.
                        </p>

                        <h2>7. Disclaimer of Warranties</h2>
                        <p>
                            THE SERVICES ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT
                            ANY WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
                            TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
                            NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED
                            OR ERROR-FREE, THAT DEFECTS WILL BE CORRECTED, OR THAT THE SERVICES OR THE
                            SERVERS THAT MAKE THEM AVAILABLE ARE FREE OF VIRUSES OR OTHER HARMFUL
                            COMPONENTS. WE DISCLAIM ALL LIABILITY FOR ANY TRANSACTIONS, INTERACTIONS,
                            OR CONDUCT BETWEEN USERS.
                        </p>

                        <h2>8. Limitation of Liability</h2>
                        <p>
                            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL SARVA,
                            ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, SUPPLIERS, OR
                            LICENSORS BE LIABLE FOR ANY INDIRECT, PUNITIVE, INCIDENTAL, SPECIAL,
                            CONSEQUENTIAL, OR EXEMPLARY DAMAGES, INCLUDING WITHOUT LIMITATION DAMAGES
                            FOR LOSS OF PROFITS, GOODWILL, USE, DATA, OR OTHER INTANGIBLE LOSSES,
                            ARISING OUT OF OR RELATING TO THE USE OF, OR INABILITY TO USE, THE
                            SERVICES, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
                            OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATING TO
                            THESE TERMS OR THE SERVICES SHALL NOT EXCEED THE AMOUNT YOU PAID TO US, IF
                            ANY, IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE
                            LIABILITY.
                        </p>

                        <h2>9. Indemnification</h2>
                        <p>
                            You agree to indemnify, defend, and hold harmless Sarva, its affiliates,
                            officers, directors, employees, agents, suppliers, and licensors from and
                            against any and all claims, liabilities, damages, losses, costs,
                            expenses, or fees (including reasonable attorneys' fees) arising out of or
                            relating to your violation of these Terms or your use of the Services,
                            including but not limited to any content you submit, post, transmit, or
                            otherwise make available through the Services.
                        </p>

                        <h2>10. Termination</h2>
                        <p>
                            We may terminate or suspend your access to the Services, without prior
                            notice or liability, for any reason whatsoever, including without
                            limitation if you breach these Terms. Upon termination, your right to use
                            the Services will immediately cease.
                        </p>

                        <h2>11. Governing Law</h2>
                        <p>
                            These Terms shall be governed by and construed in accordance with the laws
                            of Pennsylvania, without regard to its conflict of law provisions.
                        </p>

                        <h2>12. Changes to These Terms</h2>
                        <p>
                            We reserve the right to modify or update these Terms at any time. We will
                            notify Users of any material changes by posting the updated Terms on Sarva
                            or through other appropriate communication channels. Your continued use of
                            Sarva after the effective date of any changes constitutes your acceptance
                            of the revised Terms.
                        </p>

                        <h2>13. Contact Us</h2>
                        <p>
                            If you have any questions about these Terms of Service, please contact us
                            at: <a
								href="mailto:support@example.com"
								className="text-blue-600 hover:text-puce transition-colors"
							>
								    customercontact@sarvabazaar.com
							</a>
                        </p>

                        <div id="disclaimer" className="mt-12 pt-6 border-t border-gray-200">
                            <h3 className="text-xl font-semibold text-gray-800 mb-4">
                            Disclaimer Regarding Developer Responsibility
                            </h3>
                            <p className="text-gray-700">
                            The development and provision of the Sarva platform are services
                            provided by an independent developer. Sarva, its owners, operators, and
                            affiliates are solely responsible for the terms and conditions outlined
                            in this Terms of Service. The developer shall not be held liable or
                            responsible for any aspect of user agreements, service provisions,
                            liabilities, or obligations related to the operation of the Marketplace
                            or the use of the Services. By using Sarva, Users acknowledge and agree
                            that any concerns or issues related to these Terms should be directed to
                            Sarva using the contact information provided above, and not to the
                            developer.
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
