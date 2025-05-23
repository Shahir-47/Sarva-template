// File: scripts/seed-inventory.ts

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const { faker } = require("@faker-js/faker");
const axios = require("axios");
// Define the inventory item interface to match your application
interface InventoryItem {
	itemID?: string;
	name: string;
	description: string;
	price: number;
	cost: number;
	units: number | null;
	vendorID: string;
	image: string;
	tags: string[];
	soldUnits: number;
	barcode: string | null;
	created_at: any; // Firestore Timestamp
	updated_at: any; // Firestore Timestamp
}

// Configuration options
interface SeedOptions {
	count: number;
	vendorID?: string;
	serviceAccountPath: string;
	outputPath?: string; // Path to save generated items as JSON (optional)
	useUnsplash?: boolean; // Whether to use Unsplash images
}

// More realistic product categories with expanded data
const productCategories = [
	{
		type: "Spice",
		tags: ["grocery", "cooking", "premium", "organic", "essential"],
		descriptions: [
			"Aromatic blend of traditional spices, carefully sourced from authentic regions",
			"Hand-selected premium spice, perfect for enhancing the flavor of your favorite dishes",
			"Fragrant whole spice with rich aroma and exceptional quality",
			"Organic ground spice processed using traditional methods for maximum flavor",
			"Essential spice blend for authentic South Asian cuisine, packaged to preserve freshness",
		],
		specifications: {
			Origin: ["India", "Pakistan", "Bangladesh", "Nepal", "Sri Lanka"],
			Form: ["Ground", "Whole", "Blend", "Powder", "Seeds"],
			Packaging: [
				"Airtight Container",
				"Resealable Pouch",
				"Glass Bottle",
				"Premium Tin",
			],
			Weight: ["50g", "100g", "200g", "500g", "1kg"],
			Organic: ["Yes", "No"],
		},
		examples: [
			"Garam Masala",
			"Turmeric Powder",
			"Cumin Seeds",
			"Cardamom Pods",
			"Coriander Powder",
			"Fenugreek Seeds",
			"Mustard Seeds",
			"Red Chili Powder",
			"Cloves",
			"Cinnamon Sticks",
			"Black Pepper",
			"Saffron Threads",
			"Asafoetida",
			"Dried Fenugreek Leaves",
			"Curry Powder",
		],
	},
	{
		type: "Lentil",
		tags: ["grocery", "staple", "vegetarian", "protein", "organic"],
		descriptions: [
			"Premium quality lentils carefully selected for consistent cooking and rich flavor",
			"Organic lentils sourced directly from trusted farms, perfect for hearty meals",
			"Hand-picked lentils with excellent nutritional profile and traditional taste",
			"Versatile lentil variety ideal for curries, soups, and everyday South Asian cooking",
			"High-protein lentils grown using sustainable practices, packed with nutrients",
		],
		specifications: {
			Origin: ["India", "Pakistan", "Nepal", "Bangladesh"],
			Type: ["Split", "Whole", "Skinned", "Unhulled"],
			Processing: [
				"Stone-ground",
				"Machine-processed",
				"Hand-sorted",
				"Organically processed",
			],
			Packaging: [
				"Cloth Bag",
				"Resealable Pack",
				"Bulk Packaging",
				"Vacuum Sealed",
			],
			Weight: ["500g", "1kg", "2kg", "5kg"],
		},
		examples: [
			"Toor Dal",
			"Moong Dal",
			"Masoor Dal",
			"Chana Dal",
			"Urad Dal",
			"Yellow Split Peas",
			"Green Moong Whole",
			"Red Lentils",
			"Black Gram",
			"Split Bengal Gram",
			"Pigeon Peas",
			"Black Lentils",
		],
	},
	{
		type: "Rice",
		tags: ["grocery", "staple", "premium", "basmati", "essential"],
		descriptions: [
			"Aromatic basmati rice with long grains and exquisite fragrance",
			"Premium aged rice sourced from traditional farms, perfect for biryanis and pulaos",
			"Extra-long grain rice with exceptional cooking quality and taste",
			"Traditional variety rice cultivated using time-honored methods for authentic flavor",
			"Organic rice grown without chemicals, offering pure taste and nutrition",
		],
		specifications: {
			Origin: ["India", "Pakistan", "Bangladesh", "Himalayas"],
			"Grain Type": ["Extra Long", "Long", "Medium", "Short"],
			Variety: ["Basmati", "Sona Masoori", "Ponni", "Gobindobhog", "Kolam"],
			Aging: ["1 Year", "2 Years", "3+ Years", "Newly Harvested"],
			Packaging: ["Cloth Bag", "Premium Sack", "Vacuum Sealed", "Jute Bag"],
		},
		examples: [
			"Basmati Rice",
			"Sona Masoori Rice",
			"Ponni Rice",
			"Brown Basmati",
			"Gobindobhog Rice",
			"Kolam Rice",
			"Aged Basmati",
			"Royal Basmati",
			"Himalayan Red Rice",
			"Black Rice",
			"Jeera Samba Rice",
		],
	},
	{
		type: "Flour",
		tags: ["grocery", "baking", "staple", "whole-grain", "traditional"],
		descriptions: [
			"Finely milled flour from premium grains, perfect for traditional flatbreads",
			"Stone-ground whole wheat flour with rich nutty flavor and excellent texture",
			"Multi-purpose flour blend specially formulated for South Asian breads and snacks",
			"Organic flour processed using traditional methods to preserve nutrients",
			"Authentic chakki atta with perfect protein content for soft, flavorful rotis",
		],
		specifications: {
			Grain: ["Wheat", "Chickpea", "Rice", "Millet", "Multi-grain"],
			Milling: [
				"Stone-ground",
				"Roller-milled",
				"Traditional Chakki",
				"Modern Process",
			],
			Type: ["Whole Grain", "Refined", "Self-rising", "Gluten-free"],
			Packaging: [
				"Paper Bag",
				"Cotton Bag",
				"Resealable Pack",
				"Airtight Container",
			],
			Weight: ["1kg", "2kg", "5kg", "10kg"],
		},
		examples: [
			"Whole Wheat Atta",
			"Chakki Atta",
			"Besan (Gram Flour)",
			"Rice Flour",
			"Maida (All-Purpose Flour)",
			"Sooji (Semolina)",
			"Bajra Flour",
			"Jowar Flour",
			"Ragi Flour",
			"Multi-grain Atta",
			"Kuttu (Buckwheat) Flour",
		],
	},
	{
		type: "Pickle",
		tags: [
			"condiment",
			"traditional",
			"spicy",
			"preservative-free",
			"homestyle",
		],
		descriptions: [
			"Traditional handcrafted pickle made using family recipes passed down generations",
			"Authentic mix of spices and oil, carefully aged for deep flavor development",
			"Preservative-free pickle made with seasonal vegetables and premium oils",
			"Spicy and tangy pickle prepared using time-honored methods for authentic taste",
			"Small-batch homestyle pickle with perfect balance of flavors and textures",
		],
		specifications: {
			"Main Ingredient": [
				"Mango",
				"Lime",
				"Mixed Vegetable",
				"Chili",
				"Garlic",
				"Ginger",
			],
			Style: [
				"North Indian",
				"South Indian",
				"Bengali",
				"Gujarati",
				"Punjabi",
				"Hyderabadi",
			],
			"Spice Level": ["Mild", "Medium", "Hot", "Extra Hot"],
			"Oil Base": ["Mustard Oil", "Sesame Oil", "Sunflower Oil", "Mixed Oils"],
			Packaging: [
				"Glass Jar",
				"Ceramic Pot",
				"Plastic Container",
				"Traditional Container",
			],
		},
		examples: [
			"Mango Pickle",
			"Lime Pickle",
			"Mixed Vegetable Pickle",
			"Garlic Pickle",
			"Chili Pickle",
			"Ginger Pickle",
			"Amla Pickle",
			"Carrot Pickle",
			"Tomato Pickle",
			"Brinjal Pickle",
			"Green Chili Pickle",
		],
	},
	{
		type: "Chutney",
		tags: ["condiment", "fresh", "tangy", "homemade", "versatile"],
		descriptions: [
			"Fresh and tangy chutney made from quality ingredients for vibrant flavor",
			"Traditional recipe chutney crafted to enhance meals with authentic taste",
			"Versatile condiment perfect for complementing a wide variety of South Asian dishes",
			"Preservative-free chutney with balanced sweet, spicy, and tangy notes",
			"Homestyle chutney packed with natural ingredients for an explosion of flavor",
		],
		specifications: {
			"Base Ingredient": [
				"Mint",
				"Coriander",
				"Tamarind",
				"Coconut",
				"Tomato",
				"Garlic",
			],
			Consistency: ["Smooth", "Chunky", "Thick", "Thin"],
			"Flavor Profile": ["Spicy", "Sweet", "Tangy", "Savory", "Hot"],
			Preparation: ["Fresh", "Preserved", "Cooked", "Raw", "Fermented"],
			Packaging: ["Glass Jar", "Plastic Container", "Pouch", "Tray"],
		},
		examples: [
			"Mint Chutney",
			"Tamarind Chutney",
			"Coconut Chutney",
			"Coriander Chutney",
			"Garlic Chutney",
			"Tomato Chutney",
			"Pudina Chutney",
			"Imli Chutney",
			"Green Chutney",
			"Red Chutney",
			"Mango Chutney",
		],
	},
	{
		type: "Snack",
		tags: ["ready-to-eat", "traditional", "crunchy", "savory", "spicy"],
		descriptions: [
			"Crispy traditional snack made using authentic recipes and premium ingredients",
			"Flavorful savory treats perfect for tea-time or quick munching",
			"Handcrafted snacks with perfect blend of spices and textures",
			"Crunchy delights prepared using time-tested methods for authentic taste",
			"Premium quality snack with no artificial flavors or preservatives",
		],
		specifications: {
			Category: ["Fried", "Baked", "Roasted", "Mixed", "Extruded"],
			"Spice Level": ["Mild", "Medium", "Hot", "Extra Hot"],
			Texture: ["Crunchy", "Crispy", "Flaky", "Soft", "Mixed"],
			Dietary: ["Vegetarian", "Vegan", "Gluten-free", "No Added MSG"],
			Packaging: [
				"Foil Pack",
				"Plastic Container",
				"Family Pack",
				"Individual Pack",
			],
		},
		examples: [
			"Samosa",
			"Pakora",
			"Bhujia",
			"Mixture",
			"Chakli",
			"Murukku",
			"Mathri",
			"Aloo Bhujia",
			"Chana Dal",
			"Moong Dal",
			"Khakhra",
			"Sev",
			"Ghatiya",
			"Nimki",
			"Bhakarwadi",
		],
	},
	{
		type: "Sweet",
		tags: ["dessert", "traditional", "festive", "homemade", "gift"],
		descriptions: [
			"Authentic traditional sweet made using time-honored recipes and techniques",
			"Rich and indulgent dessert prepared with pure ghee and premium ingredients",
			"Festive delight with perfect texture and authentic flavor profile",
			"Homestyle sweet treat crafted with traditional methods for authentic taste",
			"Premium quality mithai ideal for celebrations and special occasions",
		],
		specifications: {
			Base: ["Milk", "Grain", "Lentil", "Fruit", "Vegetable"],
			Texture: ["Soft", "Hard", "Chewy", "Creamy", "Crumbly"],
			Sweetener: ["Sugar", "Jaggery", "Honey", "Sugar Syrup", "Dates"],
			Style: ["North Indian", "South Indian", "Bengali", "Gujarati", "Punjabi"],
			"Shelf Life": ["1 Week", "2 Weeks", "1 Month", "Long-lasting"],
		},
		examples: [
			"Gulab Jamun",
			"Rasgulla",
			"Jalebi",
			"Barfi",
			"Ladoo",
			"Halwa",
			"Kalakand",
			"Mysore Pak",
			"Peda",
			"Ras Malai",
			"Soan Papdi",
			"Kheer",
			"Sandesh",
			"Kaju Katli",
			"Besan Ladoo",
		],
	},
	{
		type: "Tea",
		tags: ["beverage", "premium", "aromatic", "organic", "daily"],
		descriptions: [
			"Premium tea leaves from renowned estates with exceptional aroma and taste",
			"Traditional blend crafted for authentic chai experience with perfect spice balance",
			"Aromatic tea sourced from high-elevation gardens for rich flavor notes",
			"Organic CTC tea with strong body, perfect for everyday chai preparation",
			"Artisanal leaf tea with delicate flavor profile and soothing qualities",
		],
		specifications: {
			Region: ["Assam", "Darjeeling", "Nilgiris", "Ceylon", "Himalayan"],
			Type: ["CTC", "Orthodox", "Green", "White", "Herbal"],
			Grade: ["Premium", "Finest", "Regular", "Economy"],
			Packaging: [
				"Tea Bags",
				"Loose Leaf",
				"Cardboard Box",
				"Gift Tin",
				"Refill Pack",
			],
			Weight: ["100g", "250g", "500g", "1kg"],
		},
		examples: [
			"Assam Tea",
			"Darjeeling Tea",
			"Masala Chai",
			"Cardamom Tea",
			"Ginger Tea",
			"Nilgiri Tea",
			"CTC Tea",
			"Orange Pekoe",
			"Green Tea",
			"Kashmiri Kahwa",
			"Lemongrass Tea",
		],
	},
	{
		type: "Frozen",
		tags: ["ready-to-cook", "authentic", "convenient", "homestyle", "quick"],
		descriptions: [
			"Authentic ready-to-cook meals prepared using traditional recipes for quick enjoyment",
			"Frozen South Asian delicacies with restaurant-quality taste and texture",
			"Convenient frozen foods made with premium ingredients and no preservatives",
			"Home-style preparations flash-frozen to lock in flavors and freshness",
			"Restaurant-quality frozen items for quick and authentic meal solutions",
		],
		specifications: {
			Category: ["Paratha", "Samosa", "Curry", "Bread", "Dessert"],
			Preparation: [
				"Ready to Cook",
				"Heat and Eat",
				"Partially Prepared",
				"Fully Cooked",
			],
			Storage: ["Keep Frozen", "Refrigerate", "Thaw Before Use"],
			"Serving Size": [
				"Single Serving",
				"Family Pack",
				"Party Pack",
				"Multi-Pack",
			],
			Dietary: ["Vegetarian", "Non-Vegetarian", "Vegan", "Gluten-Free"],
		},
		examples: [
			"Frozen Paratha",
			"Frozen Samosa",
			"Naan",
			"Chapati",
			"Paneer Tikka",
			"Vegetable Pakora",
			"Frozen Curry",
			"Paneer Cubes",
			"Malai Kofta",
			"Palak Paneer",
			"Butter Chicken",
			"Gulab Jamun",
		],
	},
];

