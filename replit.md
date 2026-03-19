# Overview

Roomdr is a React Native mobile application aiming to be the "Airbnb for roommates," connecting renters and hosts to simplify the housing and roommate search. It features role-based navigation, swipe-based matching, property listings, group functionalities, and secure messaging. The platform seeks to offer a comprehensive and intuitive solution for finding compatible roommates and suitable properties.

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

## Core Functionality

Roomdr utilizes a points-based compatibility algorithm (0-100+ score) factoring in 16 weighted criteria, including age, location, budget, sleep schedule, cleanliness, smoking, move-in timeline, work location, guest policy, noise tolerance, pets, roommate relationship, shared expenses, interest tag overlap, zodiac sign, and personality compatibility (derived from a 5-question quiz). A sophisticated interest tag system allows users to select 3-10 tags for matching and profile display.

## Frontend Architecture

Built with React Native and Expo using TypeScript, the application employs React Navigation for role-based access (Renter, Host, Agent/Landlord) and supports light/dark modes.

**Key Features:**
- **Renter:** Swipe-based matching, 1-on-1 messaging, group management (Roommate Groups, Listing Inquiry Groups), property exploration with advanced filters and map/list views, saved properties, AI Match Assistant, animated match celebration, report/block system, and a notification feed. All plans can send cold messages with daily limits (Basic: 3, Plus: 10, Elite: unlimited). Resets at midnight.
- **Host:** A full host dashboard with statistics, listing management (create, edit, delete, pause, mark rented, boost), an Inquiries screen, inquiry analytics, and host subscription management.

**User Experience Enhancements:**
- **AI Profile Completion Reminders:** A centralized, escalating reminder system guides users through profile completion, with progress tracking and direct navigation to relevant questionnaire steps.
- **Roomdr AI Assistant:** A floating, context-aware AI button provides dynamic greetings, content cards, and insights based on the current screen and data, including profile completion gaps and personalized suggestions.
- **Profile Questionnaire:** A 14-step questionnaire with progress tracking and per-step validation, designed for comprehensive user profiling.
- **Listing Boost System:** Tier-based boosting options for hosts to increase listing visibility.
- **Address Autocomplete:** The host listing form uses `react-native-google-places-autocomplete` for smart address entry. As the host types, a dropdown shows real address suggestions. Selecting one auto-fills address, city, state, neighborhood, and coordinates. Coordinates from autocomplete skip the separate Geocoding API call on save. Manual address edits clear stale coordinates so geocoding runs as fallback.
- **Transit Auto-Fill:** Listings auto-detect nearby transit stops via Google Places API on save. Hosts can manually override transit info. Transit details display in listing detail views on the Explore screen. Service: `utils/transitService.ts`, API key: `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`.
- **AI Memory Layer:** Tracks user swipe analytics, message activity, and triggers micro-questions to refine AI suggestions.
- **Identity Verification:** Supports phone, government ID (via Stripe Identity SDK on native / WebView fallback on web, with document scanning and selfie matching), social media verification, and optional background checks (via Checkr) and income checks for Elite users. Platform-specific Stripe wrapper files (`StripeWrapper.native.tsx` / `StripeWrapper.web.tsx`) handle native-only SDK imports. Verification status is synced from Supabase (`identity_verified`, `background_check_status`) on app load via `mapSupabaseToUser` in AuthContext.
- **References System:** Users can request and display references on their profiles.
- **Personality Quiz:** A 5-question quiz contributing to the matching algorithm.

Animations are managed by React Native Reanimated, gestures by React Native Gesture Handler, and state management uses React Context API and AsyncStorage.

## Backend (Supabase)

Supabase provides the entire backend infrastructure:
- **Auth**: Email/password authentication.
- **Database**: PostgreSQL with Row Level Security (RLS) across all tables.
- **Realtime**: Subscriptions for messages and notifications.
- **Storage**: For profile and listing photos.
- **Supabase Edge Functions**: For webhook handling (`stripe-webhook`, `checkr-webhook`), verification sessions (`create-verification-session`), background checks (`initiate-background-check`), payments (`create-payment-intent`, `create-subscription`), and references (`send-reference-request`).

## Authentication & Authorization

Supabase Auth handles user authentication, with an `AuthContext` managing sessions and role-based access for `renter` and `host`. A mandatory 2-step onboarding flow (Profile Creation, Plan Selection) is required post-signup.

## Subscription & Paywall System

The application features tiered subscription plans for renters (Basic, Plus, Elite) and hosts (Free, Starter, Pro, Business), alongside one-time purchases. A `PaywallSheet` prompts users for upgrades. Dedicated screens provide plan details, upgrade/downgrade options, and billing history. Host plans enforce listing caps and offer various features like boosts and analytics.

## Data Layer

The data layer uses Supabase PostgreSQL, complemented by local AsyncStorage for caching. TypeScript interfaces define core models such as `User`, `RoommateProfile`, `Property`, `Group`, `Conversation`, `Message`, `Match`, and `InterestCard`.

**Listing Service (`services/listingService.ts`):** Centralized Supabase CRUD for the `listings` table. Exports `mapListingToProperty()` to convert Supabase rows (snake_case) to the `Property` TypeScript type (camelCase). All screens (ExploreScreen, HostDashboardScreen, MyListingsScreen, HostAnalyticsScreen, CreateEditListingScreen) use this centralized mapper instead of inline mapping. Supabase-first with StorageService (mock data) fallback for demo mode.

**Group System:** Supports `roommate` groups (renter-only) and `listing_inquiry` groups (renter group + host in a chat). `GroupMember` tracks role, host status, and member status.

**Address Reveal System:** Full property addresses are hidden until the host accepts an inquiry, after which the address is revealed with navigational links.

## UI/UX and Branding

A consistent dark theme with a specific color palette is used, featuring a `RoomdrLogo` rendered with `react-native-svg` and `expo-linear-gradient`.

## Location System

The application supports over 10 US cities with a centralized location data system and a `LocationPicker` component. A `CityContext` synchronizes city selections, persisting data via AsyncStorage. Match filters (Budget, Move-in Date, Room Type, Search Radius, Minimum Compatibility) are persistently stored and displayed.

## Technical Decisions

Technical decisions include Babel module resolver for simplified imports, platform-specific UI adaptations, performance optimizations via React Native's New Architecture, React Compiler, and Reanimated, and robust error handling through an error boundary component.

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
- `@react-native-community/datetimepicker`

**Animations & Gestures:**
- `react-native-reanimated`
- `react-native-gesture-handler`
- `react-native-worklets`
- `expo-haptics`

**Payments:**
- `@stripe/stripe-react-native` (native only, platform-specific via `StripeWrapper`)

**Storage & State:**
- `@react-native-async-storage/async-storage`

**Maps:**
- `react-native-maps`
- `react-native-google-places-autocomplete`
- `react-native-webview`

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