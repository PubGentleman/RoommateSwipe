# Overview

RoomieMatch is a React Native mobile application built with Expo, designed to connect renters, hosts, and agents/landlords in the roommate-finding marketplace. It aims to be an "Airbnb for roommates," offering features such as role-based navigation, swipe-based roommate matching, property listings, group formation, and messaging capabilities to streamline the housing and roommate search process.

# User Preferences

Preferred communication style: Simple, everyday language.

**Code Organization Standards:**
- Always prefer simple solutions
- Avoid code duplication by checking existing implementations
- Keep files under 200-300 lines of code; refactor when exceeded
- Be careful to only make requested changes or well-understood related changes
- Never add stubbing or fake data patterns for dev/prod environments
- Maintain clean, organized codebase structure
- Avoid writing one-time scripts in persistent files

**Change Management:**
- When fixing bugs, exhaust all options with existing implementation before introducing new patterns
- If introducing new patterns, remove old implementation completely
- Never overwrite .env files without confirmation

# System Architecture

## Frontend Architecture

**Framework & Platform:**
- React Native with Expo
- TypeScript for type safety
- React with experimental React Compiler enabled and New Architecture for improved performance
- Cross-platform support (iOS, Android, Web)

**Navigation Structure:**
- React Navigation with native stack and bottom tabs
- Role-based navigation providing distinct user flows for Renters, Hosts, and Agents/Landlords.
- Nested navigators for specific functionalities like messaging, profile management, and AI Match Assistant (RoommatesStackNavigator).
- Custom header components and transparent headers with blur effects (iOS).

**UI/UX Design Patterns:**
- Theme system supporting light/dark modes with consistent design tokens (colors, spacing, typography) defined in `/constants/theme.ts`.
- Reusable themed components (`ThemedView`, `ThemedText`) and custom wrapper components for safe area and keyboard handling.
- Platform-specific optimizations.

**Core Features by Role:**
- **Renter:** Swipe-based roommate matching with priority placement (boosted → Priority → Plus → Basic), 1-on-1 messaging with limits (Basic: 50 total messages, Plus/Priority: unlimited), comprehensive group management (create, discover, join via request, manage members), property exploration with advanced filters (Plus/Priority only: budget, location, rooms, amenities), saved properties, and AI Match Assistant (Plus/Priority - chat-based personalized roommate recommendations). Group creation/joining limits enforced for basic users. Boost feature available (Plus: 1/week, Priority: unlimited) for 24-hour profile visibility.
- **Host:** Property listing management (CRUD), application review, listing status control, and featured listings (Priority only - properties appear first in renter search).
- **Agent:** Multi-property portfolio management, document verification, legal template library, and professional credential verification.

**Animation & Gestures:**
- React Native Reanimated for high-performance animations.
- React Native Gesture Handler for swipe interactions.
- Spring animations, haptic feedback, and Worklets for UI thread animations.

**State Management:**
- React Context API for authentication.
- Local component state with hooks.
- AsyncStorage for persistent authentication data.

## Authentication & Authorization

- **Authentication Flow:** SSO support (Apple/Google) planned, currently mock authentication. Role selection during login, persistent sessions via AsyncStorage, and loading states.
- **User Model:** Defines `id`, `email`, `name`, `role` ('renter' | 'host' | 'agent'), `profilePicture`, and optional `subscription` and `paymentMethods` details.
- **Authorization:** Role-based navigation rendering and conditional screen access.
- **Subscription & Payments:** Stripe integration configured. Defines three subscription tiers:
  - **Basic Plan:** 50 message limit, can purchase individual boosts for $3 each, no filters, no featured listings, no AI assistant, 1 group max
  - **Plus Plan ($14.99/month):** Unlimited messaging, 1 boost/week (included), advanced filters, AI match assistant, 3 groups max
  - **Priority Plan ($49.99-$99/month role-based):** Unlimited messaging, unlimited boosts (included), advanced filters, AI match assistant, featured listings (hosts only), 5 groups max
