import React, { useState } from "react";
import emailjs from "@emailjs/browser";

interface FeedbackModalProps {
	isOpen: boolean;
	onClose: () => void;
	orderID: string;
	vendorName: string;
	deliveryDate: string;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({
	isOpen,
	onClose,
	orderID,
	vendorName,
	deliveryDate,
}) => {
	const [rating, setRating] = useState<number>(0);
	const [comment, setComment] = useState<string>("");
	const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
	const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
	const [hoverRating, setHoverRating] = useState<number>(0);
	const [error, setError] = useState<string>("");

	const handleStarClick = (selectedRating: number) => {
		setRating(selectedRating);
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		if (rating === 0) {
			setError("Please select a rating");
			return;
		}

		setIsSubmitting(true);
		setError("");

		// Prepare template parameters for EmailJS
		const templateParams = {
			order_id: orderID,
			vendor_name: vendorName,
			delivery_date: deliveryDate,
			rating: rating,
			comments: comment || "No comments provided",
			recipient_email: "customercontact@sarvabazaar.com",
		};

		// Send the feedback using EmailJS
		emailjs
			.send(
				"service_1s78mke",
				"template_ev2bvrb",
				templateParams,
				"bUvTWoqR4veEvjIYF"
			)
			.then(() => {
				setIsSubmitted(true);
				setIsSubmitting(false);

				// Close the modal after a short delay
				setTimeout(() => {
					onClose();
					// Reset the form after closing
					setRating(0);
					setComment("");
					setIsSubmitted(false);
				}, 2000);
			})
			.catch(() => {
				console.error("Failed to submit feedback:");
				setError("Failed to submit feedback. Please try again.");
				setIsSubmitting(false);
			});
	};

	// If modal is not open, don't render anything
	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 backdrop-blur-xs bg-opacity-50 z-50 flex justify-center items-center p-4">
			<div className="bg-white border border-gray-600 rounded-lg shadow-xl max-w-md w-full overflow-hidden">
				{/* Modal header */}
				<div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
					<h3 className="text-lg font-semibold text-gray-900">
						Share Your Feedback
					</h3>
					<button
						onClick={onClose}
						className="text-gray-400 hover:text-gray-500 focus:outline-none"
					>
						<svg
							className="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>

				{/* Modal body */}
				<div className="px-6 py-4">
					{isSubmitted ? (
						<div className="text-center py-6">
							<div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
								<svg
									className="h-6 w-6 text-green-600"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M5 13l4 4L19 7"
									/>
								</svg>
							</div>
							<h3 className="mt-2 text-sm font-medium text-gray-900">
								Thank you for your feedback!
							</h3>
							<p className="mt-1 text-sm text-gray-500">
								Your feedback helps us improve our service.
							</p>
						</div>
					) : (
						<form onSubmit={handleSubmit}>
							<p className="text-sm text-gray-500 mb-4">
								Your feedback is anonymous and helps us improve our service.
								Order #{orderID} from {vendorName}.
							</p>

							{/* Star rating */}
							<div className="mb-4">
								<label className="block text-sm font-medium text-gray-700 mb-2">
									How would you rate your experience?
								</label>
								<div className="flex space-x-1">
									{[1, 2, 3, 4, 5].map((star) => (
										<button
											key={star}
											type="button"
											className="focus:outline-none transition-transform hover:scale-110"
											onClick={() => handleStarClick(star)}
											onMouseEnter={() => setHoverRating(star)}
											onMouseLeave={() => setHoverRating(0)}
										>
											<svg
												className={`h-8 cursor-pointer w-8 ${
													hoverRating >= star
														? "text-yellow-400"
														: rating >= star
														? "text-yellow-400"
														: "text-gray-300"
												} transition-colors duration-150`}
												fill="currentColor"
												viewBox="0 0 20 20"
												xmlns="http://www.w3.org/2000/svg"
											>
												<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
											</svg>
										</button>
									))}
								</div>
							</div>

							{/* Comment */}
							<div className="mb-4">
								<label
									htmlFor="comment"
									className="block text-sm font-medium text-gray-700 mb-2"
								>
									Additional Comments (Optional)
								</label>
								<textarea
									id="comment"
									rows={3}
									className="shadow-sm focus:ring-blue-500 focus:border-blue-500 mt-1 block w-full sm:text-sm border border-gray-300 rounded-md p-2"
									placeholder="Tell us more about your experience..."
									value={comment}
									onChange={(e) => setComment(e.target.value)}
								></textarea>
							</div>

							{/* Error message */}
							{error && (
								<div className="mb-4 p-2 bg-red-50 text-red-500 text-sm rounded">
									{error}
								</div>
							)}

							{/* Submit button */}
							<div className="mt-5 sm:mt-6">
								<button
									type="submit"
									disabled={isSubmitting}
									className={`inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm ${
										isSubmitting ? "opacity-75 cursor-not-allowed" : ""
									}`}
								>
									{isSubmitting ? (
										<>
											<svg
												className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
												xmlns="http://www.w3.org/2000/svg"
												fill="none"
												viewBox="0 0 24 24"
											>
												<circle
													className="opacity-25"
													cx="12"
													cy="12"
													r="10"
													stroke="currentColor"
													strokeWidth="4"
												></circle>
												<path
													className="opacity-75"
													fill="currentColor"
													d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
												></path>
											</svg>
											Submitting...
										</>
									) : (
										"Submit Feedback"
									)}
								</button>
							</div>
						</form>
					)}
				</div>
			</div>
		</div>
	);
};

export default FeedbackModal;