// Collection of realistic product images by category
// Collection of realistic product images by category
const productImagesByCategory: Record<string, string[]> = {
	Spice: [
		"https://images.unsplash.com/photo-1596040033229-a9821ebd058d",
		"https://images.unsplash.com/photo-1599045118108-bf9954418b76",
		"https://images.unsplash.com/photo-1615485290382-441e4d049cb5",
	],
	Lentil: [
		"https://images.unsplash.com/photo-1615485290382-441e4d049cb5",
		"https://images.unsplash.com/photo-1550399504-8953e1a6ac87",
	],
	Rice: [
		"https://images.unsplash.com/photo-1586201375761-83865001e31c",
		"https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6",
	],
	Flour: ["https://images.unsplash.com/photo-1509440159596-0249088772ff"],
	Pickle: ["https://images.unsplash.com/photo-1569289522127-c0452f372d46"],
	Chutney: ["https://images.unsplash.com/photo-1599045118108-bf9954418b76"],
	Snack: [
		"https://images.unsplash.com/photo-1569718212165-3a8278d5f624",
		"https://images.unsplash.com/photo-1631452180519-c014fe946bc7",
		"https://images.unsplash.com/photo-1604848698030-c434ba08ece1",
	],
	Sweet: ["https://images.unsplash.com/photo-1631452180519-c014fe946bc7"],
	Tea: [
		"https://images.unsplash.com/photo-1544787219-7f47ccb76574",
		"https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9",
		"https://images.unsplash.com/photo-1571934811356-5cc061b6821f",
	],
	Frozen: ["https://images.unsplash.com/photo-1583422409516-2895a77efded"],
};

