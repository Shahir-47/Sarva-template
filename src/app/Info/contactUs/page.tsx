// src/app/info/contactUs/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, UserInfo } from "firebase/auth";
import { auth, db } from "@/firebase/config";
import { doc, getDoc } from "firebase/firestore";
import Footer from "@/components/shared/Footer";
import PublicHeader from "@/components/shared/publicPageHeader";
import NavBar from "@/components/customer/navBar";
import VendorNavBar from "@/components/vendor/VendorNavBar";
import DriverNavBar from "@/components/driver/DriverNavBar";
import Image from "next/image";
import Link from "next/link";

export default function ContactUsPage() {
    const [curHeader, setcurHeader] = useState<React.ComponentType | null>(null); // Use a more specific type
    const [curUser, setCurUser] = useState<UserInfo | null>(null);
	const router = useRouter();

	useEffect(() => {
		// Use Firebase's onAuthStateChanged to properly detect auth state
		const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
			if (currentUser) {
                //store user info for support tickets
                setCurUser(currentUser);

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

    const handleContactSupport = () => {
		// Implement support contact functionality
		window.location.href = `mailto:customercontact@sarvabazaar.com?subject=Support Request for User ${curUser?.displayName} &body=Hello, I need assistance with my account (User ID: ${curUser?.uid}) and/or services. Please provide support.`;
	};

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
                    <h1 className="text-4xl font-extrabold text-center text-gray-900 tracking-tight sm:text-5xl lg:text-6xl mb-12">
                    Contact Us
                    </h1>
                    <div className="bg-white rounded-lg shadow-lg p-8 md:p-12">
  <p className="text-lg text-gray-700 mb-8">
    We'd love to hear from you! Please use the contact information below to get
    in touch with us.
  </p>
  <div className="flex justify-center">
    <div className="grid grid-cols-1 gap-8">
      <h2 className="text-2xl font-semibold text-gray-900 mb-4 text-center">
        Customer Support
      </h2>
      <ul className="text-lg text-gray-600 space-y-2">
        <li>
          Email:{" "}
          <a
            href="mailto:support@example.com"
            className="text-blue-600 hover:text-puce transition-colors"
          >
            customercontact@sarvabazaar.com
          </a>
        </li>
      </ul>
    </div>
  </div>
  {curUser != null && (
    <div className="flex justify-center">
      <button
        type="button"
        className="bg-puce cursor-pointer mt-5 hover:bg-rose text-white py-2 px-6 rounded-full flex items-center text-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
        onClick={() => handleContactSupport()}
        aria-label="Contact Support"
      >
        Create Support Ticket
      </button>
    </div>
  )}
</div>
                </div>
            </section>

            {/* Footer section */}
            <Footer />
        </div>
    );
}
