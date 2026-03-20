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

**Stripe Payment Gating:** All paid plan upgrades are gated behind Stripe payment processing. The flow is: user selects plan → `processPayment()` calls `create-subscription` edge function → Stripe PaymentSheet is presented on native (web shows fallback message) → on success, local state is updated via AuthContext. Platform-specific hooks: `hooks/useStripePayment.native.ts` (Stripe SDK) and `hooks/useStripePayment.web.ts` (graceful fallback). Price ID mapping in `constants/stripePrices.ts` — placeholder IDs need replacing with real Stripe price IDs. The `create-subscription` edge function validates auth, creates/retrieves Stripe customers, and returns a PaymentIntent client secret. Subscription IDs are propagated back to AuthContext and persisted to Supabase.

## Data Layer

The data layer uses Supabase PostgreSQL, complemented by local AsyncStorage for caching. TypeScript interfaces define core models such as `User`, `RoommateProfile`, `Property`, `Group`, `Conversation`, `Message`, `Match`, and `InterestCard`.

**Listing Service (`services/listingService.ts`):** Centralized Supabase CRUD for the `listings` table. Exports `mapListingToProperty()` to convert Supabase rows (snake_case) to the `Property` TypeScript type (camelCase). All screens (ExploreScreen, HostDashboardScreen, MyListingsScreen, HostAnalyticsScreen, CreateEditListingScreen) use this centralized mapper instead of inline mapping. Supabase-first with StorageService (mock data) fallback for demo mode.

**Group System:** Supports `roommate` groups (renter-only) and `listing_inquiry` groups (renter group + host in a chat). `GroupMember` tracks role, host status, and member status. Groups can optionally be linked to a listing (`listing_id`) — when linked, a pinned listing card appears at the top of the group chat and the member limit becomes `bedrooms + 1` (e.g., a 3BR listing allows 4 members). When no listing is linked, plan-based limits apply. Plan-based group creation limits: Renter (Basic: 1, Plus: 3, Elite: 10), Host (Starter: 1, Pro: 3, Business: unlimited). Standalone member limits per group: Renter (Basic: 3, Plus: 5, Elite: 6), Host (Starter: 4, Pro: 6, Business: 6) — capped at 6 across all top-tier plans. `CreateGroupScreen` supports standalone creation and optional property linking. GroupsScreen inline Create tab also supports group creation with property linking. Service: `services/groupService.ts` (includes `getGroupLimit`, `getMemberLimit`, `getGroupWithListing`, group message CRUD, and real-time subscription).

**Group Property Search & Linking:** A reusable `GroupPropertySearchModal` (`components/GroupPropertySearchModal.tsx`) enables property search with live results, debounced text search (title, address, city, neighborhood), and filter chips (city, price range, bedrooms). Used in CreateGroupScreen for optional property linking during group creation, and in ChatScreen for adding/changing linked properties post-creation via `linkListingToGroup()` in groupService. Selecting a listing pins it to the group chat header.

**Group Invites System:** Three invite methods — (A) Invite from Matches: admin invites users they've matched/chatted with, (C) Shareable Code: 6-character invite code anyone can use to join, (D) Listing Interest: host invites renters who swiped their linked listing. `GroupInviteScreen` (`screens/shared/GroupInviteScreen.tsx`) provides a tabbed interface for all three methods plus a "Requests" tab for join requests. Join-by-code entry is available in GroupsScreen's "My Groups" tab. Pending invites appear as cards at the top of the "My Groups" tab with accept/decline actions. ChatScreen shows an invite button (user-plus icon) in group chat headers. All invite methods enforce member limits. Service functions: `getInvitableMates`, `sendGroupInvite`, `respondToInvite`, `getMyPendingInvites`, `getInviteCode`, `regenerateInviteCode`, `disableInviteCode`, `joinGroupByCode`, `getRentersInterestedInListing`. Requires `group_invites` table and `invite_code`/`invite_code_enabled` columns on `groups` table (pending SQL migration).

**Group Logic Rules:** (1) Admin must promote another member before leaving — `PromoteAdminScreen` (`screens/shared/PromoteAdminScreen.tsx`) shows a member picker; if the admin is the last member, the group is deleted. (2) Admin can remove members via `removeMember()`, which sends an in-app notification. (3) Pinned listing cards in group chats show a red "RENTED" badge when `listing.status === 'rented'`. (4) Groups have a `discoverable` toggle (off by default) managed via the Requests tab in GroupInviteScreen — when enabled, ExploreScreen listing cards show "X people forming a group" badge linking to `ListingGroupsScreen` (`screens/shared/ListingGroupsScreen.tsx`) where users can request to join. Service functions: `promoteMember`, `removeMember`, `setGroupDiscoverable`, `getDiscoverableGroupsForListing`, `requestToJoinGroup`, `getJoinRequests`, `respondToJoinRequest`. Requires `discoverable` column on `groups` table and `group_join_requests` table (pending SQL migration).

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