function getProductImageUrl(category: string): string {
	// If category exists in our mapping, use those images
	if (category in productImagesByCategory) {
		const images = productImagesByCategory[category];
		const randomImage = faker.helpers.arrayElement(images);
		// Add size parameters to the Unsplash URL
		return `${randomImage}?q=80&w=800&auto=format&fit=crop`;
	}

	// Fallback to general product images
	return faker.helpers.arrayElement([
		"https://images.unsplash.com/photo-1585070324109-404ce0cef7b8?w=800", // Indian grocery store
		"https://images.unsplash.com/photo-1588707508263-f6f9383abc79?w=800", // Spices
		"https://images.unsplash.com/photo-1616541919566-9e8fe4cba186?w=800", // Indian food
		"https://images.unsplash.com/photo-1596097635121-14b38abc089a?w=800", // Spice market
		"https://images.unsplash.com/photo-1505253807988-7b003f1b8dba?w=800", // Food ingredients
	]);
}

function generateProductName(category: any, index: number): string {
	if (category.examples && category.examples.length > 0) {
		// If we have specific examples for this category, use them
		if (index < category.examples.length) {
			return category.examples[index];
		} else {
			// If we've used all examples, combine examples with variations
			const baseExample = category.examples[index % category.examples.length];
			const variations = [
				"Premium",
				"Organic",
				"Traditional",
				"Homestyle",
				"Special",
				"Classic",
				"Family",
				"Royal",
				"Pure",
			];
			return `${variations[index % variations.length]} ${baseExample}`;
		}
	} else {
		// Fallback generic name
		return `${category.type} ${index + 1}`;
	}
}

