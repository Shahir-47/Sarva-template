/* 

Hey Shahir, I imagined that this document pulls the vendor info and products from the database
the infterfaces that I've defined are the ones we agreeded on earlier. 

Note: that these interfeaces are referenced in other pages so, if you change a name be sure to 
change it in all the pages that reference them.

let me know if you have any questions.
*/

// Item information
export interface Item {
	itemID: string;
	name: string;
	description: string;
	price: number;
	units: number;
	vendorID: string;
	image: string;
	tags: string[];
}

// vendor information
export interface Vendor {
	vendorID: string;
	name: string;
	image: string;
	inventory: string[];
}

// TO BE REPLACED
import tempData from "@/firebase/TEMPDATA/Items.json";

export const fetchItems = (): Item[] => {
	return (tempData || []).map((item) => ({
		itemID: item.itemID,
		name: item.name,
		description: item.description,
		price: item.price,
		units: item.units,
		vendorID: item.vendorID,
		image: item.image,
		tags: item.tags,
	})) as Item[];
};
