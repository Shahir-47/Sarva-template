// src/components/vendor/DeleteConfirmationModal.tsx
import React from "react";

interface DeleteConfirmationModalProps {
	isOpen: boolean;
	itemName: string;
	onCancel: () => void;
	onConfirm: () => void;
	isDeleting: boolean;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
	isOpen,
	itemName,
	onCancel,
	onConfirm,
	isDeleting,
}) => {
	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50">
			<div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
				<h2 className="text-xl font-bold text-gray-900 mb-4">
					Confirm Deletion
				</h2>
				<p className="text-gray-700 mb-6">
					Are you sure you want to delete{" "}
					<span className="font-semibold">{itemName}</span>? This action cannot
					be undone.
				</p>
				<div className="flex justify-end space-x-3">
					<button
						type="button"
						onClick={onCancel}
						className="px-4 cursor-pointer py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
						disabled={isDeleting}
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={onConfirm}
						className="px-4 cursor-pointer py-2 bg-red-600 hover:bg-red-700 text-white rounded-md shadow-sm"
						disabled={isDeleting}
					>
						{isDeleting ? "Deleting..." : "Delete"}
					</button>
				</div>
			</div>
		</div>
	);
};

export default DeleteConfirmationModal;
