# Overview

Rhome is a React Native mobile application that revolutionizes the housing and roommate search by connecting renters and hosts. It offers role-based navigation, swipe-based matching, property listings, group functionalities, and secure messaging. The platform aims to be an intuitive, comprehensive "Airbnb for roommates," providing a seamless solution for finding compatible roommates and suitable properties.

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

The application is built with React Native and Expo using TypeScript, leveraging React Navigation for role-based access (Renter, Host, Agent/Landlord). It supports light/dark modes, uses React Native Reanimated for animations and gestures, and manages state with React Context API and AsyncStorage.

**Key Features:**
- **Matching & Profiles:** Compatibility algorithm (0-100+ score) based on 16 weighted criteria, interest tag system, 14-step Profile Questionnaire, and a 5-question Personality Quiz.
- **Renter Features:** Swipe-based matching, 1-on-1 messaging, Roommate and Listing Inquiry group management, property exploration with advanced filters (including transit-aware matching with NYC subway integration) and map/list views, saved properties, AI Match Assistant, notification feed, and daily cold messaging limits.
- **Host Features:** Host dashboard, listing management (create, edit, delete, boost), inquiries screen, analytics, and group matches monetization. Host types (Individual, Company, Agent) affect UI and features.
- **AI-Powered Enhancements:**
    - **AI Assistant:** Context-aware floating button, AI Memory Layer, and AI Match Assistant powered by Claude (claude-sonnet-4-5) via Supabase Edge Functions. It helps complete user profiles by detecting missing fields and extracting structured data.
    - **AI Renter Suggestions:** GroupInfoScreen shows compatible renter suggestions for groups.
    - **"Best Match Today" Banner:** Displays a top match in the RoommatesScreen swipe feed.
    - **AI Group Health Scores:** Calculates group compatibility and identifies conflicts, displayed with badges and snippets.
    - **Group Quick Stats:** Inline chip counts for suggested members and matching apartments on group cards.
    - **Automated AI Roommate Matching:** AI-generated group suggestions with invite flow and automatic listing matching upon group completion.
    - **Agent Matchmaker:** AI-powered renter shortlisting, group composition, compatibility matrix, group builder with invite flow, placement pipeline, and Claude AI Group Pairing for recommendations.
    - **Company Host AI Auto-Fill:** AI-powered vacancy fill system with group recommendations and invites for shortlisted renters.
- **Identity & Verification:** Phone, government ID (Stripe Identity SDK), social media verification, optional background/income checks, and a References System.
- **Boost System:** Tier-based listing and profile boosting for increased visibility.
- **Account Management:** Soft-delete with a 30-day recovery window.
- **Activity-Based Ranking:** Inactive users are ranked lower in the swipe deck.
- **Subscription Management:** Host subscription cancellation and re-activation, universal purchase confirmation modal.
- **UI/UX:** Consistent dark theme with `RhomeLogo` (SVG), collapsible/sticky headers with `react-native-reanimated`.
- **Location System:** Supports multiple US cities with sub-area filtering (e.g., NYC boroughs) via `LocationPicker` and `CityContext`.

## Backend (Supabase)

Supabase provides the entire backend infrastructure:
- **Auth:** Email/password authentication with `AuthContext` and Row Level Security (RLS).
- **Database:** PostgreSQL with RLS. Listings have a computed `rooms_available` column (`bedrooms - host_lives_in - existing_roommates_count`) used across all AI matching.
- **Realtime:** Subscriptions for messages and notifications.
- **Storage:** For profile and listing photos.
- **Edge Functions:** For webhooks (Stripe), verification sessions, background checks, payments, references, agent placement fees, match score calculation, Claude AI operations (`agent-pair-group`, `company-pair-group`), group-to-listing matching, and group unlock payments.

## Subscription & Paywall System

Tiered subscription plans for renters (Basic, Plus, Elite), hosts (Free, Starter, Pro, Business), and agents (Pay Per Use, Starter, Pro, Business), plus one-time purchases. Stripe handles all payment processing. Plan limits are centralized in `constants/planLimits.ts`.

## Data Layer

Supabase PostgreSQL for primary data storage and local AsyncStorage for caching. TypeScript interfaces define models. A centralized `listingService.ts` handles CRUD operations. The group system supports `roommate` and `listing_inquiry` groups with plan-based limits and administration rules. Host Proactive Group Outreach allows hosts on Starter+ plans to message discoverable renter groups with caps and cooldowns.

## Technical Decisions

Babel module resolver, platform-specific UI adaptations, performance optimizations via React Native's New Architecture, React Compiler, and Reanimated. Robust error handling. Navigation uses separate stack navigators per major tab with `backBehavior="history"`. `messageService.getConversations()` uses single joined queries to prevent N+1 issues. Conditional rendering of HostTabNavigator based on host type.

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