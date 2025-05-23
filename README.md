# Sarva Delivery App – Public Template

Welcome to the open template of the Sarva Bazaar delivery app!  
This repo showcases the architecture, features, and sample code for Sarva, a real-world, full-stack grocery delivery platform for South Asian markets.

**Note:**  
This is a public template repo provided for demonstration, review, and learning. The live production app at [https://www.sarvabazaar.com](https://www.sarvabazaar.com) runs on a private codebase to ensure operational security.  
You are free to explore, clone, and adapt this template. The source code for the actual deployed platform is not public.

---

## 🚀 Live Deployment

Try the production version here: [https://www.sarvabazaar.com](https://www.sarvabazaar.com)  
_Source code for the deployed app is private_

---

## 🛠️ Tech Stack

- **Frontend:** Next.js 13+ (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Firebase (Authentication, Firestore, Storage)
- **Payments:** Stripe
- **Mapping/Location:** Google Maps API (address autocomplete, distance calculation, route planning, delivery time estimation)
- **Styling:** TailwindCSS with custom color schemes

---

## 📁 Project Structure

```

src/
├── app/               # Next.js App Router pages
│   ├── customer/      # Customer-facing routes
│   ├── driver/        # Driver-facing routes
│   ├── vendor/        # Vendor-facing routes
│   └── api/           # API routes
├── components/        # Shared React components
│   ├── customer/      # Customer-specific components
│   ├── driver/        # Driver-specific components
│   ├── vendor/        # Vendor-specific components
│   └── shared/        # Shared components used across roles
├── firebase/          # Firebase config and service functions
├── hooks/             # Custom React hooks
├── lib/               # Utility libraries
├── services/          # Service layer for API interactions
├── types/             # TypeScript type definitions
└── utils/             # Utility functions

````

---

## 👤 Role-based Architecture

Sarva supports three distinct user roles:

1. **Customers:** Browse products, place orders, track deliveries
2. **Vendors:** List/manage products, process orders, manage business profile
3. **Drivers:** Accept and deliver orders, manage earnings and profile

---

## 🏁 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Firebase account
- Stripe account
- Google Maps API key

### Environment Setup

Create a `.env.local` file in the root with:

```env
# Firebase 
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000/

# Location Services
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
````

> ⚠️ **Never commit your real API keys to any public repo.**
> Use environment variables for local dev, and configure secrets securely for production.

### Installation

```bash
# Clone the repo
git clone https://github.com/YOUR-USERNAME/sarva-template.git
cd sarva-template

# Install dependencies
npm install
# or
yarn install

# Start the development server
npm run dev
# or
yarn dev
```

Visit `http://localhost:3000` to view the app.

---

## 🔒 Authentication Flow

Sarva uses Firebase Auth with custom React hooks for each user role:

* `useAuth.tsx` – Customers
* `useVendorAuth.tsx` – Vendors
* `useDriverAuth.tsx` – Drivers

Each hook manages:

* Authentication state
* User profile data
* Loading and error states

---

## ✨ Key Features

### Customer Portal

* Browse vendors and products
* Add to cart and place orders (multiple payment options)
* Track order status in real-time
* View order history

### Vendor Portal

* Dashboard with key metrics
* Inventory management (add, edit, delete products)
* Order management (view, prepare, mark as ready)
* Profile/business settings

### Driver Portal

* See available delivery jobs
* Accept and track deliveries
* Earnings dashboard and delivery history
* Manage profile and vehicle info

---

## 🗄️ Database Structure

Sarva uses Firestore with these core collections:

* `users` – Customer accounts and profiles
* `vendors` – Vendor business data
* `drivers` – Driver profiles
* `inventory` – Product listings
* `orders` – Orders and status
* `driverTransactions` – Delivery records and earnings

---

## 🧑‍💻 Common Tasks

### Adding a New Component

1. Create your component under `src/components/`
2. Export it
3. Import and use where needed

### Firebase Data Access Example

```typescript
import { getVendorInventoryItems } from "@/firebase/inventory";

const result = await getVendorInventoryItems(vendorId);
if (result.success) {
  const items = result.data;
  // Use the data
}
```

### Authentication Example

```typescript
import { useAuth } from "@/hooks/useAuth";

function MyComponent() {
  const { user, userData, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <NotAuthenticated />;

  return <YourComponent userData={userData} />;
}

// Similar pattern for useVendorAuth and useDriverAuth
```

---

## 🔄 Order & Payment Flow

1. **Customer** creates an order
2. **Vendor** processes and marks as “ready for pickup”
3. **Driver** accepts, picks up, and marks as delivered
4. **Customer** receives delivery, can leave feedback

Payments use Stripe with a split flow:

* Customer pays
* Payment is held until delivery is confirmed
* Split payout between vendor and driver

---

## 🗺️ Working with Location Services

### Google Maps API

* Address autocomplete and geocoding
* Distance and delivery time calculation
* Route visualization for drivers and customers

Make sure API keys are in your `.env.local`.

---

## ☁️ Deployment

Deploy to Vercel or any Next.js-friendly platform:

```bash
# Build for production
npm run build
# or
yarn build

# Start production server
npm start
# or
yarn start
```

---

## 🛠️ Troubleshooting

### Firebase Issues

* Double-check your `.env.local`
* Ensure Firebase project has Firestore and Auth enabled
* Check Firebase Console for service disruptions

### Map/API Issues

* Check your API keys and quotas
* Ensure Maps API is loaded properly

### Auth Errors

* Clear cookies/localStorage
* Check if user exists in Firebase Auth
* Verify email settings

---

## 🤝 Contributing

1. Fork this repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push to your branch
5. Open a Pull Request

---

## 📄 License

MIT License – see [LICENSE](LICENSE) for details

---

## 📬 Contact

For questions or support, use [Sarva Bazaar website](https://www.sarvabazaar.com)
or open an issue in this repository.

---

*This template is for demo/learning only. The deployed version at [sarvabazaar.com](https://www.sarvabazaar.com) uses a private repository for security.*
