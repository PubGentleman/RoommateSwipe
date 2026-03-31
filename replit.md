# Overview

Rhome is a React Native mobile application designed to simplify housing and roommate searches by connecting renters and hosts through a role-based, swipe-based matching platform. It aims to be a comprehensive and intuitive solution, offering AI-powered matching, property listings, group functionalities, and secure communication to facilitate the discovery of compatible roommates and suitable properties. The project envisions becoming the leading platform for seamless housing and roommate discovery.

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
- **Matching & Profiles:** Compatibility algorithms, interest tags, personality quizzes, post-signup profile completion, and location matching with multi-neighborhood, zip code, and coordinate-based proximity scoring.
- **Role-Specific Features:**
    - **Renter:** Swipe-based matching, 1-on-1 messaging, group management, property exploration with advanced filters and transit integration, saved properties, AI Match Assistant, property reviews, chat scheduling (visit requests + booking offers), and notifications. Features an "Renter Intent System" for personalized search experiences.
    - **Host:** Dashboard for listing management (create, edit, delete, boost), inquiry handling, analytics, property review management, and group matches monetization. Supports Individual, Company, and Agent host types. Includes features like Rhome Select Badge, Company Teams with role-based permissions, Company Agent Assignment & Routing, Verified Agent Badge, and Group Bookings.
- **AI-Powered Enhancements:** AI Assistant for personalized housing help, AI-generated match explanations, group and listing suggestions, AI tools for agents/companies, AI-suggested meetups, AI-generated "Question of the Day," "Ask AI About This Person" multi-turn chat, and AI Neighborhood Intelligence providing localized information with follow-up chat capabilities utilizing real-time data from external APIs.
- **Pi AI Matchmaker:** Rhome's AI matchmaker persona, providing match insights, deck rankings, host recommendations, and preference parsing. This is integrated with a subscription-tiered usage and quota enforcement system. Includes "Pi's Take" summaries, "Pi Pick" badges, and plan-gated `WhyThisMatchModal` content.
- **Pi Demand Intelligence:** Anonymous renter activity tracking feeds market context into Pi's listing advisor mode, tracking events like listing views and searches to aggregate neighborhood and listing demand.
- **Contact Info Protection:** Platform-level contact info blurring in chat messages for free users, with auto-unlocking upon confirmed visit requests or booking offers.
- **Agent/Company Messaging Paywall:** Free-tier agents (pay_per_use) and companies see blurred message previews and content. Each account gets 1 lifetime free conversation unlock. Paid plans get full messaging access. Service-level guard blocks sends on locked conversations.
- **Support System:** Email support for all users, with priority for paid users.
- **Verification & Safety:** Instagram verification, multi-photo enforcement, chat leakage detection, background checks, identity verification, a References System, and Agent License Verification.
- **Profile Pause ("I Found a Place"):** Renters can pause their search profiles, removing them from discovery surfaces while retaining subscriptions, with a daily check-in cron.
- **Activity Decay Ranking:** Inactive users' profiles progressively sink in discovery surfaces, with a `recency_score` multiplier and re-engagement notifications.
- **Boost System:** A tier-based system to increase visibility for listings and profiles.
- **Account Management:** Soft-delete functionality with a recovery window.
- **Subscription Management:** Tiered subscription plans for renters, hosts, and agents with a hybrid payment architecture.
- **UI/UX:** Consistent dark theme, collapsible/sticky headers, platform-specific interactions, and comprehensive location system with search autocomplete and popular city chips. Area Info Cards display dynamic neighborhood data.
- **Renter/Host Mode Switch:** Allows individual hosts to toggle between modes.
- **Affiliate Program:** Users can apply to become affiliates, receive unique referral codes, and earn commissions, with a dedicated affiliate dashboard.
- **Request to Join Group:** Renters can browse and send join requests to open groups, with voting mechanisms and automated expiration for requests.

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

## Amenity System

Centralized amenity definitions live in `constants/amenities.ts` — the single source of truth for all amenity data across the app. Contains 42 amenities in 6 categories (unit_features, kitchen_bath, building_amenities, outdoor_spaces, utilities_services, accessibility_safety). Key exports:
- `ALL_AMENITIES` / `AMENITY_CATEGORIES` — master data
- `getHostAmenities()` — amenities for host listing creation (excludes renter-only items)
- `getRenterPreferenceAmenities()` — curated subset for renter onboarding (max 3 picks)
- `normalizeLegacyAmenity()` — maps old string-format amenities (e.g. "In-unit Laundry") to canonical IDs (e.g. "in_unit_laundry")
- `matchAmenityText()` — fuzzy text-to-ID matching via searchTerms

All three amenity surfaces (ExploreScreen filters, CreateEditListingScreen, ApartmentPreferencesScreen) use collapsible categorized sections with badge counts. Legacy listing amenities are normalized on load/filter. Migration 057 provides a PostgreSQL `normalize_amenity()` function for server-side backward compatibility.

## Host Badge System

Three earned achievement badges for host quality signaling:
- **Rhome Select** (Gold `#D4AF37`, `award` icon) — Individual hosts: 3+ months, 10+ reviews, 4.8+ rating, 90%+ response, <10% cancellation, 1+ confirmed booking
- **Top Agent** (Amber `#F59E0B`, `star` icon) — Agents: 2+ months, verified license, paid plan, 5+ reviews, 4.7+ rating, 85%+ response, 3+ placements, <15% cancellation
- **Top Company** (Green `#22C55E`, `shield` icon) — Companies: 3+ months, Pro/Enterprise plan, 5+ active listings, 10+ reviews, 4.6+ rating, 90%+ response, <45d vacancy, 60%+ fill rate, 2+ team members

Key files:
- `hooks/useHostBadge.ts` — Unified badge determination (checks cached `host_badge` column first, falls back to live calculation)
- `hooks/useTopAgent.ts`, `hooks/useTopCompany.ts`, `hooks/useRhomeSelect.ts` — Individual check functions (exported as both hooks and standalone `checkX` functions)
- `components/HostBadge.tsx` — Reusable small/large badge display component
- `components/BadgeProgressCard.tsx` — Dashboard progress card showing criteria checklist
- `supabase/functions/recalculate-badges/index.ts` — Daily cron Edge Function to refresh cached badge columns on `users` and `listings` tables
- Migration 058 adds `host_badge` column to both `listings` and `users` tables
- Migration 060 adds `published_at` column to `listings`, backfills existing active listings, and syncs `status` for listings with `is_active = true`

## Technical Decisions

The architecture incorporates a Babel module resolver, platform-specific UI, performance optimizations (React Native's New Architecture, React Compiler, Reanimated), and robust error handling. Navigation uses separate stack navigators with history behavior, and efficient data fetching prevents N+1 issues.

# External Dependencies

- `expo`
- `react-native`
- `react-navigation`
- `@react-native-community/datetimepicker`
- `react-native-reanimated`
- `@stripe/stripe-react-native`
- `react-native-purchases` (RevenueCat)
- `@react-native-async-storage/async-storage`
- `react-native-maps`
- `react-native-google-places-autocomplete`
- `react-native-webview`
- Supabase (Auth, Database, Realtime, Storage, Edge Functions)
- Claude (for AI operations)
- Walk Score API
- Overpass API (for amenities and area info)
- NYC Open Data (for crime statistics in NYC)