- **Functional Differentiation:** All subscription features enforce limits in real-time with upgrade prompts guiding basic users to payment screen.
- **Messaging Limits:** Enforced at send-time with message count tracking in User model. Basic users blocked after 50 messages with upgrade prompt.
- **Boost System:** 24-hour profile visibility boost with visual "BOOSTED" badge. Basic users can purchase individual boosts for $3 each via in-app modal. Plus users get 1 boost every 7 days with cooldown tracking. Priority users have unlimited boosts. Expired boosts automatically removed from priority. All boosts provide the same 24-hour priority placement.
- **Priority Placement:** Swipe deck sorting prioritizes profiles: Active boost (valid expiry) → Priority tier → Plus tier → Basic tier → Compatibility score tiebreaker.
- **Advanced Filters:** Plus/Priority-exclusive property filters (budget range, location, bedrooms, bathrooms, amenities) with gated access and upgrade modal.
- **Featured Listings:** Priority hosts can feature their properties to appear first in renter explore screen. Toggle via "Feature" button with ownership validation and AsyncStorage persistence.
- **Online Status Visibility:** 
  - **Chat (Plus/Priority):** Plus and Priority users can see real-time online/offline status in Messages list (green dot on avatar) and Chat screen header (online/offline text). Basic users see upgrade banner.
  - **Roommate Cards (Priority Only):** Priority users exclusively see online indicator (green light) on roommate profile cards during swiping. This helps Priority members identify and connect with active users immediately.
- **AI Match Assistant (Plus/Priority):** Comprehensive chat-based AI assistant accessible from Roommates screen (CPU icon button). Provides intelligent recommendations across multiple categories:
  - **Roommate Matching:** Personalized recommendations, budget-based matching, compatibility analysis, profile improvement tips
  - **Location & Apartments:** Best neighborhoods by occupation/lifestyle, area comparisons with rent ranges, commute advice
  - **Nightlife & Activities:** Bar and club recommendations, entertainment venues, events and things to do, cultural activities
  - **Restaurants & Food:** Dining recommendations with price ranges, coffee shop suggestions, cuisine variety
  - **Home Decor:** Shared space decoration tips, furniture ideas on budget, storage solutions, styling advice for roommates
  - Interactive chat interface with contextual suggestion chips, real-time typing indicators, and scrollable history
  - Plus/Priority-gated access with cross-platform upgrade modal for basic users

## Data Layer

- **Current Implementation:** Utilizes mock data from `/utils/mockData.ts` and TypeScript interfaces from `/types/models.ts`.
- **Data Models:** Includes `RoommateProfile`, `Property` (with `featured` field for VIP host priority), `Group` (with members, maxMembers, description, budget, preferredLocation, createdAt, createdBy), `Conversation`, `Message`, `Match`, and `Application`. User model extended with `messageCount` for limit tracking and `boostData` (boostsUsed, isBoosted, boostExpiresAt, lastBoostDate) for boost management.
- **Matching & Messaging:** Implements reciprocal matching and automatic conversation creation upon a match. Messages and conversations are persisted in AsyncStorage. Message limits enforced for free users with real-time count tracking.
- **Groups Implementation:** Features swipeable group discovery with a request-to-join approval workflow. Group data is stored globally in AsyncStorage and is not user-scoped.
- **Property Management:** Featured property status persisted via StorageService with ownership validation. Only property owners can toggle featured status. Host listings filtered by `hostId` for access control.
- **Future Database Integration:** Designed for future integration with a SQL database (e.g., Postgres) and separate environments.

## Key Technical Decisions

- **Module Resolution:** Babel module resolver with `@/` alias for simplified imports.
- **Platform-Specific Handling:** Adapts UI components and features for iOS, Android, and Web platforms (e.g., keyboard controller, blur effects).
- **Performance Optimizations:** Leverages React Native's New Architecture, React Compiler, Reanimated, and gesture-driven interactions for smooth performance.
- **Error Handling:** Implements an error boundary component for graceful error handling and app reload functionality.
- **Development Environment:** Configured for Replit with custom dev commands and Expo Web Browser integration for OAuth.

# External Dependencies

**Core Framework:**
- `expo`
- `react-native`
- `react-navigation`

**UI Components & Styling:**
- `expo-blur`
- `expo-symbols`
- `@expo/vector-icons`
- `react-native-safe-area-context`
- `expo-system-ui`

**Animations & Gestures:**
- `react-native-reanimated`
- `react-native-gesture-handler`
- `react-native-worklets`
- `expo-haptics`

**Storage & State:**
- `@react-native-async-storage/async-storage`

**Utilities:**
- `expo-linking`
- `expo-web-browser`
- `expo-constants`
- `expo-splash-screen`
- `expo-image`
- `react-native-keyboard-controller`

**Development Tools:**
- `typescript`
- `eslint`
- `prettier`
- `babel-plugin-module-resolver`

**Planned Integrations:**
- Elasticsearch
- SQL database (e.g., Postgres)
- SSO providers (Apple, Google)