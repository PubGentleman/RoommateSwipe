# Overview

Roomdr is a React Native mobile application designed to be the "Airbnb for roommates," connecting renters and hosts to streamline the housing and roommate search process. It offers role-based navigation, swipe-based roommate matching, property listings, group formation, and secure messaging. The platform aims to capture a significant share of the roommate search market by providing a comprehensive and intuitive solution for finding compatible roommates and suitable properties.

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

Roomdr implements a points-based compatibility algorithm (0-100+ score) using 16 weighted factors, including age (8 pts - primary factor), location (16 pts), budget (12 pts), sleep schedule (12 pts), cleanliness (12 pts), smoking (10 pts), move-in timeline (4 pts), work location (6 pts), guest policy (6 pts), noise tolerance (4 pts), pets (4 pts), roommate relationship (2 pts), shared expenses (2 pts), interest tag overlap (2 pts), zodiac sign (2 pts), and personality compatibility (~15 pts, 15% weighting via 5-question quiz). A sophisticated interest tag system allows users to select 3-10 tags from predefined categories, which are used in the matching algorithm and displayed on user profiles.

## Frontend Architecture

The application is built with React Native and Expo using TypeScript, featuring React Navigation for role-based access (Renter, Host, Agent/Landlord) and a theme system supporting light/dark modes.

**Key Features:**
- **Renter:** Swipe-based matching, 1-on-1 messaging, group management (Roommate Groups + Listing Inquiry Groups), property exploration with advanced filters and map/list views, saved properties, profile view tracking, AI Match Assistant, animated match celebration, report/block system, notification feed, profile completion indicator, mutual interest flow, cold messaging (Elite), and "Inquire Together" group listing inquiries.
- **Host:** Full host dashboard with statistics and plan badge, listing management (create, edit, delete, pause, mark rented, boost), dedicated Inquiries screen, inquiry-based analytics, listing inquiry group chat participation, host subscription management (HostSubscriptionScreen), per-listing boosts (ListingBoostScreen), listing cap enforcement with overage for Business plan, and role switching.

**User Experience Enhancements:**
- **Match Celebration:** Animated full-screen modal for mutual likes.
- **Profile Questionnaire:** A 14-step questionnaire with progress tracking and per-step validation. During initial signup onboarding, only the first 5 steps are shown (Photos, Basic Info, Gender, Location & Work, Bio); remaining steps are completed later via Edit Profile. Occupation uses `OccupationBarSelector` (tap-to-open bottom sheet with categorized occupation tags). Interests use `InterestCategoryBars` (category bars with per-category modals, required/optional badges, Done button). Required categories: Lifestyle, Habits, Hobbies. Optional: Social, Diet. Validation via `validateInterestTags` in `profileReminderUtils.ts`.
- **Roomdr AI Assistant:** A floating, context-aware AI button providing dynamic greetings, content cards, and insights based on the current screen and live data. Includes a `profile_reminder` mode that shows profile completion gaps with personalized messages and "Fix" buttons navigating to the correct questionnaire step. Insight cards are tappable with deep navigation links (profile completion → questionnaire step, match rate → swipe stats, pool impact → edit profile, response rate → unanswered messages). Uses trigger-based refresh (`utils/insightRefresh.ts`) — insights only recalculate on real events (profile_change, swipe_session_end, filter_change, message_activity, daily), with AsyncStorage caching for instant loading. Feedback system (`utils/aiInsightFeedback.ts`) tracks thumbs up/down with persistent hiding after 3 dismissals. Cards show urgency border colors (red/green/grey) and animated slide-out on dismiss with toast notifications.
- **AI Profile Completion Reminders:** Centralized escalating reminder system via `ProfileReminderContext`. Three stages: (1) first reminder after 5 minutes of app usage, (2) second reminder 30 minutes after dismissing the first, (3) third/final reminder next day in-app + email via Supabase edge function `send-profile-reminder-email`. After the third dismissal, no more automatic reminders. Reminders auto-cancel if profile reaches 100% completion. Manual trigger via ProfileCompletionCard on Profile screen still available. State persisted in AsyncStorage with keys: `profileReminder_${userId}_stage`, `profileReminder_${userId}_firstDismissedAt`, `profileReminder_${userId}_nextDayDate`.
- **Roommate Interaction System:** Three types: Swipe Right (free), Super Interest (notifies recipient), and Cold Messaging (Elite only).
- **Profile Boost System:** Tier-based boosts (12-48 hours) increase profile visibility.
- **Listing Boost System:** Three tiers clearly separated — Quick Boost ($4.99/24h, placement only, no badge), Featured Boost ($9.99/72h, placement + Featured badge), Extended Featured ($19.99/7d, placement + Featured badge). `BOOST_OPTIONS` in `utils/hostPricing.ts` has `includesFeaturedBadge` and `badgeLabel` fields. `createBoostRecord()` generates `ListingBoost` records. Renter-facing ExploreScreen shows purple Featured badge on boost-featured listings. MyListingsScreen shows context-aware pills ("Boosted" vs "Featured"). Sort order: Featured boosted > Plain boosted > Normal listings.
- **AI Memory Layer:** Persistent swipe analytics via `utils/aiMemory.ts` — tracks total/right/left swipes, average match scores, cold conversations, response rates, and refinement question history. `recordSwipe()` called after every swipe in RoommatesScreen, `recordMessageActivity()` after every sent message in ChatScreen. Micro-question triggers fire every 25 right swipes (with 3-hour cooldown) using questions from `utils/aiMicroQuestions.ts`.
- **Identity Verification:** Options for phone (real Supabase OTP in production, dev shortcut in dev mode), government ID, social media, and optional background/income checks for Elite users. Dev shortcuts available via `isDev` flag.
- **References System:** ProfileScreen shows references section with author name, relationship type, star rating, review text, and verified badge. Users can request references via email. Reference count badge shown on swipe cards.
- **Background Check:** One-time $9.99 purchase on ProfileScreen. Status tracked (none/pending/clear/flagged). Green shield badge on swipe cards for cleared users. Dev shortcut to mark as cleared.
- **Personality Quiz:** 5-question personality questionnaire step (conflict resolution, energy level, space preference, schedule style, social preference). Results feed into `calculatePersonalityScore()` in matching algorithm with 15% weighting.
- **Onboarding Tutorial:** Swipeable tutorial for new users.
- **App Diagnostics:** Hidden screen for health checks.
- **Read Receipts:** For Elite users.
- **Who Liked You:** For Plus/Elite users.