// Generate price appropriate for product category
function generatePrice(category: string): number {
	switch (category) {
		case "Spice":
			return parseFloat(
				faker.commerce.price({ min: 2, max: 15, precision: 0.01 })
			);
		case "Lentil":
			return parseFloat(
				faker.commerce.price({ min: 3, max: 12, precision: 0.01 })
			);
		case "Rice":
			return parseFloat(
				faker.commerce.price({ min: 5, max: 25, precision: 0.01 })
			);
		case "Flour":
			return parseFloat(
				faker.commerce.price({ min: 3, max: 15, precision: 0.01 })
			);
		case "Pickle":
			return parseFloat(
				faker.commerce.price({ min: 4, max: 12, precision: 0.01 })
			);
		case "Chutney":
			return parseFloat(
				faker.commerce.price({ min: 3, max: 10, precision: 0.01 })
			);
		case "Snack":
			return parseFloat(
				faker.commerce.price({ min: 2, max: 8, precision: 0.01 })
			);
		case "Sweet":
			return parseFloat(
				faker.commerce.price({ min: 5, max: 20, precision: 0.01 })
			);
		case "Tea":
			return parseFloat(
				faker.commerce.price({ min: 4, max: 18, precision: 0.01 })
			);
		case "Frozen":
			return parseFloat(
				faker.commerce.price({ min: 6, max: 15, precision: 0.01 })
			);
		default:
			return parseFloat(
				faker.commerce.price({ min: 2, max: 20, precision: 0.01 })
			);
	}
}

