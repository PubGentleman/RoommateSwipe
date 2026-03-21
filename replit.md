# Overview

Roomdr is a React Native mobile application designed to simplify the housing and roommate search. It connects renters and hosts, offering features like role-based navigation, swipe-based matching, property listings, group functionalities, and secure messaging. The platform aims to provide an intuitive and comprehensive solution for finding compatible roommates and suitable properties, acting as an "Airbnb for roommates."

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

Roomdr features a compatibility algorithm (0-100+ score) based on 16 weighted criteria and a robust interest tag system for refined matching and profile display.

## Frontend Architecture

The application is built with React Native and Expo using TypeScript, leveraging React Navigation for role-based access (Renter, Host, Agent/Landlord). It supports light/dark modes and uses React Native Reanimated for animations and gestures. State management is handled with React Context API and AsyncStorage.

**Key Features:**
- **Renter:** Swipe-based matching, 1-on-1 messaging, group management (Roommate Groups, Listing Inquiry Groups), property exploration with advanced filters and map/list views, saved properties, AI Match Assistant, notification feed, and daily cold messaging limits.
- **Host:** Host dashboard with statistics, listing management (create, edit, delete, pause, mark rented, boost), an Inquiries screen, inquiry analytics, and host subscription management.
- **AI-Powered Enhancements:** AI Profile Completion Reminders, Roomdr AI Assistant (context-aware floating button), AI Memory Layer for refined suggestions, and AI Match Assistant powered by GPT-4o via Supabase Edge Function (`supabase/functions/ai-assistant/`) with conversation history, plan-based rate limiting (Free: 5/day, Plus: 50/day, Elite: 200/day), and rich system prompts using user profile + matches + listings context. Client helper at `utils/aiService.ts`. Falls back to local keyword-based responses when API unavailable.
- **User Profiling:** A 14-step Profile Questionnaire and a 5-question Personality Quiz integrated into matching.
- **Boost System:** Tier-based listing and profile boosting options for increased visibility, managed by `utils/boostRotation.ts`, `utils/boostUtils.ts`, and `utils/hostPricing.ts`.
- **Identity & Verification:** Supports phone, government ID (Stripe Identity SDK), social media verification, and optional background/income checks. Also includes a References System.
- **Host Type Differentiation:** Hosts select type (Individual, Company, Agent) affecting profile cards, listing badges, and contact labels.
- **Account Management:** Soft-delete account with a 30-day recovery window.
- **Activity-Based Ranking:** Users inactive for >14 days are sorted lower in the swipe deck.
- **Subscription Management:** Host subscription cancellation flow with re-activation option and a universal `PurchaseConfirmModal` for all payment types (subscriptions, one-time, credits).
- **Collapsible/Sticky Headers:** Implemented across main screens using `react-native-reanimated` for dynamic UI on scroll.

## Backend (Supabase)

Supabase provides the entire backend infrastructure:
- **Auth**: Email/password authentication with `AuthContext` for sessions and role-based access.
- **Database**: PostgreSQL with Row Level Security (RLS).
- **Realtime**: Subscriptions for messages and notifications.
- **Storage**: For profile and listing photos.
- **Supabase Edge Functions**: For webhook handling, verification sessions, background checks, payments, and references.

## Subscription & Paywall System

The application features tiered subscription plans for renters (Basic, Plus, Elite) and hosts (Free, Starter, Pro, Business), and one-time purchases. Stripe handles all payment processing via platform-specific hooks and Supabase Edge Functions. Plan limits are centralized in `constants/planLimits.ts` and `constants/renterPlanLimits.ts` with gate helpers in `utils/planGates.ts` and `utils/renterPlanGates.ts`.

## Data Layer

The data layer uses Supabase PostgreSQL and local AsyncStorage for caching. TypeScript interfaces define core models. A centralized `listingService.ts` handles CRUD operations.

**Group System:** Supports `roommate` groups and `listing_inquiry` groups with plan-based limits, invite methods (matches, shareable code, listing interest), and logic rules for administration.
**Host Proactive Group Outreach:** Hosts on Starter+ plans can send outreach messages to discoverable renter groups, subject to daily/hourly caps and a 30-day cooldown. Paid credit packs are available.
**Host Analytics:** Varies by plan tier (`analyticsLevel` in `planLimits.ts`). Basic provides an overview; Advanced adds real listing views, renter demographics, outreach performance, and CSV exports. Company/Agent hosts have additional specialized analytics.

## UI/UX and Branding

A consistent dark theme with a specific color palette is used, featuring a `RoomdrLogo` rendered with `react-native-svg` and `expo-linear-gradient`.

## Location System

The application supports over 10 US cities with a centralized location data system, a `LocationPicker` component, and a `CityContext` for city synchronization. Major cities (NYC, LA, Chicago, Miami, Houston) support **sub-area filtering** — boroughs for NYC, sides for Chicago, areas for LA/Miami/Houston. Sub-area data is defined in `utils/locationData.ts` (`CITY_SUB_AREAS`), persisted in `CityContext` (`activeSubArea`), and surfaced in the `CityPickerModal` as filter chips below the city selection. The pill button shows "City - SubArea" when a sub-area is active.

## Technical Decisions

Key technical decisions include Babel module resolver, platform-specific UI adaptations, performance optimizations via React Native's New Architecture, React Compiler, and Reanimated, and robust error handling. Navigation uses separate stack navigators for each major tab (`GroupsStackNavigator.tsx`, `MessagesStackNavigator.tsx`, `HostMessagesStackNavigator.tsx`, `RoommatesStackNavigator.tsx`, `ProfileStackNavigator.tsx`) with `backBehavior="history"`.

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