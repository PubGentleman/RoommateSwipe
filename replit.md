# Overview

Rhome is a React Native mobile application designed to simplify the housing and roommate search. It connects renters and hosts, offering features like role-based navigation, swipe-based matching, property listings, group functionalities, and secure messaging. The platform aims to provide an intuitive and comprehensive solution for finding compatible roommates and suitable properties, acting as an "Airbnb for roommates."

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

Rhome features a compatibility algorithm (0-100+ score) based on 16 weighted criteria and a robust interest tag system for refined matching and profile display.

## Frontend Architecture

The application is built with React Native and Expo using TypeScript, leveraging React Navigation for role-based access (Renter, Host, Agent/Landlord). It supports light/dark modes and uses React Native Reanimated for animations and gestures. State management is handled with React Context API and AsyncStorage.

**Key Features:**
- **Renter:** Swipe-based matching, 1-on-1 messaging, group management (Roommate Groups, Listing Inquiry Groups), property exploration with advanced filters and map/list views, saved properties, AI Match Assistant, notification feed, and daily cold messaging limits.
- **Host:** Host dashboard with statistics, listing management (create, edit, delete, pause, mark rented, boost), an Inquiries screen, inquiry analytics, and host subscription management.
- **AI-Powered Enhancements:** AI Profile Completion Reminders, Rhome AI Assistant (context-aware floating button), AI Memory Layer for refined suggestions, and AI Match Assistant powered by Claude (claude-sonnet-4-5) via Supabase Edge Function (`supabase/functions/ai-assistant/`) with conversation history, plan-based rate limiting (Free: 5/day, Plus: 50/day, Elite: 200/day, Agent Pro: 100/day, Agent Business: 500/day), and role-specific system prompts (renter vs agent). Requires `ANTHROPIC_API_KEY` secret on Supabase. Client helper at `utils/aiService.ts`. Shows connection error when API unavailable (no fake fallback data). AI screen opens as fullScreenModal (no tab bar overlap). Edge Function queries both `users` and `profiles` tables correctly to build user context. **Conversational Profile Collection:** Claude detects missing profile fields (budget, sleep schedule, cleanliness, smoking, pets, move-in date, preferred trains, amenities, etc.), asks about them naturally one at a time, extracts structured data from answers via `<profile_update>` tags, and saves values directly to Supabase profiles table. AIAssistantScreen shows a profile completion progress banner, dynamic opening messages based on completion %, and a toast notification when profile data is saved. AI Renter Suggestions: GroupInfoScreen shows up to 3 compatible renter suggestions for groups with open spots (gated behind Plus/Elite plans, utility at `utils/groupSuggestions.ts`). "Best Match Today" banner in RoommatesScreen swipe feed with 24h-cached top match from `match_scores` table (utility at `utils/bestMatchToday.ts`), plus highlighted card glow and "Find in deck" CTA.
- **User Profiling:** A 14-step Profile Questionnaire and a 5-question Personality Quiz integrated into matching.
- **Boost System:** Tier-based listing and profile boosting options for increased visibility, managed by `utils/boostRotation.ts`, `utils/boostUtils.ts`, and `utils/hostPricing.ts`.
- **Identity & Verification:** Supports phone, government ID (Stripe Identity SDK), social media verification, and optional background/income checks. Also includes a References System.
- **Host Type Differentiation:** Hosts select type (Individual, Company, Agent) affecting profile cards, listing badges, and contact labels.
- **Agent Matchmaker:** Agents get a dedicated tab layout (Listings, Browse Renters, My Groups, Messages, Profile) with: renter browsing/shortlisting, AI-powered renter suggestions and group composition, compatibility matrix visualization, group builder with invite flow, placement pipeline with status tracking (assembling → invited → active → placed → dissolved), and Stripe-powered placement fees. Agent plans: Pay Per Use ($149/placement), Starter ($49.99/mo), Pro ($99.99/mo), Business ($199.99/mo). Service layer at `services/agentMatchmakerService.ts` (migrated to Supabase with AsyncStorage fallback), plan config in `constants/planLimits.ts` (AGENT_PLAN_LIMITS), migration at `supabase/migrations/017_agent_matchmaker.sql`, `agent_plan` column in users table via `019_agent_plan.sql`, placement fee edge function at `supabase/functions/charge-placement-fee/`. **Claude AI Group Pairing** (Pro/Business only): "AI Pair Group" button in AgentGroupBuilderScreen and "Ask Claude" button in BrowseRentersScreen invoke the `agent-pair-group` edge function, which sends shortlisted renter profiles + listing to Claude (claude-sonnet-4-5) and returns a structured recommendation with confidence score, reasoning, concerns, alternatives, and excluded renters. Client hook at `hooks/useAgentPairing.ts`. Results displayed in a full-screen modal with "Use This Group" / "Use Alternative" actions that pre-select recommended renters.
- **Account Management:** Soft-delete account with a 30-day recovery window.
- **Activity-Based Ranking:** Users inactive for >14 days are sorted lower in the swipe deck.
- **Subscription Management:** Host subscription cancellation flow with re-activation option and a universal `PurchaseConfirmModal` for all payment types (subscriptions, one-time, credits).
- **Collapsible/Sticky Headers:** Implemented across main screens using `react-native-reanimated` for dynamic UI on scroll.
- **Transit-Aware Matching System:** NYC subway-integrated apartment matching with: 6-step `ApartmentPreferencesScreen` (bedrooms, budget, MTA train lines, move-in date, amenities, neighborhoods by borough); transit matching engine in `utils/transitMatching.ts` with group compatibility scoring (lifestyle 35%, budget 30%, transit 25%, move-in 10%), conflict detection with compromise suggestions, listing scoring (transit 40%, budget 35%, amenities 25%), and 4-stage renter pre-filtering for agents; `GroupApartmentSuggestionsScreen` with AI-powered listing suggestions, scoring breakdowns, and group voting (yes/no/maybe); transit data constants in `constants/transitData.ts` with 40+ NYC neighborhoods mapped to subway lines; agent `BrowseRentersScreen` transit pre-filtering with visual funnel summary; DB migration at `supabase/migrations/018_transit_matching.sql`.

