import React, { createContext, useContext, useState } from "react";
import { InventoryItem } from "@/firebase/inventory";
import { Vendor } from "../VendorListingSection";

export interface ProductModalProps {
	item: InventoryItem;
	vendor?: Vendor;
	amount: number;
}

interface ModalContextType {
	modalData: ProductModalProps | null;
	openModal: (data: ProductModalProps) => void;
	closeModal: () => void;
}

export const ModalContext = createContext<ModalContextType | undefined>(
	undefined
);

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const [modalData, setModalData] = useState<ProductModalProps | null>(null);

	const openModal = (data: ProductModalProps) => {
		// Set the data first
		setModalData({
			item: data.item,
			vendor: data.vendor,
			amount: data.amount,
		});

		// Use setTimeout instead of requestAnimationFrame for more reliable DOM updates
		setTimeout(() => {
			const modalBG = document.getElementById("modal-bg");
			if (modalBG) {
				modalBG.classList.add("fixed");
			}

			const modal = document.getElementById("modal");
			if (modal) {
				modal.classList.remove("hidden");
			}
		}, 50); // Small delay to ensure React has updated the DOM
	};

	const closeModal = () => {
		// Hide modal first
		const modalBG = document.getElementById("modal-bg");
		if (modalBG) {
			modalBG.classList.remove("fixed");
		}

		const modal = document.getElementById("modal");
		if (modal) {
			modal.classList.add("hidden");
		}

		// Then clear data after a short delay
		setTimeout(() => {
			setModalData(null);
		}, 100);
	};

	return (
		<ModalContext.Provider value={{ modalData, openModal, closeModal }}>
			{children}
		</ModalContext.Provider>
	);
};

export const useModal = (): ModalContextType => {
	const context = useContext(ModalContext);
	if (!context) throw new Error("useModal must be used within a ModalProvider");
	return context;
};
