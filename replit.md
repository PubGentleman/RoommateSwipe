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
- **Listing Boost System:** Tier-based boosting options for hosts (6h/$2.99, 12h/$4.99, 24h/$7.99) and renters to increase visibility. Free boosts: Plus=12h, Elite=24h, Host Starter/Pro=12h, Business=24h. Fair rotation via `utils/boostRotation.ts` (30-min time slots + viewer ID hash). Renter boost options in `utils/boostUtils.ts` (`RENTER_BOOST_OPTIONS`). Host boost options in `utils/hostPricing.ts` (`BOOST_OPTIONS`). Stripe price IDs in `constants/stripePrices.ts` (`BOOST_PRICE_IDS`).
- **Address Autocomplete & Transit Auto-Fill:** Streamlined listing creation with `react-native-google-places-autocomplete` for address and auto-detection of nearby transit stops via Google Places API.
- **AI Memory Layer:** Tracks user interactions to refine AI suggestions.
- **Host Type Differentiation:** Hosts select their type during onboarding (Individual, Company, or Agent). Each type has different profile cards, listing badges, and contact labels. Individual hosts show match scores; Company/Agent hosts show type-specific badges. Host type is locked after a 7-day grace period; changes require contacting support. Settings: `screens/host/onboarding/HostTypeSelectScreen.tsx`, `HostCompanySetupScreen.tsx`, `HostAgentSetupScreen.tsx`. Utils: `utils/hostTypeUtils.ts`.
- **Identity Verification:** Supports phone, government ID (via Stripe Identity SDK), social media, and optional background/income checks.
- **References System:** Users can request and display references.
- **Personality Quiz:** A 5-question quiz integrated into the matching algorithm.
- **Universal Purchase Confirmation Modal:** A reusable `PurchaseConfirmModal` component (`components/modals/PurchaseConfirmModal.tsx`) replaces all native `Alert.alert`/`window.confirm` payment dialogs. Handles three purchase types: subscriptions (host plans), one-time payments (outreach packages), and credit top-ups (extra sends). All purchasable items are centralized in `constants/purchaseConfig.ts` with configs for host plans, outreach packages, and outreach credits. Wired into `HostSubscriptionScreen` (plan upgrades) and `BrowseRenterGroupsScreen` (credit unlocks).

- **Collapsible/Sticky Headers:** All main screens implement a collapsible header pattern using `react-native-reanimated`. The top title bar stays pinned while secondary content (city pills, tabs, quick filters, profile hero) collapses/fades on scroll. Applied to: ExploreScreen (120px), HostDashboardScreen (50px), MessagesScreen (50px), ProfileScreen (200px), and GroupsScreen (52px). Pattern: `useAnimatedScrollHandler` + `useAnimatedStyle` with `interpolate` for translateY, opacity, and maxHeight. ProfileScreen hero is fully role-aware: renter shows coral gradient, Matches/Likes/Super Likes stats, and Boost Profile button; host shows purple gradient, Listings/Inquiries/Active stats, and Manage Plan button. Role badge color adapts (coral for renter, purple for host). Stats refresh on every tab focus via `useFocusEffect`.

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

