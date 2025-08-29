# FundVerse Frontend

A modern React + TypeScript frontend for the FundVerse decentralized funding platform, built on the Internet Computer.

## Features

- 🚀 **Modern React + TypeScript** - Built with React 18, TypeScript, and Vite
- 🎨 **Beautiful UI** - Styled with TailwindCSS and ShadCN/UI components
- 📊 **Data Visualization** - Interactive charts with Recharts
- 🔗 **Internet Computer Integration** - Full integration with FundVerse_backend and Fund_Flow canisters
- 💰 **ICP Funding** - Direct ICP coin contributions to campaigns
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile
- 🔐 **Authentication** - Internet Identity integration

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **UI Components**: ShadCN/UI + Radix UI
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod validation
- **IC Integration**: @dfinity/agent, @dfinity/candid
- **Icons**: Lucide React

## Prerequisites

- Node.js 18+ 
- dfx (Internet Computer SDK)
- Internet Identity setup

## Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Generate Candid interfaces**:
   ```bash
   dfx generate
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory:
   ```env
   FUNDVERSE_BACKEND_CANISTER_ID=your_backend_canister_id
   FUND_FLOW_CANISTER_ID=your_fund_flow_canister_id
   INTERNET_IDENTITY_CANISTER_ID=your_ii_canister_id
   DFX_NETWORK=local
   ```

## Development

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Build for production**:
   ```bash
   npm run build
   ```

3. **Preview production build**:
   ```bash
   npm run preview
   ```

## Project Structure

```
src/
├── components/
│   ├── ui/                 # ShadCN/UI components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── progress.tsx
│   │   └── badge.tsx
│   ├── CampaignCard.tsx    # Campaign display component
│   ├── CreateProjectDialog.tsx  # Project creation form
│   ├── ContributionDialog.tsx   # ICP contribution form
│   └── Dashboard.tsx       # Analytics dashboard
├── lib/
│   ├── ic.ts              # Internet Computer integration
│   └── utils.ts           # Utility functions
├── App.tsx                # Main application component
├── main.tsx              # Application entry point
└── index.css             # Global styles
```

## Key Components

### CampaignCard
Displays individual campaign information including:
- Campaign title and category
- Funding progress with visual progress bar
- Current amount raised vs goal
- Days remaining
- Deposit address for ICP contributions
- Contribute button

### CreateProjectDialog
Form for creating new funding projects:
- Project title and description
- Funding goal in ICP
- Category selection
- Legal entity information
- Contact details
- Business registration number

### ContributionDialog
Interface for making ICP contributions:
- Amount input with validation
- Real-time e8s conversion display
- Campaign information
- Payment method details

### Dashboard
Analytics dashboard with:
- Statistics cards (total campaigns, raised amount, etc.)
- Bar chart showing funding by category
- Pie chart showing campaign status distribution
- Recent campaigns list

## Internet Computer Integration

The frontend integrates with two backend canisters:

### FundVerse_backend Canister
- Campaign management
- Project/idea creation
- Campaign metadata
- ICP contribution tracking

### Fund_Flow Canister
- ICP transfer handling
- User registration
- Escrow management
- Payment confirmation

## Authentication

The app uses Internet Identity for authentication:
- Automatic wallet connection
- Secure identity management
- Seamless user experience

## Styling

The application uses a modern design system:
- **TailwindCSS** for utility-first styling
- **ShadCN/UI** for consistent component design
- **CSS Variables** for theming
- **Responsive design** for all screen sizes

## Data Flow

1. **User Authentication**: Connect with Internet Identity
2. **Campaign Loading**: Fetch campaigns from FundVerse_backend
3. **Project Creation**: Create new ideas via backend canister
4. **ICP Contributions**: Make contributions through Fund_Flow canister
5. **Real-time Updates**: Refresh data after successful operations

## Error Handling

The application includes comprehensive error handling:
- Network errors
- Authentication failures
- Invalid form submissions
- Canister call failures
- User-friendly error messages

## Performance

- **Code Splitting**: Automatic chunk splitting with Vite
- **Lazy Loading**: Components loaded on demand
- **Optimized Builds**: Production-ready builds with tree shaking
- **Caching**: Efficient caching strategies

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Check the documentation
- Open an issue on GitHub
- Contact the development team