## Backend (Supabase)

Supabase provides the entire backend infrastructure:
- **Auth**: Email/password authentication with `AuthContext` for sessions and role-based access.
- **Database**: PostgreSQL with Row Level Security (RLS).
- **Realtime**: Subscriptions for messages and notifications.
- **Storage**: For profile and listing photos.
- **Supabase Edge Functions**: For webhook handling, verification sessions, background checks, payments, references, agent placement fees, match score calculation (`calculate-match-scores`), and Claude AI-powered agent group pairing (`agent-pair-group`).

## Subscription & Paywall System

The application features tiered subscription plans for renters (Basic, Plus, Elite), hosts (Free, Starter, Pro, Business), and agents (Pay Per Use, Starter, Pro, Business), plus one-time purchases. Stripe handles all payment processing via platform-specific hooks and Supabase Edge Functions. Plan limits are centralized in `constants/planLimits.ts` and `constants/renterPlanLimits.ts` with gate helpers in `utils/planGates.ts` and `utils/renterPlanGates.ts`.

## Data Layer

The data layer uses Supabase PostgreSQL and local AsyncStorage for caching. TypeScript interfaces define core models. A centralized `listingService.ts` handles CRUD operations.

**Group System:** Supports `roommate` groups and `listing_inquiry` groups with plan-based limits, invite methods (matches, shareable code, listing interest), and logic rules for administration.
**Host Proactive Group Outreach:** Hosts on Starter+ plans can send outreach messages to discoverable renter groups, subject to daily/hourly caps and a 30-day cooldown. Paid credit packs are available.
**Host Analytics:** Varies by plan tier (`analyticsLevel` in `planLimits.ts`). Basic provides an overview; Advanced adds real listing views, renter demographics, outreach performance, and CSV exports. Company/Agent hosts have additional specialized analytics.

## UI/UX and Branding

A consistent dark theme with a specific color palette is used, featuring a `RhomeLogo` rendered with `react-native-svg` and `expo-linear-gradient`.

## Location System

The application supports over 10 US cities with a centralized location data system, a `LocationPicker` component, and a `CityContext` for city synchronization. Major cities (NYC, LA, Chicago, Miami, Houston) support **sub-area filtering** — boroughs for NYC, sides for Chicago, areas for LA/Miami/Houston. Sub-area data is defined in `utils/locationData.ts` (`CITY_SUB_AREAS`), persisted in `CityContext` (`activeSubArea`), and surfaced in the `CityPickerModal` as filter chips below the city selection. The pill button shows "City - SubArea" when a sub-area is active.

## Technical Decisions

Key technical decisions include Babel module resolver, platform-specific UI adaptations, performance optimizations via React Native's New Architecture, React Compiler, and Reanimated, and robust error handling. Navigation uses separate stack navigators for each major tab (`GroupsStackNavigator.tsx`, `MessagesStackNavigator.tsx`, `HostMessagesStackNavigator.tsx`, `RoommatesStackNavigator.tsx`, `ProfileStackNavigator.tsx`) with `backBehavior="history"`. `HostTabNavigator.tsx` conditionally renders tabs by host type: agents get (Listings, Browse Renters, My Groups, Messages, Profile), company hosts get (Dashboard, Listings, Groups, Messages, Profile — no Roommates swipe tab), and individual hosts get the full default layout including Roommates. `messageService.getConversations()` uses a single joined query (matches + users + messages) to avoid N+1 queries.

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