function generateCost(category: string, sellingPrice: number): number {
	// Calculate cost as a percentage of selling price based on category
	// Different margins for different product categories
	let marginPercentage: number;

	switch (category) {
		case "Spice":
			marginPercentage = faker.number.float({ min: 0.35, max: 0.55 }); // 35-55% margin
			break;
		case "Lentil":
			marginPercentage = faker.number.float({ min: 0.2, max: 0.4 }); // 20-40% margin
			break;
		case "Rice":
			marginPercentage = faker.number.float({ min: 0.25, max: 0.45 }); // 25-45% margin
			break;
		case "Flour":
			marginPercentage = faker.number.float({ min: 0.15, max: 0.35 }); // 15-35% margin
			break;
		case "Pickle":
			marginPercentage = faker.number.float({ min: 0.4, max: 0.6 }); // 40-60% margin (higher margin)
			break;
		case "Chutney":
			marginPercentage = faker.number.float({ min: 0.4, max: 0.6 }); // 40-60% margin (higher margin)
			break;
		case "Snack":
			marginPercentage = faker.number.float({ min: 0.45, max: 0.65 }); // 45-65% margin (highest margin)
			break;
		case "Sweet":
			marginPercentage = faker.number.float({ min: 0.4, max: 0.6 }); // 40-60% margin
			break;
		case "Tea":
			marginPercentage = faker.number.float({ min: 0.35, max: 0.55 }); // 35-55% margin
			break;
		case "Frozen":
			marginPercentage = faker.number.float({ min: 0.3, max: 0.5 }); // 30-50% margin
			break;
		default:
			marginPercentage = faker.number.float({ min: 0.3, max: 0.5 }); // 30-50% margin
	}

	// Calculate cost by removing the margin from selling price
	const cost = sellingPrice * (1 - marginPercentage);

	// Round to 2 decimal places
	return parseFloat(cost.toFixed(2));
}

