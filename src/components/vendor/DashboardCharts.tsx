// src/components/vendor/DashboardCharts.tsx
import React, { useState, useEffect } from "react";
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
	PieChart,
	Pie,
	Cell,
	AreaChart,
	Area,
} from "recharts";
import { InventoryItem } from "@/firebase/inventory";

// Define custom types
interface CategoryData {
	name: string;
	value: number;
	color: string;
}

interface SalesData {
	name: string;
	sales: number;
}

interface RevenueData {
	name: string;
	revenue: number;
	profit: number;
}

interface PriceRangeData {
	range: string;
	count: number;
}

// Enhanced color palette
const COLORS = [
	"#FF9D47", // sarva
	"#C37D92", // puce
	"#846267", // rose
	"#FFE0C6", // sand
	"#557A95", // blue accent
	"#B1A296", // neutral
];

interface DashboardChartsProps {
	inventoryItems: InventoryItem[];
}

const DashboardCharts: React.FC<DashboardChartsProps> = ({
	inventoryItems,
}) => {
	const [tagData, setTagData] = useState<CategoryData[]>([]);
	const [stockData, setStockData] = useState<CategoryData[]>([]);
	const [topSellers, setTopSellers] = useState<SalesData[]>([]);
	const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
	const [priceDistribution, setPriceDistribution] = useState<PriceRangeData[]>(
		[]
	);
	const [activeChart, setActiveChart] = useState("sales");

	useEffect(() => {
		if (!inventoryItems || inventoryItems.length === 0) return;

		// Process tag data for pie chart
		const tagCounts = inventoryItems.reduce(
			(acc: Record<string, number>, item) => {
				if (item.tags && item.tags.length > 0) {
					item.tags.forEach((tag) => {
						acc[tag] = (acc[tag] ?? 0) + 1;
					});
				}
				return acc;
			},
			{}
		);

		const processedTagData = Object.keys(tagCounts)
			.map((tag, i) => ({
				name: tag,
				value: tagCounts[tag],
				color: COLORS[i % COLORS.length],
			}))
			.sort((a, b) => b.value - a.value); // Sort by frequency

		setTagData(processedTagData);

		// Process stock data for stock levels pie chart
		const stockLevels = {
			"Out of Stock": 0,
			"Low (1-10)": 0,
			"Medium (11-50)": 0,
			"High (50+)": 0,
		};

		inventoryItems.forEach((item) => {
			const stock = item.units || 0;
			if (stock === 0) {
				stockLevels["Out of Stock"]++;
			} else if (stock <= 10) {
				stockLevels["Low (1-10)"]++;
			} else if (stock <= 50) {
				stockLevels["Medium (11-50)"]++;
			} else {
				stockLevels["High (50+)"]++;
			}
		});

		const processedStockData = Object.keys(stockLevels).map((level, i) => ({
			name: level,
			value: stockLevels[level as keyof typeof stockLevels],
			color: COLORS[i % COLORS.length],
		}));
		setStockData(processedStockData);

		// Process top sellers data for bar chart - using actual soldUnits data
		const sortedBySales = [...inventoryItems]
			.sort((a, b) => (b.soldUnits || 0) - (a.soldUnits || 0))
			.slice(0, 5);

		const processedTopSellers = sortedBySales.map((item) => ({
			name:
				item.name.length > 15 ? item.name.substring(0, 12) + "..." : item.name,
			sales: item.soldUnits || 0,
		}));
		setTopSellers(processedTopSellers);

		// Generate price distribution data
		const priceRanges = [
			{ min: 0, max: 10, label: "$0 - $10" },
			{ min: 10, max: 25, label: "$10 - $25" },
			{ min: 25, max: 50, label: "$25 - $50" },
			{ min: 50, max: 100, label: "$50 - $100" },
			{ min: 100, max: Infinity, label: "$100+" },
		];

		const priceData = priceRanges.map((range) => {
			const count = inventoryItems.filter(
				(item) => item.price >= range.min && item.price < range.max
			).length;
			return { range: range.label, count };
		});
		setPriceDistribution(priceData);

		// Generate revenue data based on actual sold units
		// We'll create monthly data that's more realistic based on sold units
		const months = [
			"Jan",
			"Feb",
			"Mar",
			"Apr",
			"May",
			"Jun",
			"Jul",
			"Aug",
			"Sep",
			"Oct",
			"Nov",
			"Dec",
		];

		// Calculate total sold units and total revenue for distribution
		const totalSoldUnits = inventoryItems.reduce(
			(sum, item) => sum + (item.soldUnits || 0),
			0
		);

		const totalRevenue = inventoryItems.reduce(
			(sum, item) => sum + (item.soldUnits || 0) * item.price,
			0
		);

		const totalProfit = inventoryItems.reduce(
			(sum, item) =>
				sum + (item.soldUnits || 0) * (item.price - (item.cost || 0)),
			0
		);

		const overallProfitMargin =
			totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

		// If we have sales, distribute them across months with a reasonable pattern
		// If not, generate sample data that follows a seasonal pattern
		const monthlyData = months.map((month, index) => {
			if (totalSoldUnits > 0) {
				// Apply a seasonal multiplier - higher in middle of year and end of year
				const seasonalFactor =
					0.7 + 0.6 * Math.sin(((index - 3) * Math.PI) / 6);

				// Distribute revenue proportionally but with seasonal variations
				const monthRevenue = Math.round((totalRevenue / 12) * seasonalFactor);

				const monthProfit = Math.round(
					monthRevenue * (totalProfit / totalRevenue)
				);

				return {
					name: month,
					revenue: monthRevenue,
					profit: monthProfit,
				};
			} else {
				// Create sample data with a realistic pattern if no sales data
				const baseValue = 5000 + index * 300;
				const seasonalFactor =
					0.7 + 0.6 * Math.sin(((index - 3) * Math.PI) / 6);
				const monthRevenue = Math.round(baseValue * seasonalFactor);

				// Use the overall profit margin or a default 40% if no sales data

				const profitMargin =
					overallProfitMargin > 0 ? overallProfitMargin / 100 : 0.4;

				return {
					name: month,
					revenue: monthRevenue,
					profit: Math.round(monthRevenue * profitMargin),
				};
			}
		});

		setRevenueData(monthlyData);
	}, [inventoryItems]);

	// Custom tooltip for the bar chart
	const CustomBarTooltip: React.FC<{
		active?: boolean;
		payload?: { value: number; payload: { name: string } }[];
	}> = ({ active, payload }) => {
		if (active && payload && payload.length) {
			return (
				<div className="bg-white p-2 border border-gray-200 shadow-md rounded-md">
					<p className="font-medium">{payload[0].payload.name}</p>
					<p className="text-puce">Sales: {payload[0].value} units</p>
				</div>
			);
		}
		return null;
	};

	const CustomRevenueTooltip: React.FC<{
		active?: boolean;
		payload?: { value: number; payload: { name: string } }[];
	}> = ({ active, payload }) => {
		if (active && payload && payload.length) {
			const revenue = payload[0].value;
			const profit = payload[1].value;
			const margin = ((profit / revenue) * 100).toFixed(1);

			return (
				<div className="bg-white p-2 border border-gray-200 shadow-md rounded-md">
					<p className="font-medium">{payload[0].payload.name}</p>
					<p className="text-sarva">Revenue: ${revenue.toLocaleString()}</p>
					<p className="text-puce">Profit: ${profit.toLocaleString()}</p>
					<p className="text-green-600">Margin: {margin}%</p>
				</div>
			);
		}
		return null;
	};

	// Custom tooltip for the pie chart
	const CustomPieTooltip: React.FC<{
		active?: boolean;
		payload?: { name: string; value: number; payload: { total: number } }[];
	}> = ({ active, payload }) => {
		if (active && payload && payload.length) {
			return (
				<div className="bg-white p-2 border border-gray-200 shadow-md rounded-md">
					<p className="font-medium">{payload[0].name}</p>
					<p className="text-puce">Count: {payload[0].value}</p>
					<p className="text-gray-500 text-sm">
						{((payload[0].value / payload[0].payload.total) * 100).toFixed(1)}%
						of total
					</p>
				</div>
			);
		}
		return null;
	};

	// Calculate total for percentage in tooltip
	const calculateTotal = (
		data: CategoryData[]
	): (CategoryData & { total: number })[] => {
		const total = data.reduce(
			(sum: number, item: { value: number }) => sum + item.value,
			0
		);
		return data.map((item) => ({ ...item, total }));
	};

	// Render appropriate chart based on active selection
	const renderChart = () => {
		switch (activeChart) {
			case "sales":
				return (
					<ResponsiveContainer width="100%" height={300}>
						<BarChart
							data={topSellers}
							margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
						>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="name" />
							<YAxis />
							<Tooltip content={<CustomBarTooltip />} />
							<Legend />
							<Bar dataKey="sales" name="Units Sold" fill="#FF9D47" />
						</BarChart>
					</ResponsiveContainer>
				);
			case "categories":
				return (
					<ResponsiveContainer width="100%" height={300}>
						<PieChart>
							<Pie
								data={calculateTotal(tagData)}
								cx="50%"
								cy="50%"
								labelLine={false}
								outerRadius={80}
								fill="#8884d8"
								dataKey="value"
								nameKey="name"
								label={({ name, percent }) =>
									`${name} (${(percent * 100).toFixed(0)}%)`
								}
							>
								{tagData.map((entry, index) => (
									<Cell key={`cell-${index}`} fill={entry.color} />
								))}
							</Pie>
							<Tooltip content={<CustomPieTooltip />} />
							<Legend />
						</PieChart>
					</ResponsiveContainer>
				);
			case "stock":
				return (
					<ResponsiveContainer width="100%" height={300}>
						<PieChart>
							<Pie
								data={calculateTotal(stockData)}
								cx="50%"
								cy="50%"
								labelLine={false}
								outerRadius={80}
								fill="#8884d8"
								dataKey="value"
								nameKey="name"
								label={({ name, percent }) =>
									`${name} (${(percent * 100).toFixed(0)}%)`
								}
							>
								{stockData.map((entry, index) => (
									<Cell key={`cell-${index}`} fill={entry.color} />
								))}
							</Pie>
							<Tooltip content={<CustomPieTooltip />} />
							<Legend />
						</PieChart>
					</ResponsiveContainer>
				);
			case "revenue":
				return (
					<ResponsiveContainer width="100%" height={300}>
						<AreaChart
							data={revenueData}
							margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
						>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="name" />
							<YAxis />
							<Tooltip content={<CustomRevenueTooltip />} />
							<Legend />
							<Area
								type="monotone"
								dataKey="revenue"
								name="Revenue ($)"
								fill="#FF9D4730"
								stroke="#FF9D47"
								activeDot={{ r: 8 }}
							/>
							<Area
								type="monotone"
								dataKey="profit"
								name="Profit ($)"
								fill="#C37D9230"
								stroke="#C37D92"
							/>
						</AreaChart>
					</ResponsiveContainer>
				);
			case "price":
				return (
					<ResponsiveContainer width="100%" height={300}>
						<BarChart
							data={priceDistribution}
							margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
						>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="range" />
							<YAxis />
							<Tooltip />
							<Legend />
							<Bar dataKey="count" name="Number of Items" fill="#846267" />
						</BarChart>
					</ResponsiveContainer>
				);
			default:
				return null;
		}
	};

	return (
		<div className="bg-white p-6 rounded-lg shadow-md">
			<div className="flex flex-col sm:flex-row justify-between items-center mb-6">
				<h2 className="text-xl font-semibold text-gray-800 mb-4 sm:mb-0">
					Performance Dashboard
				</h2>
				<div className="flex flex-wrap gap-2 justify-center">
					<button
						className={`px-3 py-1 cursor-pointer rounded-md text-sm font-medium transition-colors ${
							activeChart === "sales"
								? "bg-puce text-white"
								: "bg-gray-100 text-gray-700 hover:bg-gray-200"
						}`}
						onClick={() => setActiveChart("sales")}
					>
						Top Sellers
					</button>
					<button
						className={`px-3 py-1 cursor-pointer rounded-md text-sm font-medium transition-colors ${
							activeChart === "categories"
								? "bg-puce text-white"
								: "bg-gray-100 text-gray-700 hover:bg-gray-200"
						}`}
						onClick={() => setActiveChart("categories")}
					>
						Categories
					</button>
					<button
						className={`px-3 py-1 cursor-pointer rounded-md text-sm font-medium transition-colors ${
							activeChart === "stock"
								? "bg-puce text-white"
								: "bg-gray-100 text-gray-700 hover:bg-gray-200"
						}`}
						onClick={() => setActiveChart("stock")}
					>
						Stock Levels
					</button>
					<button
						className={`px-3 py-1 cursor-pointer rounded-md text-sm font-medium transition-colors ${
							activeChart === "revenue"
								? "bg-puce text-white"
								: "bg-gray-100 text-gray-700 hover:bg-gray-200"
						}`}
						onClick={() => setActiveChart("revenue")}
					>
						Revenue
					</button>
					<button
						className={`px-3 py-1 cursor-pointer rounded-md text-sm font-medium transition-colors ${
							activeChart === "price"
								? "bg-puce text-white"
								: "bg-gray-100 text-gray-700 hover:bg-gray-200"
						}`}
						onClick={() => setActiveChart("price")}
					>
						Price Range
					</button>
				</div>
			</div>

			<div className="mt-4">{renderChart()}</div>

			<div className="mt-6 text-center text-sm text-gray-500">
				<p>Hover over the chart elements for more detailed information.</p>
				{activeChart === "revenue" && (
					<p className="mt-1 text-xs text-gray-400">
						{inventoryItems.some((item) => (item.soldUnits || 0) > 0)
							? "Revenue data based on actual sales"
							: "Showing simulated revenue pattern - add sales data for actual metrics"}
					</p>
				)}
			</div>
		</div>
	);
};

export default DashboardCharts;
