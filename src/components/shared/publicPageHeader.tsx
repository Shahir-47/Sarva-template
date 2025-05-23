// src/components/shared/SignUpHeader.tsx
import Link from "next/link";
import Image from "next/image";

type HeaderProps = {
	className?: string;
};

const PublicHeader: React.FC<HeaderProps> = ({ className = "" }) => {
	return (
        <div className="bg-sand fixed top-0 right-0 left-0 z-50 !shadow-md">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-between items-center">
                <div className="flex items-center">
                    <Link
                        href="/"
                        className="inline-block transform transition duration-300 ease-in-out hover:scale-105 hover:-translate-y-1"
                    >
                        <Image
                            src="/logo-black.png"
                            alt="Logo"
                            width={220}
                            height={110}
                            className="object-contain"
                        />
                    </Link>
                </div>
                <nav className="flex gap-6 items-center">
                    <div className="relative group">
                        <button className="text-puce cursor-pointer hover:text-rose mr-4 flex items-center text-lg font-medium transition-colors duration-200">
                            Sign In
                            <svg
                                className="w-5 h-5 ml-1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 9l-7 7-7-7"
                                />
                            </svg>
                        </button>
                        <div className="absolute left-0 z-10 mt-2 w-52 origin-top-right rounded-lg bg-white py-2 shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                            <Link
                                href="/customer/auth/signin"
                                className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 hover:text-puce transition-colors duration-150 rounded-md mx-1"
                            >
                                Customer Sign In
                            </Link>

                            <Link
                                href="/vendor/auth/signin"
                                className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 hover:text-puce transition-colors duration-150 rounded-md mx-1"
                            >
                                Vendor Sign In
                            </Link>

                            <Link
                                href="/driver/auth/signin"
                                className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 hover:text-puce transition-colors duration-150 rounded-md mx-1"
                            >
                                Driver Sign In
                            </Link>
                        </div>
                    </div>
                    <div className="relative group">
                        <button className="bg-puce cursor-pointer hover:bg-rose text-white py-2 px-6 rounded-full flex items-center text-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
                            Sign Up
                            <svg
                                className="w-5 h-5 ml-1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 9l-7 7-7-7"
                                />
                            </svg>
                        </button>
                        <div className="absolute right-0 z-10 mt-2 w-52 origin-top-right rounded-lg bg-white py-2 shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                            <Link
                                href="/customer/auth/signup"
                                className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 hover:text-puce transition-colors duration-150 rounded-md mx-1"
                            >
                                Customer Sign Up
                            </Link>
                            <Link
                                href="/vendor/auth/signup"
                                className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 hover:text-puce transition-colors duration-150 rounded-md mx-1"
                            >
                                Vendor Sign Up
                            </Link>
                            <Link
                                href="/driver/auth/signup"
                                className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 hover:text-puce transition-colors duration-150 rounded-md mx-1"
                            >
                                Driver Sign Up
                            </Link>
                        </div>
                    </div>
                </nav>
            </div>
        </div>
	);
};

export default PublicHeader;