Animations are handled by React Native Reanimated, gestures by React Native Gesture Handler, and state management utilizes React Context API and AsyncStorage.

## Backend (Supabase)

Supabase serves as the comprehensive backend, providing:
- **Auth**: Email/password authentication.
- **Database**: PostgreSQL with Row Level Security (RLS) enabled across all tables for users, profiles, listings, matches, messages, subscriptions, and more.
- **Realtime**: Subscriptions for messages and notifications.
- **Storage**: Buckets for profile and listing photos.
- **Supabase Edge Functions**: For Stripe webhook handling.

All screens prioritize Supabase data access, with AsyncStorage as a fallback cache. Coordinate data is standardized and normalized.

## Authentication & Authorization

Supabase Auth manages user authentication, with an `AuthContext` handling session management and role-based access for `renter` and `host` roles. A mandatory 2-step onboarding flow (Profile Creation, Plan Selection) gates access for new users post-signup.

## Subscription & Paywall System

The application features tiered subscription plans for both renters (Basic, Plus, Elite) and hosts (Free $0/Starter $19.99/Pro $49.99/Business $99), including one-time purchases. A `PaywallSheet` component prompts users for upgrades when limits are reached. Billing cycles include monthly, 3-month, and annual options. Dedicated screens for Renter Subscription, Host Subscription (`HostSubscriptionScreen` with 4 plan cards, agent verification add-on), Listing Boost (`ListingBoostScreen` with Quick Boost $4.99/24h placement-only, Featured Boost $9.99/72h placement+badge, Extended Featured $19.99/7d placement+badge + explainer box + free boost banner), and Manage Subscription provide detailed plan information, upgrade/downgrade options, and billing history. Host plan limits: Free=1 listing, Starter=1, Pro=5, Business=15 (+$5/listing overage). Free plan is the default for new hosts — no payment required. Free plan hosts cannot access: renter group browsing, AI assistant, listing boosts, compatibility scores, or verified host badge. `utils/hostPricing.ts` centralizes plan constants and helpers with `isFreePlan()` utility. `HostPlanBadge` component shows plan tier in dashboard header (gray for Free). Listing cap checks enforced in MyListingsScreen, CreateEditListingScreen, and HostDashboardScreen quick actions. Free plan hosts see a dismissible upgrade banner (24hr cooldown) on the dashboard. ListingBoostScreen shows a locked state for free plan hosts. RoomdrAISheet shows locked AI state for free plan host contexts.

## Data Layer

The data layer uses Supabase PostgreSQL, supported by local AsyncStorage for caching. TypeScript interfaces define core models like `User`, `RoommateProfile`, `Property`, `Group`, `GroupMember`, `Conversation`, `Message`, `Match`, and `InterestCard`. Service files abstract database operations.

**Group System:** Two group types — `roommate` (renter-only swipe/join groups) and `listing_inquiry` (renter group + host in one chat, created via "Inquire Together" on listing cards). `GroupMember` tracks `role` (admin/member), `isHost`, and `status` (active/pending/left/removed). Inquiry groups can be archived (read-only). `groupService.ts` provides all group CRUD, membership, archive, accept/decline operations.

**Address Reveal System:** Full property addresses are hidden until the host accepts an inquiry. Before acceptance, renters see neighborhood + city only with a lock icon. After acceptance: full address revealed with coral flash animation, "Get Directions" link opens Maps, and system message confirms the reveal. Host sees Accept/Decline action bar at top of inquiry chat. Declined inquiries show status and offer archive. `formatLocation()` in `matchingAlgorithm.ts` accepts `revealed` param. ExploreScreen listing cards always pass `revealed: false`. DB fields: `groups.inquiry_status` (pending/accepted/declined), `groups.address_revealed` (boolean). Migration: `008_inquiry_status.sql`.

## UI/UX and Branding

A consistent dark theme with specific color palettes is used throughout the application. The `RoomdrLogo` component renders the brand logo using `react-native-svg` and `expo-linear-gradient`, featuring coral-red gradients and white.

## Location System

The application supports over 10 US cities with a centralized location data system and a `LocationPicker` component. A `CityContext` synchronizes city selections across tabs, persisting data via AsyncStorage. Comprehensive match filters (Budget, Move-in Date, Room Type, Lifestyle, Search Radius, Minimum Compatibility) are persistently stored and displayed as dismissible chips.

## Technical Decisions

Key technical decisions include Babel module resolver for simplified imports, platform-specific UI adaptations, performance optimizations via React Native's New Architecture, React Compiler, and Reanimated, and robust error handling through an error boundary component.

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
- `react-native-maps`
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