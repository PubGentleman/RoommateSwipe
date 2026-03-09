# Overview

Roomdr is a React Native mobile application designed to connect renters, hosts, and agents/landlords in the roommate-finding marketplace. It functions as an "Airbnb for roommates," offering features like role-based navigation, swipe-based roommate matching, property listings, group formation, and messaging to streamline the housing and roommate search process. The project aims to capture a significant share of the roommate search market by providing a comprehensive and intuitive platform.

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

Roomdr implements a points-based compatibility algorithm (0-100 score) across 14 weighted factors including location, budget, and lifestyle, providing detailed breakdowns with strengths and concerns. Date of Birth is used to calculate Zodiac signs for minor compatibility weighting.

## Frontend Architecture

The application is built with React Native and Expo using TypeScript, featuring React Navigation for role-based access (Renter, Host, Agent/Landlord) and a theme system for light/dark modes.

**Key Features:**
- **Renter:** Swipe-based matching, 1-on-1 messaging, group management, property exploration with advanced filters and map/list views, saved properties, rewind, profile view tracking, AI Match Assistant, animated match celebration, report/block system, notification feed, profile completion indicator, and mutual interest flow (send Interest Cards to hosts from property listings with daily limits and Super Interest for premium users). The Match screen has a dark Tinder-style UI with specific branding elements and action buttons.
- **Host:** Full host dashboard with stats overview (total/active/paused/rented listings, inquiries, pending inquiries, applications, unread messages), listing management (create/edit/delete/pause/unpause/mark rented), dedicated Inquiries tab for interest card management (filter by status, accept/pass with notifications, super interest highlighting), application review (filter by status, approve/reject with persistence, internal notes), analytics screen (overview stats, conversion funnel, per-listing breakdowns), and role switching from Profile. Host tab navigator has 5 tabs: Dashboard, Listings, Apps, Messages, Profile. Dashboard and Listings tabs use stack navigators to push CreateEditListing and Analytics screens. Dashboard stack also includes Inquiries screen accessible via "View Inquiries" quick action.
- **Agent:** Multi-property portfolio management, document verification, and a legal template library.

**User Experience Enhancements:**
- **Match Celebration:** An animated full-screen modal appears upon mutual likes, displaying user photos, compatibility, and options to message or continue swiping.
- **Profile Questionnaire:** A multi-step guided questionnaire replaces previous single-page forms, featuring progress tracking, `SelectionCard` components, and keyboard avoidance.
- **Report/Block System:** Users can report or block others from various screens, filtering blocked users from interactions.
- **Notification System:** A context-based system provides app-wide notifications with unread counts, real-time toast alerts, and configurable preferences.
- **Profile Completion:** A component tracks progress across 10 weighted profile fields, offering suggestions for improvement.
- **Identity Verification:** Users can verify identity via phone, government ID, and social media, with verification badges displayed across the app.
- **Onboarding Tutorial:** A swipeable tutorial introduces new users to core features upon first login.

Animations are powered by React Native Reanimated, gestures by React Native Gesture Handler, and state managed by React Context API and AsyncStorage.

## Authentication & Authorization

The system uses mock authentication for demonstration, supporting role-based navigation and conditional access for `renter`, `host`, and `agent` roles. Three subscription tiers (Basic, Plus, Elite) are planned via Stripe integration. Privacy settings and account deletion are implemented.

## Data Layer

The data layer uses mock data and TypeScript interfaces for models like `RoommateProfile`, `Property`, `Group`, `Conversation`, `Message`, `Match`, `Application`, and `InterestCard`. There are 201 total demo roommate profiles spread across 11 major US cities (New York, Los Angeles, Chicago, Miami, San Francisco, Austin, Seattle, Denver, Boston, Houston, Atlanta). Profiles are split across three files: 26 base profiles in `utils/mockData.ts`, 100 in `utils/additionalProfiles.ts`, and 75 in `utils/extraProfiles.ts`, all merged via spread operator. The app also has 17 conversations, 50 properties, 30 groups, and 10 applications across all cities. Extra conversations, properties, groups, and applications are in `utils/extraMockData.ts`. Data version is managed via `MOCK_DATA_VERSION` in `utils/mockData.ts` (currently '2.0.0') — changing this triggers automatic re-seeding on next app load. It supports reciprocal matching, automatic conversation creation, and message limits. Property management includes distinguishing room types and tracking existing roommates. An AI Match Assistant refines user profiles through natural language interactions.

