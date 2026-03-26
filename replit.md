# Overview

Rhome is a React Native mobile application designed to simplify housing and roommate searches by connecting renters and hosts through a role-based, swipe-based matching platform. It aims to be a comprehensive and intuitive solution, offering AI-powered matching, property listings, group functionalities, and secure communication to facilitate the discovery of compatible roommates and suitable properties.

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

## Frontend

The application is built using React Native, Expo, and TypeScript, employing React Navigation for role-based access (Renter, Host, Agent/Landlord). It supports light/dark modes, animations with React Native Reanimated, and state management via React Context API and AsyncStorage.

**Key Features:**
- **Matching & Profiles:** Features a compatibility algorithm, interest tags, personality quizzes, and a post-signup Profile Completion system.
- **Role-Specific Features:**
    - **Renter:** Swipe-based matching, 1-on-1 messaging, group management, property exploration with advanced filters and transit integration, saved properties, AI Match Assistant, property reviews, chat scheduling (visit requests + booking offers), and notifications.
    - **Host:** Dashboard for listing management (create, edit, delete, boost), inquiry handling, analytics, property review management with host replies, and group matches monetization. Supports Individual, Company, and Agent host types with varying UI/features.
    - **Property Reviews:** Renters can rate and review listings, with hosts able to reply. Ratings and review counts are aggregated and displayed.
    - **Chat Scheduling & Booking:** In-chat actions allow scheduling visits and sending booking offers, which render as rich action cards and create records in the `bookings` table upon acceptance.
    - **Rhome Select Badge:** A gold badge awarded to top-rated hosts meeting specific criteria (average rating, review count, tenure, cancellation rate, booking history).
    - **Company Teams:** Multi-seat team access for company accounts with role-based permissions, invite systems, and seat limits based on subscription plans.
    - **Company Agent Assignment & Routing:** Allows company accounts to assign agents to listings, routing inquiries, conversations, and notifications directly to the assigned agent. Includes features for monitoring agent response times and reassigning conversations.
    - **Verified Agent Badge:** A blue badge displayed for agents with verified licenses.
    - **Group Bookings:** Visit/booking action cards support group contexts, with only group leaders able to accept/decline.
    - **Agent Response Tracking & Company Alerts:** Tracks agent response times, escalates status, and provides alerts to companies for delayed or unresponsive agents, impacting Rhome Select eligibility.
- **AI-Powered Enhancements:** Includes an AI Assistant for personalized housing help, AI-generated match explanations, group and listing suggestions, AI tools for agents/companies, AI-suggested meetups, AI-generated "Question of the Day," "Ask AI About This Person" multi-turn chat, and AI Neighborhood Intelligence providing localized information with follow-up chat capabilities.
- **Verification & Safety:** Features Instagram verification, multi-photo enforcement, chat leakage detection, Safety Mode with background checks, identity verification, a References System, and Agent License Verification (including state board scraping, document upload, and verification statuses).
- **Benefit Callouts:** Role-specific benefit lists are displayed during host onboarding.
- **Boost System:** A tier-based system to increase visibility for listings and profiles.
- **Account Management:** Includes soft-delete functionality with a recovery window.
- **Subscription Management:** Tiered subscription plans for renters, hosts, and agents with a hybrid payment architecture (RevenueCat for native, Stripe for web).
- **UI/UX:** Adheres to a consistent dark theme, uses collapsible/sticky headers, and adapts for platform-specific interactions.
- **Location System:** The Explore screen uses search autocomplete for cities, neighborhoods, and ZIP codes via geocoding, supplemented by popular city chips and Google Places Autocomplete for onboarding.
- **Area Info Cards:** Listing detail modals display area information (Transit, Restaurants, Grocery, Laundromat, Parks) powered by the Overpass API, with loading skeletons and graceful fallbacks.
- **Renter/Host Mode Switch:** Allows individual hosts to toggle between modes.
- **Affiliate Program:** Users can apply to become affiliates, receive unique referral codes (RHOME-XXXX format), and earn commissions ($10 for Plus, $20 for Elite referrals). Includes an affiliate dashboard with stats, referral history, PayPal email management, and native share integration. Referral codes can be entered during sign-up. Commission tracking triggers automatically on subscription upgrades.

## Backend (Supabase)

Supabase provides the complete backend infrastructure:
- **Auth:** Email/password authentication with Row Level Security (RLS).
- **Database:** PostgreSQL with RLS, including computed columns and preference tables.
- **Realtime:** Subscriptions for messaging and notifications.
- **Storage:** For media assets.
- **Edge Functions:** Utilized for webhooks, verification, background checks, payments, references, AI operations (Claude), match score calculations, group-to-listing matching, and public forms.

## Subscription & Paywall System

A tiered subscription model exists for renters, hosts, and agents, with payments managed through RevenueCat for native platforms and Stripe for web. RevenueCat webhooks sync subscription states to the Supabase database.

## Data Layer

Supabase PostgreSQL serves as the primary data store, complemented by AsyncStorage for local caching. TypeScript interfaces define data models. A centralized `listingService.ts` manages CRUD operations. The group system handles roommate and listing inquiry groups with plan-based limits.

## Technical Decisions

The architecture incorporates a Babel module resolver, platform-specific UI, performance optimizations (React Native's New Architecture, React Compiler, Reanimated), and robust error handling. Navigation uses separate stack navigators with history behavior, and efficient data fetching prevents N+1 issues.

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
- `react-native-purchases` (RevenueCat)

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