// Helper function to generate a random inventory item with all fields
function generateInventoryItem(vendorID: string, index: number): InventoryItem {
	// Get a random product category
	const category = faker.helpers.arrayElement(productCategories);

	// Create a product name using our examples
	const name = generateProductName(category, index);

	// Get a random description from the category
	const description = faker.helpers.arrayElement(category.descriptions) + `.`;

	// Generate a realistic price based on category
	const price = generatePrice(category.type);

	// Generate a cost based on the price and category
	const cost = generateCost(category.type, price);

	// Generate units in stock (0-100, with occasional null for out-of-stock items)
	const units = faker.number.int({ min: 0, max: 100 });

	// Select a realistic product image
	const image = getProductImageUrl(category.type);

	// Select 1-3 random tags from the category's tags
	const numTags = faker.number.int({ min: 1, max: 3 });
	const tags = faker.helpers.arrayElements(category.tags, numTags);

	// Generate barcode (EAN-13 format) for some items
	const barcode = faker.string.numeric(12) + faker.string.numeric(1);

	// Generate sold units (0-200)
	const soldUnits = faker.number.int({ min: 0, max: 200 });

	// Create timestamps
	const created_at = admin.firestore.Timestamp.fromDate(
		faker.date.past({ years: 1 })
	);
	const updated_at = admin.firestore.Timestamp.fromDate(
		faker.date.recent({ days: 30 })
	);

	return {
		name,
		description,
		price,
		cost,
		units,
		vendorID,
		image,
		tags,
		barcode,
		soldUnits,
		created_at,
		updated_at,
	};
}

// Function to add items to a vendor's inventory in Firestore
async function addItemToVendorInventory(
	db: any,
	vendorID: string,
	itemID: string
): Promise<void> {
	const vendorRef = db.collection("vendors").doc(vendorID);

	// Get the vendor document
	const vendorDoc = await vendorRef.get();

	if (vendorDoc.exists) {
		const vendorData = vendorDoc.data();
		const inventory = vendorData?.inventory || [];

		// Only add if not already in the array
		if (!inventory.includes(itemID)) {
			await vendorRef.update({
				inventory: [...inventory, itemID],
				updated_at: admin.firestore.Timestamp.now(),
			});
			console.log(`Added item ${itemID} to vendor ${vendorID}'s inventory`);
		}
	} else {
		console.warn(
			`Vendor ${vendorID} does not exist. Item ${itemID} not added to vendor inventory.`
		);
	}
}

