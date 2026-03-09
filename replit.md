# Overview

Roomdr is a React Native mobile application aiming to be the "Airbnb for roommates." It connects renters and hosts, streamlining the housing and roommate search process. The platform offers role-based navigation, swipe-based roommate matching, property listings, group formation, and secure messaging. Its core purpose is to capture a significant share of the roommate search market by providing a comprehensive and intuitive solution for finding roommates and properties.

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

Roomdr features a points-based compatibility algorithm (0-100 score) using 14 weighted factors, including location, budget, and lifestyle. Date of Birth is used for Zodiac sign compatibility.

## Frontend Architecture

The application is built with React Native and Expo using TypeScript, utilizing React Navigation for role-based access (Renter, Host, Agent/Landlord) and a theme system supporting light/dark modes.

**Key Features:**
- **Renter:** Swipe-based matching, 1-on-1 messaging, group management, property exploration with advanced filters and map/list views, saved properties, profile view tracking, AI Match Assistant, animated match celebration, report/block system, notification feed, profile completion indicator, mutual interest flow (Interest Cards and Super Interest), and cold messaging (Elite).
- **Host:** Full host dashboard with statistics, listing management (create, edit, delete, pause, mark rented), dedicated Inquiries screen for interest card management, inquiry-based analytics, roommate matching (same UI as renters), and role switching.

**User Experience Enhancements:**
- **Match Celebration:** An animated full-screen modal for mutual likes.
- **Profile Questionnaire:** A 14-step guided questionnaire with progress tracking, per-step validation (all required fields enforced before advancing), separate Noise Tolerance screen, and housing preferences including private bathroom and bathroom count.
- **Report/Block System:** Functionality to report or block users.
- **Notification System:** Context-based, app-wide notifications with real-time toast alerts.
- **Profile Completion:** A component tracking progress across weighted profile fields.
- **Identity Verification:** Users can verify identity via phone, government ID, social media, with optional background and income checks for elite users.
- **Onboarding Tutorial:** A swipeable tutorial for new users.
- **App Diagnostics:** Hidden diagnostic screen (tap "My Profile" title 5 times) with 10 automated health checks covering auth, navigation, theme, billing, and profile integrity.
- **Roomdr AI Assistant:** A floating coral-red CPU button (`AIFloatingButton`) positioned on every renter screen (Match, Groups, Explore, Messages, Profile) that opens a context-aware AI bottom sheet. The sheet dynamically adapts greetings, content cards, and insights based on the current screen context and live data (match compatibility, conversation stats, group analysis, profile completion, filter guidance). Supports 6 screen contexts with a context pill indicator in the header.
- **Read Receipts:** Elite users can see message read status.
- **Who Liked You:** Plus/Elite users can view received interest cards.
- **Roommate Interaction System:** Three interaction types: Swipe Right (free, mutual match required), Super Interest ($0.99/each for Basic, 5/mo free for Plus, unlimited for Elite — immediately notifies recipient), and Cold Messaging (Elite only, 3/mo — messages non-matches with banner indicator). Match types tracked as `'mutual' | 'super_interest' | 'cold'` on Match and Conversation models. MessagesScreen shows colored badges per match type (coral "Matched", gold "Super Interest", purple "Direct"). ChatScreen shows cold message banner and blocks non-Elite users from messaging non-matches. Upsell modals for Super Interest and cold message upgrade.

Animations are handled by React Native Reanimated, gestures by React Native Gesture Handler, and state is managed by React Context API and AsyncStorage.

## Authentication & Authorization

Mock authentication supports role-based navigation and conditional access for `renter` and `host` roles. Privacy settings and account deletion are implemented.

**Post-Signup Onboarding Flow:** After signup, users must complete a mandatory 2-step onboarding before accessing the main app:
1. **Profile Creation** — 13-step questionnaire (photos, bio, location, lifestyle preferences)
2. **Plan Selection** — Choose subscription tier (Basic/Plus/Elite for renters, Starter/Pro/Business for hosts) with billing cycle options

