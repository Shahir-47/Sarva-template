# Sarva Delivery App - Sarva Bazaar

## Overview

Sarva Delivery is a comprehensive delivery platform connecting customers, vendors, and drivers. The application enables customers to browse products from local vendors, place orders, and have them delivered by independent drivers.

### Live Deployment

The application is live at [https://www.sarvabazaar.com](https://www.sarvabazaar.com)

## Tech Stack

- **Frontend**: Next.js 13+ (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Firebase (Authentication, Firestore, Storage)
- **Payments**: Stripe
- **Mapping/Location**: Google Maps API (address autocomplete, distance calculation, delivery time estimation, route visualization)
- **Styling**: TailwindCSS with custom color schemes

## Project Structure

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
├── firebase/          # Firebase configuration and service functions
├── hooks/             # Custom React hooks
├── lib/               # Utility libraries
├── services/          # Service layer for API interactions
├── types/             # TypeScript type definitions
└── utils/             # Utility functions
```

## Role-based Architecture

The app follows a role-based architecture with three distinct user types:

1. **Customers**: Users who browse products, place orders, and track deliveries
2. **Vendors**: Businesses that list products, manage inventory, and process orders
3. **Drivers**: Independent contractors who deliver orders from vendors to customers

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Firebase account
- Stripe account
- HERE Maps API key

### Live Application

You can explore the live application at [https://www.sarvabazaar.com](https://www.sarvabazaar.com) to understand how the features work in production.

### Environment Setup

Create a `.env.local` file in the root directory with the following variables:

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
```

> ⚠️ **Security Note**: Never commit your actual API keys to the repository. Use environment variables for local development and secure environment configuration for production deployments.

### Installation

```bash
# Clone the repository
git clone https://github.com/your-organization/sarva-delivery.git
cd sarva-delivery

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

## Authentication Flow

Sarva uses Firebase Authentication with custom hooks for each user role:

- `useAuth.tsx` - For customers
- `useVendorAuth.tsx` - For vendors
- `useDriverAuth.tsx` - For drivers

Each hook manages:
- Authentication state
- User profile data
- Loading states
- Error handling

## Key Features

### Customer Portal

- Browse vendors and products
- Add items to cart
- Place orders with multiple payment options
- Track order status in real-time
- View order history

### Vendor Portal

- Dashboard with key business metrics
- Inventory management (add, edit, delete products)
- Order management (view, prepare, mark as ready)
- Business profile settings

### Driver Portal

- View available delivery opportunities
- Accept deliveries
- Track earnings and completed deliveries
- Profile and vehicle information management

## Database Structure

Sarva uses Firestore with the following main collections:

- `users` - Customer accounts and profile data
- `vendors` - Vendor accounts and business data
- `drivers` - Driver accounts and profile data
- `inventory` - Product listings from vendors
- `orders` - Order details and status
- `driverTransactions` - Driver delivery history and earnings

## Common Tasks

### Adding a New Component

1. Create your component in the appropriate directory under `src/components/`
2. Export the component
3. Import and use in your page or other components

### Firebase Data Access

Use the service functions in the `src/firebase/` directory:

```typescript
// Example: Fetching vendor inventory
import { getVendorInventoryItems } from "@/firebase/inventory";

const result = await getVendorInventoryItems(vendorId);
if (result.success) {
  const items = result.data;
  // Use the data
}
```

### Authentication

Use the appropriate hook for the user role:

```typescript
// For customers
import { useAuth } from "@/hooks/useAuth";

function MyComponent() {
  const { user, userData, loading } = useAuth();
  
  if (loading) return <LoadingScreen />;
  if (!user) return <NotAuthenticated />;
  
  return <YourComponent userData={userData} />;
}

// Similar usage for useVendorAuth and useDriverAuth
```

## Order Flow

1. **Customer** creates an order
2. **Vendor** receives the order and marks it as "ready for pickup"
3. **Driver** accepts the delivery and marks when picked up
4. **Driver** completes delivery and marks as "delivered"
5. **Customer** receives delivery and can leave feedback

## Payment Processing

Sarva uses Stripe for payments with a split payment flow:

1. Customer makes payment
2. System holds payment until delivery confirmation
3. Payment is split between vendor and driver based on configured rates

## Working with Location Services

The app uses a combination of mapping services:

### Google Maps API
- Address autocomplete and geocoding
- Distance calculation
- Delivery time estimation

### HERE Maps API
- Route visualization on the driver and customer interfaces

Make sure both API keys are properly configured in your environment variables.

## Deployment

The application can be deployed on Vercel or any platform supporting Next.js:

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

## Troubleshooting

### Firebase Connection Issues

- Check your Firebase credentials in `.env.local`
- Ensure the Firebase project has Firestore and Authentication enabled
- Check Firebase console for any service disruptions

### Map Integration Problems

- Verify your HERE Maps API key is correct
- Check request quotas in the HERE Developer Portal
- Ensure the Maps JavaScript API is loaded properly

### Authentication Errors

- Clear browser cookies and local storage
- Check if the user exists in Firebase Authentication
- Verify email verification settings if applicable

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contact

For questions or support, please contact the team through the [Sarva Bazaar website](https://www.sarvabazaar.com) or open an issue in the GitHub repository.