// Function to update related items
async function updateRelatedItems(db: any, items: string[]): Promise<void> {
	if (items.length <= 1) return;

	// For each item, add 0-3 related items
	for (const itemID of items) {
		// Create a copy of all items except the current one
		const otherItems = items.filter((id) => id !== itemID);

		// Select 0-3 random related items
		const relatedCount = faker.number.int({
			min: 0,
			max: Math.min(3, otherItems.length),
		});
		const relatedItems = faker.helpers.arrayElements(otherItems, relatedCount);

		if (relatedItems.length > 0) {
			try {
				await db.collection("inventory").doc(itemID).update({
					related_items: relatedItems,
				});
				console.log(`Updated related items for ${itemID}`);
			} catch (error) {
				console.error(`Error updating related items for ${itemID}:`, error);
			}
		}
	}
}

// Main function to seed the database
async function seedInventory(options: SeedOptions): Promise<void> {
	const { count, vendorID, serviceAccountPath, outputPath, useUnsplash } =
		options;

	try {
		// Initialize Firebase Admin
		const serviceAccount = JSON.parse(
			fs.readFileSync(path.resolve(serviceAccountPath), "utf8")
		);

		admin.initializeApp({
			credential: admin.credential.cert(serviceAccount),
		});

		const db = admin.firestore();
		console.log("Connected to Firestore");

		// Generate items
		const generatedItems: InventoryItem[] = [];
		const generatedItemIds: string[] = [];
		const targetVendorID =
			vendorID || `vendor${faker.number.int({ min: 1, max: 10 })}`;

		console.log(`Generating ${count} items for vendor: ${targetVendorID}`);

		for (let i = 0; i < count; i++) {
			const item = generateInventoryItem(targetVendorID, i);
			generatedItems.push(item);

			// Add to Firestore
			try {
				const docRef = await db.collection("inventory").add(item);
				const itemID = docRef.id;
				generatedItemIds.push(itemID);

				// Update document with its own ID
				await docRef.update({ itemID });

				// Add item to vendor's inventory
				await addItemToVendorInventory(db, targetVendorID, itemID);

				console.log(`Created item ${i + 1}/${count}: ${item.name} (${itemID})`);
			} catch (error) {
				console.error(`Error adding item ${i + 1}:`, error);
			}
		}

		// Update related items
		console.log("Updating related items...");
		await updateRelatedItems(db, generatedItemIds);

		// Save generated items to file if outputPath is provided
		if (outputPath) {
			// Ensure the directory exists
			const directory = path.dirname(path.resolve(outputPath));
			if (!fs.existsSync(directory)) {
				fs.mkdirSync(directory, { recursive: true });
			}

			fs.writeFileSync(
				path.resolve(outputPath),
				JSON.stringify(generatedItems, null, 2)
			);
			console.log(`Generated items saved to ${outputPath}`);
		}

		console.log("Seeding completed successfully!");
	} catch (error) {
		console.error("Error seeding inventory:", error);
	}
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: SeedOptions = {
	count: 10, // Default to 10 items
	serviceAccountPath: "./serviceAccountKey.json", // Default path
	useUnsplash: true, // Use Unsplash images by default
};

// Parse command-line arguments
for (let i = 0; i < args.length; i++) {
	if (args[i] === "--count" && args[i + 1]) {
		options.count = parseInt(args[i + 1]);
		i++;
	} else if (args[i] === "--vendor" && args[i + 1]) {
		options.vendorID = args[i + 1];
		i++;
	} else if (args[i] === "--key" && args[i + 1]) {
		options.serviceAccountPath = args[i + 1];
		i++;
	} else if (args[i] === "--output" && args[i + 1]) {
		options.outputPath = args[i + 1];
		i++;
	} else if (args[i] === "--no-unsplash") {
		options.useUnsplash = false;
		i++;
	}
}

// Run the seed function
seedInventory(options)
	.then(() => process.exit(0))
	.catch((error) => {
		console.error("Fatal error:", error);
		process.exit(1);
	});