## Dark Theme UI

All screens use a consistent dark theme with hardcoded colors:
- Root background: `#111` (near-black)
- Card backgrounds: `#1a1a1a` (dark gray)
- Accent/CTA: coral `#ff6b5b` with gradient to `#e83a2a`
- Text: white `#fff` with opacity variants for secondary text (`rgba(255,255,255,0.35)`)
- Section titles: uppercase, `rgba(255,255,255,0.5)`, 13px, 700 weight
- Settings items: colored icon boxes (purple, green, orange, red) with rounded backgrounds
- All profile sub-screens (Payment, Plans, Notifications, Privacy, Verification, etc.) use matching dark backgrounds

The ProfileScreen uses a custom ScrollView layout with manual safe area insets (matching other main screens like RoommatesScreen and MessagesScreen). Sub-screens use either ScreenScrollView or custom layouts with dark background overrides.

## Branding

The `RoomdrLogo` component renders the brand logo using `react-native-svg` and `expo-linear-gradient`, with variants for horizontal, stacked, and icon-only layouts in `sm`, `md`, `lg` sizes. Brand colors are coral-red gradients and white.

## Location System

The application supports over 10 US cities across multiple states, centralizing location data. A `LocationPicker` component provides a cascading State → City → Neighborhood selection. Location filtering is applied to roommate profiles, groups, and property searches. Public property displays enforce location privacy by showing only neighborhood and city.

**Shared City Selector (All Tabs):** City selection is synchronized across the Match, Groups, and Explore tabs via a shared `CityContext` (`contexts/CityContext.tsx`). All three tabs use the same `CityPillButton` (map-pin icon + city name + dropdown arrow) and `CityPickerModal` bottom sheet (`components/CityPickerModal.tsx`) with Recently Viewed cities (last 3), Popular Cities chips, and a search bar. Selecting a city on any tab carries over to all others. The selected city and recent cities are persisted via AsyncStorage. The Match screen also has a filter icon button beside the city pill.

**Match Filters (`components/RoommateFilterSheet.tsx`):** A comprehensive filter bottom sheet accessible from the filter icon on the Roommates screen. Includes: Budget Range (preset chips for $500-$1K, $1K-$2K, $2K-$3.5K, $3.5K+), Move-in Date (ASAP, 30 days, 3 months), Room Type (Private/Shared/Entire/Studio, multi-select), Lifestyle (Pet Friendly, Non-Smoker, Remote Worker, Students OK, Night Owl, Early Bird, multi-select), Search Radius (5/10/25/50mi segmented control), and Minimum Compatibility (Any/50%+/60%+/70%+/80%+/90%+). Filters persist via AsyncStorage. Active filters show as dismissible chips below the city selector. Filter count badge appears on the filter icon. Zero-results state offers a "Relax Filters" button. Real-time matching count shown in the sheet. Accent color: coral `#ff6b5b`.

## Technical Decisions

Key technical decisions include Babel module resolver for simplified imports, platform-specific UI adaptations, performance optimizations via React Native's New Architecture, React Compiler, and Reanimated, and error handling through an error boundary component.

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

**Storage & State:**
- `@react-native-async-storage/async-storage`

**Maps:**
- `react-native-maps` (iOS/Android native maps)
- Leaflet/OpenStreetMap via iframe for web maps
- `react-native-webview`

**Utilities:**
- `expo-linking`
- `expo-web-browser`
- `expo-constants`
- `expo-splash-screen`
- `expo-image`
- `react-native-keyboard-controller`

**Monetization:**
- `AdBanner` component (placeholder for Google AdMob integration)

**Development Tools:**
- `typescript`
- `eslint`
- `prettier`
- `babel-plugin-module-resolver`