# Overview

Roomdr is a React Native mobile application designed to simplify the housing and roommate search by connecting renters and hosts. It functions as an "Airbnb for roommates," offering features like role-based navigation, swipe-based matching, property listings, group functionalities, and secure messaging. The platform aims to provide an intuitive and comprehensive solution for finding compatible roommates and suitable properties.

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

Roomdr employs a compatibility algorithm (0-100+ score) based on 16 weighted criteria including demographics, lifestyle, and preferences. A robust interest tag system further refines matching and profile display.

## Frontend Architecture

The application is built with React Native and Expo using TypeScript, featuring React Navigation for role-based access (Renter, Host, Agent/Landlord) and support for light/dark modes.

**Key Features:**
- **Renter:** Swipe-based matching, 1-on-1 messaging, group management (Roommate Groups, Listing Inquiry Groups), property exploration with advanced filters and map/list views, saved properties, AI Match Assistant, and a notification feed. Cold messaging has daily limits based on subscription tier.
- **Host:** A comprehensive host dashboard with statistics, listing management (create, edit, delete, pause, mark rented, boost), an Inquiries screen, inquiry analytics, and host subscription management.

**User Experience Enhancements:**
- **AI Profile Completion Reminders:** An escalating reminder system guides users through profile completion.
- **Roomdr AI Assistant:** A floating, context-aware AI button provides dynamic greetings, content cards, and insights based on screen context.
- **Profile Questionnaire:** A 14-step questionnaire for comprehensive user profiling.
- **Listing Boost System:** Tier-based boosting options for hosts to increase listing visibility.
- **Address Autocomplete & Transit Auto-Fill:** Streamlined listing creation with `react-native-google-places-autocomplete` for address and auto-detection of nearby transit stops via Google Places API.
- **AI Memory Layer:** Tracks user interactions to refine AI suggestions.
- **Identity Verification:** Supports phone, government ID (via Stripe Identity SDK), social media, and optional background/income checks.
- **References System:** Users can request and display references.
- **Personality Quiz:** A 5-question quiz integrated into the matching algorithm.

Animations are powered by React Native Reanimated, gestures by React Native Gesture Handler, and state management uses React Context API and AsyncStorage.

## Backend (Supabase)

Supabase provides the entire backend infrastructure:
- **Auth**: Email/password authentication.
- **Database**: PostgreSQL with Row Level Security (RLS).
- **Realtime**: Subscriptions for messages and notifications.
- **Storage**: For profile and listing photos.
- **Supabase Edge Functions**: For webhook handling, verification sessions, background checks, payments, and references.

## Authentication & Authorization

Supabase Auth manages user authentication, with an `AuthContext` handling sessions and role-based access. A mandatory 2-step onboarding flow (Profile Creation, Plan Selection) is required post-signup.

## Subscription & Paywall System

The application features tiered subscription plans for renters (Basic, Plus, Elite) and hosts (Free, Starter, Pro, Business), alongside one-time purchases. Stripe handles all payment processing via dedicated platform-specific hooks and Supabase Edge Functions.

## Data Layer

The data layer uses Supabase PostgreSQL, complemented by local AsyncStorage for caching. TypeScript interfaces define core models such as `User`, `RoommateProfile`, `Property`, `Group`, `Conversation`, `Message`, `Match`, and `InterestCard`. A centralized `listingService.ts` handles Supabase CRUD operations for listings, mapping data to TypeScript types.

**Group System:** Supports `roommate` groups and `listing_inquiry` groups. Groups can be linked to a listing, affecting member limits. Plan-based limits apply to group creation and standalone member counts. `CreateGroupScreen` and `GroupsScreen` facilitate group creation and management.

**Group Property Search & Linking:** A reusable `GroupPropertySearchModal` allows property search for linking to groups.

**Group Invites System:** Three invite methods are supported: from matches, shareable code, and listing interest. A `GroupInviteScreen` manages invites and join requests.

**Group Logic Rules:** Includes admin promotion before leaving, member removal, discoverable groups for listings, and join requests.

**Host Proactive Group Outreach:** Hosts on Pro/Business plans can browse discoverable renter groups and send them outreach messages about available listings. Robust spam controls include: daily caps (Pro: 3/day, Business: 10/day), hourly rate limits (Pro: 2/hr, Business: 3/hr), 30-day per-group cooldown, 50-character minimum message length, and auto-suspend after 3 reports. When daily limits are hit, hosts can purchase additional sends ($4.99 for +3, $12.99 for +10) that expire at midnight. Service layer: `services/hostOutreachService.ts`, constants: `constants/planLimits.ts`, screen: `screens/host/BrowseRenterGroupsScreen.tsx`.

**Address Reveal System:** Full property addresses are hidden until a host accepts an inquiry.

## UI/UX and Branding

A consistent dark theme with a specific color palette is used, featuring a `RoomdrLogo` rendered with `react-native-svg` and `expo-linear-gradient`.

## Location System

The application supports over 10 US cities with a centralized location data system and a `LocationPicker` component. A `CityContext` synchronizes and persists city selections. Match filters are persistently stored.

## Technical Decisions

Key technical decisions include Babel module resolver, platform-specific UI adaptations, performance optimizations via React Native's New Architecture, React Compiler, and Reanimated, and robust error handling through an error boundary component.

**Navigation Architecture:** Each major tab (Groups, Messages, Profile, Roommates) has its own stack navigator so back navigation stays within the tab. Tab navigators use `backBehavior="history"` for proper tab-level back navigation. Navigation files: `GroupsStackNavigator.tsx`, `MessagesStackNavigator.tsx`, `HostMessagesStackNavigator.tsx`, `RoommatesStackNavigator.tsx`, `ProfileStackNavigator.tsx`.

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
- `@stripe/stripe-react-native`

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