The application features tiered subscription plans for renters (Basic, Plus, Elite) and hosts (Free, Starter, Pro, Business), alongside one-time purchases. Stripe handles all payment processing via dedicated platform-specific hooks and Supabase Edge Functions. Both renter and host subscription screens share a uniform design language: eyebrow badge hero section, billing cycle toggle chips, plan cards with tier badges, big price display, feature checklists with check/x icons, and styled CTA buttons. Renter plans use coral accent (#ff6b5b), host plans use purple (#7B5EA7). Upgrade confirmations use the shared `PurchaseConfirmModal` component.

## Data Layer

The data layer uses Supabase PostgreSQL, complemented by local AsyncStorage for caching. TypeScript interfaces define core models such as `User`, `RoommateProfile`, `Property`, `Group`, `Conversation`, `Message`, `Match`, and `InterestCard`. A centralized `listingService.ts` handles Supabase CRUD operations for listings, mapping data to TypeScript types.

**Group System:** Supports `roommate` groups and `listing_inquiry` groups. Groups can be linked to a listing, affecting member limits. Plan-based limits apply to group creation and standalone member counts. `CreateGroupScreen` and `GroupsScreen` facilitate group creation and management.

**Group Property Search & Linking:** A reusable `GroupPropertySearchModal` allows property search for linking to groups.

**Group Invites System:** Three invite methods are supported: from matches, shareable code, and listing interest. A `GroupInviteScreen` manages invites and join requests.

**Group Logic Rules:** Includes admin promotion before leaving, member removal, discoverable groups for listings, and join requests.

**Host Proactive Group Outreach:** Hosts on Starter+ plans can browse discoverable renter groups and send outreach messages. Daily caps: Starter 3/day, Pro 5/day, Business 10/day. Hourly limits: Starter 2/hr, Pro 3/hr, Business 5/hr. 30-day per-group cooldown (configurable via `planLimits.ts`), 50-char minimum, auto-suspend after 3 reports. Paid credit packs ($4.99/+3, $12.99/+10) available when daily cap is hit. Service: `services/hostOutreachService.ts`, constants: `constants/planLimits.ts`, screen: `screens/host/BrowseRenterGroupsScreen.tsx`.

**Host Plan Restriction System:** Centralized plan limits in `constants/planLimits.ts` with `PLAN_LIMITS` config covering Free/Starter/Pro/Business tiers. Gate helpers in `utils/planGates.ts` (`canAccessAnalytics`, `canViewFullGroupProfile`, `canUseCompanyBranding`, `getNextUpgradePlan`). Reusable `LockedFeatureWall` component (`components/host/LockedFeatureWall.tsx`) renders lock icon, feature description, required plan badge, and upgrade CTA. Screen-level enforcement: `HostAnalyticsScreen` (Pro+ required), `BrowseRenterGroupsScreen` (Starter+ required), `CreateEditListingScreen` (fail-closed listing cap check — Free=1, Starter=5, Pro/Business=unlimited). Listing cap enforced via `canAddListingCheck` in `utils/hostPricing.ts`.

**Host Analytics (Basic vs Advanced):** `analyticsLevel` in `planLimits.ts` controls tier: `'none'` (Free/Starter, locked), `'basic'` (Pro), `'advanced'` (Business). Basic shows overview grid, status pills, conversion funnel with amber EST badges on estimated metrics, per-listing inquiry breakdown, and 30-day trend. Advanced adds: real listing views (via `listing_views` table + `recordListingView()` in listingService), renter demographics (budget/move-in/lifestyle tags), outreach performance, 30/90-day toggle, and CSV export. Company hosts additionally see: vacancy/occupancy rates, projected revenue, avg days to fill, portfolio comparison table, and portfolio CSV export. Agent hosts see: response time tracker, listing health scorecards (0-100 score), and client report CSV export. View tracking: `ExploreScreen` calls `recordListingView()` on listing open; one impression per renter per listing per calendar day (DB UNIQUE constraint). Migration: `014_listing_views.sql`.

**Renter Plan Restriction System:** Centralized renter plan limits in `constants/renterPlanLimits.ts` with `RENTER_PLAN_LIMITS` config covering Free/Plus/Elite tiers. Gate functions: `canSwipe(plan, count)`, `canJoinGroup(plan, count)`. Shared `normalizeRenterPlan()` maps legacy `'basic'` → `'free'`. Gate helpers in `utils/renterPlanGates.ts` (`canSeeWhoLiked`, `canSeeMatchBreakdown`, `canBrowseIncognito`, `hasProfileBoost`, `hasReadReceipts`, `hasAdvancedFilters`, `hasVerifiedBadge`, `hasPriorityInSearch`, `hasDedicatedSupport`). Purchase configs in `constants/purchaseConfig.ts` (`RENTER_PLAN_CONFIGS` for Plus/Elite). Subscription screen: `screens/shared/PlansScreen.tsx` — uses coral accent, stacked plan cards with plan icons, feature rows with per-feature icons, billing cycle toggle (monthly/3-month/annual), Best Value badge on Elite, Current Plan banner, `PurchaseConfirmModal` for upgrades. Pricing: Plus $14.99/mo, Elite $29.99/mo (discounts for 3-month/annual). Free tier limits: 10 swipes/day, 1 group. Plus: unlimited swipes, 3 groups. Elite: unlimited everything + boost/incognito/read receipts.

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