The `onboardingStep` field on the User model (`'profile' | 'plan' | 'complete'`) gates access in `RootNavigator`. Existing/login users default to `'complete'`.

## Subscription & Paywall System

**Renter Tiers:** Basic (Free), Plus, and Elite. Includes one-time purchases like Super Interest.
**Host Tiers:** Starter (Free), Pro, and Business. Includes one-time purchases like Listing Boost and Host Verification Badge.

A `PaywallSheet` component handles subscription prompts when users hit plan limits. `PlanBadge` components indicate user tiers. `AuthContext` includes functions for managing host plans and purchases.

**Billing Cycles:** Monthly, 3-Month, and Annual options for both renter and host subscriptions. 3-month saves 10%, annual saves 17%. Stripe price ID constants are mapped per plan/cycle (placeholder IDs for future backend integration). `BillingCycle` type: `'monthly' | '3month' | 'annual'`.

**Renter Subscription Screen (`PlansScreen.tsx`):** Custom header (nav header hidden), hero with gradient accent text, 7-day trial banner (Basic users), tier comparison strip (3 tiles with tap-to-scroll and save badges), 3-option billing toggle (Monthly/3 Months/Annual) with LinearGradient, "Today's Usage" card with progress bars (Interest Cards, Rewinds, Super Likes), three plan cards (Basic ghost CTA, Plus coral "MOST POPULAR" with trial CTA, Elite gold "BEST VALUE"), scheduled change/reactivation banner, and fine-print footer. All upgrade/downgrade/cancel/reactivate logic wired to AuthContext.

**Host Pricing Screen (`HostPricingScreen.tsx`):** Same 3-option billing toggle, tier strip with save badges, plan cards with cycle-aware pricing notes and CTAs.

**ManageSubscription Screen (`ManageSubscriptionScreen.tsx`):** Shows current plan + billing cycle, next renewal date + amount, billing history (last 3 charges), Cancel Plan button with confirmation bottom sheet ("Keep My Plan" primary, "Cancel Anyway" outline). Cancellation sets `status: 'cancelling'` (cancel_at_period_end). Resubscribe option shown when cancelling. Accessible from ProfileScreen "Manage Subscription" row (visible for paid plan users). Cancelling banner shown on ProfileScreen.

## Data Layer

The data layer uses mock data and TypeScript interfaces for models such as `RoommateProfile`, `Property`, `Group`, `Conversation`, `Message`, `Match`, `Application`, and `InterestCard`. Mock data is extensive, covering 11 major US cities and various entities, with versioning for automatic re-seeding.

## Dark Theme UI

The application uses a consistent dark theme with specific color palettes for backgrounds, cards, accents, and text, ensuring a cohesive visual experience across all screens.

## Branding

The `RoomdrLogo` component renders the brand logo using `react-native-svg` and `expo-linear-gradient`, with variants for different layouts and sizes. Brand colors are coral-red gradients and white.

## Location System

The application supports over 10 US cities with a centralized location data system. A `LocationPicker` component provides cascading selection. Location filtering is applied to searches. A shared `CityContext` synchronizes city selection across Match, Groups, and Explore tabs, persisting selections via AsyncStorage.

Match filters are comprehensive, including Budget Range, Move-in Date, Room Type, Lifestyle, Search Radius, and Minimum Compatibility, all persistently stored and displayed as dismissible chips.

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
- `react-native-webview` (for web-based maps like Leaflet/OpenStreetMap)

**Utilities:**
- `expo-linking`
- `expo-web-browser`
- `expo-constants`
- `expo-splash-screen`
- `expo-image`
- `react-native-keyboard-controller`

**Monetization:**
- `AdBanner` component (placeholder for Google AdMob)

**Development Tools:**
- `typescript`
- `eslint`
- `prettier`
- `babel-plugin-module-resolver`